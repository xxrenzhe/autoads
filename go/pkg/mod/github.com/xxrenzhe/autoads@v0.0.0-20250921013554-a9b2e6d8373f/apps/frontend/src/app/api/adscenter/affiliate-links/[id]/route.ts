import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'
import { withFeatureGuard } from '@/lib/middleware/feature-guard-middleware'
import { withApiProtection } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type AffiliateLink = {
  id: string
  name: string
  affiliateUrl: string
  description?: string
  category?: string
  isActive: boolean
  status: 'valid' | 'invalid' | 'untested'
  createdAt: string
}

const KEY = (userId: string) => `adscenter:${userId}:affiliate_links`

async function getLinks(userId: string): Promise<AffiliateLink[]> {
  const existing = await prisma.systemConfig.findUnique({ where: { key: KEY(userId) } })
  if (!existing?.value) return []
  try { return JSON.parse(existing.value) as AffiliateLink[] } catch { return [] }
}

async function setLinks(userId: string, list: AffiliateLink[], updatedBy: string) {
  const value = JSON.stringify(list)
  const existing = await prisma.systemConfig.findUnique({ where: { key: KEY(userId) } })
  if (existing) {
    await prisma.systemConfig.update({ where: { key: KEY(userId) }, data: { value, updatedBy } })
  } else {
    await prisma.systemConfig.create({ data: { key: KEY(userId), value, category: 'adscenter', description: 'Affiliate links', createdBy: updatedBy, updatedBy } })
  }
}

async function handleGET(_req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const list = await getLinks(session.user.id)
  const item = list.find(l => l.id === params.id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: item })
}

async function handlePUT(req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const list = await getLinks(session.user.id)
  const idx = list.findIndex(l => l.id === params.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  list[idx] = { ...list[idx], ...body }
  await setLinks(session.user.id, list, session.user.id)
  return NextResponse.json({ success: true, data: list[idx] })
}

async function handleDELETE(_req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const list = await getLinks(session.user.id)
  const idx = list.findIndex(l => l.id === params.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  list.splice(idx, 1)
  await setLinks(session.user.id, list, session.user.id)
  return NextResponse.json({ success: true })
}

export const GET = withFeatureGuard(withApiProtection('adsCenter')(handleGET as any) as any, { featureId: 'adscenter_basic' })
export const PUT = withFeatureGuard(withApiProtection('adsCenter')(handlePUT as any) as any, { featureId: 'adscenter_basic' })
export const DELETE = withFeatureGuard(withApiProtection('adsCenter')(handleDELETE as any) as any, { featureId: 'adscenter_basic' })
