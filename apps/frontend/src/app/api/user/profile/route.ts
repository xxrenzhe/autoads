import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { Logger } from '@/lib/core/Logger';

const logger = new Logger('USER-PROFILE-ROUTE');

/**
 * Get user profile information
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

    const userId = session.userId;

    // Get user profile with related data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        loginCount: true,
        tokenBalance: true,
        tokenUsedThisMonth: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: {
            plan: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get token breakdown by source
    const tokenBreakdown = await prisma.tokenTransaction.groupBy({
      by: ['type'],
      where: {
        userId,
        amount: { gt: 0 }
      },
      _sum: {
        amount: true
      }
    });

    const tokensBySource = tokenBreakdown.reduce((acc, item: any) => {
      acc[item.type.toLowerCase()] = item._sum.amount || 0;
      return acc;
    }, {} as Record<string, number>);

    // Get recent token transactions
    const recentTransactions = await prisma.tokenTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        type: true,
        amount: true,
        source: true,
        description: true,
        createdAt: true,
      },
    });

    // Format user data for response
    const userProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString(),
      loginCount: user.loginCount,
      tokenBalance: user.tokenBalance || 0,
      tokensBySource,
      tokenUsedThisMonth: user.tokenUsedThisMonth || 0,
      subscription: user.subscriptions[0] ? {
        id: user.subscriptions[0].id,
        status: user.subscriptions[0].status,
        plan: {
          name: user.subscriptions[0].plan?.name || 'Free',
          price: user.subscriptions[0].plan?.price || 0,
          tokenQuota: user.subscriptions[0].plan?.tokenQuota || 0,
        },
        currentPeriodEnd: user.subscriptions[0].currentPeriodEnd?.toISOString(),
      } : null,
      recentTransactions: recentTransactions.map((tx: any) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        source: tx.source,
        description: tx.description,
        createdAt: tx.createdAt.toISOString(),
      })),
    };

    return NextResponse.json({
      success: true,
      user: userProfile,
    });
  } catch (error) {
    logger.error('Failed to get user profile:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get user profile',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}

/**
 * Update user profile information
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.userId;
    const body = await request.json();
    const { name } = body;

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || undefined,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        tokenBalance: true,
      },
    });

    logger.info(`User profile updated: ${userId}`, {
      userId,
      changes: { name },
    });

    return NextResponse.json({
      success: true,
      user: {
        ...updatedUser,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString(),
        lastLoginAt: updatedUser.lastLoginAt?.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to update user profile:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update user profile',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}