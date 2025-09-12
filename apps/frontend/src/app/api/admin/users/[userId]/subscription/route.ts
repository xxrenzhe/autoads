import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SubscriptionHelper } from '@/lib/services/subscription-helper';
import { SubscriptionSource, SubscriptionChangeReason } from '@prisma/client';

/**
 * POST /api/admin/users/[userId]/subscription
 * 
 * Admin endpoint to manually set a user's subscription plan
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Check authentication and admin permissions
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!currentUser || !['ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const userId = params.userId;
    const { planId, duration, customEndDate, notes } = await request.json();

    // Validate input
    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Get the target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the plan details
    const plan = await prisma.plan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Calculate subscription dates
    const now = new Date();
    let startDate = now;
    let endDate: Date;

    if (customEndDate) {
      endDate = new Date(customEndDate);
      if (endDate <= now) {
        return NextResponse.json({ error: 'End date must be in the future' }, { status: 400 });
      }
    } else {
      // Default duration: 1 month
      const months = duration || 1;
      endDate = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
    }

    // Deactivate existing active subscription if any
    if (targetUser.subscriptions.length > 0) {
      const existingSubscription = targetUser.subscriptions[0];
      await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          changeReason: SubscriptionChangeReason.MANUAL_CHANGE,
          metadata: {
            ...existingSubscription.metadata,
            cancelledBy: session.user.id,
            cancelledAt: now.toISOString(),
            notes: notes || 'Manually changed by admin'
          }
        }
      });
    }

    // Create new subscription
    const newSubscription = await prisma.subscription.create({
      data: {
        userId: targetUser.id,
        planId: plan.id,
        status: 'ACTIVE',
        startDate,
        endDate,
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate,
        source: SubscriptionSource.MANUAL,
        changeReason: SubscriptionChangeReason.MANUAL_CHANGE,
        metadata: {
          assignedBy: session.user.id,
          assignedAt: now.toISOString(),
          notes: notes || 'Manually assigned by admin',
          originalPlanPrice: plan.price,
          customDuration: duration,
          customEndDate: customEndDate
        }
      }
    });

    // Update user's trial used status if assigning a trial
    if (plan.trialDays > 0) {
      await prisma.user.update({
        where: { id: targetUser.id },
        data: { trialUsed: true }
      });
    }

    // Send notification to user
    try {
      const oldPlanName = targetUser.subscriptions.length > 0 
        ? targetUser.subscriptions[0].plan.name 
        : 'Free';
      await SubscriptionHelper.sendSubscriptionChangeNotification(
        targetUser.id,
        oldPlanName,
        plan.name,
        SubscriptionChangeReason.MANUAL_CHANGE
      );
    } catch (notificationError) {
      console.error('Failed to send subscription notification:', notificationError);
    }

    return NextResponse.json({
      message: 'Subscription assigned successfully',
      subscription: {
        id: newSubscription.id,
        userId: newSubscription.userId,
        planName: plan.name,
        status: newSubscription.status,
        startDate: newSubscription.startDate,
        endDate: newSubscription.endDate,
        source: newSubscription.source
      }
    });

  } catch (error) {
    console.error('Error assigning subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[userId]/subscription
 * 
 * Admin endpoint to modify an existing subscription
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Check authentication and admin permissions
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!currentUser || !['ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const userId = params.userId;
    const { subscriptionId, extendDays, newEndDate, cancelImmediately, notes } = await request.json();

    // Get the user's active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        ...(subscriptionId && { id: subscriptionId })
      }
    });

    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    const updates: any = {
      changeReason: SubscriptionChangeReason.MANUAL_CHANGE,
      metadata: {
        ...subscription.metadata,
        modifiedBy: session.user.id,
        modifiedAt: new Date().toISOString(),
        notes: notes || 'Manually modified by admin'
      }
    };

    if (cancelImmediately) {
      updates.status = 'CANCELLED';
      updates.cancelledAt = new Date();
    } else if (extendDays) {
      const newEnd = new Date(subscription.endDate);
      newEnd.setDate(newEnd.getDate() + extendDays);
      updates.endDate = newEnd;
      updates.currentPeriodEnd = newEnd;
    } else if (newEndDate) {
      const newEnd = new Date(newEndDate);
      if (newEnd <= new Date()) {
        return NextResponse.json({ error: 'New end date must be in the future' }, { status: 400 });
      }
      updates.endDate = newEnd;
      updates.currentPeriodEnd = newEnd;
    }

    // Update the subscription
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: updates
    });

    // Send notification if subscription was cancelled
    if (cancelImmediately) {
      try {
        await SubscriptionHelper.sendSubscriptionChangeNotification(
          userId,
          subscription.plan.name,
          'Free',
          SubscriptionChangeReason.CANCELLATION
        );
      } catch (notificationError) {
        console.error('Failed to send cancellation notification:', notificationError);
      }
    }

    return NextResponse.json({
      message: 'Subscription updated successfully',
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        endDate: updatedSubscription.endDate,
        changes: {
          extendedDays: extendDays,
          newEndDate: newEndDate,
          cancelled: cancelImmediately
        }
      }
    });

  } catch (error) {
    console.error('Error modifying subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}