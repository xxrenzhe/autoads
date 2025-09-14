import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'
import { getAuditService } from '@/lib/services/audit-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
    if (!me || (me.role !== 'ADMIN' && me.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const fmt = (searchParams.get('format') || 'json').toLowerCase()
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const timeRange = start && end ? { start: new Date(start), end: new Date(end) } : undefined

    const audit = getAuditService()
    if (fmt === 'csv') {
      const csv = await audit.exportLogs({ ...(timeRange ? { startDate: timeRange.start, endDate: timeRange.end } : {}) } as any, 'csv')
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-logs-${Date.now()}.csv"`
        }
      })
    }
    const json = await audit.exportLogs({ ...(timeRange ? { startDate: timeRange.start, endDate: timeRange.end } : {}) } as any, 'json')
    return new NextResponse(json, { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Audit export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

