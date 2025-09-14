import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'
import { TokenRuleEngine } from '@/lib/services/token-rule-engine'
import { TokenConfigService } from '@/lib/services/token-config-service'
import { withApiProtection } from '@/lib/api-utils'

async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!me || (me.role !== 'ADMIN' && me.role !== 'SUPER_ADMIN')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as any
  const feature = String(body.feature || '').toLowerCase()
  const action = String(body.action || 'default')
  const count = Math.max(1, parseInt(body.count || '1', 10))
  try {
    if (feature === 'adscenter') {
      const per = await TokenRuleEngine.calcAdsCenterCost(action as any, 1, false)
      const total = await TokenRuleEngine.calcAdsCenterCost(action as any, count, count > 1)
      return NextResponse.json({ success: true, data: { per, total } })
    }
    const cfg = new TokenConfigService()
    const key = feature === 'siterank' ? 'siterank' : feature === 'batchopen' ? 'batchopen' : 'adscenter'
    const per = await cfg.calculateTokenCost(key as any, 1, false)
    const total = await cfg.calculateTokenCost(key as any, count, count > 1)
    return NextResponse.json({ success: true, data: { per, total } })
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 })
  }
}

export { POST as POST }
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
export const preferredRegion = 'auto'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const GET = withApiProtection('api')(async () => NextResponse.json({ error: 'Use POST' }, { status: 405 }))
export const POST_WITH_LIMIT = withApiProtection('api')(POST as any)

