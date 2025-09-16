/*
  Admin OPS proxy:
  - Public prefix: /ops/*
  - Upstream base: BACKEND_URL (defaults to http://127.0.0.1:8080)
  - Allowed upstream paths (prefix):
    * /api/v1/console        -> Admin management APIs
    * /console               -> Admin console static site (Vite dist)
    * /admin                 -> Legacy admin endpoints (login/profile)
  Notes:
  - This route exists to simplify deployment by avoiding external gateway mapping for OPS.
  - It is NOT a replacement for production-grade API gateways; use with proper auth upstream.
*/

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BACKEND_BASE = process.env.BACKEND_URL || 'http://127.0.0.1:8080'
const MAX_BODY_BYTES = Number(process.env.BACKEND_PROXY_MAX_BODY || 2 * 1024 * 1024)
const UPSTREAM_TIMEOUT_MS = Number(process.env.BACKEND_PROXY_TIMEOUT_MS || 15000)

function resolveOpsTarget(subPath: string, search: string) {
  const s = subPath.startsWith('/') ? subPath : `/${subPath}`
  const allow = [
    '/api/v1/console',
    '/console',
    '/admin',
  ]
  const ok = allow.some(p => s === p || s.startsWith(p))
  if (!ok) return null
  return `${BACKEND_BASE}${s}${search || ''}`
}

async function readBodyWithLimit(req: Request, limit: number): Promise<BodyInit | undefined | Response> {
  if (['GET', 'HEAD'].includes(req.method)) return undefined
  const len = req.headers.get('content-length')
  if (len && Number(len) > limit) {
    return new Response('payload too large', { status: 413 })
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
      if (received > limit) return new Response('payload too large', { status: 413 })
      chunks.push(value)
    }
  }
  if (chunks.length === 0) return undefined
  return Buffer.concat(chunks)
}

async function proxy(req: Request, path: string[]) {
  const url = new URL(req.url)
  const subPath = `/${path.join('/')}`
  const target = resolveOpsTarget(subPath, url.search)
  if (!target) return new Response('not found', { status: 404 })

  const headers = new Headers(req.headers)
  headers.delete('host')
  headers.delete('connection')
  headers.delete('content-length')
  headers.delete('accept-encoding')

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
    // passthrough headers; add noindex tag for safety
    const respHeaders = new Headers(resp.headers)
    respHeaders.set('X-Robots-Tag', 'noindex, nofollow')
    return new Response(resp.body, { status: resp.status, headers: respHeaders })
  } catch (err) {
    const isTimeout = String((err as Error)?.message || '').toLowerCase().includes('abort')
    return new Response(isTimeout ? 'gateway timeout' : 'bad gateway', { status: isTimeout ? 504 : 502 })
  }
}

export async function GET(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function HEAD(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function POST(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function PUT(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function PATCH(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function DELETE(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function OPTIONS(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }

