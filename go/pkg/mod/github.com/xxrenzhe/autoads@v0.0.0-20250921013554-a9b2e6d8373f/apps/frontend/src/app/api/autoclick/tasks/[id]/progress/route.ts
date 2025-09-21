import { forwardToGo } from '@/lib/bff/forward'

// BFF: GET /api/autoclick/tasks/[id]/progress -> /api/v1/batchgo/tasks/{id}/progress
export async function GET(req: Request, ctx: { params: { id: string } }) {
  return forwardToGo(req, { targetPath: `/api/v1/batchgo/tasks/${ctx.params.id}/progress`, appendSearch: true })
}
