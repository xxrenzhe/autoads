import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';

// GET /api/admin/payments/stats - 获取支付统计数据
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

    // 获取基本统计
    const [
      totalRevenue,
      totalPayments,
      successfulPayments,
      paymentStatsByMethod,
      paymentStatsByStatus,
      dailyRevenue,
    ] = await Promise.all([
      // 总收入
      prisma.payment.aggregate({
        where: {
          ...dateFilter,
          status: 'SUCCEEDED',
        },
        _sum: {
          amount: true,
        },
      }),

      // 总支付数
      prisma.payment.count({
        where: dateFilter,
      }),

      // 成功支付数
      prisma.payment.count({
        where: {
          ...dateFilter,
          status: 'SUCCEEDED',
        },
      }),

      // 按支付方式统计
      prisma.payment.groupBy({
        by: ['provider'],
        where: {
          ...dateFilter,
          status: 'SUCCEEDED',
        },
        _sum: {
          amount: true,
        },
        _count: {
          _all: true,
        },
      }),

      // 按状态统计
      prisma.payment.groupBy({
        by: ['status'],
        where: dateFilter,
        _sum: {
          amount: true,
        },
        _count: {
          _all: true,
        },
      }),

      // 每日收入
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          SUM(amount) as amount,
          COUNT(*) as count
        FROM payments
        WHERE 
          status = 'SUCCEEDED'
          ${startDate ? `AND created_at >= ${startDate}::timestamp` : ''}
          ${endDate ? `AND created_at <= ${endDate}::timestamp` : ''}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      ` as any,
    ]);

    // 处理统计数据
    const revenueByMethod = paymentStatsByMethod.map((stat: any) => ({
      method: stat.provider,
      amount: stat._sum.amount || 0,
      count: stat._count._all,
    }));

    const revenueByStatus = paymentStatsByStatus.map((stat: any) => ({
      status: stat.status,
      amount: stat._sum.amount || 0,
      count: stat._count._all,
    }));

    const stats = {
      totalRevenue: totalRevenue._sum.amount || 0,
      totalPayments,
      successRate: totalPayments > 0 ? successfulPayments / totalPayments : 0,
      averageAmount: totalPayments > 0 ? (totalRevenue._sum.amount || 0) / successfulPayments : 0,
      revenueByMethod,
      revenueByStatus,
      dailyRevenue: dailyRevenue.map(((day: any) => ({
        date: day.date,
        amount: Number(day.amount),
        count: day.count,
      })),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}