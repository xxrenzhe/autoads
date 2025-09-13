import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { TrialService } from '@/lib/services/trial-service'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'expiring':
        // Get trials expiring in the next 3 days
        const expiringTrials = await TrialService.getExpiringTrials(3)
        return NextResponse.json({
          success: true,
          data: expiringTrials,
          count: expiringTrials.length
        })

      case 'stats':
        // Get trial statistics
        const stats = await getTrialStatistics()
        return NextResponse.json({
          success: true,
          data: stats
        })

      default:
        // Get all active trials
        const activeTrials = await prisma.subscription.findMany({
          where: {
            provider: 'system',
            status: 'ACTIVE'
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                createdAt: true
              }
            },
            plan: {
              select: {
                id: true,
                name: true,
                tokenQuota: true
              }
            }
          },
          orderBy: {
            currentPeriodEnd: 'asc'
          }
        })

        // Calculate days remaining for each trial
        const trialsWithDaysRemaining = activeTrials.map((trial: any) => {
          const now = new Date()
          const daysRemaining = Math.max(0, Math.ceil(
            (trial.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          ))

          return {
            ...trial,
            daysRemaining,
            isExpiring: daysRemaining <= 3
          }
        })

        return NextResponse.json({
          success: true,
          data: trialsWithDaysRemaining,
          count: trialsWithDaysRemaining.length
        })
    }

  } catch (error) {
    console.error('Error in trials API:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" as any 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, userId } = await request.json()

    switch (action) {
      case 'check_expiration':
        // Manually trigger trial expiration check
        await TrialService.checkTrialExpiration()
        return NextResponse.json({
          success: true,
          message: 'Trial expiration check completed'
        })

      case 'assign_trial':
        // Manually assign trial to a user
        if (!userId) {
          return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
        }
        
        const trial = await TrialService.assignTrialToNewUser(userId)
        return NextResponse.json({
          success: true,
          data: trial,
          message: 'Trial assigned successfully'
        })

      case 'convert_to_free':
        // Manually convert trial to free
        if (!userId) {
          return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
        }
        
        await TrialService.convertTrialToFree(userId)
        return NextResponse.json({
          success: true,
          message: 'Trial converted to free plan'
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in trials POST API:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" as any 
    }, { status: 500 })
  }
}

async function getTrialStatistics() {
  const now = new Date()
  
  // Get trial statistics
  const [
    totalActiveTrials,
    expiringTrials,
    expiredTrials,
    convertedTrials,
    totalTrialUsers
  ] = await Promise.all([
    // Active trials
    prisma.subscription.count({
      where: {
        provider: 'system',
        status: 'ACTIVE',
        currentPeriodEnd: { gt: now }
      }
    }),
    
    // Expiring in next 3 days
    prisma.subscription.count({
      where: {
        provider: 'system',
        status: 'ACTIVE',
        currentPeriodEnd: {
          gt: now,
          lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
        }
      }
    }),
    
    // Expired trials
    prisma.subscription.count({
      where: {
        provider: 'system',
        status: 'EXPIRED'
      }
    }),
    
    // Converted trials (users who had trials and now have paid subscriptions)
    prisma.user.count({
      where: {
        subscriptions: {
          some: {
            provider: 'system',
            status: 'EXPIRED'
          }
        },
        AND: {
          subscriptions: {
            some: {
              provider: 'stripe',
              status: 'ACTIVE'
            }
          }
        }
      }
    }),
    
    // Total users who have had trials
    prisma.user.count({
      where: {
        subscriptions: {
          some: {
            provider: 'system'
          }
        }
      }
    })
  ])

  // Calculate conversion rate
  const conversionRate = totalTrialUsers > 0 ? (convertedTrials / totalTrialUsers) * 100 : 0

  return {
    totalActiveTrials,
    expiringTrials,
    expiredTrials,
    convertedTrials,
    totalTrialUsers,
    conversionRate: Math.round(conversionRate * 100) / 100
  }
}