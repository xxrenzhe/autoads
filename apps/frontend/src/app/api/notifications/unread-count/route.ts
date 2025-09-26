import { forwardToGo } from '@/lib/bff/forward'

export async function GET(req: Request) {
  return forwardToGo(req, { targetPath: '/api/v1/notifications/unread-count', appendSearch: true })
}

