import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'
import { withFeatureGuard } from '@/lib/middleware/feature-guard-middleware'

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
  const list = await getExecutions(session.user.id)
  const idx = list.findIndex(e => e.id === params.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  list[idx] = { ...list[idx], status: 'cancelled' }
  await setExecutions(session.user.id, list, session.user.id)
  return NextResponse.json({ success: true })
}

export const POST = withFeatureGuard(handlePOST as any, { featureId: 'adscenter_basic', requireToken: false })

