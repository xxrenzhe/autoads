import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { createSecureHandler } from '@/lib/utils/api-security'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

async function handleGET(request: NextRequest, { user, validatedData }: any) {
  // Check if user is admin
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  const { days } = validatedData.query

  try {
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
    
    // Generate mock trend data (in real implementation, this would query actual subscription events)
    const trends: Array<{ date: string; newSubscriptions: number; cancellations: number; revenue: number; netGrowth: number; }> = []
    for (let i = parseInt(days) - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      
      // Mock data - in real implementation, query subscription events
      const newSubscriptions = Math.floor(Math.random() * 20) + 5
      const cancellations = Math.floor(Math.random() * 8) + 1
      const revenue = (newSubscriptions * 29) - (cancellations * 29) // Simplified
      const netGrowth = newSubscriptions - cancellations
      
      trends.push({
        date: dateStr,
        newSubscriptions,
        cancellations,
        revenue,
        netGrowth
      })
    }

    return NextResponse.json({
      success: true,
      data: trends
    })
  } catch (error) {
    console.error('Error fetching subscription trends:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription trends' },
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
      return `admin-subscription-trends:${session}`;
    }
  },
  validation: {
    query: [
      { field: 'days', type: 'number', required: false, min: 1, max: 365, default: 30 }
    ]
  },
  handler: handleGET
});
