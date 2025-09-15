import { forwardToGo } from '@/lib/bff/forward'

function shouldAppendSearch(method: string) {
  const m = (method || 'GET').toUpperCase()
  return m === 'GET' || m === 'HEAD'
}

async function proxy(req: Request, ctx: { params: { path: string[] } }) {
  const sub = (ctx.params.path || []).join('/').replace(/^\/+/, '')
  const base = `/api/v1/adscenter/${sub}`.replace(/\/$/, '')
  return forwardToGo(req, { targetPath: base, appendSearch: shouldAppendSearch(req.method) })
}

export async function GET(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function HEAD(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function POST(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function PUT(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function PATCH(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function DELETE(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function OPTIONS(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }

