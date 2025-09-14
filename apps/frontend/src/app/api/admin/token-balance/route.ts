import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'

// 返回管理员视图下用户Token余额概览
// GET /api/admin/token-balance
export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 简单的管理员校验（沿用现有角色模型）
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
    if (!me || (me.role !== 'ADMIN' && me.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // 拉取最近一段时间的使用量（近30天）
    const since = new Date()
    since.setDate(since.getDate() - 30)

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        tokenBalance: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          select: { plan: { select: { name: true, tokenQuota: true } } },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      take: 500
    })

    // 统计最近使用量
    const recentUsage = await prisma.token_usage.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: since } },
      _sum: { tokensConsumed: true }
    })
    const recentUsageMap = new Map<string, number>(recentUsage.map((r: any) => [r.userId, r._sum.tokensConsumed || 0]))

    const data = users.map((u) => {
      const planName = u.subscriptions?.[0]?.plan?.name || 'Free'
      const monthlyAllocation = u.subscriptions?.[0]?.plan?.tokenQuota || 0
      const usedTokens = recentUsageMap.get(u.id) || 0
      return {
        userId: u.id,
        totalTokens: u.tokenBalance + usedTokens,
        usedTokens,
        remainingTokens: u.tokenBalance,
        lastUpdated: new Date().toISOString(),
        subscriptionPlan: planName,
        monthlyAllocation,
        rolloverTokens: 0
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Admin token balance list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

