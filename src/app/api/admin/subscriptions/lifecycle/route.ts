import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { createSecureHandler } from '@/lib/utils/api-security'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

async function handleGET(request: NextRequest, { user }: any) {
  // Check if user is admin
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    // Get user lifecycle metrics
    const [
      newUsers,
      trialUsers,
      activeSubscribers,
      cancelledUsers
    ] = await Promise.all([
      // New users in last 30 days
      prisma.user.count({
        where: {
          createdAt: { gte: thirtyDaysAgo }
        }
      }),

      // Users with trial subscriptions (mock - would need trial status in real implementation)
      prisma.user.count({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          subscriptions: { none: {} }
        }
      }),

      // Active subscribers
      prisma.subscription.count({
        where: { status: 'ACTIVE' }
      }),

      // Cancelled users in last 30 days
      prisma.subscription.count({
        where: {
          status: 'CANCELED',
          updatedAt: { gte: thirtyDaysAgo }
        }
      })
    ])

    // Calculate average lifetime and LTV (simplified)
    const averageLifetime = 180 // Mock data - would calculate from actual subscription durations
    const lifetimeValue = 450 // Mock data - would calculate from actual revenue data

    const lifecycleMetrics = {
      newUsers,
      trialUsers,
      activeSubscribers,
      cancelledUsers,
      averageLifetime,
      lifetimeValue
    }

    return NextResponse.json({
      success: true,
      data: lifecycleMetrics
    })
  } catch (error) {
    console.error('Error fetching lifecycle metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lifecycle metrics' },
      { status: 500 }
    )
  }
}

export const GET = createSecureHandler({
  requireAuth: true,
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    keyGenerator: (req: NextRequest) => {
      const session = req.headers.get('authorization') || 'anonymous';
      return `admin-subscription-lifecycle:${session}`;
    }
  },
  handler: handleGET
});