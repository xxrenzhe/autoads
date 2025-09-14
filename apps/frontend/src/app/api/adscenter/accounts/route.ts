import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'
import { withFeatureGuard } from '@/lib/middleware/feature-guard-middleware'
import { withApiProtection } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type Account = {
  accountId: string
  accountName: string
  createdAt: string
}

const KEY = (userId: string) => `adscenter:${userId}:accounts`

async function getAccounts(userId: string): Promise<Account[]> {
  const existing = await prisma.systemConfig.findUnique({ where: { key: KEY(userId) } })
  if (!existing?.value) return []
  try { return JSON.parse(existing.value) as Account[] } catch { return [] }
}

async function setAccounts(userId: string, accounts: Account[], updatedBy: string) {
  const value = JSON.stringify(accounts)
  const existing = await prisma.systemConfig.findUnique({ where: { key: KEY(userId) } })
  if (existing) {
    await prisma.systemConfig.update({ where: { key: KEY(userId) }, data: { value, updatedBy } })
  } else {
    await prisma.systemConfig.create({ data: { key: KEY(userId), value, category: 'adscenter', description: 'AdsCenter accounts', createdBy: updatedBy, updatedBy } })
  }
}

async function handleGET(_req: NextRequest): Promise<NextResponse> {
  const t0 = Date.now();
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // 优先从规范化表读取，回退到 SystemConfig
  try {
    const rows = await prisma.adsAccount.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' }
    })
    if (rows && rows.length > 0) {
      const data = rows.map((r: any) => ({
        accountId: r.accountId,
        accountName: r.accountName,
        createdAt: r.createdAt.toISOString(),
        status: r.status || 'active'
      }))
      const res = NextResponse.json({ success: true, data })
      try { res.headers.set('X-RateLimit-Limit', '30'); res.headers.set('X-RateLimit-Remaining', '30'); } catch {}
      try { res.headers.set('Server-Timing', `upstream;dur=${Date.now() - t0}`) } catch {}
      return res
    }
  } catch (e) {
    // ignore and fallback
  }
  const accounts = await getAccounts(session.user.id)
  const resList = NextResponse.json({ success: true, data: accounts })
  try { resList.headers.set('Server-Timing', `upstream;dur=${Date.now() - t0}`) } catch {}
  return resList
}

async function handlePOST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { accountId, accountName } = body as Partial<Account>
  if (!accountId || !accountName) return NextResponse.json({ error: 'accountId and accountName are required' }, { status: 400 })
  // 先写入规范化表
  try {
    await prisma.adsAccount.upsert({
      where: { userId_accountId: { userId: session.user.id, accountId } },
      update: { accountName, status: 'active' },
      create: { userId: session.user.id, accountId, accountName, status: 'active' }
    })
  } catch (e) {
    // ignore and continue to maintain fallback
  }

  // 维护回退的 SystemConfig 列表，确保向后兼容
  const list = await getAccounts(session.user.id)
  if (!list.some(a => a.accountId === accountId)) {
    const now = new Date().toISOString()
    list.push({ accountId, accountName, createdAt: now })
    await setAccounts(session.user.id, list, session.user.id)
  }
  const res2 = NextResponse.json({ success: true, data: list })
  try { res2.headers.set('X-RateLimit-Limit', '10'); res2.headers.set('X-RateLimit-Remaining', '10'); } catch {}
  return res2
}

export const GET = withFeatureGuard(withApiProtection('adsCenter')(handleGET as any) as any, { featureId: 'adscenter_basic' })
export const POST = withFeatureGuard(withApiProtection('adsCenter')(handlePOST as any) as any, { featureId: 'adscenter_basic' })
