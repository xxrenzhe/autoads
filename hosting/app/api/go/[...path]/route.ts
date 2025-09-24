import { NextResponse } from 'next/server'

// Default to API Gateway host if BACKEND_URL is not provided
const BACKEND_BASE = process.env.BACKEND_URL || 'https://autoads-gw-885pd7lz.an.gateway.dev'

export async function GET(req: Request, ctx: any) {
  const params = ctx?.params as { path: string[] }
  const url = new URL(req.url)
  const target = `${BACKEND_BASE}/${params.path.join('/')}${url.search || ''}`
  const resp = await fetch(target, { headers: { 'x-forwarded-host': req.headers.get('host') || '' } })
  const body = await resp.text()
  return new NextResponse(body, { status: resp.status, headers: { 'content-type': resp.headers.get('content-type') || 'text/plain' } })
}

export async function POST(req: Request, ctx: any) {
  const params = ctx?.params as { path: string[] }
  const url = new URL(req.url)
  const target = `${BACKEND_BASE}/${params.path.join('/')}${url.search || ''}`
  const resp = await fetch(target, { method: 'POST', headers: { 'content-type': 'application/json' }, body: await (req as any).text() })
  const body = await resp.text()
  return new NextResponse(body, { status: resp.status, headers: { 'content-type': resp.headers.get('content-type') || 'application/json' } })
}
