import { forwardToGo } from '@/lib/bff/forward'

// BFF: POST /api/autoclick/tasks/[id]/[action]
// - start -> /api/v1/batchgo/tasks/{id}/start
// - stop|terminate -> /api/v1/batchgo/stop-all (best-effort)
export async function POST(req: Request, ctx: { params: { id: string, action: string } }) {
  const { id, action } = ctx.params
  if (action === 'start') {
    return forwardToGo(req, { targetPath: `/api/v1/batchgo/tasks/${id}/start`, appendSearch: false, method: 'POST' })
  }
  if (action === 'stop') {
    return forwardToGo(req, { targetPath: `/api/v1/batchgo/tasks/${id}/stop`, appendSearch: false, method: 'POST' })
  }
  if (action === 'terminate') {
    return forwardToGo(req, { targetPath: `/api/v1/batchgo/tasks/${id}/terminate`, appendSearch: false, method: 'POST' })
  }
  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { 'content-type': 'application/json' } })
}
