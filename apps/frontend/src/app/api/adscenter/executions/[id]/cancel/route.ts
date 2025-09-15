import { forwardToGo } from '@/lib/bff/forward'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: { id: string } }) {
  return forwardToGo(req, { targetPath: `/api/go/api/v1/adscenter/executions/${ctx.params.id}/cancel`, appendSearch: false, method: 'POST' })
}
