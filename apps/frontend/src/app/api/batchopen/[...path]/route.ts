import { forwardToGo } from '@/lib/bff/forward'

function shouldAppendSearch(method: string) {
  const m = (method || 'GET').toUpperCase()
  return m === 'GET' || m === 'HEAD'
}

async function proxy(req: Request, ctx: { params: { path: string[] } }) {
  const parts = (ctx.params.path || [])
  const sub = parts.join('/').replace(/^\/+/, '')
  const method = (req.method || 'GET').toUpperCase()

  // Special mappings to keep old contracts
  if (sub === 'silent-start') {
    const start = Date.now()
    const r = await forwardToGo(req, { targetPath: '/api/v1/batchopen/start?type=silent', appendSearch: false, method: 'POST' })
    console.info(`[bff] /api/batchopen/silent-start -> status=${r.status} dur=${Date.now()-start}ms`)
    const h = new Headers(r.headers); h.set('Deprecation','true'); h.set('Sunset','Wed, 01 Jan 2026 00:00:00 GMT'); h.set('Link','</go/api/v1/batchopen>; rel="successor-version"')
    return new Response(r.body, { status: r.status, headers: h })
  }
  if (sub === 'silent-progress') {
    const start = Date.now()
    const r = await forwardToGo(req, { targetPath: '/api/v1/batchopen/progress', appendSearch: true })
    console.info(`[bff] /api/batchopen/silent-progress -> status=${r.status} dur=${Date.now()-start}ms`)
    const h = new Headers(r.headers); h.set('Deprecation','true'); h.set('Sunset','Wed, 01 Jan 2026 00:00:00 GMT'); h.set('Link','</go/api/v1/batchopen>; rel="successor-version"')
    return new Response(r.body, { status: r.status, headers: h })
  }
  if (sub === 'silent-terminate') {
    const start = Date.now()
    const r = await forwardToGo(req, { targetPath: '/api/v1/batchopen/terminate', appendSearch: false, method: 'POST' })
    console.info(`[bff] /api/batchopen/silent-terminate -> status=${r.status} dur=${Date.now()-start}ms`)
    const h = new Headers(r.headers); h.set('Deprecation','true'); h.set('Sunset','Wed, 01 Jan 2026 00:00:00 GMT'); h.set('Link','</go/api/v1/batchopen>; rel="successor-version"')
    return new Response(r.body, { status: r.status, headers: h })
  }
  if (sub === 'version') {
    const start = Date.now()
    const r = await forwardToGo(req, { targetPath: '/api/v1/batchopen/version', appendSearch: true })
    console.info(`[bff] /api/batchopen/version -> status=${r.status} dur=${Date.now()-start}ms`)
    const h = new Headers(r.headers); h.set('Deprecation','true'); h.set('Sunset','Wed, 01 Jan 2026 00:00:00 GMT'); h.set('Link','</go/api/v1/batchopen>; rel="successor-version"')
    return new Response(r.body, { status: r.status, headers: h })
  }
  if (sub === 'proxy-url-validate') {
    const start = Date.now()
    const r = await forwardToGo(req, { targetPath: '/api/v1/batchopen/proxy-url-validate', appendSearch: false, method: 'POST' })
    console.info(`[bff] /api/batchopen/proxy-url-validate -> status=${r.status} dur=${Date.now()-start}ms`)
    const h = new Headers(r.headers); h.set('Deprecation','true'); h.set('Sunset','Wed, 01 Jan 2026 00:00:00 GMT'); h.set('Link','</go/api/v1/batchopen>; rel="successor-version"')
    return new Response(r.body, { status: r.status, headers: h })
  }

  const base = `/api/v1/batchopen/${sub}`.replace(/\/$/, '')
  const start = Date.now()
  const r = await forwardToGo(req, { targetPath: base, appendSearch: shouldAppendSearch(method) })
  console.info(`[bff] /api/batchopen/${sub} -> status=${r.status} dur=${Date.now()-start}ms`)
  const h = new Headers(r.headers); h.set('Deprecation','true'); h.set('Sunset','Wed, 01 Jan 2026 00:00:00 GMT'); h.set('Link','</go/api/v1/batchopen>; rel="successor-version"')
  return new Response(r.body, { status: r.status, headers: h })
}

export async function GET(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function HEAD(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function POST(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function PUT(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function PATCH(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function DELETE(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function OPTIONS(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
