import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionExpirationService } from '@/lib/services/subscription-expiration-service';

/**
 * POST /api/subscription/process-expired
 * Process expired subscriptions and downgrade users to free plan
 * This endpoint should be called by a cron job daily
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Process expired subscriptions
    const results = await SubscriptionExpirationService.processExpiredSubscriptions();
    
    // Process expiring subscriptions (for notifications)
    const expiringResults = await SubscriptionExpirationService.processExpiringSubscriptions();

    return NextResponse.json({
      success: true,
      message: 'Processed expired subscriptions',
      data: {
        expired: results,
        expiring: expiringResults
      }
    });
  } catch (error) {
    console.error('Error processing expired subscriptions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process expired subscriptions' },
      { status: 500 }
    );
  }
}