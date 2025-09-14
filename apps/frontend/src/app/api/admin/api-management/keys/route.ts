import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth/v5-config'
import { getCacheManager } from '@/lib/cache/cache-manager'
import { EncryptionService } from '@/lib/services/encryption-service'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

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
  // Internal fields (not returned to clients normally)
  encryptedKey?: string
}

async function getStoredKeys(): Promise<APIKey[]> {
  const cfg = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } })
  if (!cfg) return []
  try {
    const parsed = JSON.parse(cfg.value)
    return Array.isArray(parsed) ? parsed as APIKey[] : []
  } catch {
    return []
  }
}

async function saveKeys(userId: string, keys: APIKey[]) {
  const value = JSON.stringify(keys)
  const now = new Date()
  await prisma.systemConfig.upsert({
    where: { key: CONFIG_KEY },
    update: { value, updatedBy: userId, updatedAt: now },
    create: {
      key: CONFIG_KEY,
      value,
      category: 'api-management',
      description: 'API Management: API keys',
      isSecret: true,
      createdBy: userId,
      updatedBy: userId
    }
  })
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const cache = getCacheManager()
    const cacheKey = 'api-management:keys:list'
    const cached = await cache.get<APIKey[]>(cacheKey)
    if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

    const keys = await getStoredKeys()
    // Do not leak encryptedKey
    const safe = keys.map(({ encryptedKey, ...rest }) => rest)
    await cache.set(cacheKey, safe, 60)
    return NextResponse.json({ success: true, data: safe })
  } catch (err) {
    console.error('Keys GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json()

    const enc = new EncryptionService()
    const fullKey = enc.generateApiKey('ak')
    const encryptedKey = enc.encryptApiKey(fullKey)
    const keyPrefix = fullKey.slice(0, 16)

    const nowISO = new Date().toISOString()
    const key: APIKey = {
      id: crypto.randomUUID(),
      name: body.name || 'New API Key',
      keyPrefix,
      userId: body.userId || null,
      permissions: Array.isArray(body.permissions) ? body.permissions : ['*'],
      rateLimitOverride: body.rateLimitOverride ? Number(body.rateLimitOverride) : undefined,
      isActive: body.isActive ?? true,
      expiresAt: body.expiresAt || null,
      lastUsed: null,
      totalRequests: 0,
      createdAt: nowISO,
      encryptedKey
    }

    const list = await getStoredKeys()
    list.unshift(key)
    await saveKeys(session.user.id, list)
    await getCacheManager().delete('api-management:keys:list')

    // Return full key only upon creation
    const { encryptedKey: _ek, ...safe } = key
    return NextResponse.json({ success: true, data: { ...safe, fullKey } })
  } catch (err) {
    console.error('Keys POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
