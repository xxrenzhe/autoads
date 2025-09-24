import { prisma } from '@/lib/db';
import { NotificationService } from './notification-service';
// Avoid Prisma enum coupling; use string literals in notifications

/**
 * Service for handling subscription-related notifications
 */
export class SubscriptionNotificationService {
  /**
   * Send trial expiration reminder (3 days before trial ends)
   */
  static async sendTrialExpirationReminder(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            preferences: true
          }
        },
        plan: {
          select: {
            name: true,
            features: true
          }
        }
      }
    });

    if (!subscription || subscription.source !== 'MANUAL') {
      return;
    }

    const trialEndDate = new Date(subscription.trialEnd || subscription.currentPeriodEnd);
    const daysUntilExpiry = Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= 3 && daysUntilExpiry > 0) {
      await NotificationService.sendNotification({
        userId: subscription.userId,
        type: 'EMAIL',
        template: 'trial_expiring_soon',
        data: {
          userName: subscription.user.name || subscription.user.email,
          planName: subscription.plan.name,
          daysLeft: daysUntilExpiry,
          expiryDate: trialEndDate.toLocaleDateString(),
          features: subscription.plan.features,
          upgradeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`
        },
        priority: 'HIGH'
      });

      // Also create in-app notification
      await prisma.appNotification.create({
        data: {
          userId: subscription.userId,
          type: 'WARNING',
          title: '试用即将到期',
          content: `您的${subscription.plan.name}试用套餐将在${daysUntilExpiry}天后到期。请升级到付费套餐以继续使用所有功能。`,
          priority: 'HIGH',
          metadata: {
            type: 'trial_expiring',
            subscriptionId: subscription.id,
            daysLeft: daysUntilExpiry,
            expiryDate: trialEndDate.toISOString()
          }
        }
      });
    }
  }

  /**
   * Send subscription expiration notification
   */
  static async sendSubscriptionExpirationNotification(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
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
            name: true
          }
        }
      }
    });

    if (!subscription) return;

    await NotificationService.sendNotification({
      userId: subscription.userId,
      type: 'EMAIL',
      template: 'subscription_expired',
      data: {
        userName: subscription.user.name || subscription.user.email,
        planName: subscription.plan.name,
        expiredDate: new Date(subscription.currentPeriodEnd).toLocaleDateString(),
        downgradeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/account`,
        upgradeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`
      },
      priority: 'MEDIUM'
    });

    // Create in-app notification
    await prisma.appNotification.create({
      data: {
        userId: subscription.userId,
        type: 'ERROR',
        title: '套餐已到期',
        content: `您的${subscription.plan.name}套餐已到期。您已被降级到免费套餐。`,
        priority: 'MEDIUM',
        metadata: {
          type: 'subscription_expired',
          subscriptionId: subscription.id,
          previousPlan: subscription.plan.name
        }
      }
    });
  }

  /**
   * Send subscription change notification
   */
  static async sendSubscriptionChangeNotification(
    userId: string,
    oldPlanName: string,
    newPlanName: string,
    changeReason: any,
    effectiveDate: Date
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true
      }
    });

    if (!user) return;

    const changeReasonMap: Record<string,string> = {
      UPGRADE: '升级',
      DOWNGRADE: '降级',
      CANCELLATION: '取消',
      EXPIRATION: '到期',
      TRIAL_END: '试用结束',
      INVITATION_ACCEPTED: '邀请奖励',
      PAYMENT_FAILURE: '支付失败',
      MANUAL_CHANGE: '手动更改'
    };

    await NotificationService.sendNotification({
      userId,
      type: 'EMAIL',
      template: 'subscription_changed',
      data: {
        userName: user.name || user.email,
        oldPlanName,
        newPlanName,
        changeReason: (changeReasonMap as any)[changeReason] || changeReason,
        effectiveDate: effectiveDate.toLocaleDateString(),
        accountUrl: `${process.env.NEXT_PUBLIC_APP_URL}/account`
      },
      priority: 'MEDIUM'
    });

    // Create in-app notification
    await prisma.appNotification.create({
      data: {
        userId,
        type: 'INFO',
        title: '套餐变更',
        content: `您的套餐已从${oldPlanName}变更为${newPlanName}，原因：${(changeReasonMap as any)[changeReason]}`,
        priority: 'MEDIUM',
        metadata: {
          type: 'subscription_changed',
          oldPlanName,
          newPlanName,
          changeReason
        }
      }
    });
  }

  /**
   * Send payment failure notification
   */
  static async sendPaymentFailureNotification(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
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
            name: true,
            price: true,
            currency: true
          }
        }
      }
    });

    if (!subscription) return;

    await NotificationService.sendNotification({
      userId: subscription.userId,
      type: 'EMAIL',
      template: 'payment_failed',
      data: {
        userName: subscription.user.name || subscription.user.email,
        planName: subscription.plan.name,
        amount: subscription.plan.price,
        currency: subscription.plan.currency,
        updatePaymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/account/billing`
      },
      priority: 'URGENT'
    });

    // Create in-app notification
    await prisma.appNotification.create({
      data: {
        userId: subscription.userId,
        type: 'ERROR',
        title: '支付失败',
        content: `您的${subscription.plan.name}套餐续费支付失败。请更新支付信息以避免服务中断。`,
        priority: 'URGENT',
        metadata: {
          type: 'payment_failed',
          subscriptionId: subscription.id,
          amount: subscription.plan.price,
          currency: subscription.plan.currency
        }
      }
    });
  }

  /**
   * Send trial start welcome notification
   */
  static async sendTrialStartNotification(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
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
            name: true,
            features: true
          }
        }
      }
    });

    if (!subscription || subscription.source !== 'MANUAL') {
      return;
    }

    const trialEndDate = new Date(subscription.trialEnd || subscription.currentPeriodEnd);
    const trialDays = Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    await NotificationService.sendNotification({
      userId: subscription.userId,
      type: 'EMAIL',
      template: 'trial_started',
      data: {
        userName: subscription.user.name || subscription.user.email,
        planName: subscription.plan.name,
        trialDays,
        expiryDate: trialEndDate.toLocaleDateString(),
        features: subscription.plan.features,
        upgradeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`
      },
      priority: 'MEDIUM'
    });

    // Create in-app notification
    await prisma.appNotification.create({
      data: {
        userId: subscription.userId,
        type: 'SUCCESS',
        title: '欢迎使用试用套餐',
        content: `您已成功开始${subscription.plan.name}的${trialDays}天试用。享受所有高级功能！`,
        priority: 'MEDIUM',
        metadata: {
          type: 'trial_started',
          subscriptionId: subscription.id,
          trialDays,
          expiryDate: trialEndDate.toISOString()
        }
      }
    });
  }

  /**
   * Process and send all pending subscription notifications
   */
  static async processPendingNotifications() {
    const now = new Date();
    
    // 1. Send trial expiration reminders (3 days before)
    const trialReminderDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    const expiringTrials = await prisma.subscription.findMany({
      where: {
        source: 'MANUAL',
        status: 'ACTIVE',
        trialEnd: {
          lte: trialReminderDate,
          gt: now
        }
      }
    });

    for (const subscription of expiringTrials) {
      await this.sendTrialExpirationReminder(subscription.id);
    }

    // 2. Send subscription expiration notifications for expired subscriptions
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          lte: now
        },
        // Avoid sending multiple notifications
        user: {
          app_notifications: {
            none: {
              type: 'ERROR',
              title: '套餐已到期',
              createdAt: {
                gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) // Last 24 hours
              }
            }
          }
        }
      }
    });

    for (const subscription of expiredSubscriptions) {
      await this.sendSubscriptionExpirationNotification(subscription.id);
    }

    console.log(`Processed ${expiringTrials.length} trial reminders and ${expiredSubscriptions.length} expiration notifications`);
  }
}
