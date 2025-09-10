import { NextRequest, NextResponse } from 'next/server';
import { InvitationService } from '@/lib/services/invitation-service';
import { auth } from '@/lib/auth';

/**
 * GET /api/invitation/stats
 * Get invitation statistics for the current user
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

    // Get invitation statistics
    const stats = await InvitationService.getInvitationStats(session.user.id);

    return NextResponse.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting invitation stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get invitation stats' },
      { status: 500 }
    );
  }
}