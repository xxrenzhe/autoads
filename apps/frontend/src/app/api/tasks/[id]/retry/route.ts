import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth/v5-config'
import { getRedisClient } from '@/lib/cache/redis-client'
import { withApiProtection } from '@/lib/api-utils'

async function POST(_req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = params.id
  // If AdsCenter execution exists, publish retry instruction (best-effort)
  const exec = await prisma.adsExecution.findFirst({ where: { id, userId: session.user.id } })
  if (exec) {
    try {
      const redis = getRedisClient()
      await redis.publish('adscenter:executions:updates', JSON.stringify({ userId: session.user.id, id, status: 'retry' }))
    } catch {}
    return NextResponse.json({ success: true, message: 'Retry signal published for AdsCenter execution' })
  }
  // Otherwise accept retry for SiteRank (no-op placeholder)
  return NextResponse.json({ success: true, message: 'Retry accepted (SiteRank)', id })
}

export const POST_WITH_LIMIT = withApiProtection('api')(POST as any)
export { POST }
export const dynamic = 'force-dynamic'
