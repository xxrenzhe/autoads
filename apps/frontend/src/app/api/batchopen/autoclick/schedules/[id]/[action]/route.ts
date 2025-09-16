import { forwardToGo } from '@/lib/bff/forward'

// BFF: POST /api/batchopen/autoclick/schedules/[id]/[action]
// - enable -> /api/v1/batchopen/autoclick/schedules/:id/enable
// - disable -> /api/v1/batchopen/autoclick/schedules/:id/disable
export async function POST(req: Request, ctx: { params: { id: string, action: string } }) {
  const { id, action } = ctx.params
  if (action !== 'enable' && action !== 'disable') {
    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { 'content-type': 'application/json' } })
  }
  return forwardToGo(req, { targetPath: `/api/v1/batchopen/autoclick/schedules/${id}/${action}`, appendSearch: false, method: 'POST' })
}

