import { forwardToGo } from '@/lib/bff/forward'

export async function GET(req: Request) {
  // 直接转发到 Go 后端 notifications 服务
  return forwardToGo(req, { targetPath: '/api/v1/notifications/recent', appendSearch: true })
}

