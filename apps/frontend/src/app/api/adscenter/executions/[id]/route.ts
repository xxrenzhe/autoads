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
  const list = await getExecutions(session.user.id)
  const item = list.find(e => e.id === params.id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: item })
}

export const GET = withFeatureGuard(handleGET as any, { featureId: 'adscenter_basic', requireToken: false })

