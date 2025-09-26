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
const ctxGauge = new client.Gauge({ name: 'be_pool_shared_contexts', help: 'shared contexts in use', registers: [registry] })
const rssGauge = new client.Gauge({ name: 'be_memory_rss_mb', help: 'process RSS in MB', registers: [registry] })
const capExhausted = new client.Counter({ name: 'be_capacity_exhausted_total', help: 'capacity exhausted events', registers: [registry] })
const resolveCounter = new client.Counter({ name: 'be_resolve_total', help: 'resolve-offer total', registers: [registry] })
app.get('/metrics', async (req, res) => { res.set('Content-Type', registry.contentType); res.end(await registry.metrics()) })

setInterval(() => {
  try {
    const s = pool.stats()
    ctxGauge.set(s.sharedContexts)
    rssGauge.set(s.memoryRssMb)
  } catch {}
}, 2000)

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

// Internal auth (optional)
const INTERNAL_TOKEN = (process.env.BROWSER_INTERNAL_TOKEN || '').trim()
function enforceInternal(req, res, next) {
  if (!INTERNAL_TOKEN) return next()
  const hdr = (req.headers['x-service-token'] || req.headers['authorization'] || '').toString()
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : hdr
  if (token === INTERNAL_TOKEN) return next()
  return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'internal token required' } })
}
app.use('/api/v1/browser', enforceInternal)

// Resolve an affiliate Offer URL to final landing page; return final URL, suffix, domain, brand
app.post('/api/v1/browser/resolve-offer', withSlot(async (req, res) => {
  if (!USE_PW) return res.status(400).json({ error: { code: 'PLAYWRIGHT_DISABLED', message: 'playwright disabled' } })
  const {
    url,
    waitUntil = 'networkidle',     // more耐心，适合多重跳转
    timeoutMs = 45000,             // 默认45s，上限60s
    stabilizeMs = 1200,            // URL稳定判定窗口
    headers = {},
    userAgent,
    proxyProviderURL
  } = req.body || {}
  if (!url) return res.status(400).json({ error: { code: 'INVALID_ARGUMENT', message: 'url required' } })
  resolveCounter.inc()
  const wUntil = ['domcontentloaded','load','networkidle'].includes(String(waitUntil)) ? String(waitUntil) : 'networkidle'
  const navTimeout = Math.min(60000, Math.max(2000, Number(timeoutMs)))
  const stabBudget = Math.max(0, Math.min(5000, Number(stabilizeMs)))

  async function pickWorkingProxy(providerUrl, maxProbe = 3) {
    try {
      const txt = await (await fetch(providerUrl)).text()
      const all = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      const candidates = all.slice(0, Math.max(1, Math.min(maxProbe, all.length)))
      for (const line of candidates) {
        const opt = toPlaywrightProxy(line)
        if (!opt) continue
        const h = await pool.getContext({ proxy: opt })
        const page = await h.context.newPage()
        let ok = false
        try {
          const resp = await page.goto('https://www.gstatic.com/generate_204', { timeout: 3000, waitUntil: 'load' })
          const sc = resp?.status() || 0
          ok = sc >= 200 && sc < 400
        } catch {}
        try { await page.close() } catch {}
        await pool.release(h)
        if (ok) return opt
      }
    } catch {}
    return undefined
  }

  let proxyOpt = undefined
  try {
    const provider = String(proxyProviderURL || process.env.PROXY_URL_US || '').trim()
    if (provider) {
      proxyOpt = await pickWorkingProxy(provider, 5)
    }
  } catch {}

  const fp = { userAgent: userAgent || process.env.SIMILARWEB_USER_AGENT || undefined }
  let h
  try { h = await pool.getContext({ proxy: proxyOpt, fingerprint: fp }) } catch (e) {
    if (String(e).startsWith('capacity_exhausted')) capExhausted.inc()
    return res.status(503).json({ error: { code: 'CAPACITY_EXHAUSTED', message: String(e?.message || e) } })
  }
  const page = await h.context.newPage()
  try {
    const hdrs = headers && typeof headers === 'object' ? headers : {}
    const keys = Object.keys(hdrs)
    if (keys.length) { try { await page.setExtraHTTPHeaders(hdrs) } catch {} }
    const t0 = Date.now()
    const resp = await page.goto(url, { timeout: navTimeout, waitUntil: wUntil })
    const status = resp?.status() || 0
    // collect redirect chain via request.redirectedFrom()
    const chain = []
    try {
      let reqObj = resp?.request?.()
      // safeguard when resp.request is a function per Playwright object model
      if (typeof reqObj === 'function') reqObj = resp.request()
      let cur = reqObj
      while (cur) {
        chain.push(cur.url())
        cur = cur.redirectedFrom?.()
      }
      chain.reverse()
    } catch {}

    // stabilize URL: ensure it stops changing for stabilizeMs window
    let current = page.url()
    let stableSince = Date.now()
    while (Date.now() - t0 < navTimeout && Date.now() - stableSince < stabBudget) {
      await new Promise(r => setTimeout(r, 300))
      const now = page.url()
      if (now !== current) { current = now; stableSince = Date.now() }
    }
    const stabilizeMsSpent = Date.now() - stableSince
    const finalHref = await page.evaluate(() => window.location && window.location.href || document.location.href)
    const u = new URL(finalHref)
    const finalUrl = `${u.origin}${u.pathname}${u.pathname.endsWith('/') ? '' : '/'}`
    const finalUrlSuffix = (u.search || '').replace(/^\?/, '')
    const domain = u.hostname
    const parts = domain.split('.')
    const brand = parts.length >= 2 ? parts[parts.length - 2] : domain
    return res.json({
      ok: status >= 200 && status < 400,
      status,
      finalUrl,
      finalUrlSuffix,
      domain,
      brand,
      via: proxyOpt ? 'proxy' : 'direct',
      chainLength: chain.length,
      chain,
      timings: { navMs: Date.now() - t0, stabilizeMs: stabilizeMsSpent }
    })
  } catch (e) {
    const msg = String(e?.message || e)
    if (/Timeout/i.test(msg)) {
      return res.status(504).json({ error: { code: 'RESOLVE_TIMEOUT', message: msg } })
    }
    return res.status(502).json({ error: { code: 'RESOLVE_FAILED', message: msg } })
  } finally {
    try { await page.close() } catch {}
    await pool.release(h)
  }
}))

app.post('/api/v1/browser/check-availability', withSlot(async (req, res) => {
  const { url, timeoutMs = 5000, method = 'HEAD', retries = 0, backoffMs = 150, proxyProviderURL } = req.body || {}
  if (!url) return res.status(400).json({ error: { code: 'INVALID_ARGUMENT', message: 'url required' } })
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), Math.min(15000, Math.max(1000, timeoutMs)))
  try {
    chkCounter.inc()
    const t0 = Date.now()
    const attempt = async () => {
      if (USE_PW) {
        // allow proxy provider
        let proxy = (req.body && req.body.proxy) || undefined
        if (!proxy && proxyProviderURL) {
          try {
            const txt = await (await fetch(String(proxyProviderURL))).text()
            const lines = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
            if (lines.length) proxy = toPlaywrightProxy(lines[(Math.random()*lines.length)|0])
          } catch {}
        }
        const fp = (req.body && req.body.fingerprint) || {}
        return await gotoWithFingerprint(url, { timeoutMs, proxy, fingerprint: fp })
      }
      const r = await fetch(url, { method, redirect: 'follow', signal: ctrl.signal })
      return { ok: r.ok, status: r.status, engine: 'fetch' }
    }
    let out = null, lastErr = null
    const n = Math.max(0, Math.min(3, Number(retries)))
    const backoff = Math.max(50, Math.min(1000, Number(backoffMs)))
    for (let i = 0; i <= n; i++) {
      try { out = await attempt(); break } catch (e) { lastErr = e }
      await new Promise(r => setTimeout(r, backoff * (i + 1)))
    }
    durHist.observe(Date.now() - t0)
    clearTimeout(t)
    if (!out) return res.json({ ok: false, status: 0, error: String(lastErr?.message || lastErr) })
    res.json({ ...out, engine: out.engine || (USE_PW ? 'playwright' : 'fetch') })
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

// JSON fetch via browser with optional proxy provider
app.post('/api/v1/browser/json-fetch', withSlot(async (req, res) => {
  if (!USE_PW) return res.status(400).json({ error: { code: 'PLAYWRIGHT_DISABLED', message: 'playwright disabled' } })
  const {
    url,
    headers = {},
    userAgent,
    waitUntil = 'domcontentloaded', // 'domcontentloaded' | 'load' | 'networkidle'
    timeoutMs = 20000,              // clamp 1s..30s
    proxyProviderURL,
    retries = 1,
    backoffMs = 200
  } = req.body || {}
  if (!url) return res.status(400).json({ error: { code: 'INVALID_ARGUMENT', message: 'url required' } })
  const wUntil = ['domcontentloaded','load','networkidle'].includes(String(waitUntil)) ? String(waitUntil) : 'domcontentloaded'
  const navTimeout = Math.min(30000, Math.max(1000, Number(timeoutMs)))

  async function pickWorkingProxy(providerUrl, maxProbe = 3) {
    try {
      const txt = await (await fetch(providerUrl)).text()
      const all = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      const candidates = all.slice(0, Math.max(1, Math.min(maxProbe, all.length)))
      for (const line of candidates) {
        const opt = toPlaywrightProxy(line)
        if (!opt) continue
        // quick probe to gstatic 204
        const h = await pool.getContext({ proxy: opt })
        const page = await h.context.newPage()
        let ok = false
        try {
          const resp = await page.goto('https://www.gstatic.com/generate_204', { timeout: 3000, waitUntil: 'load' })
          const sc = resp?.status() || 0
          ok = sc >= 200 && sc < 400
        } catch {}
        try { await page.close() } catch {}
        await pool.release(h)
        if (ok) return opt
      }
    } catch {}
    return undefined
  }

  const attempt = async () => {
    let proxyOpt = undefined
    try {
      const provider = String(proxyProviderURL || process.env.PROXY_URL_US || '').trim()
      if (provider) {
        // probe a few proxies; fallback to random if probe fails
        proxyOpt = await pickWorkingProxy(provider, 5)
        if (!proxyOpt) {
          const txt = await (await fetch(provider)).text()
          const lines = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
          if (lines.length) proxyOpt = toPlaywrightProxy(lines[(Math.random()*lines.length)|0])
        }
      }
    } catch (e) {
      // ignore provider errors; proceed without proxy
    }
    let h
    try {
      // pass userAgent via fingerprint; allow SIMILARWEB_USER_AGENT fallback
      const fp = { userAgent: userAgent || process.env.SIMILARWEB_USER_AGENT || undefined }
      h = await pool.getContext({ proxy: proxyOpt, fingerprint: fp })
    } catch (e) {
      if (String(e).startsWith('capacity_exhausted')) capExhausted.inc()
      throw new Error(String(e?.message || e))
    }
    const page = await h.context.newPage()
    try {
      // apply extra headers if provided
      const hdrs = headers && typeof headers === 'object' ? headers : {}
      const keys = Object.keys(hdrs)
      if (keys.length) { try { await page.setExtraHTTPHeaders(hdrs) } catch {} }
      const resp = await page.goto(url, { timeout: navTimeout, waitUntil: wUntil })
      const status = resp?.status() || 0
      let bodyText = ''
      try { bodyText = await page.evaluate(() => document.body && document.body.innerText || '') } catch {}
      let parsed = null
      try { parsed = JSON.parse(bodyText) } catch {}
      return { status, json: parsed, text: parsed ? undefined : bodyText, via: proxyOpt ? 'proxy' : 'direct' }
    } finally { try { await page.close() } catch {}; await pool.release(h) }
  }
  try {
    let lastErr = null
    const n = Math.max(0, Math.min(3, Number(retries)))
    const backoff = Math.max(50, Math.min(2000, Number(backoffMs)))
    for (let i = 0; i <= n; i++) {
      try { const out = await attempt(); return res.json(out) } catch (e) { lastErr = e }
      await new Promise(r => setTimeout(r, backoff * (i + 1)))
    }
    return res.status(502).json({ error: { code: 'BROWSER_FETCH_FAILED', message: String(lastErr?.message || lastErr) } })
  } catch (e) {
    return res.status(502).json({ error: { code: 'BROWSER_FETCH_FAILED', message: String(e?.message || e) } })
  }
}))

// Page signals: title and og:site_name (best-effort)
app.post('/api/v1/browser/page-signals', withSlot(async (req, res) => {
  const { url, timeoutMs = 8000 } = req.body || {}
  if (!url) return res.status(400).json({ error: { code: 'INVALID_ARGUMENT', message: 'url required' } })
  const timeout = Math.min(15000, Math.max(1000, timeoutMs))
  try {
    if (USE_PW) {
      const h = await pool.getContext({})
      const page = await h.context.newPage()
      try {
        const resp = await page.goto(url, { timeout, waitUntil: 'domcontentloaded' })
        const status = resp?.status() || 0
        const info = await page.evaluate(() => ({
          title: document?.title || '',
          siteName: (document.querySelector('meta[property="og:site_name"]')?.getAttribute('content')) || ''
        }))
        return res.json({ status, ...info })
      } finally { try { await page.close() } catch {}; await pool.release(h) }
    }
    // Fallback: plain fetch and regex parse
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeout)
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal })
    clearTimeout(t)
    const status = r.status
    const html = await r.text()
    const lower = html.toLowerCase()
    let title = ''
    const ti = lower.indexOf('<title>')
    if (ti >= 0) { const end = lower.indexOf('</title>', ti+7); if (end > ti) title = html.slice(ti+7, end) }
    let siteName = ''
    const ogi = lower.indexOf('property="og:site_name"')
    if (ogi >= 0) {
      const seg = html.slice(ogi)
      const m = seg.match(/content=["']([^"']+)["']/i)
      if (m && m[1]) siteName = m[1]
    }
    return res.json({ status, title, siteName })
  } catch (e) {
    return res.status(502).json({ error: { code: 'PAGE_SIGNALS_FAILED', message: String(e?.message || e) } })
  }
}))

// Debug stats endpoint
app.get('/api/v1/browser/stats', (req, res) => {
  try { return res.json(pool.stats()) } catch (e) { return res.status(500).json({ error: { code: 'STATS_FAILED', message: String(e?.message || e) } }) }
})

function toPlaywrightProxy(line) {
  try {
    let server = '', username = undefined, password = undefined
    if (line.includes('://')) {
      const u = new URL(line)
      server = `${u.protocol}//${u.hostname}:${u.port}`
      if (u.username) username = decodeURIComponent(u.username)
      if (u.password) password = decodeURIComponent(u.password)
    } else if (line.includes('@')) {
      const [cred, host] = line.split('@')
      const [user, pass] = cred.split(':')
      const [h, p] = host.split(':')
      server = `http://${h}:${p}`
      username = user; password = pass
    } else {
      const [h, p] = line.split(':')
      server = `http://${h}:${p}`
    }
    return { server, username, password }
  } catch { return undefined }
}

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
