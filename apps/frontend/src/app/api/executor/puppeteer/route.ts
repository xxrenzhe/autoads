import type { NextRequest } from 'next/server'
import puppeteer, { LaunchOptions } from 'puppeteer'

export const dynamic = 'force-dynamic'

type ExecBody = {
  url: string
  proxy?: string
  referer?: string
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
  timeoutMs?: number
  userAgent?: string
  screenshot?: boolean
  fullPage?: boolean
}

function classify(content: string, status: number | undefined): string | null {
  const l = content.toLowerCase()
  if (status === 403) return '403_blocked'
  if (status === 429) return 'rate_limited'
  if (l.includes('captcha') || l.includes('recaptcha')) return 'captcha_detected'
  if (l.includes('cloudflare') && l.includes('checking your browser')) return 'browser_required'
  return null
}

export async function POST(req: NextRequest) {
  let browser: any = null
  const started = Date.now()
  try {
    const body = (await req.json()) as ExecBody
    const url = String(body.url || '')
    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ ok: false, classification: 'invalid_url' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    const waitUntil = (body.waitUntil || 'domcontentloaded') as any
    const timeout = Math.max(1000, Math.min(60000, Number(body.timeoutMs || 20000)))

    const launchArgs: string[] = ['--no-sandbox', '--disable-setuid-sandbox']
    let proxyUser = ''
    let proxyPass = ''
    if (body.proxy) {
      try {
        const u = new URL(body.proxy)
        launchArgs.push(`--proxy-server=${u.protocol}//${u.host}`)
        if (u.username || u.password) { proxyUser = decodeURIComponent(u.username); proxyPass = decodeURIComponent(u.password) }
      } catch {}
    }
    const launchOptions: LaunchOptions = { headless: 'new', args: launchArgs }
    browser = await puppeteer.launch(launchOptions)
    const page = await browser.newPage()
    if (proxyUser || proxyPass) {
      try { await page.authenticate({ username: proxyUser, password: proxyPass }) } catch {}
    }
    if (body.userAgent) { await page.setUserAgent(body.userAgent) }
    await page.setExtraHTTPHeaders({ ...(body.referer ? { referer: body.referer } : {}) })
    let httpStatus: number | undefined
    page.on('response', (resp) => { if (!httpStatus) { try { httpStatus = resp.status() } catch {} } })
    const resp = await page.goto(url, { waitUntil, timeout })
    if (resp) { httpStatus = resp.status() }
    const text = await page.content()
    const cls = classify(text, httpStatus)
    const ok = !cls
    const finalUrl = page.url()
    let screenshotBase64: string | undefined
    if (body.screenshot) {
      const buf = await page.screenshot({ fullPage: !!body.fullPage, type: 'jpeg', quality: 70 }) as Buffer
      screenshotBase64 = buf.toString('base64')
    }
    try { await page.close() } catch {}
    try { await browser.close() } catch {}
    browser = null
    return new Response(JSON.stringify({ ok, classification: cls || 'browser_success', httpStatus, finalUrl, durationMs: Date.now() - started, screenshotBase64 }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    try { if (browser) await browser.close() } catch {}
    const msg = String(e?.message || e)
    let classification = 'browser_failed'
    const lm = msg.toLowerCase()
    if (lm.includes('timeout')) classification = 'browser_timeout'
    return new Response(JSON.stringify({ ok: false, classification, error: msg, durationMs: Date.now() - started }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
}
