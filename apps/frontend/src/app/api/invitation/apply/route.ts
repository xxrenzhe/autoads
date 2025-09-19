import { NextRequest, NextResponse } from 'next/server';
import { InvitationService } from '@/lib/services/invitation-service';
import { requireIdempotencyKey } from '@/lib/utils/idempotency';
import { forwardToGo } from '@/lib/bff/forward';
import { auth } from '@/lib/auth';

/**
 * POST /api/invitation/apply
 * Apply an invitation code to the current user
 */
export async function POST(request: NextRequest) {
  try {
    requireIdempotencyKey(request as any)
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

    // Prefer Go authoritative path if present
    try {
      const resp = await forwardToGo(request as any, { targetPath: '/api/invitation/process', method: 'POST', appendSearch: false })
      if (resp.ok) return resp
    } catch {}

    // Fallback to Next-side service
    const result = await InvitationService.acceptInvitation(invitationCode, session.user.id);

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
