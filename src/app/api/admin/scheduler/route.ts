import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { SchedulerService } from '@/lib/services/scheduler-service'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get scheduler status
    const status = SchedulerService.getSchedulerStatus()
    
    return NextResponse.json({
      success: true,
      data: status
    })

  } catch (error) {
    console.error('Error getting scheduler status:', error)
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

    const { action } = await request.json()

    switch (action) {
      case 'start':
        SchedulerService.startScheduler()
        return NextResponse.json({
          success: true,
          message: 'Scheduler started successfully'
        })

      case 'stop':
        SchedulerService.stopScheduler()
        return NextResponse.json({
          success: true,
          message: 'Scheduler stopped successfully'
        })

      case 'trigger_trial_check':
        await SchedulerService.triggerTrialExpirationCheck()
        return NextResponse.json({
          success: true,
          message: 'Trial expiration check triggered successfully'
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in scheduler API:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" as any 
    }, { status: 500 })
  }
}