import express from 'express'
import { pool } from './pool.js'
import client from 'prom-client'

const app = express()
app.use(express.json({ limit: '1mb' }))

app.get('/healthz', (req, res) => res.sendStatus(200))
app.get('/health', (req, res) => res.sendStatus(200))
app.get('/readyz', (req, res) => res.sendStatus(200))
// Prometheus metrics
const registry = new client.Registry()
client.collectDefaultMetrics({ register: registry })
const chkCounter = new client.Counter({ name: 'be_checks_total', help: 'check-availability total', registers: [registry] })
const clickCounter = new client.Counter({ name: 'be_clicks_total', help: 'simulate-click total', registers: [registry] })
const failCounter = new client.Counter({ name: 'be_failures_total', help: 'total failures', registers: [registry] })
const runningGauge = new client.Gauge({ name: 'be_running_tasks', help: 'running tasks', registers: [registry] })
const durHist = new client.Histogram({ name: 'be_task_duration_ms', help: 'task duration ms', registers: [registry], buckets: [50,100,200,500,1000,2000,5000,10000,15000] })
app.get('/metrics', async (req, res) => { res.set('Content-Type', registry.contentType); res.end(await registry.metrics()) })

// KISS: no real browser yet; this is a skeleton with minimal behaviors
app.post('/api/v1/browser/parse-url', (req, res) => {
  const { url } = req.body || {}
  try {
    const u = new URL(url)
    const host = u.hostname
    const parts = host.split('.')
    const brand = parts.length >= 2 ? parts[parts.length - 2] : host
    res.json({ ok: true, hostname: host, brand })
  } catch {
    res.status(400).json({ error: { code: 'INVALID_URL', message: 'Invalid URL' } })
  }
})

// --- Concurrency guard ---
const MAX_CONCURRENCY = Number(process.env.BROWSER_MAX_CONCURRENCY || 4)
let running = 0
function withSlot(fn) {
  return async (req, res) => {
    if (running >= MAX_CONCURRENCY) {
      res.set('Retry-After', '1')
      return res.status(503).json({ error: { code: 'OVERLOADED', message: 'Too many concurrent tasks' } })
    }
    running++
    runningGauge.set(running)
    try { await fn(req, res) } finally { running--; runningGauge.set(running) }
  }
}

// Enable stealth if using Playwright
const USE_PW = String(process.env.PLAYWRIGHT || '').toLowerCase() === '1'

// buildContextOptions moved to pool.js

async function gotoWithFingerprint(url, opts = {}) {
  const { timeoutMs = 8000, proxy, fingerprint } = opts
  const h = await pool.getContext({ fingerprint, proxy })
  const page = await h.context.newPage()
  let status = 0
  try {
    const resp = await page.goto(url, { timeout: Math.min(15000, Math.max(2000, timeoutMs)), waitUntil: 'domcontentloaded' })
    status = resp?.status() || 0
    return { ok: status >= 200 && status < 400, status }
  } finally { try { await page.close() } catch {}; await pool.release(h) }
}

app.post('/api/v1/browser/check-availability', withSlot(async (req, res) => {
  const { url, timeoutMs = 5000, method = 'HEAD' } = req.body || {}
  if (!url) return res.status(400).json({ error: { code: 'INVALID_ARGUMENT', message: 'url required' } })
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), Math.min(15000, Math.max(1000, timeoutMs)))
  try {
    chkCounter.inc()
    const t0 = Date.now()
    if (USE_PW) {
      const fp = (req.body && req.body.fingerprint) || {}
      const proxy = (req.body && req.body.proxy) || undefined
      const r = await gotoWithFingerprint(url, { timeoutMs, proxy, fingerprint: fp })
      durHist.observe(Date.now() - t0)
      clearTimeout(t)
      return res.json({ ...r, engine: 'playwright' })
    }
    const r = await fetch(url, { method, redirect: 'follow', signal: ctrl.signal })
    durHist.observe(Date.now() - t0)
    clearTimeout(t)
    res.json({ ok: r.ok, status: r.status, engine: 'fetch' })
  } catch (e) {
    failCounter.inc()
    clearTimeout(t)
    res.json({ ok: false, status: 0, error: String(e?.message || e) })
  }
}))

app.post('/api/v1/browser/simulate-click', (req, res) => {
  const { url, fingerprint, proxy } = req.body || {}
  if (!url) return res.status(400).json({ error: { code: 'INVALID_ARGUMENT', message: 'url required' } })
  const taskId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`
  tasks.set(taskId, { status: 'queued' })
  ;(async () => {
    tasks.set(taskId, { status: 'running' })
    try {
      const t0 = Date.now()
      const result = await simulateClick(url, { fingerprint, proxy, ...req.body })
      durHist.observe(Date.now() - t0)
      clickCounter.inc()
      tasks.set(taskId, { status: 'completed', result })
    } catch (e) {
      failCounter.inc()
      tasks.set(taskId, { status: 'failed', error: String(e?.message || e) })
    }
  })()
  res.status(202).json({ taskId, status: 'queued' })
})

app.post('/api/v1/browser/batch-execute', (req, res) => {
  const { tasks: items = [], concurrency = 2 } = req.body || {}
  const groupId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`
  for (const it of items) {
    const taskId = `${groupId}-${Math.random().toString(36).slice(2,6)}`
    tasks.set(taskId, { status: 'queued', groupId })
    ;(async () => {
      // naive limiter per-process using withSlot
      await withSlot(async () => {
        tasks.set(taskId, { status: 'running', groupId })
        try {
          const result = await simulateClick(it.url, { fingerprint: it.fingerprint, proxy: it.proxy })
          tasks.set(taskId, { status: 'completed', result, groupId })
        } catch (e) {
          tasks.set(taskId, { status: 'failed', error: String(e?.message || e), groupId })
        }
      })({},{ status:()=>({ json:()=>{} }), set:()=>{} }) // fake res for slot; internal use only
    })()
  }
  res.status(202).json({ accepted: items.length, taskGroupId: groupId })
})

// Tasks status endpoint (minimal)
const tasks = new Map()
app.get('/api/v1/browser/tasks/:id', (req, res) => {
  const st = tasks.get(req.params.id)
  if (!st) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'task not found' } })
  res.json(st)
})

const port = process.env.PORT || 8080
app.listen(port, () => console.log(`[browser-exec] listening on :${port}`))

// ---- helpers ----
async function simulateClick(url, opts = {}) {
  if (!USE_PW) return { ok: false, status: 0, error: 'playwright disabled' }
  const t0 = Date.now()
  const { timeoutMs = 10000, proxy, fingerprint, selector, wait = {}, dwellMs = 0 } = opts
  const h = await pool.getContext({ fingerprint, proxy })
  const page = await h.context.newPage()
  let status = 0
  try {
    const resp = await page.goto(url, { timeout: Math.min(15000, Math.max(2000, timeoutMs)), waitUntil: 'domcontentloaded' })
    status = resp?.status() || 0
    // try click first visible link or body
    const targetSel = selector || 'a[href]'
    let anchor = null
    try { anchor = await page.waitForSelector(targetSel, { timeout: 1500, state: 'visible' }) } catch {}
    const ct0 = Date.now()
    if (anchor) {
      await anchor.click({ trial: false, timeout: 2000 }).catch(()=>{})
    } else {
      await page.mouse.click(10 + Math.random()*100, 10 + Math.random()*50).catch(()=>{})
    }
    // optional wait strategy after click
    const until = (wait && wait.until) || 'domcontentloaded'
    const waitTimeout = Math.min(10000, Math.max(500, wait.timeoutMs || 1500))
    try {
      if (until === 'networkidle') {
        await page.waitForLoadState('networkidle', { timeout: waitTimeout })
      } else if (until === 'selector' && wait.selector) {
        await page.waitForSelector(wait.selector, { timeout: waitTimeout })
      } else {
        await page.waitForLoadState('domcontentloaded', { timeout: waitTimeout })
      }
    } catch {}
    if (dwellMs > 0) { await page.waitForTimeout(Math.min(5000, Math.max(100, dwellMs))) }
    const tNav = Date.now() - t0
    const tClick = Date.now() - ct0
    return { ok: status >= 200 && status < 400, status, timings: { navMs: tNav, clickMs: tClick } }
  } finally {
    try { await page.close() } catch {}
    await pool.release(h)
  }
}
