import { prisma } from '@/lib/prisma';
import { PlanFeaturesService } from './plan-features-service';

/**
 * Subscription quota management service
 */
export class SubscriptionQuotaService {
  /**
   * Quota types
   */
  static readonly QUOTA_TYPES = {
    API_CALLS: 'API_CALLS_PER_MONTH',
    BATCH_SIZE: 'BATCH_SIZE_LIMIT',
    STORAGE: 'STORAGE_LIMIT',
    TOKEN_QUOTA: 'TOKEN_QUOTA'
  };

  /**
   * Check if user has sufficient quota for a feature
   */
  static async checkQuota(userId: string, quotaType: string, requiredAmount: number = 1): Promise<{
    hasQuota: boolean;
    remaining: number;
    limit: number;
    resetDate?: Date;
  }> {
    // Get user's current subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: {
          gt: new Date()
        }
      },
      include: {
        plan: true
      }
    });

    if (!subscription) {
      // Check if user has free plan
      const freePlan = await prisma.plan.findFirst({
        where: { name: 'free', status: 'ACTIVE' }
      });
      
      if (!freePlan) {
        return { hasQuota: false, remaining: 0, limit: 0 };
      }
      
      return this.checkPlanQuota(freePlan.id, quotaType, requiredAmount);
    }

    return this.checkPlanQuota(subscription.planId, quotaType, requiredAmount, subscription.currentPeriodEnd);
  }

  /**
   * Check quota for a specific plan
   */
  static async checkPlanQuota(planId: string, quotaType: string, requiredAmount: number = 1, periodEnd?: Date): Promise<{
    hasQuota: boolean;
    remaining: number;
    limit: number;
    resetDate?: Date;
  }> {
    // Get quota limit from plan features
    const quotaLimit = await PlanFeaturesService.getFeatureValue(planId, quotaType);
    
    if (quotaLimit === null || quotaLimit === undefined) {
      // Feature not available for this plan
      return { hasQuota: false, remaining: 0, limit: 0 };
    }

    // Get current usage
    const currentUsage = await this.getCurrentUsage(planId, quotaType, periodEnd);
    const remaining = Math.max(0, quotaLimit - currentUsage);

    return {
      hasQuota: remaining >= requiredAmount,
      remaining,
      limit: quotaLimit,
      resetDate: periodEnd
    };
  }

  /**
   * Get current usage for a quota type
   */
  static async getCurrentUsage(planId: string, quotaType: string, periodEnd?: Date): Promise<number> {
    const now = new Date();
    const periodStart = periodEnd ? new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000) : new Date(now.getFullYear(), now.getMonth(), 1);

    switch (quotaType) {
      case this.QUOTA_TYPES.API_CALLS:
        return await prisma.apiUsage.count({
          where: {
            user: {
              subscriptions: {
                some: {
                  planId,
                  status: 'ACTIVE',
                  currentPeriodEnd: { gt: now }
                }
              }
            },
            timestamp: {
              gte: periodStart,
              lte: periodEnd || now
            }
          }
        });

      case this.QUOTA_TYPES.BATCH_SIZE:
        // This is a per-request limit, not cumulative
        return 0;

      case this.QUOTA_TYPES.STORAGE:
        // Calculate storage usage from relevant data
        // This is a simplified example - implement based on your storage needs
        const userCount = await prisma.user.count({
          where: {
            subscriptions: {
              some: {
                planId,
                status: 'ACTIVE'
              }
            }
          }
        });
        return userCount * 0.1; // Example: 0.1MB per user

      case this.QUOTA_TYPES.TOKEN_QUOTA:
        // Get token usage from token_usage table
        const tokenUsage = await prisma.token_usage.aggregate({
          where: {
            user: {
              subscriptions: {
                some: {
                  planId,
                  status: 'ACTIVE',
                  currentPeriodEnd: { gt: now }
                }
              }
            },
            createdAt: {
              gte: periodStart,
              lte: periodEnd || now
            }
          },
          _sum: {
            tokensConsumed: true
          }
        });
        return tokenUsage._sum.tokensConsumed || 0;

      default:
        return 0;
    }
  }

  /**
   * Consume quota
   */
  static async consumeQuota(userId: string, quotaType: string, amount: number = 1): Promise<boolean> {
    // Check if user has sufficient quota
    const quota = await this.checkQuota(userId, quotaType, amount);
    
    if (!quota.hasQuota) {
      return false;
    }

    // Record usage (this depends on the specific quota type)
    switch (quotaType) {
      case this.QUOTA_TYPES.API_CALLS:
        // API calls are logged automatically by the API usage system
        break;

      case this.QUOTA_TYPES.TOKEN_QUOTA:
        // Token usage is tracked by the token system
        break;

      // Add other quota types as needed
    }

    return true;
  }

  /**
   * Get user's quota usage summary
   */
  static async getUserQuotaSummary(userId: string) {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: {
          gt: new Date()
        }
      },
      include: {
        plan: {
          include: {
            planFeatures: true
          }
        }
      }
    });

    if (!subscription) {
      // Return free plan quotas
      const freePlan = await prisma.plan.findFirst({
        where: { name: 'free', status: 'ACTIVE' },
        include: {
          planFeatures: true
        }
      });

      if (!freePlan) {
        return {};
      }

      return this.buildQuotaSummary(freePlan.id, freePlan.planFeatures);
    }

    return this.buildQuotaSummary(subscription.planId, subscription.plan.features, subscription.currentPeriodEnd);
  }

  /**
   * Build quota summary from plan features
   */
  private static async buildQuotaSummary(planId: string, features: any[], periodEnd?: Date) {
    const summary: any = {};

    for (const feature of features) {
      if (Object.values(this.QUOTA_TYPES).includes(feature.featureId)) {
        const usage = await this.getCurrentUsage(planId, feature.featureId, periodEnd);
        const limit = feature.config?.value || 0;
        
        summary[feature.featureId] = {
          name: feature.name,
          limit,
          used: usage,
          remaining: Math.max(0, limit - usage),
          percentage: limit > 0 ? Math.min(100, (usage / limit) * 100) : 0,
          unit: feature.config?.unit,
          resetDate: periodEnd
        };
      }
    }

    return summary;
  }

  /**
   * Check and enforce rate limits
   */
  static async checkRateLimit(userId: string, endpoint: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: Date;
  }> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: {
          gt: new Date()
        }
      },
      include: {
        plan: true
      }
    });

    const rateLimit = subscription?.plan.rateLimit || 10;
    const windowMs = 60 * 1000; // 1 minute window

    // Check recent requests
    const recentRequests = await prisma.apiUsage.count({
      where: {
        userId,
        endpoint,
        timestamp: {
          gte: new Date(Date.now() - windowMs)
        }
      }
    });

    const remaining = Math.max(0, rateLimit - recentRequests);
    const resetTime = new Date(Date.now() + windowMs);

    return {
      allowed: remaining > 0,
      remaining,
      resetTime
    };
  }

  /**
   * Get quota usage alerts
   */
  static async getQuotaAlerts(userId: string): Promise<Array<{
    type: string;
    level: 'warning' | 'critical';
    message: string;
    quota: any;
  }>> {
    const summary = await this.getUserQuotaSummary(userId);
    const alerts: any[] = [];

    for (const [quotaType, quota] of Object.entries(summary)) {
      const quotaData = quota as any;
      if (quotaData.percentage >= 90) {
        alerts.push({
          type: quotaType,
          level: 'critical',
          message: `${quotaData.name}使用量已达到${Math.round(quotaData.percentage)}%`,
          quota: quotaData
        });
      } else if (quotaData.percentage >= 75) {
        alerts.push({
          type: quotaType,
          level: 'warning',
          message: `${quotaData.name}使用量已达到${Math.round(quotaData.percentage)}%`,
          quota: quotaData
        });
      }
    }

    return alerts;
  }

  /**
   * Reset monthly quotas (called by scheduled task)
   */
  static async resetMonthlyQuotas() {
    console.log('[QuotaService] Resetting monthly quotas...');
    
    // This is mainly for logging purposes
    // Actual quotas are calculated based on current period
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Log quota reset activity
    await prisma.userActivity.createMany({
      data: [{
        userId: 'system',
        action: 'monthly_quota_reset',
        resource: 'quota',
        metadata: {
          resetDate: now.toISOString(),
          periodStart: startOfMonth.toISOString()
        }
      }]
    });
    
    console.log('[QuotaService] Monthly quota reset completed');
  }
}