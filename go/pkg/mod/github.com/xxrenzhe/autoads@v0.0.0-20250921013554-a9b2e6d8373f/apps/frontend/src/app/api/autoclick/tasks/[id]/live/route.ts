import { forwardToGo } from '@/lib/bff/forward'

// BFF: GET /api/autoclick/tasks/[id]/live -> /api/v1/batchopen/tasks/{id}/live (SSE 透传)
export async function GET(req: Request, ctx: { params: { id: string } }) {
  return forwardToGo(req, { targetPath: `/api/v1/batchopen/tasks/${ctx.params.id}/live`, appendSearch: true })
}
