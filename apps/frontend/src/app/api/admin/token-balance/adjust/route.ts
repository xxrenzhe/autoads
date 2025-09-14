import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { AuditService } from '@/lib/services/audit-service'
import { TokenService } from '@/lib/services/token-service'
import { $Enums } from '@prisma/client'

// POST /api/admin/token-balance/adjust
// 手动调整（正负皆可），记录交易与余额
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

    const { userId, amount, reason } = await request.json()
    if (!userId || typeof amount !== 'number' || !Number.isFinite(amount)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // 正数增加，负数减少：减少统一用 consumeTokens 语义更加复杂，因此这里仅支持正向调整
    if (amount < 0) {
      // 对于负向调整，简单地以“usage”记录方式落账（保持最小实现，后续可迁移到Go原子端点）
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { tokenBalance: true } })
      if (!user) return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
      if (user.tokenBalance + amount < 0) {
        return NextResponse.json({ error: 'Insufficient user balance for negative adjustment' }, { status: 400 })
      }
      await prisma.user.update({ where: { id: userId }, data: { tokenBalance: { decrement: Math.abs(amount) } } })
      await prisma.tokenTransaction.create({
        data: {
          userId,
          type: $Enums.TokenType.BONUS,
          amount: amount, // 负值
          balanceBefore: user.tokenBalance,
          balanceAfter: user.tokenBalance + amount,
          source: 'admin_adjustment',
          description: reason || 'Admin negative adjustment',
          metadata: { adjustedBy: session.user.id }
        }
      })
      // 审计记录
      try {
        await new AuditService().log({
          userId: session.user.id,
          action: 'token_adjust',
          resource: 'token_balance',
          details: { targetUserId: userId, amount, reason },
          severity: 'medium',
          category: 'data_modification',
          outcome: 'success'
        })
      } catch {}
      return NextResponse.json({ success: true })
    }

    const result = await TokenService.addTokens(userId, amount, reason || 'Admin adjustment', session.user.id, $Enums.TokenType.BONUS)
    if (!result.success) return NextResponse.json({ error: result.error || 'Failed to adjust' }, { status: 400 })
    try {
      await new AuditService().log({
        userId: session.user.id,
        action: 'token_adjust',
        resource: 'token_balance',
        details: { targetUserId: userId, amount, reason },
        severity: 'medium',
        category: 'data_modification',
        outcome: 'success'
      })
    } catch {}
    return NextResponse.json({ success: true, newBalance: result.newBalance })
  } catch (error) {
    console.error('Admin token adjust error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
