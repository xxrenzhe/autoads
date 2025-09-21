import { forwardToGo } from '@/lib/bff/forward'

// BFF: /api/autoclick/tasks/[id] -> /api/v1/batchgo/tasks/{id}
export async function GET(req: Request, ctx: { params: { id: string } }) {
  return forwardToGo(req, { targetPath: `/api/v1/batchgo/tasks/${ctx.params.id}`, appendSearch: true })
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  return forwardToGo(req, { targetPath: `/api/v1/batchgo/tasks/${ctx.params.id}`, appendSearch: false, method: 'PUT' })
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  return forwardToGo(req, { targetPath: `/api/v1/batchgo/tasks/${ctx.params.id}`, appendSearch: false, method: 'DELETE' })
}
