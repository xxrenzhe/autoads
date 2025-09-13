import { prisma } from '@/lib/prisma';

export interface PlanMetrics {
  planId: string;
  planName: string;
  subscribers: number;
  revenue: number;
  conversionRate: number;
  churnRate: number;
  avgLifetimeValue: number;
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
}

export class PlanAnalyticsService {
  /**
   * Calculate plan performance metrics with real data
   */
  static async calculatePlanMetrics(planId: string): Promise<PlanMetrics> {
    // Get current subscribers
    const subscribers = await prisma.subscription.count({
      where: { 
        planId, 
        status: 'ACTIVE',
        currentPeriodEnd: { gt: new Date() }
      }
    });

    // Get revenue from payments in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPayments = await prisma.payment.aggregate({
      where: { 
        subscription: { planId },
        status: 'COMPLETED',
        createdAt: { gte: thirtyDaysAgo }
      },
      _sum: { amount: true },
      _count: true
    });

    // Calculate total revenue (all time)
    const totalRevenue = await prisma.payment.aggregate({
      where: { 
        subscription: { planId },
        status: 'COMPLETED'
      },
      _sum: { amount: true }
    });

    // Get plan details for pricing
    const plan = await prisma.plan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    // Calculate MRR and ARR
    const monthlyPrice = plan.interval === 'MONTH' ? plan.price : plan.price / 12;
    const mrr = subscribers * monthlyPrice;
    const arr = mrr * 12;

    // Calculate conversion rate
    // Track users who visited pricing page and converted
    const conversionRate = await this.calculateConversionRate(planId);

    // Calculate churn rate
    const churnRate = await this.calculateChurnRate(planId);

    // Calculate average lifetime value
    const avgLifetimeValue = subscribers > 0 ? (totalRevenue._sum.amount || 0) / subscribers : 0;

    return {
      planId,
      planName: plan.name,
      subscribers,
      revenue: recentPayments._sum.amount || 0,
      conversionRate,
      churnRate,
      avgLifetimeValue,
      mrr,
      arr
    };
  }

  /**
   * Calculate conversion rate for a plan
   */
  private static async calculateConversionRate(planId: string): Promise<number> {
    // Get users who viewed pricing page in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // This would typically track page views, for now we'll use user activity
    const pricingPageViews = await prisma.userActivity.count({
      where: {
        action: 'page_view',
        resource: '/pricing',
        timestamp: { gte: thirtyDaysAgo }
      }
    });

    // Get new subscriptions for this plan in the same period
    const newSubscriptions = await prisma.subscription.count({
      where: {
        planId,
        createdAt: { gte: thirtyDaysAgo },
        status: 'ACTIVE'
      }
    });

    // Calculate conversion rate
    if (pricingPageViews === 0) return 0;
    return (newSubscriptions / pricingPageViews) * 100;
  }

  /**
   * Calculate churn rate for a plan
   */
  private static async calculateChurnRate(planId: string): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Get active subscribers 30-60 days ago
    const previousSubscribers = await prisma.subscription.count({
      where: {
        planId,
        status: 'ACTIVE',
        currentPeriodEnd: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
      }
    });

    // Get subscriptions that were canceled or expired in the last 30 days
    const canceledSubscriptions = await prisma.subscription.count({
      where: {
        planId,
        status: { in: ['CANCELED', 'EXPIRED'] },
        updatedAt: { gte: thirtyDaysAgo },
        currentPeriodEnd: { lt: new Date() }
      }
    });

    // Calculate churn rate
    if (previousSubscribers === 0) return 0;
    return (canceledSubscriptions / previousSubscribers) * 100;
  }

  /**
   * Get comparison data for all plans
   */
  static async getAllPlansComparison(): Promise<PlanMetrics[]> {
    const plans = await prisma.plan.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { sortOrder: 'asc' }
    });

    const metrics = await Promise.all(
      plans.map(((plan: any) => this.calculatePlanMetrics(plan.id))
    );

    return metrics;
  }

  /**
   * Get overall subscription analytics
   */
  static async getOverallAnalytics() {
    const totalSubscribers = await prisma.subscription.count({
      where: { 
        status: 'ACTIVE',
        currentPeriodEnd: { gt: new Date() }
      }
    });

    const totalRevenue = await prisma.payment.aggregate({
      where: { 
        status: 'COMPLETED',
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      },
      _sum: { amount: true }
    });

    const newSubscriptionsThisMonth = await prisma.subscription.count({
      where: {
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        status: 'ACTIVE'
      }
    });

    const churnedSubscriptionsThisMonth = await prisma.subscription.count({
      where: {
        status: { in: ['CANCELED', 'EXPIRED'] },
        updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      }
    });

    const overallChurnRate = totalSubscribers > 0 
      ? (churnedSubscriptionsThisMonth / totalSubscribers) * 100 
      : 0;

    return {
      totalSubscribers,
      monthlyRevenue: totalRevenue._sum.amount || 0,
      newSubscriptionsThisMonth,
      churnedSubscriptionsThisMonth,
      overallChurnRate
    };
  }
}