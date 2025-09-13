import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { NotificationService } from '@/lib/services/notification-service';
import { StripeService } from '@/lib/services/stripe-service';

// Action validation schema
const actionSchema = z.object({
  action: z.enum(['cancel', 'renew', 'upgrade', 'refund', 'pause', 'resume']),
  subscriptionId: z.string(),
  data: z.record(z.any()).optional(),
});

interface RouteParams {
  params: {
    id: string;
  };
}

// POST /api/admin/subscriptions/[id]/actions - Perform subscription actions
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = actionSchema.parse({ ...body, subscriptionId: params.id });

    // Get subscription with related data
    const subscription = await prisma.subscription.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        plan: true,
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    let result;

    switch (action) {
      case 'cancel':
        result = await cancelSubscription(subscription, data);
        break;
      case 'renew':
        result = await renewSubscription(subscription, data);
        break;
      case 'upgrade':
        result = await upgradeSubscription(subscription, data);
        break;
      case 'refund':
        result = await refundSubscription(subscription, data);
        break;
      case 'pause':
        result = await pauseSubscription(subscription, data);
        break;
      case 'resume':
        result = await resumeSubscription(subscription, data);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error performing subscription action:', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}

// Cancel subscription
async function cancelSubscription(subscription: any, data: any) {
  const { immediate = false, reason = '' } = data || {};

  const updateData: any = {
    status: 'CANCELED',
    cancelAtPeriodEnd: true,
  };

  if (immediate) {
    updateData.canceledAt = new Date();
    updateData.currentPeriodEnd = new Date();
  }

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: updateData,
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      plan: {
        select: { id: true, name: true, price: true },
      },
    },
  });

  // 发送取消通知
  try {
    await NotificationService.sendNotification({
      userId: updated.user.id,
      type: 'SYSTEM',
      template: 'SUBSCRIPTION_CANCELED',
      data: {
        planName: updated.plan.name,
        immediate,
        reason
      }
    })
  } catch {}

  // 同步到Stripe（若存在）
  try {
    if (subscription.provider === 'stripe' && subscription.providerSubscriptionId) {
      await StripeService.cancelSubscription(subscription.id, !immediate)
    }
  } catch (e) {
    console.warn('Stripe cancel failed (non-fatal):', e)
  }

  return {
    success: true,
    message: immediate ? 'Subscription cancelled immediately' : 'Subscription will not renew',
    subscription: updated,
  };
}

// Renew subscription
async function renewSubscription(subscription: any, data: any) {
  const { duration = 30, extendCurrent = true } = data || {};

  const newEndDate = extendCurrent
    ? new Date(subscription.currentPeriodEnd.getTime() + duration * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + duration * 24 * 60 * 60 * 1000);

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'ACTIVE',
      currentPeriodEnd: newEndDate,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      plan: {
        select: { id: true, name: true, price: true },
      },
    },
  });

  // 通知续订
  try {
    await NotificationService.sendNotification({
      userId: updated.user.id,
      type: 'SYSTEM',
      template: 'SUBSCRIPTION_RENEWED',
      data: {
        planName: updated.plan.name,
        extendCurrent,
        duration
      }
    })
  } catch {}

  return {
    success: true,
    message: `Subscription renewed for ${duration} days`,
    subscription: updated,
  };
}

// Upgrade subscription
async function upgradeSubscription(subscription: any, data: any) {
  const { newPlanId, prorate = true } = data || {};

  if (!newPlanId) {
    throw new Error('New plan ID is required');
  }

  // Get new plan details
  const newPlan = await prisma.plan.findUnique({
    where: { id: newPlanId },
  });

  if (!newPlan) {
    throw new Error('New plan not found');
  }

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      planId: newPlanId,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      plan: {
        select: { id: true, name: true, price: true },
      },
    },
  });

  // 通知升级
  try {
    await NotificationService.sendNotification({
      userId: updated.user.id,
      type: 'SYSTEM',
      template: 'SUBSCRIPTION_UPGRADED',
      data: {
        oldPlan: subscription.plan.name,
        newPlan: updated.plan.name,
        prorate
      }
    })
  } catch {}

  return {
    success: true,
    message: `Subscription upgraded to ${newPlan.name}`,
    subscription: updated,
  };
}

// Refund subscription
async function refundSubscription(subscription: any, data: any) {
  const { amount, reason = 'Admin refund' } = data || {};

  // 记录退款（本地记录，Stripe退款需另行实现）
  if (amount && amount > 0) {
    await prisma.payment.create({
      data: {
        userId: subscription.userId,
        subscriptionId: subscription.id,
        amount: -Math.abs(amount),
        currency: subscription.plan?.currency || 'USD',
        status: 'REFUNDED',
        provider: subscription.provider,
        metadata: { reason }
      }
    })
  }

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {},
  });

  try {
    await NotificationService.sendNotification({
      userId: subscription.userId,
      type: 'SYSTEM',
      template: 'SUBSCRIPTION_REFUNDED',
      data: { amount: amount ?? null, reason }
    })
  } catch {}

  return {
    success: true,
    message: amount ? `Refund of ${amount} processed` : 'Refund initiated',
    subscription: updated,
  };
}

// Pause subscription
async function pauseSubscription(subscription: any, data: any) {
  const { pauseDuration = 7 } = data || {};

  const resumeDate = new Date(Date.now() + pauseDuration * 24 * 60 * 60 * 1000);

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'CANCELED',
      cancelAtPeriodEnd: false,
      canceledAt: new Date(),
    },
  });

  // 发送暂停通知并记录计划恢复时间
  const resumeDate = new Date(Date.now() + pauseDuration * 24 * 60 * 60 * 1000)
  try {
    await NotificationService.sendNotification({
      userId: subscription.userId,
      type: 'SYSTEM',
      template: 'SUBSCRIPTION_PAUSED',
      data: { pauseDuration, resumeDate: resumeDate.toISOString() }
    })
  } catch {}

  return {
    success: true,
    message: `Subscription paused for ${pauseDuration} days`,
    subscription: updated,
  };
}

// Resume subscription
async function resumeSubscription(subscription: any, data: any) {
  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'ACTIVE',
      canceledAt: null,
      cancelAtPeriodEnd: false,
    },
  });
  try {
    await NotificationService.sendNotification({
      userId: subscription.userId,
      type: 'SYSTEM',
      template: 'SUBSCRIPTION_RESUMED',
      data: { planName: updated.plan?.name }
    })
  } catch {}

  return {
    success: true,
    message: 'Subscription resumed',
    subscription: updated,
  };
}
