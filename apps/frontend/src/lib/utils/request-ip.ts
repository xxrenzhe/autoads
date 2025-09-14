import type { NextRequest } from 'next/server'

export function getRequestIp(req: NextRequest): string | undefined {
  const xf = req.headers.get('x-forwarded-for') || ''
  const xr = req.headers.get('x-real-ip') || ''
  const ipFromHeaders = xf.split(',')[0]?.trim() || xr || undefined
  // Some environments add a non-standard ip property at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ip = (req as any).ip as string | undefined
  return ip || ipFromHeaders
}

