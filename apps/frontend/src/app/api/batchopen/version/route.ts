import { forwardToGo } from '@/lib/bff/forward'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return forwardToGo(req, { targetPath: '/api/go/api/v1/batchopen/version', appendSearch: true })
}

