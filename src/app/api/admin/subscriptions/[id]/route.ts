import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Subscription update schema
const updateSubscriptionSchema = z.object({
  status: z.enum(['ACTIVE', 'CANCELED', 'EXPIRED', 'PENDING', 'PAST_DUE']).optional(),
  currentPeriodStart: z.date().optional(),
  currentPeriodEnd: z.date().optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  canceledAt: z.date().optional(),
  provider: z.string().optional(),
  providerSubscriptionId: z.string().optional(),
});

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/admin/subscriptions/[id] - Get single subscription
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        plan: {
          select: { id: true, name: true, price: true, currency: true, features: true },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json(subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/subscriptions/[id] - Update subscription
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateSubscriptionSchema.parse(body);

    const subscription = await prisma.subscription.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        plan: {
          select: { id: true, name: true, price: true, currency: true },
        },
      },
    });

    return NextResponse.json(subscription);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/subscriptions/[id] - Delete subscription
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.subscription.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    return NextResponse.json(
      { error: 'Failed to delete subscription' },
      { status: 500 }
    );
  }
}