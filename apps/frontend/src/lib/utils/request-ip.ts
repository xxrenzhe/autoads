import type { NextRequest } from 'next/server'

export function getRequestIp(req: NextRequest): string | undefined {
  const xf = req.headers.get('x-forwarded-for') || ''
  const xr = req.headers.get('x-real-ip') || ''
  const ipFromHeaders = xf.split(',')[0]?.trim() || xr || undefined
  // 某些运行环境会在请求对象上动态添加非标准 ip 字段
  const ip = (req as unknown as { ip?: string }).ip
  return ip || ipFromHeaders
}
