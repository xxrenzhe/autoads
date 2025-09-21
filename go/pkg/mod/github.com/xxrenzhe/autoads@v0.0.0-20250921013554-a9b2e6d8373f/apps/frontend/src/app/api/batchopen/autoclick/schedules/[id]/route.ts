import { forwardToGo } from '@/lib/bff/forward'

// BFF: /api/batchopen/autoclick/schedules/[id] -> /api/v1/batchopen/autoclick/schedules/:id
export async function GET(req: Request, ctx: { params: { id: string } }) {
  return forwardToGo(req, { targetPath: `/api/v1/batchopen/autoclick/schedules/${ctx.params.id}`, appendSearch: true })
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  return forwardToGo(req, { targetPath: `/api/v1/batchopen/autoclick/schedules/${ctx.params.id}`, appendSearch: false, method: 'PUT' })
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  return forwardToGo(req, { targetPath: `/api/v1/batchopen/autoclick/schedules/${ctx.params.id}`, appendSearch: false, method: 'DELETE' })
}

