import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'
import { withFeatureGuard } from '@/lib/middleware/feature-guard-middleware'

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

async function handleGET(_req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const list = await getLinks(session.user.id)
  return NextResponse.json({ success: true, data: list })
}

async function handlePOST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { name, affiliateUrl, description, category } = body as any
  if (!name || !affiliateUrl) return NextResponse.json({ error: 'name and affiliateUrl are required' }, { status: 400 })
  const list = await getLinks(session.user.id)
  const id = `aff_${Date.now()}`
  list.push({ id, name, affiliateUrl, description, category, isActive: true, status: 'untested', createdAt: new Date().toISOString() })
  await setLinks(session.user.id, list, session.user.id)
  return NextResponse.json({ success: true, data: { id } })
}

export const GET = withFeatureGuard(handleGET as any, { featureId: 'adscenter_basic', requireToken: false })
export const POST = withFeatureGuard(handlePOST as any, { featureId: 'adscenter_basic', requireToken: false })

