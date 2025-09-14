import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth/v5-config'
import { getCacheManager } from '@/lib/cache/cache-manager'

const CONFIG_KEY = 'api_management:endpoints'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const id = params.id
    const cfg = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } })
    let list: any[] = []
    try { list = cfg?.value ? JSON.parse(cfg.value) : [] } catch {}
    const idx = list.findIndex((e: any) => e.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
    list[idx].isActive = !list[idx].isActive
    list[idx].updatedAt = new Date().toISOString()
    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: JSON.stringify(list), updatedBy: session.user.id, updatedAt: new Date() },
      create: { key: CONFIG_KEY, value: JSON.stringify(list), category: 'api-management', description: 'API Management: endpoint catalog', isSecret: false, createdBy: session.user.id, updatedBy: session.user.id }
    })
    await getCacheManager().delete('api-management:endpoints:list')
    return NextResponse.json({ success: true, data: list[idx] })
  } catch (err) {
    console.error('Toggle endpoint error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

