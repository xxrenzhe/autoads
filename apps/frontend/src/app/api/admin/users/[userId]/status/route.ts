import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { createSecureHandler } from '@/lib/utils/api-security';

interface RouteParams {
  params: {
    userId: string;
  };
}

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/users/[userId]/status - Update user status (enable/disable)
 */
async function handlePATCH(request: NextRequest, { params, validatedData, user }: any) {
  const { userId } = params;
  const { status } = validatedData.body;

  // Check if user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, status: true }
  });

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Prevent self-modification for critical operations
  if (userId === user.id && (status === 'BANNED' || status === 'INACTIVE')) {
    return NextResponse.json({ error: 'Cannot disable your own account' }, { status: 400 });
  }

  // Update user status
  const updatedUser = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        status,
        updatedAt: new Date()
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        updatedAt: true
      }
    });

    // Record admin log
    await tx.adminLog.create({
      data: {
        action: 'UPDATE_USER_STATUS',
        details: {
          userId,
          userEmail: targetUser.email,
          oldStatus: targetUser.status,
          newStatus: status,
          adminId: user.id,
          adminEmail: user.email
        },
        userId: user.id
      }
    });

    return updated;
  });

  return NextResponse.json({
    user: updatedUser,
    message: `User status updated to ${status}`
  });
}

export const PATCH = createSecureHandler({
  requireAuth: true,
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 status updates per minute
    keyGenerator: (req: NextRequest) => {
      const session = req.headers.get('authorization') || 'anonymous';
      return `admin-users-status:${session}`;
    }
  },
  validation: {
    body: [
      { field: 'status', type: 'string', required: true, enum: ['ACTIVE', 'INACTIVE', 'BANNED'] },
        ]
  },
  handler: handlePATCH
});