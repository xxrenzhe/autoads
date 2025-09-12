import { NextRequest, NextResponse } from 'next/server';
import { InvitationService } from '@/lib/services/invitation-service';
import { auth } from '@/lib/auth';

/**
 * POST /api/invitation/apply
 * Apply an invitation code to the current user
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
    const { invitationCode } = body;

    if (!invitationCode) {
      return NextResponse.json(
        { success: false, error: 'Invitation code is required' },
        { status: 400 }
      );
    }

    // Apply the invitation
    const result = await InvitationService.acceptInvitation(
      invitationCode,
      session.user.id
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error applying invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to apply invitation' },
      { status: 500 }
    );
  }
}