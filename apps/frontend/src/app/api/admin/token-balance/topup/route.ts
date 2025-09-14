import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { AuditService } from '@/lib/services/audit-service'
import { TokenService } from '@/lib/services/token-service'
import { $Enums } from '@prisma/client'

// POST /api/admin/token-balance/topup
// 手动充值（视为 PURCHASED），记录交易与余额
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
    if (!me || (me.role !== 'ADMIN' && me.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { userId, amount, paymentMethod } = await request.json()
    if (!userId || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const result = await TokenService.addTokens(
      userId,
      amount,
      `Manual top-up${paymentMethod ? ` via ${paymentMethod}` : ''}`,
      session.user.id,
      $Enums.TokenType.PURCHASED
    )

    if (!result.success) return NextResponse.json({ error: result.error || 'Failed to top up' }, { status: 400 })
    try {
      await new AuditService().log({
        userId: session.user.id,
        action: 'token_topup',
        resource: 'token_balance',
        details: { targetUserId: userId, amount, paymentMethod },
        severity: 'medium',
        category: 'data_modification',
        outcome: 'success'
      })
    } catch {}
    return NextResponse.json({ success: true, newBalance: result.newBalance })
  } catch (error) {
    console.error('Admin token topup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
