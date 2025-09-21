import { NextRequest, NextResponse } from 'next/server';
import { InvitationService } from '@/lib/services/invitation-service';
import { auth } from '@/lib/auth';
import { getDomainConfig } from '@/lib/domain-config';

/**
 * GET /api/invitation/my-code
 * Get the current user's invitation code
 */
export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get or create user's invitation code
    const result = await InvitationService.createInvitation(session.user.id);

    if (result.success) {
      // Use domain config instead of request.nextUrl.origin to get the proper public URL
      const domainConfig = getDomainConfig();
      const invitationUrl = `${domainConfig.baseUrl}/?invite=${result.invitationCode}`;
      
      return NextResponse.json({
        success: true,
        data: {
          invitationCode: result.invitationCode,
          invitationUrl
        }
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error getting invitation code:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get invitation code' },
      { status: 500 }
    );
  }
}