import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'
import { withFeatureGuard } from '@/lib/middleware/feature-guard-middleware'
import { withApiProtection } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const KEY = (userId: string) => `adscenter:${userId}:setup_progress`

async function getProgress(userId: string): Promise<any | null> {
  const existing = await prisma.systemConfig.findUnique({ where: { key: KEY(userId) } })
  if (!existing?.value) return null
  try { return JSON.parse(existing.value) } catch { return null }
}

async function setProgress(userId: string, value: any, updatedBy: string) {
  const serialized = JSON.stringify(value)
  const existing = await prisma.systemConfig.findUnique({ where: { key: KEY(userId) } })
  if (existing) {
    await prisma.systemConfig.update({ where: { key: KEY(userId) }, data: { value: serialized, updatedBy } })
  } else {
    await prisma.systemConfig.create({ data: { key: KEY(userId), value: serialized, category: 'adscenter', description: 'Setup progress', createdBy: updatedBy, updatedBy } })
  }
}

async function handleGET(_req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const value = await getProgress(session.user.id)
  return NextResponse.json({ success: true, data: value })
}

async function handlePOST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  await setProgress(session.user.id, body, session.user.id)
  return NextResponse.json({ success: true })
}

export const GET = withFeatureGuard(withApiProtection('adsCenter')(handleGET as any) as any, { featureId: 'adscenter_basic' })
export const POST = withFeatureGuard(withApiProtection('adsCenter')(handlePOST as any) as any, { featureId: 'adscenter_basic' })
