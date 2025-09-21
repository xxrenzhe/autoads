import { forwardToGo } from '@/lib/bff/forward'

// 将简化批量接口直接转发到后端真实实现，避免前端假数据
export async function POST(req: Request) {
  return forwardToGo(req, { targetPath: '/api/v1/siterank/batch', appendSearch: false, method: 'POST' })
}
