import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { TokenPriorityService } from '@/lib/services/token-priority-service';

/**
 * POST /api/user/tokens/check-availability
 * Check if user has enough tokens and get consumption breakdown
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { amount, simulate = false } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    if (simulate) {
      // Simulate consumption to show breakdown
      const simulation = await TokenPriorityService.simulateConsumption(
        session.user.id,
        amount
      );

      return NextResponse.json({
        type: 'simulation',
        ...simulation
      });
    } else {
      // Just check availability
      const availability = await TokenPriorityService.checkTokenAvailability(
        session.user.id,
        amount
      );

      return NextResponse.json({
        type: 'availability',
        ...availability
      });
    }

  } catch (error) {
    console.error('Check token availability error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/tokens/consumption-breakdown
 * Get user's token consumption breakdown
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const breakdown = await TokenPriorityService.getTokenConsumptionBreakdown(
      session.user.id
    );

    return NextResponse.json(breakdown);

  } catch (error) {
    console.error('Get consumption breakdown error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}