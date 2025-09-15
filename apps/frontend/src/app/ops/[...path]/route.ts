/*
  OPS 反代入口：将 /ops/* 转发到容器内 Go 管理端
  - 对外前缀：/ops/*
  - 目标后端：BACKEND_URL (默认 http://127.0.0.1:8080)
  - 允许前缀：/console/* 与 /api/v1/console/*，及健康检查路由
*/

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BACKEND_BASE = process.env.BACKEND_URL || 'http://127.0.0.1:8080'
const MAX_BODY_BYTES = Number(process.env.BACKEND_PROXY_MAX_BODY || 2 * 1024 * 1024)
const UPSTREAM_TIMEOUT_MS = Number(process.env.BACKEND_PROXY_TIMEOUT_MS || 15000)

function isAllowed(subPath: string): boolean {
  const s = subPath.startsWith('/') ? subPath : `/${subPath}`
  const allow = [
    '/console', '/console/',
    '/api/v1/console', '/api/v1/console/',
    '/health', '/healthz', '/ready', '/readyz', '/live'
  ]
  return allow.some(p => s === p || s.startsWith(p))
}

async function readBodyWithLimit(req: Request, limit: number): Promise<BodyInit | undefined | Response> {
  if (['GET', 'HEAD'].includes(req.method)) return undefined
  const len = req.headers.get('content-length')
  if (len && Number(len) > limit) {
    return new Response(JSON.stringify({ error: { code: 'PAYLOAD_TOO_LARGE', limit } }), { status: 413, headers: { 'content-type': 'application/json' } })
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
        return new Response(JSON.stringify({ error: { code: 'PAYLOAD_TOO_LARGE', limit } }), { status: 413, headers: { 'content-type': 'application/json' } })
      }
      chunks.push(value)
    }
  }
  if (chunks.length === 0) return undefined
  return Buffer.concat(chunks)
}

import { auth } from '@/lib/auth/v5-config'
import { createInternalJWT, ensureRequestId, ensureIdempotencyKey } from '@/lib/security/internal-jwt'

async function proxy(req: Request, path: string[]) {
  const url = new URL(req.url)
  const subPath = `/${path.join('/')}`
  if (!isAllowed(subPath)) {
    return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }), { status: 404, headers: { 'content-type': 'application/json' } })
  }
  const target = `${BACKEND_BASE}${subPath}${url.search}`

  const headers = new Headers(req.headers)
  headers.delete('host')
  headers.delete('connection')
  headers.delete('content-length')
  headers.delete('accept-encoding')
  ensureRequestId(headers)
  ensureIdempotencyKey(req.method, headers)

  if (!headers.get('authorization')) {
    try {
      const session: any = await auth()
      const uid = session?.user?.id
      const role = session?.user?.role
      if (uid) {
        const token = createInternalJWT({ sub: uid, role })
        if (token) headers.set('authorization', `Bearer ${token}`)
      }
    } catch {}
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
    respHeaders.set('X-OPS-Proxy', '1')
    const reqId = headers.get('x-request-id') || ''
    if (reqId) respHeaders.set('x-request-id', reqId)
    return new Response(resp.body, { status: resp.status, headers: respHeaders })
  } catch (err) {
    const message = (err as Error)?.message || 'Upstream error'
    const isTimeout = message.toLowerCase().includes('abort') || message.toLowerCase().includes('timeout')
    const status = isTimeout ? 504 : 502
    return new Response(JSON.stringify({ error: { code: isTimeout ? 'GATEWAY_TIMEOUT' : 'BAD_GATEWAY', message } }), { status, headers: { 'content-type': 'application/json' } })
  }
}

export async function GET(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function HEAD(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function POST(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function PUT(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function PATCH(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function DELETE(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function OPTIONS(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }

