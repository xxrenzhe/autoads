import { forwardToGo } from '@/lib/bff/forward'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // Map to Go batchopen start with type=silent
  const base = '/api/go/api/v1/batchopen/start?type=silent'
  return forwardToGo(req, { targetPath: base, appendSearch: false, method: 'POST' })
}

