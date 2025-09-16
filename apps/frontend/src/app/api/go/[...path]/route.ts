/*
  Unified BFF entry that proxies API calls to the internal Go backend
  - Public prefix: /api/go/*
  - Upstream base: BACKEND_URL (defaults to http://127.0.0.1:8080)
  - Adds:
    * X-BFF-Enforced: 1
    * x-request-id passthrough
    * X-Robots-Tag: noindex
  - KISS: no local fallback; upstream error -> 5xx/504 with minimal body
*/

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BACKEND_BASE = process.env.BACKEND_URL || 'http://127.0.0.1:8080'
const MAX_BODY_BYTES = Number(process.env.BFF_MAX_BODY || 2 * 1024 * 1024)
const UPSTREAM_TIMEOUT_MS = Number(process.env.BFF_UPSTREAM_TIMEOUT_MS || 15000)
const READY_CHECK_TIMEOUT_MS = Number(process.env.BFF_READY_TIMEOUT_MS || 1200)
const READY_CHECK_TTL_MS = Number(process.env.BFF_READY_TTL_MS || 3000)

function resolveTarget(subPath: string, search: string) {
  // Allow only API and health endpoints
  // Normalize subPath
  const s = subPath.startsWith('/') ? subPath : `/${subPath}`
  const allow = [
    '/api',
    '/api/',
    '/api/v1',
    '/api/v1/',
    '/health',
    '/healthz',
    '/ready',
    '/readyz'
  ]
  const allowed = allow.some(p => s === p || s.startsWith(p))
  if (!allowed) return null
  return `${BACKEND_BASE}${s}${search || ''}`
}

async function readBodyWithLimit(req: Request, limit: number): Promise<BodyInit | undefined | Response> {
  if (['GET', 'HEAD'].includes(req.method)) return undefined
  const len = req.headers.get('content-length')
  if (len && Number(len) > limit) {
    return new Response(JSON.stringify({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large', limit } }), {
      status: 413,
      headers: { 'content-type': 'application/json', 'X-BFF-Enforced': '1', 'X-Robots-Tag': 'noindex' }
    })
  }
  const reader = req.body?.getReader()
  if (!reader) return undefined
  let received = 0
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      received += value.byteLength
      if (received > limit) {
        return new Response(JSON.stringify({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large', limit } }), {
          status: 413,
          headers: { 'content-type': 'application/json', 'X-BFF-Enforced': '1', 'X-Robots-Tag': 'noindex' }
        })
      }
      chunks.push(value)
    }
  }
  if (chunks.length === 0) return undefined
  return Buffer.concat(chunks)
}

import { auth } from '@/lib/auth/v5-config'
import { createInternalJWT } from '@/lib/security/internal-jwt'

async function proxy(req: Request, path: string[]) {
  const url = new URL(req.url)
  const subPath = `/${path.join('/')}`
  const target = resolveTarget(subPath, url.search)
  if (!target) {
    return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }), {
      status: 404,
      headers: { 'content-type': 'application/json', 'X-BFF-Enforced': '1', 'X-Robots-Tag': 'noindex' }
    })
  }

  // Readiness check (skip for health endpoints)
  if (!['/health', '/healthz', '/ready', '/readyz'].some(h => subPath === h || subPath.startsWith(h))) {
    const now = Date.now()
    const cache: any = (globalThis as any).__go_ready_cache || { ts: 0, ok: false }
    if (!cache.ts || now - cache.ts > READY_CHECK_TTL_MS) {
      try {
        const controller = new AbortController()
        const to = setTimeout(() => controller.abort(), READY_CHECK_TIMEOUT_MS)
        // Prefer /readyz; fall back to /ready for compatibility (tests expect /readyz first)
        let resp: Response
        try {
          resp = await fetch(`${BACKEND_BASE}/readyz`, { method: 'GET', signal: controller.signal })
        } catch {
          resp = await fetch(`${BACKEND_BASE}/ready`, { method: 'GET', signal: controller.signal })
        }
        clearTimeout(to)
        cache.ts = Date.now()
        cache.ok = resp.ok
      } catch {
        cache.ts = Date.now()
        cache.ok = false
      }
      ;(globalThis as any).__go_ready_cache = cache
    }
    if (!cache.ok) {
      return new Response(JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Upstream not ready' } }), {
        status: 503,
        headers: {
          'content-type': 'application/json',
          'X-BFF-Enforced': '1',
          'X-Robots-Tag': 'noindex',
          'Retry-After': '2'
        }
      })
    }
  }

  const headers = new Headers(req.headers)
  headers.delete('host')
  headers.delete('connection')
  headers.delete('content-length')
  headers.delete('accept-encoding')
  // Inject request id if absent
  if (!headers.get('x-request-id')) {
    headers.set('x-request-id', `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)
  }

  // Bridge NextAuth session -> Internal JWT for Go if Authorization is missing
  if (!headers.get('authorization')) {
    try {
      const session: any = await auth()
      const uid = session?.user?.id
      const role = session?.user?.role
      if (uid) {
        const ijwt = createInternalJWT({ sub: uid, role })
        if (ijwt) headers.set('authorization', `Bearer ${ijwt}`)
      }
    } catch { /* no-op */ }
  }

  let body: BodyInit | undefined | Response = undefined
  if (!['GET', 'HEAD'].includes(req.method)) {
    body = await readBodyWithLimit(req, MAX_BODY_BYTES)
    if (body instanceof Response) return body
  }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    const resp = await fetch(target, { method: req.method, headers, body, redirect: 'manual', signal: controller.signal })
    clearTimeout(timeout)
    const respHeaders = new Headers(resp.headers)
    respHeaders.set('X-Robots-Tag', 'noindex, nofollow')
    respHeaders.set('X-BFF-Enforced', '1')
    // Mark this route as deprecated in favor of /go/*
    respHeaders.set('Deprecation', 'true')
    // optional Sunset date in RFC 1123 format; 90 days from now (static string acceptable)
    respHeaders.set('Sunset', 'Wed, 01 Jan 2026 00:00:00 GMT')
    respHeaders.set('Link', '</go>; rel="successor-version"')
    const reqId = headers.get('x-request-id') || ''
    if (reqId) respHeaders.set('x-request-id', reqId)
    return new Response(resp.body, { status: resp.status, headers: respHeaders })
  } catch (err) {
    const message = (err as Error)?.message || 'Upstream error'
    const isTimeout = message.toLowerCase().includes('abort') || message.toLowerCase().includes('timeout')
    const status = isTimeout ? 504 : 502
    return new Response(JSON.stringify({ error: { code: isTimeout ? 'GATEWAY_TIMEOUT' : 'BAD_GATEWAY', message } }), {
      status,
      headers: { 'content-type': 'application/json', 'X-BFF-Enforced': '1', 'X-Robots-Tag': 'noindex' }
    })
  }
}

export async function GET(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function HEAD(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function POST(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function PUT(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function PATCH(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function DELETE(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function OPTIONS(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
