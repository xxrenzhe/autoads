import { prisma } from '@/lib/db';
// Use string literal to avoid Prisma enum coupling
import { TokenExpirationService } from './token-expiration-service';

/**
 * Service for managing subscription inheritance from plans
 */
export class SubscriptionInheritanceService {
  /**
   * Create a new subscription with inherited properties from the plan
   */
  static async createSubscription(userId: string, planId: string, providerSubscriptionId?: string) {
    // Get the plan with all its configurations
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        planFeatures: true
      }
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    // Calculate subscription period
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1); // Default to 1 month

    // Create subscription with inherited properties
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId,
        status: 'ACTIVE',
        currentPeriodStart,
        currentPeriodEnd,
        provider: 'stripe',
        providerSubscriptionId,
        monthlyPrice: plan.price,
        currency: plan.currency,
        
        // Inherited Token Quota
        tokenQuota: plan.tokenQuota,
        tokenQuotaDaily: plan.tokenQuotaDaily,
        tokenQuotaHourly: plan.tokenQuotaHourly,
        tokenUsed: 0,
        tokenResetPeriod: plan.tokenResetPeriod || 'monthly',
        tokenOverageAllowed: plan.tokenOverageAllowed || false,
        tokenOveragePrice: plan.tokenOveragePrice,
        
        // Inherited Rate Limits
        rateLimit: plan.rateLimit,
        rateLimitWindow: plan.rateLimitWindow,
        rateLimitBurst: plan.rateLimitBurst,
        concurrentRequests: plan.concurrentRequests,
        requestTimeout: plan.requestTimeout,
        
        // Feature-specific Rate Limits
        siterankRateLimit: plan.siterankRateLimit,
        batchopenRateLimit: plan.batchopenRateLimit,
        adscenterRateLimit: plan.adscenterRateLimit,
        
        // Advanced Features
        maxBatchSize: plan.maxBatchSize,
        maxConcurrentBatches: plan.maxConcurrentBatches,
        priorityAccess: plan.priorityAccess,
        advancedAnalytics: plan.advancedAnalytics,
        apiAccessLevel: plan.apiAccessLevel,
        
        // Features from plan
        features: plan.features,
        
        // Metadata
        metadata: {
          planName: plan.name,
          planDescription: plan.description,
          inheritedAt: new Date().toISOString()
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        plan: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    });

    // Add subscription tokens with expiration
    if (plan.tokenQuota > 0) {
      await TokenExpirationService.addTokensWithExpiration(
        userId,
        plan.tokenQuota,
        'SUBSCRIPTION' as any,
        currentPeriodEnd, // Tokens expire when subscription ends
        {
          subscriptionId: subscription.id,
          planId: plan.id,
          grantedAt: new Date().toISOString()
        }
      );
    }

    return subscription;
  }

  /**
   * Update subscription to reflect changes in the associated plan
   */
  static async syncSubscriptionWithPlan(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true
      }
    });

    if (!subscription || !subscription.plan) {
      throw new Error('Subscription or plan not found');
    }

    const plan = subscription.plan;

    // Only update if subscription doesn't have custom overrides
    const updateData: any = {};

    // Check for custom overrides before updating
    if (!subscription.customRateLimits) {
      updateData.rateLimit = plan.rateLimit;
      updateData.rateLimitWindow = plan.rateLimitWindow;
      updateData.rateLimitBurst = plan.rateLimitBurst;
      updateData.concurrentRequests = plan.concurrentRequests;
      updateData.requestTimeout = plan.requestTimeout;
      updateData.siterankRateLimit = plan.siterankRateLimit;
      updateData.batchopenRateLimit = plan.batchopenRateLimit;
      updateData.adscenterRateLimit = plan.adscenterRateLimit;
    }

    if (!subscription.customTokenQuotas) {
      updateData.tokenQuota = plan.tokenQuota;
      updateData.tokenQuotaDaily = plan.tokenQuotaDaily;
      updateData.tokenQuotaHourly = plan.tokenQuotaHourly;
      updateData.tokenResetPeriod = plan.tokenResetPeriod;
      updateData.tokenOverageAllowed = plan.tokenOverageAllowed;
      updateData.tokenOveragePrice = plan.tokenOveragePrice;
    }

    if (!subscription.customFeatures) {
      updateData.features = plan.features;
      updateData.maxBatchSize = plan.maxBatchSize;
      updateData.maxConcurrentBatches = plan.maxConcurrentBatches;
      updateData.priorityAccess = plan.priorityAccess;
      updateData.advancedAnalytics = plan.advancedAnalytics;
      updateData.apiAccessLevel = plan.apiAccessLevel;
    }

    // Update subscription
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        ...updateData,
        metadata: {
          ...subscription.metadata,
          lastSyncedAt: new Date().toISOString(),
          planVersion: plan.updatedAt.toISOString()
        }
      },
      include: {
        user: true,
        plan: true
      }
    });

    return updatedSubscription;
  }

  /**
   * Get effective rate limits for a subscription (considering custom overrides)
   */
  static async getEffectiveRateLimits(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true
      }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const customRateLimits = subscription.customRateLimits as any || {};
    const plan = subscription.plan;

    return {
      rateLimit: customRateLimits.rateLimit || plan.rateLimit,
      rateLimitWindow: customRateLimits.rateLimitWindow || plan.rateLimitWindow,
      rateLimitBurst: customRateLimits.rateLimitBurst || plan.rateLimitBurst,
      concurrentRequests: customRateLimits.concurrentRequests || plan.concurrentRequests,
      requestTimeout: customRateLimits.requestTimeout || plan.requestTimeout,
      siterankRateLimit: customRateLimits.siterankRateLimit || plan.siterankRateLimit,
      batchopenRateLimit: customRateLimits.batchopenRateLimit || plan.batchopenRateLimit,
      adscenterRateLimit: customRateLimits.adscenterRateLimit || plan.adscenterRateLimit
    };
  }

  /**
   * Get effective token quotas for a subscription (considering custom overrides)
   */
  static async getEffectiveTokenQuotas(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true
      }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const customTokenQuotas = subscription.customTokenQuotas as any || {};
    const plan = subscription.plan;

    return {
      tokenQuota: customTokenQuotas.tokenQuota || plan.tokenQuota,
      tokenQuotaDaily: customTokenQuotas.tokenQuotaDaily || plan.tokenQuotaDaily,
      tokenQuotaHourly: customTokenQuotas.tokenQuotaHourly || plan.tokenQuotaHourly,
      tokenResetPeriod: customTokenQuotas.tokenResetPeriod || plan.tokenResetPeriod,
      tokenOverageAllowed: customTokenQuotas.tokenOverageAllowed ?? plan.tokenOverageAllowed,
      tokenOveragePrice: customTokenQuotas.tokenOveragePrice || plan.tokenOveragePrice
    };
  }

  /**
   * Apply custom rate limit overrides to a subscription
   */
  static async applyCustomRateLimits(subscriptionId: string, customLimits: any) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const updatedCustomLimits = {
      ...(subscription.customRateLimits as any || {}),
      ...customLimits
    };

    return await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        customRateLimits: updatedCustomLimits,
        metadata: {
          ...subscription.metadata,
          customRateLimitsAppliedAt: new Date().toISOString()
        }
      }
    });
  }

  /**
   * Apply custom token quota overrides to a subscription
   */
  static async applyCustomTokenQuotas(subscriptionId: string, customQuotas: any) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const updatedCustomQuotas = {
      ...(subscription.customTokenQuotas as any || {}),
      ...customQuotas
    };

    return await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        customTokenQuotas: updatedCustomQuotas,
        metadata: {
          ...subscription.metadata,
          customTokenQuotasAppliedAt: new Date().toISOString()
        }
      }
    });
  }

  /**
   * Check if subscription has exceeded its token quota
   */
  static async checkTokenQuota(subscriptionId: string) {
    const quotas = await this.getEffectiveTokenQuotas(subscriptionId);
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: {
        tokenUsed: true,
        tokenOverageAllowed: true
      }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const { tokenUsed, tokenOverageAllowed } = subscription;
    
    if (tokenOverageAllowed) {
      // If overage is allowed, always return true
      return { allowed: true, remaining: Math.max(0, quotas.tokenQuota - tokenUsed) };
    }

    const remaining = Math.max(0, quotas.tokenQuota - tokenUsed);
    return {
      allowed: remaining > 0,
      remaining,
      used: tokenUsed,
      quota: quotas.tokenQuota
    };
  }

  /**
   * Consume tokens from subscription quota
   */
  static async consumeTokens(subscriptionId: string, amount: number, feature: string, operation: string) {
    const quotaCheck = await this.checkTokenQuota(subscriptionId);
    
    // Get subscription details to check overage allowance
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { tokenOverageAllowed: true }
    });
    
    if (!quotaCheck.allowed && !subscription?.tokenOverageAllowed) {
      throw new Error('Insufficient token quota');
    }

    // Update subscription token usage
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        tokenUsed: {
          increment: amount
        }
      }
    });

    // Record token usage
    await prisma.token_usage.create({
      data: {
        userId: updatedSubscription.userId,
        feature,
        operation,
        tokensConsumed: amount,
        tokensRemaining: Math.max(0, quotaCheck.remaining - amount),
        planId: updatedSubscription.planId
      }
    });

    return updatedSubscription;
  }

  /**
   * Reset token usage based on reset period
   */
  static async resetTokenUsage(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true
      }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const resetPeriod = subscription.tokenResetPeriod || 'monthly';
    const now = new Date();
    let shouldReset = false;

    switch (resetPeriod) {
      case 'hourly':
        shouldReset = now.getHours() !== subscription.updatedAt.getHours();
        break;
      case 'daily':
        shouldReset = now.getDate() !== subscription.updatedAt.getDate() ||
                     now.getMonth() !== subscription.updatedAt.getMonth() ||
                     now.getFullYear() !== subscription.updatedAt.getFullYear();
        break;
      case 'monthly':
        shouldReset = now.getMonth() !== subscription.updatedAt.getMonth() ||
                     now.getFullYear() !== subscription.updatedAt.getFullYear();
        break;
    }

    if (shouldReset) {
      return await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          tokenUsed: 0,
          metadata: {
            ...subscription.metadata,
            lastTokenReset: new Date().toISOString()
          }
        }
      });
    }

    return subscription;
  }
}
