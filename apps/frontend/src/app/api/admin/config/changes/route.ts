import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const prefix = url.searchParams.get('prefix') || undefined
  const take = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 200)

  try {
    const where: any = {}
    if (prefix) {
      where.configKey = { startsWith: prefix }
    }
    const rows = await prisma.config_change_history.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take
    })
    return NextResponse.json({ success: true, data: rows })
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Failed to load changes' }, { status: 500 })
  }
}

