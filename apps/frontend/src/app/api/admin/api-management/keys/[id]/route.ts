import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth/v5-config'
import { getCacheManager } from '@/lib/cache/cache-manager'

const CONFIG_KEY = 'api_management:keys'

type APIKey = {
  id: string
  name: string
  keyPrefix: string
  userId: string | null
  permissions: string[]
  rateLimitOverride?: number
  isActive: boolean
  expiresAt?: string | null
  lastUsed?: string | null
  totalRequests: number
  createdAt: string
  encryptedKey?: string
}

async function getStoredKeys(): Promise<APIKey[]> {
  const cfg = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } })
  if (!cfg) return []
  try { const parsed = JSON.parse(cfg.value); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
}

async function saveKeys(userId: string, keys: APIKey[]) {
  const value = JSON.stringify(keys)
  const now = new Date()
  await prisma.systemConfig.upsert({
    where: { key: CONFIG_KEY },
    update: { value, updatedBy: userId, updatedAt: now },
    create: { key: CONFIG_KEY, value, category: 'api-management', description: 'API Management: API keys', isSecret: true, createdBy: userId, updatedBy: userId }
  })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const id = params.id
    const body = await req.json()
    const list = await getStoredKeys()
    const idx = list.findIndex(k => k.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    const prev = list[idx]
    const updated: APIKey = {
      ...prev,
      name: body.name ?? prev.name,
      userId: body.userId ?? prev.userId,
      permissions: Array.isArray(body.permissions) ? body.permissions : prev.permissions,
      rateLimitOverride: body.rateLimitOverride ?? prev.rateLimitOverride,
      isActive: body.isActive ?? prev.isActive,
      expiresAt: body.expiresAt ?? prev.expiresAt
    }
    list[idx] = updated
    await saveKeys(session.user.id, list)
    await getCacheManager().delete('api-management:keys:list')
    const { encryptedKey, ...safe } = updated
    return NextResponse.json({ success: true, data: safe })
  } catch (err) {
    console.error('Key PUT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const id = params.id
    const list = await getStoredKeys()
    const next = list.filter(k => k.id !== id)
    if (next.length === list.length) return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    await saveKeys(session.user.id, next)
    await getCacheManager().delete('api-management:keys:list')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Key DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

