import { forwardToGo } from '@/lib/bff/forward'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // Forward to same backend endpoint; backend decides response shape
  return forwardToGo(req, { targetPath: '/api/go/api/v1/siterank/batch', appendSearch: false, method: 'POST' })
}

