import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'
import { withFeatureGuard } from '@/lib/middleware/feature-guard-middleware'
import { withApiProtection } from '@/lib/api-utils'
import { getRedisClient } from '@/lib/cache/redis-client'

export const dynamic = 'force-dynamic'

type Execution = {
  id: string
  configurationId: string
  status: 'created' | 'running' | 'completed' | 'failed' | 'cancelled'
  createdAt: string
  progress?: number
  total_items?: number
  processed_items?: number
  started_at?: string
  completed_at?: string
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

async function handleGET(_req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const t0 = Date.now();
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // 优先读规范化表
  try {
    const row = await prisma.adsExecution.findFirst({
      where: { id: params.id, userId: session.user.id },
    })
    if (row) {
      const res = NextResponse.json({
        success: true,
        data: {
          id: row.id,
          configurationId: row.configurationId,
          status: (row.status as any),
          createdAt: row.createdAt.toISOString(),
          progress: row.progress,
          total_items: row.totalItems,
          processed_items: row.processedItems,
          started_at: row.startedAt?.toISOString(),
          completed_at: row.completedAt?.toISOString(),
        }
      })
      try { res.headers.set('X-RateLimit-Limit', '30'); res.headers.set('X-RateLimit-Remaining', '30'); } catch {}
      return res
    }
  } catch {}
  // 回退 SystemConfig
  const list = await getExecutions(session.user.id)
  const item = list.find(e => e.id === params.id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const res = NextResponse.json({ success: true, data: item })
  try { res.headers.set('X-RateLimit-Limit', '30'); res.headers.set('X-RateLimit-Remaining', '30'); res.headers.set('Server-Timing', `upstream;dur=${Date.now() - t0}`) } catch {}
  return res
}

export const GET = withFeatureGuard(withApiProtection('adsCenter')(handleGET as any) as any, { featureId: 'adscenter_basic' })

async function handlePATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))

  const updates: any = {}
  if (typeof body.status === 'string') updates.status = body.status
  if (typeof body.progress === 'number') updates.progress = Math.max(0, Math.min(100, Math.floor(body.progress)))
  if (typeof body.totalItems === 'number') updates.totalItems = Math.max(0, Math.floor(body.totalItems))
  if (typeof body.processedItems === 'number') updates.processedItems = Math.max(0, Math.floor(body.processedItems))
  if (body.startedAt) updates.startedAt = new Date(body.startedAt)
  if (body.completedAt) updates.completedAt = new Date(body.completedAt)

  try {
    const exists = await prisma.adsExecution.findFirst({ where: { id: params.id, userId: session.user.id } })
    if (exists) {
      await prisma.adsExecution.update({ where: { id: params.id }, data: updates })
    }
  } catch {}

  // 同步回退 SystemConfig
  const list = await getExecutions(session.user.id)
  const idx = list.findIndex(e => e.id === params.id)
  if (idx !== -1) {
    list[idx] = {
      ...list[idx],
      ...(updates.status ? { status: updates.status } : {}),
      ...(updates.progress !== undefined ? { progress: updates.progress } : {}),
      ...(updates.totalItems !== undefined ? { total_items: updates.totalItems } : {}),
      ...(updates.processedItems !== undefined ? { processed_items: updates.processedItems } : {}),
      ...(updates.startedAt ? { started_at: (updates.startedAt as Date).toISOString() } : {}),
      ...(updates.completedAt ? { completed_at: (updates.completedAt as Date).toISOString() } : {}),
    } as any
    await setExecutions(session.user.id, list, session.user.id)
  }

  // 发布通知
  try {
    const redis = getRedisClient();
    await redis.publish('adscenter:executions:updates', JSON.stringify({
      userId: session.user.id,
      id: params.id,
      status: updates.status,
      progress: updates.progress,
      totalItems: updates.totalItems,
      processedItems: updates.processedItems,
      startedAt: updates.startedAt?.toISOString?.(),
      completedAt: updates.completedAt?.toISOString?.()
    }))
  } catch {}

  // 若执行已完成且尚未扣费，则在此完成扣费（幂等）
  try {
    if (updates.status === 'completed') {
      const exec = await prisma.adsExecution.findFirst({ where: { id: params.id, userId: session.user.id } })
      if (exec) {
        const charged = await prisma.token_usage.findFirst({
          where: {
            userId: session.user.id,
            feature: 'CHANGELINK',
            metadata: { path: ['adsExecutionId'], equals: params.id }
          }
        })
        if (!charged) {
          const unitCost = await (await import('@/lib/services/token-rule-engine')).TokenRuleEngine.calcAdsCenterCost('update_ad', 1, false)
          await (await import('@/lib/services/token-service')).TokenService.consumeTokens(session.user.id, 'adscenter', 'update_ad', {
            batchSize: 1,
            customAmount: unitCost,
            metadata: { endpoint: '/api/adscenter/executions', configurationId: exec.configurationId, adsExecutionId: params.id }
          })
        }
      }
    }
  } catch {}

  const res2 = NextResponse.json({ success: true })
  try { res2.headers.set('X-RateLimit-Limit', '30'); res2.headers.set('X-RateLimit-Remaining', '30'); } catch {}
  return res2
}

export const PATCH = withFeatureGuard(withApiProtection('adsCenter')(handlePATCH as any) as any, { featureId: 'adscenter_basic' })
