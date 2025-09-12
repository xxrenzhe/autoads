import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { InvitationService } from '@/lib/services/invitation-service';
import { PermissionService } from '@/lib/services/permission-service';

/**
 * POST /api/admin/invitations/[id]/revoke
 * Revoke an invitation (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permissions
    const hasPermission = await PermissionService.hasPermission(
      session.user.id,
      'users',
      'write'
    );
    
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = params;
    const result = await InvitationService.revokeInvitation(id);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Invitation revoked successfully'
      });
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Revoke invitation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}