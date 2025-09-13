import { prisma } from '@/lib/prisma';
import { TokenExpirationService } from './token-expiration-service';
import { SubscriptionNotificationService } from './subscription-notification-service';
import { TokenType } from '@prisma/client';
import { $Enums } from '@prisma/client';

/**
 * Helper service for creating subscriptions for invitations and trials
 */
export class SubscriptionHelper {
  /**
   * Create or queue invitation subscription reward
   * If user has no active subscription, create immediately
   * If user has active subscription, queue the reward to activate after current subscription ends
   */
  static async createOrExtendInvitationSubscription(userId: string, planId: string, invitationId: string) {
    // Check if user has active subscription
    const activeSubscription = await prisma.subscription.findFirst({
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

    if (!activeSubscription) {
      // No active subscription, create invitation subscription immediately
      return await this.createInvitationSubscription(userId, planId, invitationId);
    } else {
      // User has active subscription, queue the invitation reward
      const queuedReward = await prisma.queuedInvitationReward.create({
        data: {
          userId,
          planId,
          invitationId,
          daysToAdd: 30,
          status: 'PENDING'
        },
        include: {
          plan: true
        }
      });

      // Record queuing activity
      await prisma.userActivity.create({
        data: {
          userId,
          action: 'invitation_reward_queued',
          resource: 'invitation',
          metadata: {
            invitationId,
            planId,
            planName: queuedReward.plan.name,
            daysToAdd: 30,
            queuedRewardId: queuedReward.id,
            currentSubscriptionEnds: activeSubscription.currentPeriodEnd
          }
        }
      });

      return {
        queued: true,
        queuedReward,
        activeSubscription
      };
    }
  }

  /**
   * Create invitation subscription immediately
   */
  static async createInvitationSubscription(userId: string, planId: string, invitationId: string) {
    // Create new 30-day subscription
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // 30 days

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId,
        status: 'ACTIVE',
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate,
        provider: 'invitation',
        providerSubscriptionId: `invitation_${invitationId}_${Date.now()}`,
        source: $Enums.SubscriptionSource.INVITATION,
        cancelAtPeriodEnd: true // Auto-cancel after 30 days
      },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    // Add initial monthly tokens if plan has token quota
    if (subscription.plan.tokenQuota > 0) {
      await this.addMonthlyTokens(userId, subscription.plan.tokenQuota, subscription.id, subscription.plan.id, invitationId);
    }

    // Send subscription change notification (ignore errors)
    try {
      await SubscriptionNotificationService.sendSubscriptionChangeNotification(
        userId,
        'Previous Plan',
        subscription.plan.name,
        'MANUAL_CHANGE',
        startDate
      );
    } catch (error) {
      console.error('Failed to send subscription change notification:', error);
    }

    return subscription;
  }

  /**
   * Add monthly tokens for subscription
   */
  static async addMonthlyTokens(userId: string, tokenAmount: number, subscriptionId: string, planId: string, invitationId?: string) {
    // Calculate end of current month
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    await TokenExpirationService.addTokensWithExpiration(
      userId,
      tokenAmount,
      TokenType.SUBSCRIPTION,
      monthEnd, // Tokens expire at end of current month
      {
        subscriptionId,
        planId,
        source: 'invitation_monthly_tokens',
        invitationId,
        grantedAt: now.toISOString(),
        monthlyAllocation: true
      }
    );
  }

  /**
   * Create a subscription for trial (14 days Pro)
   */
  static async createTrialSubscription(userId: string, planId: string) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 14); // 14 days

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId,
        status: 'ACTIVE',
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate,
        provider: 'trial',
        providerSubscriptionId: `trial_${userId}_${Date.now()}`,
        source: $Enums.SubscriptionSource.MANUAL,
        cancelAtPeriodEnd: true // Auto-cancel after trial period
      },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    // Add subscription tokens if plan has token quota
    if (subscription.plan.tokenQuota > 0) {
      await TokenExpirationService.addTokensWithExpiration(
        userId,
        subscription.plan.tokenQuota,
        TokenType.SUBSCRIPTION,
        endDate, // Tokens expire when subscription ends
        {
          subscriptionId: subscription.id,
          planId: subscription.plan.id,
          source: 'trial_subscription',
          grantedAt: new Date().toISOString()
        }
      );
    }

    // Send trial start notification (ignore errors)
    try {
      await SubscriptionNotificationService.sendTrialStartNotification(subscription.id);
    } catch (error) {
      console.error('Failed to send trial start notification:', error);
    }

    return subscription;
  }

  /**
   * Check if user already has an active subscription or trial
   */
  static async hasActiveSubscription(userId: string): Promise<boolean> {
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: {
          gt: new Date()
        }
      }
    });

    return !!activeSubscription;
  }

  /**
   * Get user's current active subscription
   */
  static async getCurrentSubscription(userId: string) {
    return await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: {
          gt: new Date()
        }
      },
      include: {
        plan: true
      },
      orderBy: {
        currentPeriodEnd: 'desc'
      }
    });
  }

  /**
   * Cancel subscription at period end
   */
  static async cancelAtPeriodEnd(subscriptionId: string) {
    return await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        cancelAtPeriodEnd: true,
        canceledAt: new Date()
      }
    });
  }

  /**
   * Expire subscription immediately
   */
  static async expireSubscription(subscriptionId: string) {
    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'EXPIRED',
        canceledAt: new Date(),
        currentPeriodEnd: new Date(), // Set end date to now
        changeReason: $Enums.SubscriptionChangeReason.EXPIRATION
      },
      include: {
        plan: true
      }
    });

    // Clear subscription tokens
    if (subscription.plan.tokenQuota > 0) {
      await TokenExpirationService.clearSubscriptionTokens(
        subscription.userId,
        subscription.id
      );
    }

    // Send expiration notification
    await SubscriptionNotificationService.sendSubscriptionExpirationNotification(subscription.id);

    return subscription;
  }

  /**
   * Process expired subscriptions and activate queued invitation rewards
   */
  static async processExpiredSubscriptions() {
    const now = new Date();
    
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          lte: now
        }
      },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    const results = [];

    for (const subscription of expiredSubscriptions) {
      try {
        await this.expireSubscription(subscription.id);
        results.push({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          userEmail: subscription.user.email,
          planName: subscription.plan.name,
          status: 'expired'
        });

        // Check for queued invitation rewards after expiration
        await this.processQueuedInvitationRewards(subscription.userId);
      } catch (error) {
        console.error(`Failed to expire subscription ${subscription.id}:`, error);
        results.push({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          userEmail: subscription.user.email,
          planName: subscription.plan.name,
          status: 'error',
          error: error instanceof Error ? error.message : "Unknown error" as any
        });
      }
    }

    return results;
  }

  /**
   * Process queued invitation rewards for a user
   */
  static async processQueuedInvitationRewards(userId: string) {
    // Check if user has any active subscription
    const hasActiveSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: {
          gt: new Date()
        }
      }
    });

    if (hasActiveSubscription) {
      return; // Don't process if user has active subscription
    }

    // Get all pending queued rewards for the user
    const queuedRewards = await prisma.queuedInvitationReward.findMany({
      where: {
        userId,
        status: 'PENDING'
      },
      orderBy: {
        createdAt: 'asc'
      },
      include: {
        plan: true
      }
    });

    if (queuedRewards.length === 0) {
      return;
    }

    // Calculate total days to add from all queued rewards
    const totalDays = queuedRewards.reduce((sum: number, reward: any) => sum + reward.daysToAdd, 0);
    
    // Create a single subscription for all queued rewards
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + totalDays);

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId: queuedRewards[0].planId, // Use the plan from the first reward
        status: 'ACTIVE',
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate,
        provider: 'invitation',
        providerSubscriptionId: `invitation_queued_${userId}_${Date.now()}`,
        source: $Enums.SubscriptionSource.INVITATION,
        cancelAtPeriodEnd: true
      },
      include: {
        plan: true
      }
    });

    // Add initial monthly tokens
    if (subscription.plan.tokenQuota > 0) {
      await this.addMonthlyTokens(userId, subscription.plan.tokenQuota, subscription.id, subscription.plan.id);
    }

    // Mark all queued rewards as processed
    await prisma.queuedInvitationReward.updateMany({
      where: {
        id: {
          in: queuedRewards.map((r: any) => r.id)
        }
      },
      data: {
        status: 'PROCESSED',
        processedAt: new Date()
      }
    });

    // Record activation of queued rewards
    await prisma.userActivity.create({
      data: {
        userId,
        action: 'queued_invitation_rewards_activated',
        resource: 'invitation',
        metadata: {
          subscriptionId: subscription.id,
          totalDays,
          rewardsCount: queuedRewards.length,
          rewardIds: queuedRewards.map((r: any) => r.id)
        }
      }
    });

    // Schedule monthly token allocation for the subscription duration
    await this.scheduleMonthlyTokenAllocation(userId, subscription.id, subscription.plan.tokenQuota, subscription.plan.id);

    return subscription;
  }

  /**
   * Schedule monthly token allocation for a subscription
   */
  static async scheduleMonthlyTokenAllocation(userId: string, subscriptionId: string, tokenAmount: number, planId: string) {
    // This would typically be handled by a cron job
    // For now, we'll store the allocation schedule in metadata
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        metadata: {
          monthlyTokenAllocation: {
            enabled: true,
            tokenAmount,
            lastAllocated: new Date().toISOString()
          }
        }
      }
    });
  }

  /**
   * Process monthly token allocation for all active invitation subscriptions
   */
  static async processMonthlyTokenAllocation() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Find active invitation subscriptions that need monthly tokens
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        provider: 'invitation',
        currentPeriodEnd: {
          gt: now
        }
      },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    const processed = [];

    for (const subscription of subscriptions) {
      try {
        // Check if tokens were already allocated this month
        const metadata = subscription.metadata as any;
        const lastAllocated = metadata?.monthlyTokenAllocation?.lastAllocated;
        
        if (lastAllocated) {
          const lastDate = new Date(lastAllocated);
          if (lastDate.getMonth() === currentMonth && lastDate.getFullYear() === currentYear) {
            continue; // Already allocated this month
          }
        }

        // Allocate monthly tokens
        await this.addMonthlyTokens(
          subscription.userId,
          subscription.plan.tokenQuota,
          subscription.id,
          subscription.plan.id
        );

        // Update last allocated timestamp
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            metadata: {
              ...metadata,
              monthlyTokenAllocation: {
                enabled: true,
                tokenAmount: subscription.plan.tokenQuota,
                lastAllocated: now.toISOString()
              }
            }
          }
        });

        processed.push({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          userEmail: subscription.user.email,
          tokenAmount: subscription.plan.tokenQuota,
          status: 'allocated'
        });
      } catch (error) {
        console.error(`Failed to allocate monthly tokens for subscription ${subscription.id}:`, error);
        processed.push({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          userEmail: subscription.user.email,
          status: 'error',
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    return processed;
  }

  /**
   * Send subscription change notification
   */
  static async sendSubscriptionChangeNotification(
    userId: string,
    oldPlanName: string,
    newPlanName: string,
    changeReason: $Enums.SubscriptionChangeReason
  ) {
    await SubscriptionNotificationService.sendSubscriptionChangeNotification(
      userId,
      oldPlanName,
      newPlanName,
      changeReason,
      new Date() // effectiveDate
    );
  }
}
