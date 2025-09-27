import playwright from 'playwright-extra'

const USE_PW = String(process.env.PLAYWRIGHT || '').toLowerCase() === '1'
// Optional stealth plugin (best-effort); not required for JSON fetch
;(async () => { if (USE_PW) { try { const m = await import('playwright-extra-plugin-stealth'); playwright.use(m.default()); } catch {} } })()

let MAX_CONTEXTS = Number(process.env.BROWSER_MAX_CONTEXTS || 12)
let MAX_MEMORY_MB = Number(process.env.BROWSER_MAX_MEMORY_MB || 1024)

function buildContextOptions(fp = {}) {
  const {
    locale = 'en-US',
    timezoneId = 'UTC',
    viewport = { width: 1366, height: 768 },
    geolocation,
    colorScheme = 'light',
    userAgent,
  } = fp
  const uaList = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  ]
  const ua = userAgent || uaList[Math.floor(Math.random() * uaList.length)]
  return { locale, timezoneId, userAgent: ua, viewport, geolocation, permissions: geolocation ? ['geolocation'] : [], colorScheme }
}

class BrowserPool {
  constructor() { this.sharedBrowser = null; this.sharedContexts = 0 }
  async getContext({ fingerprint, proxy } = {}) {
    if (!USE_PW) throw new Error('playwright disabled')
    const launchOpts = { headless: true }
    if (proxy && proxy.server) {
      launchOpts.proxy = proxy
      const browser = await playwright.chromium.launch(launchOpts)
      const ctx = await browser.newContext(buildContextOptions(fingerprint))
      await ctx.addInitScript(this._patch)
      return { browser, context: ctx, isEphemeral: true }
    }
    // capacity guard: memory
    const rssMb = (process.memoryUsage().rss / (1024*1024)) | 0
    if (rssMb >= MAX_MEMORY_MB) throw new Error('capacity_exhausted:memory')
    if (!this.sharedBrowser) {
      this.sharedBrowser = await playwright.chromium.launch(launchOpts)
      this.sharedContexts = 0
    }
    if (this.sharedContexts >= MAX_CONTEXTS) throw new Error('capacity_exhausted:contexts')
    const ctx = await this.sharedBrowser.newContext(buildContextOptions(fingerprint))
    await ctx.addInitScript(this._patch)
    this.sharedContexts++
    return { browser: this.sharedBrowser, context: ctx, isEphemeral: false }
  }
  async release({ browser, context, isEphemeral }) {
    try { await context.close() } catch {}
    if (isEphemeral) { try { await browser.close() } catch {} }
    else { this.sharedContexts = Math.max(0, this.sharedContexts - 1) }
  }
  _patch() {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    if (!navigator.languages || !navigator.languages.length) {
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
    }
  }
  stats() {
    const rssMb = (process.memoryUsage().rss / (1024*1024)) | 0
    return {
      sharedContexts: this.sharedContexts,
      hasSharedBrowser: !!this.sharedBrowser,
      maxContexts: MAX_CONTEXTS,
      memoryRssMb: rssMb,
      maxMemoryMb: MAX_MEMORY_MB,
    }
  }
}

export const pool = new BrowserPool()
export { buildContextOptions }

// Allow dynamic limit updates from ops endpoint
export function setLimits({ maxContexts, maxMemoryMb } = {}) {
  if (Number.isFinite(maxContexts) && maxContexts > 0) {
    MAX_CONTEXTS = Math.min(64, Math.max(1, maxContexts|0))
  }
  if (Number.isFinite(maxMemoryMb) && maxMemoryMb > 128) {
    MAX_MEMORY_MB = Math.min(8192, Math.max(128, maxMemoryMb|0))
  }
}

export function getLimits() {
  return { maxContexts: MAX_CONTEXTS, maxMemoryMb: MAX_MEMORY_MB }
}
