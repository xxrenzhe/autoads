import { forwardToGo } from '@/lib/bff/forward'

// BFF: /api/autoclick/tasks -> /api/v1/batchgo/tasks
export async function GET(req: Request) {
  return forwardToGo(req, { targetPath: `/api/v1/batchgo/tasks`, appendSearch: true })
}

export async function POST(req: Request) {
  return forwardToGo(req, { targetPath: `/api/v1/batchgo/tasks`, appendSearch: false, method: 'POST' })
}
