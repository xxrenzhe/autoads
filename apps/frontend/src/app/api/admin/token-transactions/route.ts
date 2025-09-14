import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'

// GET /api/admin/token-transactions
// 返回近期交易列表，匹配前端 TokenBalanceManager 期望字段
export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
    if (!me || (me.role !== 'ADMIN' && me.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const rows = await prisma.tokenTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200
    })

    const data = rows.map((t: any) => ({
      id: t.id,
      userId: t.userId,
      type: (t.type as 'purchase' | 'usage' | 'refund' | 'bonus' | 'rollover') || 'usage',
      amount: t.amount,
      cost: undefined,
      description: t.description || t.source || '',
      feature: t.metadata?.feature || t.metadata?.operation,
      timestamp: t.createdAt?.toISOString?.() || new Date().toISOString(),
      status: 'completed' as const
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Admin token transactions list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

