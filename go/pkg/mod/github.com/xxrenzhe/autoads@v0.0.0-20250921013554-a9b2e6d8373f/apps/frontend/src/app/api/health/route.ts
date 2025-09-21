import { forwardToGo } from '@/lib/bff/forward'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // 透传到后端健康检查（/health），保持同源，便于部署探针统一使用
  return forwardToGo(req, { targetPath: '/health', appendSearch: false, method: 'GET' })
}

export async function HEAD(req: Request) {
  return forwardToGo(req, { targetPath: '/health', appendSearch: false, method: 'HEAD' })
}

