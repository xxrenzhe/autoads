import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth/v5-config'
import { withApiProtection } from '@/lib/api-utils'

async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const now = new Date()
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  // AdsCenter executions as tasks
  const adsExecs = await prisma.adsExecution.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: 'desc' }, take: 100 })
  const adsTasks = adsExecs.map((e: any) => ({
    id: e.id,
    type: 'adscenter',
    status: e.status,
    createdAt: e.createdAt,
    progress: e.progress ?? 0,
    total: e.totalItems ?? 0,
    processed: e.processedItems ?? 0,
    metadata: { configurationId: e.configurationId }
  }))
  // SiteRank tasks from token usage (best-effort)
  const siterankUsages = await prisma.token_usage.findMany({
    where: { userId: session.user.id, feature: 'SITERANK', createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 100
  })
  const srTasks = siterankUsages.map((u: any) => ({
    id: u.batchId || `sr_${u.id}`,
    type: 'siterank',
    status: 'completed',
    createdAt: u.createdAt,
    progress: 100,
    total: u.itemCount ?? (u.isBatch ? u.itemCount : 1) ?? 1,
    processed: u.itemCount ?? 1,
    metadata: { operation: u.operation, isBatch: u.isBatch }
  }))
  const tasks = [...adsTasks, ...srTasks]
  return NextResponse.json({ success: true, data: tasks })
}

export const GET_WITH_LIMIT = withApiProtection('api')(GET as any)
export { GET }
export const dynamic = 'force-dynamic'
