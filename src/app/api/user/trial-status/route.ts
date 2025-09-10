import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { TrialService } from '@/lib/services/trial-service'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get trial status for the current user
    const trialStatus = await TrialService.getTrialStatus(session.userId)
    
    return NextResponse.json({
      success: true,
      data: trialStatus
    })

  } catch (error) {
    console.error('Error getting trial status:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" as any 
    }, { status: 500 })
  }
}