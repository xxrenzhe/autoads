import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth/v5-config'

const CONFIG_KEY = 'api_management:rate_limit_rules'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const id = params.id
    const body = await req.json()
    const cfg = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } })
    let rules: any[] = []
    try { rules = cfg?.value ? JSON.parse(cfg.value) : [] } catch {}
    const idx = rules.findIndex((r: any) => r.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    rules[idx].isActive = !!body.isActive
    rules[idx].updatedAt = new Date().toISOString()
    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: JSON.stringify(rules), updatedBy: session.user.id, updatedAt: new Date() },
      create: { key: CONFIG_KEY, value: JSON.stringify(rules), category: 'api-management', description: 'API Management: rate limit rules', isSecret: false, createdBy: session.user.id, updatedBy: session.user.id }
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Update rate limit rule status error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

