import { NextRequest, NextResponse } from 'next/server';
import { requireIdempotencyKey } from '@/lib/utils/idempotency';
import { ensureNextWriteAllowed } from '@/lib/utils/writes-guard'
import { forwardToGo } from '@/lib/bff/forward'
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { Logger } from '@/lib/core/Logger';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

const logger = new Logger('USER-CHECK-IN-ROUTE');
/**
 * Get user check-in data
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

    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    // Check if user has checked in today
    const todayCheckIn = await prisma.checkIn.findFirst({
      where: {
        userId: session.userId!,
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    // Get check-in history (last 30 days)
    const thirtyDaysAgo = subDays(today, 30);
    const history = await prisma.checkIn.findMany({
      where: {
        userId: session.userId!,
        date: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: { date: 'desc' },
    });

    // Calculate stats
    const totalCheckIns = await prisma.checkIn.count({
      where: { userId: session.userId },
    });

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthCheckIns = await prisma.checkIn.count({
      where: {
        userId: session.userId!,
        date: {
          gte: thisMonthStart,
        },
      },
    });

    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const lastMonthCheckIns = await prisma.checkIn.count({
      where: {
        userId: session.userId!,
        date: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
      },
    });

    // Calculate current streak
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    // Sort history by date ascending for streak calculation
    const sortedHistory = [...history].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Calculate streaks
    for (let i = 0; i < sortedHistory.length; i++) {
      const current = sortedHistory[i];
      const previous = sortedHistory[i - 1];
      
      if (i === 0) {
        tempStreak = 1;
      } else {
        const daysDiff = Math.floor((current.date.getTime() - previous.date.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      
      longestStreak = Math.max(longestStreak, tempStreak);
    }

    // Calculate current streak (from today backwards)
    if (todayCheckIn) {
      currentStreak = 1;
      for (let i = 1; i < 365; i++) { // Max 365 days
        const checkDate = subDays(today, i);
        const checkIn = history.find((h: any) => 
          format(h.date, 'yyyy-MM-dd') === format(checkDate, 'yyyy-MM-dd')
        );
        if (checkIn) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate next reward
    const getRewardTokens = (streak: number) => {
      if (streak === 1) return 10;
      if (streak === 2) return 20;
      if (streak === 3) return 40;
      return 80; // 4+ days
    };

    const getRewardLevel = (streak: number) => {
      return Math.min(4, streak);
    };

    const nextStreak = currentStreak + 1;
    const nextReward = {
      streak: nextStreak,
      tokens: getRewardTokens(nextStreak),
      rewardLevel: getRewardLevel(nextStreak),
    };

    const stats = {
      totalCheckIns,
      thisMonthCheckIns,
      lastMonthCheckIns,
      currentStreak,
      longestStreak,
      consecutiveDays: currentStreak,
    };

    const checkInData = {
      hasCheckedInToday: !!todayCheckIn,
      todayCheckIn: todayCheckIn ? {
        id: todayCheckIn.id,
        date: todayCheckIn.date.toISOString(),
        tokens: todayCheckIn.tokens,
        streak: todayCheckIn.streak,
        rewardLevel: getRewardLevel(todayCheckIn.streak),
        createdAt: todayCheckIn.createdAt.toISOString(),
      } : undefined,
      history: history.map((checkIn: any) => ({
        id: checkIn.id,
        date: checkIn.date.toISOString(),
        tokens: checkIn.tokens,
        streak: checkIn.streak,
        rewardLevel: getRewardLevel(checkIn.streak),
        createdAt: checkIn.createdAt.toISOString(),
      })),
      stats,
      nextReward,
    };

    return NextResponse.json(checkInData);
  } catch (error) {
    logger.error('Failed to get check-in data:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get check-in data',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}

/**
 * Perform daily check-in
 */
export async function POST(request: NextRequest) {
  try {
    requireIdempotencyKey(request as any)

    // Try Go first via BFF; if available, prefer server-side authoritative implementation
    try {
      const resp = await forwardToGo(request as any, { targetPath: '/api/checkin/perform', method: 'POST', appendSearch: false })
      if (resp.ok) return resp
    } catch {}

    // Fallback to Next-side implementation (guarded in prod unless explicitly enabled)
    ensureNextWriteAllowed()
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check new account limits for check-in
    const { checkNewAccountLimits } = await import('@/lib/security/anti-cheat-middleware');
    const limitCheck = await checkNewAccountLimits(session.userId, 'check-in');
    
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { 
          success: false,
          error: limitCheck.reason || 'Account restricted'
        },
        { status: 403 }
      );
    }

    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    // Check if user has already checked in today
    const existingCheckIn = await prisma.checkIn.findFirst({
      where: {
        userId: session.userId!,
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    if (existingCheckIn) {
      return NextResponse.json(
        { error: 'Already checked in today' },
        { status: 400 }
      );
    }

    // Calculate current streak
    let currentStreak = 1;
    const yesterday = subDays(today, 1);
    const yesterdayStart = startOfDay(yesterday);
    const yesterdayEnd = endOfDay(yesterday);

    const yesterdayCheckIn = await prisma.checkIn.findFirst({
      where: {
        userId: session.userId!,
        date: {
          gte: yesterdayStart,
          lte: yesterdayEnd,
        },
      },
    });

    if (yesterdayCheckIn) {
      currentStreak = yesterdayCheckIn.streak + 1;
    }

    // Calculate reward tokens based on streak
    const getRewardTokens = (streak: number) => {
      if (streak === 1) return 10;
      if (streak === 2) return 20;
      if (streak === 3) return 40;
      return 80; // 4+ days
    };

    const rewardTokens = getRewardTokens(currentStreak);

    // Perform check-in and update token balance in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create check-in record
      const checkIn = await tx.checkIn.create({
        data: {
          userId: session.userId!,
          date: today,
          tokens: rewardTokens,
          streak: currentStreak,
        },
      });

      // Update user's unified token balance
      const user = await tx.user.findUnique({
        where: { id: session.userId },
        select: { tokenBalance: true }
      });
      
      await tx.user.update({
        where: { id: session.userId },
        data: {
          tokenBalance: {
            increment: rewardTokens,
          },
        },
      });

      // Create token transaction record using unified system
      await tx.tokenTransaction.create({
        data: {
          userId: session.userId!,
          type: 'ACTIVITY',
          amount: rewardTokens,
          balanceBefore: user?.tokenBalance || 0,
          balanceAfter: (user?.tokenBalance || 0) + rewardTokens,
          source: 'daily_check_in',
          description: `Daily check-in reward (Day ${currentStreak})`,
          metadata: {
            streak: currentStreak,
            checkInId: checkIn.id,
            tokenSource: 'ACTIVITY' // These tokens never expire
          },
        },
      });

      return checkIn;
    });

    logger.info(`User checked in: ${session.userId}`, {
      userId: session.userId,
      streak: currentStreak,
      tokens: rewardTokens,
    });

    return NextResponse.json({
      success: true,
      checkIn: {
        id: result.id,
        date: result.date.toISOString(),
        tokens: result.tokens,
        streak: result.streak,
        rewardLevel: Math.min(4, result.streak),
        createdAt: result.createdAt.toISOString(),
      },
    });
  } catch (error) {
    const status = (error as any)?.status || 500
    logger.error('Failed to perform check-in:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        success: false,
        error: status === 400 ? 'Missing Idempotency-Key header' : 'Failed to perform check-in',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status }
    );
  }
}
