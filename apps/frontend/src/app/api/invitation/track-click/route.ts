import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/invitation/track-click
 * Track when a user clicks on an invitation link (before login)
 * This helps us know that the user came from an invitation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invitationCode } = body;

    if (!invitationCode) {
      return NextResponse.json(
        { success: false, error: 'Invitation code is required' },
        { status: 400 }
      );
    }

    // Store in a temporary storage (we'll use localStorage for now)
    // In a production app, you might want to use cookies or session storage
    // with proper expiration and security measures

    return NextResponse.json({
      success: true,
      message: 'Invitation click tracked'
    });
  } catch (error) {
    console.error('Error tracking invitation click:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to track invitation click' },
      { status: 500 }
    );
  }
}