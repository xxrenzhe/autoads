import { forwardToGo } from '@/lib/bff/forward'

function shouldAppendSearch(method: string) {
  const m = (method || 'GET').toUpperCase()
  return m === 'GET' || m === 'HEAD'
}

async function proxy(req: Request, ctx: { params: { path: string[] } }) {
  const sub = (ctx.params.path || []).join('/').replace(/^\/+/, '')
  const base = `/api/v1/siterank/${sub}`.replace(/\/$/, '')
  const resp = await forwardToGo(req, { targetPath: base, appendSearch: shouldAppendSearch(req.method) })
  const headers = new Headers(resp.headers)
  headers.set('Deprecation', 'true')
  headers.set('Sunset', 'Wed, 01 Jan 2026 00:00:00 GMT')
  headers.set('Link', '</go/api/v1/siterank>; rel="successor-version"')
  return new Response(resp.body, { status: resp.status, headers })
}

export async function GET(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function HEAD(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function POST(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function PUT(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function PATCH(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function DELETE(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function OPTIONS(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
