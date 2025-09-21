import { NextRequest, NextResponse } from 'next/server';
import { TokenExpirationService } from '@/lib/services/token-expiration-service';

/**
 * POST /api/cron/process-expired-tokens
 * Process expired tokens (should be called by cron job)
 */
export async function POST(request: NextRequest) {
  // Deprecated: Backend Go scheduler now owns this task.
  // Keep endpoint to avoid breaking callers; respond with 410 and guidance.
  return NextResponse.json({
    code: 410,
    message: 'Endpoint deprecated. Token expiration is handled by backend scheduler.',
    next: '/ops/api/v1/console/scheduler/jobs'
  }, { status: 410 })
}
