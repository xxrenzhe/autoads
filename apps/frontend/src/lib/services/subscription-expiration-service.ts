import { prisma } from '@/lib/prisma';
import { TokenExpirationService } from './token-expiration-service';
import { SubscriptionNotificationService } from './subscription-notification-service';
import { SubscriptionHelper } from './subscription-helper';
import { TokenType } from '@prisma/client';
import { Cron } from 'croner';

/**
 * Service to handle subscription expiration and fallback to free plan
 */
export class SubscriptionExpirationService {
  private static expirationCheckJob: ReturnType<typeof Cron> | null = null;
  /**
   * Process expired subscriptions and downgrade users to free plan
   */
  static async processExpiredSubscriptions() {
    const now = new Date();
    
    // Find all expired subscriptions
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
            email: true,
            tokenBalance: true,
            subscriptionTokenBalance: true
          }
        }
      }
    });

    const results: any[] = [];

    for (const subscription of expiredSubscriptions) {
      try {
        // Mark subscription as expired
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'EXPIRED',
            canceledAt: now
          }
        });

        // Clear subscription tokens
        if (subscription.plan.tokenQuota > 0) {
          await TokenExpirationService.clearSubscriptionTokens(
            subscription.userId,
            subscription.id
          );
        }

        // Find free plan
        const freePlan = await prisma.plan.findFirst({
          where: {
            name: 'free',
            status: 'ACTIVE'
          }
        });

        if (freePlan) {
          // Check if user already has a free plan subscription
          const existingFreeSubscription = await prisma.subscription.findFirst({
            where: {
              userId: subscription.userId,
              planId: freePlan.id,
              status: 'ACTIVE'
            }
          });

          if (!existingFreeSubscription) {
            // Create free plan subscription
            const freeStartDate = new Date();
            const freeEndDate = new Date();
            freeEndDate.setFullYear(freeEndDate.getFullYear() + 10); // Long duration for free plan

            await prisma.subscription.create({
              data: {
                userId: subscription.userId,
                planId: freePlan.id,
                status: 'ACTIVE',
                currentPeriodStart: freeStartDate,
                currentPeriodEnd: freeEndDate,
                provider: 'system',
                providerSubscriptionId: `free_${subscription.userId}_${Date.now()}`,
                cancelAtPeriodEnd: false
              }
            });

            // Update user's token balance to free plan quota
            await prisma.user.update({
              where: { id: subscription.userId },
              data: {
                subscriptionTokenBalance: freePlan.tokenQuota,
                tokenBalance: Math.max(subscription.user.tokenBalance, freePlan.tokenQuota)
              }
            });

            // Add free plan tokens
            await TokenExpirationService.addTokensWithExpiration(
              subscription.userId,
              freePlan.tokenQuota - subscription.user.tokenBalance,
              TokenType.SUBSCRIPTION,
              freeEndDate,
              {
                subscriptionId: subscription.id,
                planId: freePlan.id,
                source: 'free_plan_fallback',
                previousPlan: subscription.plan.name,
                grantedAt: new Date().toISOString()
              }
            );
          }
        }

        results.push({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          userEmail: subscription.user.email,
          planName: subscription.plan.name,
          status: 'expired_and_downgraded'
        });

        // Log the activity
        await prisma.userActivity.create({
          data: {
            userId: subscription.userId,
            action: 'subscription_expired',
            resource: 'subscription',
            metadata: {
              subscriptionId: subscription.id,
              planName: subscription.plan.name,
              expiredAt: now.toISOString(),
              action: 'downgraded_to_free'
            }
          }
        });
      } catch (error) {
        console.error(`Failed to process expired subscription ${subscription.id}:`, error);
        results.push({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          userEmail: subscription.user.email,
          planName: subscription.plan.name,
          status: 'error',
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    return results;
  }

  /**
   * Check and process subscriptions that are about to expire (within 24 hours)
   * Send notifications to users
   */
  static async processExpiringSubscriptions() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const expiringSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          lte: tomorrow,
          gt: new Date()
        },
        cancelAtPeriodEnd: true // Only for subscriptions that will auto-cancel
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

    // Here you could send email notifications
    // For now, just log the activity
    for (const subscription of expiringSubscriptions) {
      await prisma.userActivity.create({
        data: {
          userId: subscription.userId,
          action: 'subscription_expiring_soon',
          resource: 'subscription',
          metadata: {
            subscriptionId: subscription.id,
            planName: subscription.plan.name,
            expiresAt: subscription.currentPeriodEnd.toISOString(),
            notifiedAt: new Date().toISOString()
          }
        }
      });
    }

    return {
      processed: expiringSubscriptions.length,
      subscriptions: expiringSubscriptions
    };
  }

  /**
   * Start the expiration check job
   * Runs daily at 2:00 AM
   */
  static startExpirationCheck() {
    // Run daily at 2:00 AM
    this.expirationCheckJob = new Cron('0 2 * * *', async () => {
      console.log('🔍 Starting daily subscription expiration check...');
      try {
        const results = await this.processExpiredSubscriptions();
        console.log(`✅ Processed ${results.length} expired subscriptions`);
        
        // Also check for subscriptions expiring soon
        const expiringSoon = await this.processExpiringSubscriptions();
        console.log(`📧 Notified ${expiringSoon.processed} users about expiring subscriptions`);
      } catch (error) {
        console.error('❌ Error in daily expiration check:', error);
      }
    }, {
      timezone: 'Asia/Shanghai'
    });

    console.log('✅ Subscription expiration check job scheduled (daily at 2:00 AM)');
  }

  /**
   * Stop the expiration check job
   */
  static stopExpirationCheck() {
    if (this.expirationCheckJob) {
      this.expirationCheckJob.stop();
      this.expirationCheckJob = null;
      console.log('⏹️ Subscription expiration check job stopped');
    }
  }

  /**
   * Get statistics about expiring subscriptions
   */
  static async getExpiringStats() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const [
      expiredCount,
      expiringTomorrowCount,
      expiringNextWeekCount
    ] = await Promise.all([
      // Count already expired but still active subscriptions
      prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          currentPeriodEnd: {
            lt: now
          }
        }
      }),
      
      // Count expiring tomorrow
      prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          currentPeriodEnd: {
            gte: now,
            lt: tomorrow
          }
        }
      }),
      
      // Count expiring within next week
      prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          currentPeriodEnd: {
            gte: now,
            lt: nextWeek
          }
        }
      })
    ]);

    return {
      expired: expiredCount,
      expiringTomorrow: expiringTomorrowCount,
      expiringNextWeek: expiringNextWeekCount
    };
  }

  /**
   * Manually trigger expiration check (for testing or manual runs)
   */
  static async triggerExpirationCheck() {
    console.log('🔍 Manually triggering subscription expiration check...');
    const results = await this.processExpiredSubscriptions();
    console.log(`✅ Processed ${results.length} expired subscriptions`);
    return results;
  }
}
