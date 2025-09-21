import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { SimpleSecurityMonitor } from '@/lib/security/simple-security-middleware';

/**
 * GET /api/user/restrictions - Get current user's restrictions
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.userId;
    
    // Get user's active restrictions
    const restrictions = await SimpleSecurityMonitor.getUserRestrictions(userId);
    
    // Check for specific restriction types
    const [hasApiLimit, hasBatchLimit, hasAccountSuspend] = await Promise.all([
      SimpleSecurityMonitor.hasRestriction(userId, 'api_limit'),
      SimpleSecurityMonitor.hasRestriction(userId, 'batch_limit'),
      SimpleSecurityMonitor.hasRestriction(userId, 'account_suspend'),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        restrictions,
        hasApiLimit,
        hasBatchLimit,
        hasAccountSuspend,
        hasAnyRestriction: restrictions.length > 0,
      },
    });
  } catch (error) {
    console.error('Error fetching user restrictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch restrictions' },
      { status: 500 }
    );
  }
}