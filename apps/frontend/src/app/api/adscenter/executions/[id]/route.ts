import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'
import { withFeatureGuard } from '@/lib/middleware/feature-guard-middleware'
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
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // 优先读规范化表
  try {
    const row = await prisma.adsExecution.findFirst({
      where: { id: params.id, userId: session.user.id },
    })
    if (row) {
      return NextResponse.json({
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
    }
  } catch {}
  // 回退 SystemConfig
  const list = await getExecutions(session.user.id)
  const item = list.find(e => e.id === params.id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: item })
}

export const GET = withFeatureGuard(handleGET as any, { featureId: 'adscenter_basic', requireToken: false })

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

  return NextResponse.json({ success: true })
}

export const PATCH = withFeatureGuard(handlePATCH as any, { featureId: 'adscenter_basic', requireToken: false })
