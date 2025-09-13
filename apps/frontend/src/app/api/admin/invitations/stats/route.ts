import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';

// GET /api/admin/invitations/stats - 获取邀请统计
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // 获取今日开始时间
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 获取本月开始时间
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // 并行获取所有统计数据
    const [
      totalInvitations,
      todayInvitations,
      monthInvitations,
      pendingInvitations,
      acceptedInvitations,
      expiredInvitations,
      totalTokensReward,
      invitationRate,
      topInviters,
      invitationsByDay,
    ] = await Promise.all([
      // 总邀请数
      prisma.invitation.count({
        where: dateFilter,
      }),

      // 今日创建邀请数
      prisma.invitation.count({
        where: {
          createdAt: {
            gte: today,
          },
          ...dateFilter,
        },
      }),

      // 本月创建邀请数
      prisma.invitation.count({
        where: {
          createdAt: {
            gte: monthStart,
          },
          ...dateFilter,
        },
      }),

      // 待使用邀请数
      prisma.invitation.count({
        where: {
          status: 'PENDING',
          ...dateFilter,
        },
      }),

      // 已使用邀请数
      prisma.invitation.count({
        where: {
          status: 'ACCEPTED',
          ...dateFilter,
        },
      }),

      // 已过期邀请数
      prisma.invitation.count({
        where: {
          status: 'EXPIRED',
          ...dateFilter,
        },
      }),

      // 总奖励Token数
      prisma.invitation.aggregate({
        where: {
          status: 'ACCEPTED',
          ...dateFilter,
        },
        _sum: {
          tokensReward: true,
        },
      }),

      // 邀请成功率
      prisma.invitation.groupBy({
        by: ['status'],
        where: dateFilter,
        _count: {
          _all: true,
        },
      }),

      // 邀请最多的用户
      prisma.invitation.groupBy({
        by: ['inviterId'],
        where: dateFilter,
        _count: {
          _all: true,
        },
        _sum: {
          tokensReward: true,
        },
        orderBy: {
          inviterId: 'desc',
        },
        take: 10,
      }),

      // 每日邀请统计（最近30天）
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted,
          SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
          SUM(tokens_reward) as totalTokens
        FROM invitations
        WHERE 
          created_at >= ${monthStart}
          ${startDate ? `AND created_at >= ${startDate}::timestamp` : ''}
          ${endDate ? `AND created_at <= ${endDate}::timestamp` : ''}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      ` as unknown as Array<{ date: string; total: number; accepted: number; pending: number; totalTokens: number }>,
    ]);

    // 计算邀请成功率
    const statusCounts = invitationRate.reduce((acc, item: any) => {
      acc[item.status] = item._count._all;
      return acc;
    }, {} as Record<string, number>);

    const totalWithStatus = Object.values(statusCounts).reduce((sum, count: any) => sum + count, 0);
    const acceptanceRate = totalWithStatus > 0 
      ? ((statusCounts.ACCEPTED || 0) / totalWithStatus) * 100 
      : 0;

    // 获取Top邀请者的详细信息
    const topInvitersWithDetails = await Promise.all(
      topInviters.map(async (inviter) => {
        const userInfo = await prisma.user.findUnique({
          where: { id: inviter.inviterId },
          select: {
            id: true,
            email: true,
            name: true,
          },
        });
        return {
          ...inviter,
          user: userInfo,
        };
      })
    );

    const stats = {
      totalInvitations,
      todayInvitations,
      monthInvitations,
      pendingInvitations,
      acceptedInvitations,
      expiredInvitations,
      totalTokensReward: totalTokensReward._sum.tokensReward || 0,
      acceptanceRate: Math.round(acceptanceRate * 100) / 100,
      topInviters: topInvitersWithDetails,
      invitationsByDay,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching invitation stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}