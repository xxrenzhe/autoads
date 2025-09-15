import { forwardToGo } from '@/lib/bff/forward'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return forwardToGo(req, { targetPath: '/api/go/api/v1/batchopen/terminate', appendSearch: false, method: 'POST' })
}

