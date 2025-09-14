import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'
import { withFeatureGuard } from '@/lib/middleware/feature-guard-middleware'
import { TokenRuleEngine } from '@/lib/services/token-rule-engine'
import { getRedisClient } from '@/lib/cache/redis-client'

export const dynamic = 'force-dynamic'

type Execution = {
  id: string
  configurationId: string
  status: 'created' | 'running' | 'completed' | 'failed'
  message?: string
  createdAt: string
}

const KEY = (userId: string) => `adscenter:${userId}:executions`

async function getExecutions(userId: string): Promise<Execution[]> {
  const existing = await prisma.systemConfig.findUnique({ where: { key: KEY(userId) } })
  if (!existing?.value) return []
  try { return JSON.parse(existing.value) as Execution[] } catch { return [] }
}

async function setExecutions(userId: string, records: Execution[], updatedBy: string) {
  const value = JSON.stringify(records)
  const existing = await prisma.systemConfig.findUnique({ where: { key: KEY(userId) } })
  if (existing) {
    await prisma.systemConfig.update({ where: { key: KEY(userId) }, data: { value, updatedBy } })
  } else {
    await prisma.systemConfig.create({ data: { key: KEY(userId), value, category: 'adscenter', description: 'AdsCenter executions', createdBy: updatedBy, updatedBy } })
  }
}

async function handleGET(_req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // 优先从规范化表读取，回退 SystemConfig
  try {
    const rows = await prisma.adsExecution.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' }
    })
    if (rows && rows.length > 0) {
      const data = rows.map((r: any) => ({
        id: r.id,
        configurationId: r.configurationId,
        status: (r.status as any) || 'created',
        message: r.message || undefined,
        createdAt: r.createdAt.toISOString(),
        progress: r.progress ?? 0,
        total_items: r.totalItems ?? 0,
        processed_items: r.processedItems ?? 0,
        started_at: r.startedAt ? r.startedAt.toISOString() : undefined,
        completed_at: r.completedAt ? r.completedAt.toISOString() : undefined
      }))
      return NextResponse.json({ success: true, data })
    }
  } catch (e) {
    // ignore and fallback
  }
  const list = await getExecutions(session.user.id)
  return NextResponse.json({ success: true, data: list })
}

async function handlePOST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { configurationId } = body as any
  if (!configurationId) return NextResponse.json({ error: 'configurationId is required' }, { status: 400 })
  // 先写入规范化表
  let newId = ''
  try {
    const created = await prisma.adsExecution.create({
      data: {
        userId: session.user.id,
        configurationId,
        status: 'created'
      }
    })
    newId = created.id
  } catch (e) {
    // ignore and use fallback id
  }
  // 维护回退 SystemConfig 以兼容
  const list = await getExecutions(session.user.id)
  const id = newId || `exec_${Date.now()}`
  const now = new Date().toISOString()
  list.unshift({ id, configurationId, status: 'created', createdAt: now })
  await setExecutions(session.user.id, list.slice(0, 200), session.user.id)
  // 发布通知
  try { const redis = getRedisClient(); await redis.publish('adscenter:executions:updates', JSON.stringify({ userId: session.user.id, id, configurationId, status: 'created' })); } catch {}
  return NextResponse.json({ success: true, data: { id } })
}

export const GET = withFeatureGuard(handleGET as any, { featureId: 'adscenter_basic', requireToken: false })
export const POST = withFeatureGuard(handlePOST as any, {
  featureId: 'adscenter_basic',
  requireToken: true,
  getTokenCost: async () => {
    // Use rule engine to calculate cost of an execution (treat as update_ad, 1 item)
    return await TokenRuleEngine.calcAdsCenterCost('update_ad', 1, false)
  }
})
