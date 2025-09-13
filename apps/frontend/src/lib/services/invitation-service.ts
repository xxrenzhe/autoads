import { prisma } from '@/lib/prisma';
import { TokenType } from '@/types/auth';
import { TokenExpirationService } from './token-expiration-service';
import { TokenTransactionService } from './token-transaction-service';
import { SubscriptionHelper } from './subscription-helper';

export interface InvitationData {
  id: string;
  code: string;
  inviterEmail: string;
  inviterName?: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  tokensReward: number;
  createdAt: string;
  expiresAt?: string;
}

export interface InvitationStats {
  totalInvited: number;
  totalAccepted: number;
  totalTokensEarned: number;
  recentInvitations: InvitationData[];
}

export class InvitationService {
  /**
   * Generate a unique invitation code
   */
  private static generateInvitationCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Create a new invitation
   */
  static async createInvitation(userId: string): Promise<{
    success: boolean;
    invitationCode?: string;
    error?: string;
  }> {
    try {
      // Check if user already has a pending invitation (reuse if exists)
      const existingInvitation = await prisma.invitation.findFirst({
        where: {
          inviterId: userId,
          status: 'PENDING'
        }
      });

      if (existingInvitation) {
        return {
          success: true,
          invitationCode: existingInvitation.code
        };
      }

      // Generate new invitation code
      let invitationCode: string;
      let attempts = 0;
      
      do {
        invitationCode = this.generateInvitationCode();
        attempts++;
        
        if (attempts > 10) {
          return {
            success: false,
            error: 'Failed to generate unique invitation code'
          };
        }
      } while (await prisma.invitation.findUnique({
        where: { code: invitationCode }
      }));

      // Create invitation (no expiration)
      const invitation = await prisma.invitation.create({
        data: {
          inviterId: userId,
          code: invitationCode,
          status: 'PENDING',
          tokensReward: 0, // No additional token rewards, only Pro plan subscription
          // expiresAt: null // No expiration
        }
      });

      return {
        success: true,
        invitationCode: invitation.code
      };
    } catch (error) {
      console.error('Failed to create invitation:', error);
      return {
        success: false,
        error: 'Failed to create invitation'
      };
    }
  }

  /**
   * Accept an invitation and grant Pro plan to both users
   */
  static async acceptInvitation(
    invitationCode: string,
    invitedUserId: string
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      // Find the invitation
      const invitation = await prisma.invitation.findUnique({
        where: { code: invitationCode },
        include: {
          inviter: true
        }
      });

      if (!invitation) {
        return {
          success: false,
          error: 'Invalid invitation code'
        };
      }

      // No expiration check - invitations are permanent

      // Check if user is inviting themselves
      if (invitation.inviterId === invitedUserId) {
        return {
          success: false,
          error: 'Cannot use your own invitation code'
        };
      }

      // Check if this user has already used any invitation (one-time reward per user)
      const existingUsage = await prisma.invitation.findFirst({
        where: {
          invitedId: invitedUserId,
          status: 'ACCEPTED'
        }
      });

      if (existingUsage) {
        return {
          success: false,
          error: 'You have already used an invitation code and received your reward'
        };
      }

      // Get Pro plan details
      const proPlan = await prisma.plan.findFirst({
        where: {
          name: { contains: 'PRO', mode: 'insensitive' },
          status: 'ACTIVE'
        }
      });

      if (!proPlan) {
        return {
          success: false,
          error: 'Pro plan not found'
        };
      }

      // Grant Pro plan to both users (30 days duration)
      const subscriptionDuration = 30; // days
      
      // Cancel trial subscriptions first (outside transaction for performance)
      await prisma.subscription.updateMany({
        where: {
          userId: invitedUserId,
          status: 'ACTIVE',
          provider: 'system',
          providerSubscriptionId: {
            startsWith: 'trial_'
          }
        },
        data: {
          status: 'CANCELED',
          canceledAt: new Date()
        }
      });

      // Create or queue invitation subscriptions for both users
      await prisma.$transaction(async (tx: any) => {
        // Grant Pro plan to inviter (30 days or queued)
        const inviterResult = await SubscriptionHelper.createOrExtendInvitationSubscription(
          invitation.inviterId,
          proPlan.id,
          invitation.id
        );

        // Grant Pro plan to invited user (30 days or queued)
        const invitedResult = await SubscriptionHelper.createOrExtendInvitationSubscription(
          invitedUserId,
          proPlan.id,
          invitation.id
        );
      });

      // Record invitation activity (outside transaction)
      await prisma.userActivity.createMany({
        data: [
          {
            userId: invitation.inviterId,
            action: 'invitation_accepted',
            resource: 'invitation',
            metadata: {
              invitationId: invitation.id,
              invitedUserId,
              reward: 0, // No additional token rewards
              planGranted: proPlan.name
            }
          },
          {
            userId: invitedUserId,
            action: 'invitation_used',
            resource: 'invitation',
            metadata: {
              invitationId: invitation.id,
              inviterId: invitation.inviterId,
              reward: 0, // No additional token rewards
              planGranted: proPlan.name
            }
          }
        ]
      });

      // Check if rewards were queued or activated immediately
      const inviterQueuedRewards = await prisma.queuedInvitationReward.count({
        where: {
          userId: invitation.inviterId,
          status: 'PENDING'
        }
      });

      const invitedQueuedRewards = await prisma.queuedInvitationReward.count({
        where: {
          userId: invitedUserId,
          status: 'PENDING'
        }
      });

      let message = `Successfully accepted invitation! `;
      
      if (inviterQueuedRewards > 0 || invitedQueuedRewards > 0) {
        message += `The Pro plan rewards will be activated after your current subscriptions end. `;
        if (inviterQueuedRewards > 0) {
          message += `${invitation.inviter.email} has ${inviterQueuedRewards} queued reward(s). `;
        }
        if (invitedQueuedRewards > 0) {
          message += `You have ${invitedQueuedRewards} queued reward(s). `;
        }
      } else {
        message += `You and ${invitation.inviter.email} have received Pro plan for 30 days. `;
      }

      return {
        success: true,
        message
      };
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      return {
        success: false,
        error: 'Failed to accept invitation'
      };
    }
  }

  /**
   * Get user's invitation statistics
   */
  static async getInvitationStats(userId: string): Promise<InvitationStats> {
    try {
      // Get the user's invitation code
      const invitation = await prisma.invitation.findFirst({
        where: {
          inviterId: userId,
          status: 'PENDING'
        }
      });

      // Count actual usage from userActivity
      const [totalAccepted, recentActivities] = await Promise.all([
        // Count unique users who accepted invitations from this user
        prisma.userActivity.count({
          where: {
            userId,
            action: 'invitation_accepted',
            resource: 'invitation'
          }
        }),

        // Get recent invitation activities
        prisma.userActivity.findMany({
          where: {
            userId,
            action: 'invitation_accepted',
            resource: 'invitation'
          },
          include: {
            user: {
              select: {
                email: true,
                name: true
              }
            }
          },
          orderBy: { timestamp: 'desc' },
          take: 10
        })
      ]);

      // Calculate total tokens earned (now 0 since we removed additional token rewards)
      const totalTokensEarned = 0; // No additional token rewards, only Pro plan subscription

      // Format recent invitations from activities
      const recentInvitations: InvitationData[] = recentActivities.map(((activity: any) => ({
        id: activity.id,
        code: invitation?.code || 'N/A',
        inviterEmail: activity.user.email,
        inviterName: activity.user.name,
        status: 'ACCEPTED',
        tokensReward: 0,
        createdAt: activity.createdAt.toISOString()
      }));

      return {
        totalInvited: totalAccepted,
        totalAccepted,
        totalTokensEarned,
        recentInvitations
      };
    } catch (error) {
      console.error('Failed to get invitation stats:', error);
      return {
        totalInvited: 0,
        totalAccepted: 0,
        totalTokensEarned: 0,
        recentInvitations: []
      };
    }
  }

  /**
   * Get user's current invitation code
   */
  static async getCurrentInvitation(userId: string): Promise<{
    code?: string;
    expiresAt?: Date;
    status: string;
  }> {
    try {
      const invitation = await prisma.invitation.findFirst({
        where: {
          inviterId: userId,
          status: 'PENDING',
          expiresAt: {
            gte: new Date()
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!invitation) {
        return { status: 'NONE' };
      }

      return {
        code: invitation.code,
        expiresAt: invitation.expiresAt,
        status: 'ACTIVE'
      };
    } catch (error) {
      console.error('Failed to get current invitation:', error);
      return { status: 'ERROR' };
    }
  }

  /**
   * Check if an invitation code is valid
   */
  static async validateInvitationCode(code: string, userId?: string): Promise<{
    valid: boolean;
    inviter?: {
      id: string;
      email: string;
      name?: string;
    };
    error?: string;
  }> {
    try {
      // Find the original invitation (status PENDING) to get inviter info
      const invitation = await prisma.invitation.findFirst({
        where: { 
          code,
          status: 'PENDING'
        },
        include: {
          inviter: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });

      if (!invitation) {
        return {
          valid: false,
          error: 'Invalid invitation code'
        };
      }

      // If userId is provided, check if this user has already used any invitation (one-time reward)
      if (userId && invitation.inviterId !== userId) {
        const existingUsage = await prisma.invitation.findFirst({
          where: {
            invitedId: userId,
            status: 'ACCEPTED'
          }
        });

        if (existingUsage) {
          return {
            valid: false,
            error: 'You have already used an invitation code and received your reward'
          };
        }
      }

      // No expiration check - invitations are permanent
      // Invitation codes can be used by multiple different users

      return {
        valid: true,
        inviter: invitation.inviter
      };
    } catch (error) {
      console.error('Failed to validate invitation code:', error);
      return {
        valid: false,
        error: 'Failed to validate invitation code'
      };
    }
  }

  /**
   * Revoke an invitation (admin function)
   */
  static async revokeInvitation(invitationId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await prisma.invitation.update({
        where: { id: invitationId },
        data: { status: 'EXPIRED' }
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to revoke invitation:', error);
      return {
        success: false,
        error: 'Failed to revoke invitation'
      };
    }
  }

  /**
   * Get user's queued invitation rewards
   */
  static async getQueuedRewards(userId: string): Promise<{
    pending: any[];
    totalDays: number;
  }> {
    try {
      const queuedRewards = await prisma.queuedInvitationReward.findMany({
        where: {
          userId,
          status: 'PENDING'
        },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              tokenQuota: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      const totalDays = queuedRewards.reduce((sum: number, reward: any: any) => sum + reward.daysToAdd, 0);

      return {
        pending: queuedRewards,
        totalDays
      };
    } catch (error) {
      console.error('Failed to get queued rewards:', error);
      return {
        pending: [],
        totalDays: 0
      };
    }
  }

  /**
   * Clean up expired invitations
   */
  static async cleanupExpiredInvitations(): Promise<{
    cleaned: number;
  }> {
    try {
      const result = await prisma.invitation.updateMany({
        where: {
          status: 'PENDING',
          expiresAt: {
            lt: new Date()
          }
        },
        data: { status: 'EXPIRED' }
      });

      return { cleaned: result.count };
    } catch (error) {
      console.error('Failed to cleanup expired invitations:', error);
      return { cleaned: 0 };
    }
  }
}