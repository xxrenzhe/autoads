import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth/v5-config'
import { getCacheManager } from '@/lib/cache/cache-manager'

const CONFIG_KEY = 'api_management:keys'

type APIKey = { id: string; isActive: boolean }

async function getStoredKeys(): Promise<APIKey[]> {
  const cfg = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } })
  if (!cfg) return []
  try { const parsed = JSON.parse(cfg.value); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
}

async function saveKeys(userId: string, keys: any[]) {
  const now = new Date()
  await prisma.systemConfig.upsert({
    where: { key: CONFIG_KEY },
    update: { value: JSON.stringify(keys), updatedBy: userId, updatedAt: now },
    create: { key: CONFIG_KEY, value: JSON.stringify(keys), category: 'api-management', description: 'API Management: API keys', isSecret: true, createdBy: userId, updatedBy: userId }
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const id = params.id
    const list = await getStoredKeys()
    const idx = list.findIndex((k: any) => k.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    list[idx].isActive = false
    await saveKeys(session.user.id, list)
    await getCacheManager().delete('api-management:keys:list')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Key revoke error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

