import { NextRequest, NextResponse } from 'next/server';
import { TokenExpirationService } from '@/lib/services/token-expiration-service';

/**
 * POST /api/cron/process-expired-tokens
 * Process expired tokens (should be called by cron job)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await TokenExpirationService.processExpiredSubscriptionTokens();

    return NextResponse.json({
      success: true,
      processed: result.count,
      details: result.processed
    });

  } catch (error) {
    console.error('Process expired tokens error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}