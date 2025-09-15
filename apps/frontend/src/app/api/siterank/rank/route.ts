import { forwardToGo } from '@/lib/bff/forward'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // Forward with query params intact
  return forwardToGo(req, { targetPath: '/api/go/api/v1/siterank/rank', appendSearch: true })
}

