import { forwardToGo } from '@/lib/bff/forward'

export async function POST(req: Request) {
  return forwardToGo(req, { targetPath: '/api/v1/notifications/read', appendSearch: false, method: 'POST' })
}

