import { forwardToGo } from '@/lib/bff/forward'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: { id: string } }) {
  return forwardToGo(req, { targetPath: `/api/go/api/v1/adscenter/executions/${ctx.params.id}`, appendSearch: true })
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  return forwardToGo(req, { targetPath: `/api/go/api/v1/adscenter/executions/${ctx.params.id}`, appendSearch: false, method: 'PATCH' })
}
