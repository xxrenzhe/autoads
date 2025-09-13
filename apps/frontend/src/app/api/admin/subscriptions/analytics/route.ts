import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { createSecureHandler } from '@/lib/utils/api-security'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

async function handleGET(request: NextRequest, { user }: any) {
  // Check if user is admin
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  try {
    // Get subscription analytics
    const [
      totalSubscribers,
      totalRevenue,
      planDistribution,
      revenueByPlan,
      churnData
    ] = await Promise.all([
      // Total active subscribers
      prisma.subscription.count({
        where: { status: 'ACTIVE' }
      }),

      // Total revenue from payments
      prisma.payment.aggregate({
        where: { 
          subscription: { status: 'ACTIVE' }
        },
        _sum: { amount: true }
      }),

      // Plan distribution
      prisma.subscription.groupBy({
        by: ['planId'],
        where: { status: 'ACTIVE' },
        _count: { _all: true }
      }),

      // Revenue by plan - simplified calculation
      prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        include: {
          plan: { select: { name: true, price: true } },
          payments: {
            select: { amount: true }
          }
        }
      }),

      // Churn data (last 30 days)
      prisma.subscription.count({
        where: {
          status: 'CANCELED',
          updatedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ])

    // Calculate metrics
    const monthlyRecurringRevenue = totalRevenue._sum.amount || 0
    const averageRevenuePerUser = totalSubscribers > 0 ? monthlyRecurringRevenue / totalSubscribers : 0
    const churnRate = totalSubscribers > 0 ? (churnData / totalSubscribers) * 100 : 0

    // Format plan distribution
    const planDistributionFormatted = planDistribution.reduce((acc: any, item: any) => {
      // In a real implementation, you'd join with plan data
      const planName = `Plan ${item.planId}` // Simplified
      acc[planName] = item._count._all
      return acc
    }, {} as Record<string, number>)

    // Format revenue by plan - calculate from subscription data
    const revenueByPlanFormatted = revenueByPlan.reduce((acc: any, subscription: any) => {
      const planName = subscription.plan?.name || 'Unknown'
      const totalPayments = subscription.payments.reduce((sum: number, payment: any) => sum + payment.amount, 0)
      acc[planName] = (acc[planName] || 0) + totalPayments
      return acc
    }, {})

    const analytics = {
      totalSubscribers,
      totalRevenue: totalRevenue._sum.amount || 0,
      monthlyRecurringRevenue,
      averageRevenuePerUser,
      churnRate,
      conversionRate: 15.5, // Would calculate from actual data
      planDistribution: planDistributionFormatted,
      revenueByPlan: revenueByPlanFormatted
    }

    return NextResponse.json({
      success: true,
      data: analytics
    })
  } catch (error) {
    console.error('Error fetching subscription analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription analytics' },
      { status: 500 }
    )
  }
}

export const GET = createSecureHandler({
  requireAuth: true,
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    keyGenerator: (req: NextRequest) => {
      const session = req.headers.get('authorization') || 'anonymous';
      return `admin-subscription-analytics:${session}`;
    }
  },
  handler: handleGET
});
