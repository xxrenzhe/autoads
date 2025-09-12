import { NextRequest, NextResponse } from 'next/server'
import { TrialService } from '@/lib/services/trial-service'

export async function GET(request: NextRequest) {
  try {
    // Verify the request is from a cron job (optional security check)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('Unauthorized cron job request for trial expiration')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting trial expiration check...')
    
    // Check and process expired trials
    await TrialService.checkTrialExpiration()
    
    console.log('Trial expiration check completed successfully')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Trial expiration check completed',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in trial expiration cron job:', error)
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" as any,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Also support POST method for manual triggering
export async function POST(request: NextRequest) {
  return GET(request)
}