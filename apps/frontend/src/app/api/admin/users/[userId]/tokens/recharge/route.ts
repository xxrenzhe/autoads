import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { createSecureHandler } from '@/lib/utils/api-security';
import { TokenExpirationService } from '@/lib/services/token-expiration-service';

interface RouteParams {
  params: {
    userId: string;
  };
}

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/users/[userId]/tokens/recharge - Recharge user tokens
 */
async function handlePOST(request: NextRequest, { params, validatedData, user }: any) {
  const { userId } = params;
  const { amount, description } = validatedData.body;

  // Validate amount
  if (amount <= 0) {
    return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
  }

  // Check if user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      id: true, 
      email: true, 
      name: true, 
      tokenBalance: true 
    }
  });

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    // Use TokenExpirationService for unified token management
    // Admin recharge tokens are typically PURCHASED type (never expire)
    const result = await TokenExpirationService.addTokensWithExpiration(
      userId,
      amount,
      'PURCHASED', // Admin recharged tokens don't expire
      undefined, // No expiration for admin recharged tokens
      {
        description: `管理员充值: ${description || `${amount} tokens`}`,
        adminId: user.id,
        adminEmail: user.email,
        rechargeType: 'admin_manual'
      }
    );

    // Record admin log
    await prisma.adminLog.create({
      data: {
        action: 'RECHARGE_USER_TOKENS',
        details: {
          userId,
          userEmail: targetUser.email,
          amount,
          oldBalance: targetUser.tokenBalance,
          newBalance: targetUser.tokenBalance + amount,
          adminId: user.id,
          adminEmail: user.email,
          description: description || `管理员充值 ${amount} tokens`
        },
        userId: user.id
      }
    });

    // Get updated user info
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        tokenBalance: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      user: updatedUser,
      transaction: result,
      message: `Successfully recharged ${amount} tokens to user ${targetUser.email}`
    });

  } catch (error) {
    console.error('Token recharge error:', error);
    return NextResponse.json(
      { error: 'Failed to recharge tokens' },
      { status: 500 }
    );
  }
}

export const POST = createSecureHandler({
  requireAuth: true,
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 recharges per minute
    keyGenerator: (req: NextRequest) => {
      const session = req.headers.get('authorization') || 'anonymous';
      return `admin-users-recharge:${session}`;
    }
  },
  validation: {
    body: [
      { field: 'amount', type: 'number', required: true, min: 1, max: 100000 },
      { field: 'description', type: 'string', required: false, max: 200 }
    ]
  },
  handler: handlePOST
});