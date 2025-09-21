import { forwardToGo } from '@/lib/bff/forward'

// BFF: /api/autoclick/stats -> /api/v1/batchgo/running-tasks (近似统计)
export async function GET(req: Request) {
  return forwardToGo(req, { targetPath: `/api/v1/batchgo/running-tasks`, appendSearch: true })
}
