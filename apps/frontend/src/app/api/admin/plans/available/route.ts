import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/plans/available
 * 
 * Admin endpoint to get all available plans for assignment
 */
export async function GET() {
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

    if (!currentUser || !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get all active plans
    const plans = await prisma.plan.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { sortOrder: 'asc' },
      include: {
        planFeatures: {
          select: {
            featureId: true,
            name: true,
            enabled: true,
            config: true
          }
        }
      }
    });

    // Format plans with their features
    const formattedPlans = plans.map((plan: any) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      currency: plan.currency,
      interval: plan.interval,
      isActive: plan.isActive,
      tokenQuota: plan.tokenQuota,
      trialDays: plan.trialDays,
      yearlyDiscount: plan.yearlyDiscount,
      features: plan.planFeatures.map((feature: any) => ({
        id: feature.featureId,
        name: feature.name,
        enabled: feature.enabled,
        value: feature.config?.value,
        unit: feature.config?.unit
      }))
    }));

    return NextResponse.json({
      plans: formattedPlans
    });

  } catch (error) {
    console.error('Error fetching available plans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
