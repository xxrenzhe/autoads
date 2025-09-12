import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';

// GET /api/admin/check-ins/stats - 获取签到统计
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
      dateFilter.date = {
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
      totalCheckIns,
      todayCheckIns,
      monthCheckIns,
      totalTokensAwarded,
      todayTokensAwarded,
      monthTokensAwarded,
      uniqueUsers,
      activeStreaks,
      averageStreak,
      checkInsByDay,
      topUsers,
    ] = await Promise.all([
      // 总签到次数
      prisma.checkIn.count({
        where: dateFilter,
      }),

      // 今日签到次数
      prisma.checkIn.count({
        where: {
          date: {
            gte: today,
          },
          ...dateFilter,
        },
      }),

      // 本月签到次数
      prisma.checkIn.count({
        where: {
          date: {
            gte: monthStart,
          },
          ...dateFilter,
        },
      }),

      // 总奖励Token数
      prisma.checkIn.aggregate({
        where: dateFilter,
        _sum: {
          tokens: true,
        },
      }),

      // 今日奖励Token数
      prisma.checkIn.aggregate({
        where: {
          date: {
            gte: today,
          },
          ...dateFilter,
        },
        _sum: {
          tokens: true,
        },
      }),

      // 本月奖励Token数
      prisma.checkIn.aggregate({
        where: {
          date: {
            gte: monthStart,
          },
          ...dateFilter,
        },
        _sum: {
          tokens: true,
        },
      }),

      // 独立用户数
      prisma.checkIn.groupBy({
        by: ['userId'],
        where: dateFilter,
      }),

      // 活跃连续签到用户数（连续签到3天以上）
      prisma.checkIn.groupBy({
        by: ['userId'],
        where: {
          ...dateFilter,
          streak: {
            gte: 3,
          },
        },
      }),

      // 平均连续签到天数
      prisma.checkIn.aggregate({
        where: dateFilter,
        _avg: {
          streak: true,
        },
      }),

      // 每日签到统计（最近30天）
      prisma.$queryRaw`
        SELECT 
          DATE(date) as date,
          COUNT(*) as count,
          SUM(tokens) as totalTokens,
          AVG(streak) as avgStreak
        FROM check_ins
        WHERE 
          date >= ${monthStart}
          ${startDate ? `AND date >= ${startDate}::timestamp` : ''}
          ${endDate ? `AND date <= ${endDate}::timestamp` : ''}
        GROUP BY DATE(date)
        ORDER BY date DESC
        LIMIT 30
      ` as unknown as Array<{ date: string; count: number; totalTokens: number; avgStreak: number }>,

      // 签到次数最多的用户
      prisma.checkIn.groupBy({
        by: ['userId'],
        where: dateFilter,
        _count: {
          _all: true,
        },
        _sum: {
          tokens: true,
        },
        orderBy: {
          userId: 'desc',
        },
        take: 10,
      }),
    ]);

    // 获取Top用户的详细信息
    const topUsersWithDetails = await Promise.all(
      topUsers.map(async (user) => {
        const userInfo = await prisma.user.findUnique({
          where: { id: user.userId },
          select: {
            id: true,
            email: true,
            name: true,
          },
        });
        return {
          ...user,
          user: userInfo,
        };
      })
    );

    const stats = {
      totalCheckIns,
      todayCheckIns,
      monthCheckIns,
      totalTokensAwarded: totalTokensAwarded._sum.tokens || 0,
      todayTokensAwarded: todayTokensAwarded._sum.tokens || 0,
      monthTokensAwarded: monthTokensAwarded._sum.tokens || 0,
      uniqueUsers: uniqueUsers.length,
      activeStreaks: activeStreaks.length,
      averageStreak: Math.round((averageStreak._avg.streak || 0) * 100) / 100,
      checkInsByDay,
      topUsers: topUsersWithDetails,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching check-in stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}