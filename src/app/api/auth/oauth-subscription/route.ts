import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { handleNewUserSubscription } from '@/lib/auth/v5-config';

/**
 * POST /api/auth/oauth-subscription
 * Handle subscription creation for new OAuth users
 */
export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { isNewUser, invitationCode } = body;

    if (!isNewUser) {
      return NextResponse.json({
        success: true,
        message: 'Not a new user, no subscription needed'
      });
    }

    // Handle subscription creation
    await handleNewUserSubscription(
      session.user.id,
      session.user.email || '',
      invitationCode
    );

    return NextResponse.json({
      success: true,
      message: 'Subscription created successfully'
    });

  } catch (error) {
    console.error('Error creating OAuth subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}