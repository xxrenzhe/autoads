import { NextRequest, NextResponse } from 'next/server';
import { requireIdempotencyKey } from '@/lib/utils/idempotency';
import { ensureNextWriteAllowed } from '@/lib/utils/writes-guard'
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { Logger } from '@/lib/core/Logger';
import { addDays } from 'date-fns';

const logger = new Logger('USER-INVITATION-ACCEPT-ROUTE');
/**
 * Accept invitation
 */
export async function POST(request: NextRequest) {
  try {
    ensureNextWriteAllowed()
    requireIdempotencyKey(request as any)
    const session = await auth();
    if (!session?.userId || !session.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { invitationCode } = body;

    if (!invitationCode || invitationCode.length !== 8) {
      return NextResponse.json(
        { error: 'Invalid invitation code' },
        { status: 400 }
      );
    }

    // Find invitation by code
    const invitations = await prisma.invitation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        inviter: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Find matching invitation by generated code
    const invitation = invitations.find((inv: any) => 
      generateInvitationCode(inv.id) === invitationCode.toUpperCase()
    );

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation code' },
        { status: 400 }
      );
    }

    // Check if user is trying to use their own invitation
    if (invitation.inviterId === session.userId) {
      return NextResponse.json(
        { error: 'You cannot use your own invitation code' },
        { status: 400 }
      );
    }

    // Check if user has already used an invitation
    const existingAcceptedInvitation = await prisma.invitation.findFirst({
      where: {
        email: session.user.email,
        status: 'ACCEPTED',
      },
    });

    if (existingAcceptedInvitation) {
      return NextResponse.json(
        { error: 'You have already used an invitation code' },
        { status: 400 }
      );
    }

    // Process invitation acceptance in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get or create Pro plan
      let proPlan = await tx.plan.findFirst({
        where: { name: 'Pro', isActive: true }
      });
      
      if (!proPlan) {
        proPlan = await tx.plan.create({
          data: {
            name: 'Pro',
            description: '专业版套餐',
            price: 99.99,
            currency: 'CNY',
            interval: 'MONTH',
            tokenQuota: 10000, // Pro套餐包含10000个token
            features: {
              batchOpen: { enabled: true, maxUrlsPerBatch: 1000 },
              siteRank: { enabled: true, maxUrlsPerDay: 5000 },
              advancedFeatures: { enabled: true }
            },
            isActive: true,
            metadata: {
              type: 'pro'
            }
          }
        });
      }
      
      // Update invitation status
      const updatedInvitation = await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          email: session.user!.email!,
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });

      // Create Pro subscription for invitee (30 days)
      const inviteeSubscription = await tx.subscription.create({
        data: {
          userId: session.userId!,
          planId: proPlan.id,
          status: 'ACTIVE',
          provider: 'system',
          currentPeriodStart: new Date(),
          currentPeriodEnd: addDays(new Date(), 30),
          metadata: {
            source: 'invitation_reward',
            invitationId: invitation.id,
          },
        },
      });

      // Add subscription tokens to invitee using unified system
      const inviteeTokens = proPlan.tokenQuota || 10000;
      const inviteeUser = await tx.user.findUnique({
        where: { id: session.userId },
        select: { tokenBalance: true }
      });
      
      await tx.user.update({
        where: { id: session.userId },
        data: {
          tokenBalance: {
            increment: inviteeTokens,
          },
        },
      });

      // Create subscription token transaction for invitee
      await tx.tokenTransaction.create({
        data: {
          userId: session.userId!,
          type: 'SUBSCRIPTION',
          amount: inviteeTokens,
          balanceBefore: inviteeUser?.tokenBalance || 0,
          balanceAfter: (inviteeUser?.tokenBalance || 0) + inviteeTokens,
          source: 'invitation_reward',
          description: 'Invitation Pro subscription tokens',
          metadata: {
            invitationId: invitation.id,
            inviterId: invitation.inviterId,
            subscriptionId: inviteeSubscription.id,
            expiresAt: inviteeSubscription.currentPeriodEnd.toISOString(),
            tokenSource: 'SUBSCRIPTION'
          },
        },
      });

      // Add subscription tokens to inviter using unified system
      const inviterTokens = proPlan.tokenQuota || 10000;
      const inviterUser = await tx.user.findUnique({
        where: { id: invitation.inviterId },
        select: { tokenBalance: true }
      });
      
      await tx.user.update({
        where: { id: invitation.inviterId },
        data: {
          tokenBalance: {
            increment: inviterTokens,
          },
        },
      });

      
      // Create Pro subscription for inviter (30 days)
      const inviterSubscription = await tx.subscription.create({
        data: {
          userId: invitation.inviterId,
          planId: proPlan.id,
          status: 'ACTIVE',
          provider: 'system',
          currentPeriodStart: new Date(),
          currentPeriodEnd: addDays(new Date(), 30),
          metadata: {
            source: 'invitation_reward',
            invitationId: invitation.id,
          },
        },
      });

      // Create subscription token transaction for inviter
      await tx.tokenTransaction.create({
        data: {
          userId: invitation.inviterId,
          type: 'SUBSCRIPTION',
          amount: inviterTokens,
          balanceBefore: inviterUser?.tokenBalance || 0,
          balanceAfter: (inviterUser?.tokenBalance || 0) + inviterTokens,
          source: 'invitation_reward',
          description: 'Successful invitation Pro subscription tokens',
          metadata: {
            invitationId: invitation.id,
            subscriptionId: inviterSubscription.id,
            expiresAt: inviterSubscription.currentPeriodEnd.toISOString(),
            tokenSource: 'SUBSCRIPTION',
            inviteeId: session.userId,
            inviteeEmail: session.user!.email,
          },
        },
      });

      return {
        invitation: updatedInvitation,
        inviteeSubscription,
        inviterSubscription,
      };
    });

    logger.info(`Invitation accepted: ${invitation.id}`, {
      invitationId: invitation.id,
      inviterId: invitation.inviterId,
      inviteeId: session.userId,
      inviteeEmail: session.user.email,
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully! You and your friend both received 30 days Pro access.',
      data: {
        subscriptionDays: 30,
        inviterName: invitation.inviter.name || invitation.inviter.email,
      },
    });
  } catch (error) {
    logger.error('Failed to accept invitation:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to accept invitation',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}

/**
 * Generate invitation code from ID (same as in create route)
 */
function generateInvitationCode(id: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  let hash = 0;
  
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) & 0xffffffff;
  }
  
  for (let i = 0; i < 8; i++) {
    code += chars[Math.abs(hash) % chars.length];
    hash = Math.floor(hash / chars.length);
  }
  
  return code;
}
