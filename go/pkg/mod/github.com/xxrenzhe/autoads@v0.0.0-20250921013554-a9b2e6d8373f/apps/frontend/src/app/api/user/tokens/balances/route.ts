import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { TokenExpirationService } from '@/lib/services/token-expiration-service';

/**
 * GET /api/user/tokens/balances
 * Get user's token balances by type
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const balances = await TokenExpirationService.getUserTokenBalances(session.user.id);

    return NextResponse.json(balances);

  } catch (error) {
    console.error('Get token balances error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}