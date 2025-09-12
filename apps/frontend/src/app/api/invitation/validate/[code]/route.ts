import { NextRequest, NextResponse } from 'next/server';
import { InvitationService } from '@/lib/services/invitation-service';

/**
 * GET /api/invitation/validate/[code]
 * Validate an invitation code (public endpoint)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    
    const result = await InvitationService.validateInvitationCode(code);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Validate invitation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}