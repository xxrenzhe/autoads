import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'
import { withFeatureGuard } from '@/lib/middleware/feature-guard-middleware'
import { TokenRuleEngine } from '@/lib/services/token-rule-engine'
import { getRedisClient } from '@/lib/cache/redis-client'
import { TokenService } from '@/lib/services/token-service'
import { withApiProtection } from '@/lib/api-utils'

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
  const t0 = Date.now();
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
      const res = NextResponse.json({ success: true, data })
      try {
        res.headers.set('X-RateLimit-Limit', '30')
        res.headers.set('X-RateLimit-Remaining', '30')
        res.headers.set('Server-Timing', `upstream;dur=${Date.now() - t0}`)
      } catch {}
      return res
    }
  } catch (e) {
    // ignore and fallback
  }
  const list = await getExecutions(session.user.id)
  const resList = NextResponse.json({ success: true, data: list })
  try { resList.headers.set('Server-Timing', `upstream;dur=${Date.now() - t0}`) } catch {}
  return resList
}

async function handlePOST(req: NextRequest): Promise<NextResponse> {
  const t0 = Date.now();
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { configurationId } = body as any
  if (!configurationId) return NextResponse.json({ error: 'configurationId is required' }, { status: 400 })
  // 预检余额（不扣费）：按规则引擎估算一次执行的消耗
  try {
    const unitCost = await TokenRuleEngine.calcAdsCenterCost('update_ad', 1, false)
    const check = await TokenService.checkTokenBalance(session.user.id, unitCost)
    if (!check.sufficient) {
      return NextResponse.json({
        error: 'Insufficient token balance',
        code: 'INSUFFICIENT_TOKENS',
        required: check.required,
        balance: check.currentBalance
      }, { status: 402 })
    }
  } catch (e) {
    // 如果估算失败，回退到1
    const check = await TokenService.checkTokenBalance(session.user.id, 1)
    if (!check.sufficient) {
      return NextResponse.json({ error: 'Insufficient token balance', code: 'INSUFFICIENT_TOKENS', required: check.required, balance: check.currentBalance }, { status: 402 })
    }
  }
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
  const res = NextResponse.json({ success: true, data: { id } })
  try {
    res.headers.set('X-RateLimit-Limit', '10')
    res.headers.set('X-RateLimit-Remaining', '10')
    res.headers.set('Server-Timing', `upstream;dur=${Date.now() - t0}`)
  } catch {}
  return res
}

export const GET = withFeatureGuard(withApiProtection('adsCenter')(handleGET as any) as any, { featureId: 'adscenter_basic' })
export const POST = withFeatureGuard(withApiProtection('adsCenter')(handlePOST as any) as any, { featureId: 'adscenter_basic' })
