import { NextRequest, NextResponse } from 'next/server';
import { InvitationService } from '@/lib/services/invitation-service';
import { TrialService } from '@/lib/services/trial-service';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import { AuthError, handleAuthError } from '@/lib/auth/auth-errors';

/**
 * Queue benefit assignment for async processing
 */
async function queueBenefitAssignment(userId: string, invitationCode?: string, invitationValid?: boolean) {
  // Use setTimeout to process benefits asynchronously
  setTimeout(async () => {
    try {
      if (invitationValid && invitationCode) {
        // Process invitation benefits
        await InvitationService.acceptInvitation(invitationCode, userId);
        console.log(`Invitation benefits processed for user: ${userId}`);
      } else {
        // Assign trial benefits
        await TrialService.assignTrialToNewUser(userId);
        console.log(`Trial benefits processed for user: ${userId}`);
      }
    } catch (error) {
      console.error(`Failed to process benefits for user ${userId}:`, error);
      // Could implement retry logic or notification here
    }
  }, 100); // Process after 100ms to not block the response
}

/**
 * POST /api/auth/register
 * Registration endpoint has been disabled - users can only register via OAuth (Google)
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'User registration has been disabled. Please use Google OAuth to sign up.',
    error: 'REGISTRATION_DISABLED'
  }, { status: 403 });
}