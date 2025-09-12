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
 * PATCH /api/admin/users/[userId]/role - Update user role
 */
async function handlePATCH(request: NextRequest, { params, validatedData, user }: any) {
  const { userId } = params;
  const { role } = validatedData.body;

  // Check if user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true }
  });

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Prevent self-demotion from ADMIN
  if (userId === user.id && user.role === 'ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Cannot demote your own ADMIN role' }, { status: 400 });
  }

  // Update user role
  const updatedUser = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        role,
        updatedAt: new Date()
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        updatedAt: true
      }
    });

    // Record admin log
    await tx.adminLog.create({
      data: {
        action: 'UPDATE_USER_ROLE',
        details: {
          userId,
          userEmail: targetUser.email,
          oldRole: targetUser.role,
          newRole: role,
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
    message: `User role updated to ${role}`
  });
}

export const PATCH = createSecureHandler({
  requireAuth: true,
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 role updates per minute (more restrictive)
    keyGenerator: (req: NextRequest) => {
      const session = req.headers.get('authorization') || 'anonymous';
      return `admin-users-role:${session}`;
    }
  },
  validation: {
    body: [
      { field: 'role', type: 'string', required: true, enum: ['USER', 'ADMIN'] }
    ]
  },
  handler: handlePATCH
});