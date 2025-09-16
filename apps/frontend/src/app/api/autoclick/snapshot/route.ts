import { forwardToGo } from '@/lib/bff/forward'

// BFF: GET /api/autoclick/snapshot -> /api/v1/batchopen/autoclick/executions/snapshot (降级轮询快照)
export async function GET(req: Request) {
  const url = new URL(req.url)
  const search = url.search || ''
  return forwardToGo(req, { targetPath: `/api/v1/batchopen/autoclick/executions/snapshot${search}`, appendSearch: false })
}

