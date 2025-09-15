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
    return forwardToGo(req, { targetPath: '/api/v1/batchopen/start?type=silent', appendSearch: false, method: 'POST' })
  }
  if (sub === 'silent-progress') {
    return forwardToGo(req, { targetPath: '/api/v1/batchopen/progress', appendSearch: true })
  }
  if (sub === 'silent-terminate') {
    return forwardToGo(req, { targetPath: '/api/v1/batchopen/terminate', appendSearch: false, method: 'POST' })
  }
  if (sub === 'version') {
    return forwardToGo(req, { targetPath: '/api/v1/batchopen/version', appendSearch: true })
  }
  if (sub === 'proxy-url-validate') {
    return forwardToGo(req, { targetPath: '/api/v1/batchopen/proxy-url-validate', appendSearch: false, method: 'POST' })
  }

  const base = `/api/v1/batchopen/${sub}`.replace(/\/$/, '')
  return forwardToGo(req, { targetPath: base, appendSearch: shouldAppendSearch(method) })
}

export async function GET(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function HEAD(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function POST(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function PUT(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function PATCH(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function DELETE(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }
export async function OPTIONS(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx) }

