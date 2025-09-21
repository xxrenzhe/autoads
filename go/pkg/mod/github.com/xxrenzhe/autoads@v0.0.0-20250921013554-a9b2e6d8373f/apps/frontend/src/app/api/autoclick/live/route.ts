import { forwardToGo } from '@/lib/bff/forward'

// BFF: GET /api/autoclick/live -> /api/v1/batchopen/autoclick/executions/live (SSE 透传)
export async function GET(req: Request) {
  const url = new URL(req.url)
  const search = url.search || ''
  return forwardToGo(req, { targetPath: `/api/v1/batchopen/autoclick/executions/live${search}`, appendSearch: false })
}

