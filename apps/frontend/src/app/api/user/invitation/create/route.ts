import { NextRequest, NextResponse } from 'next/server';
import { requireIdempotencyKey } from '@/lib/utils/idempotency';
import { ensureNextWriteAllowed } from '@/lib/utils/writes-guard'
import { forwardToGo } from '@/lib/bff/forward'
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { Logger } from '@/lib/core/Logger';
import { addDays } from 'date-fns';

const logger = new Logger('USER-INVITATION-CREATE-ROUTE');
/**
 * Get current invitation data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current active invitation
    // More flexible query to handle both expired and non-expired invitations
    const currentInvitation = await prisma.invitation.findFirst({
      where: {
        inviterId: session.userId,
        status: 'PENDING',
        // Check if invitation is either not expired or has no expiration
        OR: [
          { expiresAt: { gt: new Date() } },
          { expiresAt: null }
        ]
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get invitation stats
    const [totalInvited, totalAccepted, recentInvitations] = await Promise.all([
      prisma.invitation.count({
        where: { invitedId: session.userId },
      }),
      prisma.invitation.count({
        where: {
          inviterId: session.userId, invitedId: null,
          status: 'ACCEPTED',
        },
      }),
      prisma.invitation.findMany({
        where: { invitedId: session.userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Calculate total tokens earned from invitations
    const totalTokensEarned = totalAccepted * 100; // 100 tokens per successful invitation

    const stats = {
      totalInvited,
      totalAccepted,
      totalTokensEarned,
      recentInvitations: recentInvitations.map((inv: any) => ({
        id: inv.id,
        code: generateInvitationCode(inv.id), // Generate display code from ID
        inviterEmail: 'user@example.com', // session.user?.email || '',
        status: inv.status,
        tokensReward: 0, // No additional token rewards
        createdAt: inv.createdAt.toISOString(),
        expiresAt: inv.expiresAt?.toISOString(),
      })),
    };

    const data = {
      currentInvitation: currentInvitation ? {
        code: generateInvitationCode(currentInvitation.id),
        expiresAt: currentInvitation.expiresAt?.toISOString(),
        status: 'ACTIVE',
      } : null,
      stats,
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Failed to get invitation data:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get invitation data',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}

/**
 * Create new invitation
 */
export async function POST(request: NextRequest) {
  try {
    requireIdempotencyKey(request as any)
    // Prefer Go authoritative path if present
    try {
      const resp = await forwardToGo(request as any, { targetPath: '/api/invitation/generate-link', method: 'POST', appendSearch: false })
      if (resp.ok) return resp
    } catch {}
    // Fallback to Next-side implementation (guarded)
    ensureNextWriteAllowed()
    const session = await auth();
    if (!session?.userId || !session.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user already has an active invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        inviterId: session.userId,
        status: 'PENDING',
        OR: [
          { expiresAt: { gt: new Date() } },
          { expiresAt: null }
        ]
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'You already have an active invitation' },
        { status: 400 }
      );
    }

    // Create new invitation
    const expiresAt = addDays(new Date(), 30); // 30 days expiry
    
    // Create invitation first without code
    const invitation = await prisma.invitation.create({
      data: {
        email: '', // Will be filled when someone accepts
        inviterId: session.userId,
        invitedId: null,
        code: '', // Will be generated after creation
        status: 'PENDING',
        expiresAt,
        tokensReward: 100, // Default reward
      },
    });
    
    // Generate invitation code using the invitation ID
    const code = generateInvitationCode(invitation.id);
    
    // Update the invitation with the generated code
    const updatedInvitation = await prisma.invitation.update({
      where: { id: invitation.id },
      data: { code },
    });
    

    logger.info(`Invitation created: ${invitation.id}`, {
      userId: session.userId,
      invitationId: invitation.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        currentInvitation: {
          code: updatedInvitation.code,
          expiresAt: updatedInvitation.expiresAt?.toISOString(),
          status: 'ACTIVE',
        },
        stats: {
          totalInvited: 0,
          totalAccepted: 0,
          totalTokensEarned: 0,
          recentInvitations: [],
        },
      },
    });
  } catch (error) {
    logger.error('Failed to create invitation:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create invitation',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}

/**
 * Generate invitation code from ID
 */
function generateInvitationCode(id: string): string {
  // Simple algorithm to generate 8-character code from ID
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  let hash = 0;
  
  // Create hash from ID
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) & 0xffffffff;
  }
  
  // Convert hash to 8-character code
  for (let i = 0; i < 8; i++) {
    code += chars[Math.abs(hash) % chars.length];
    hash = Math.floor(hash / chars.length);
  }
  
  return code;
}
