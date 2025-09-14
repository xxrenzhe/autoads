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

async function handlePOST(_req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // 先更新规范化表
  let updated = false
  try {
    const exists = await prisma.adsExecution.findFirst({ where: { id: params.id, userId: session.user.id } })
    if (exists) {
      await prisma.adsExecution.update({ where: { id: params.id }, data: { status: 'cancelled' } })
      updated = true
    }
  } catch {}

  // 回退 SystemConfig 以保持兼容
  const list = await getExecutions(session.user.id)
  const idx = list.findIndex(e => e.id === params.id)
  if (idx !== -1) {
    list[idx] = { ...list[idx], status: 'cancelled' }
    await setExecutions(session.user.id, list, session.user.id)
  }
  // 发布通知
  try { const redis = getRedisClient(); await redis.publish('adscenter:executions:updates', JSON.stringify({ userId: session.user.id, id: params.id, status: 'cancelled' })); } catch {}
  return NextResponse.json({ success: true, updatedTable: updated })
}

export const POST = withFeatureGuard(withApiProtection('adsCenter')(handlePOST as any) as any, { featureId: 'adscenter_basic' })
