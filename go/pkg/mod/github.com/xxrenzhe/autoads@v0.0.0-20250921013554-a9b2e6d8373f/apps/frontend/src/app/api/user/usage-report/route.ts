import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { Logger } from '@/lib/core/Logger';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

const logger = new Logger('USER-USAGE-REPORT-ROUTE');
/**
 * Get user usage report
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

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = startOfDay(subDays(new Date(), days));
    const endDate = endOfDay(new Date());

    // Get user's current token balances
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        tokenBalance: true,
        subscriptionTokenBalance: true,
        activityTokenBalance: true,
        purchasedTokenBalance: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get token transactions for the period
    const transactions = await prisma.tokenTransaction.findMany({
      where: {
        userId: session.userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get API access logs for the period (if available)
    const apiLogs = await prisma.apiAccessLog.findMany({
      where: {
        userId: session.userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'asc' },
    }).catch(() => []); // Fallback if table doesn't exist

    // Group data by day
    const dailyUsage: Record<string, { tokensUsed: number; apiCalls: number }> = {};
    
    // Initialize all days with zero values
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      dailyUsage[date] = { tokensUsed: 0, apiCalls: 0 };
    }

    // Aggregate token usage by day
    transactions.forEach((tx: any) => {
      if (tx.amount < 0) { // Only count token consumption
        const date = format(tx.createdAt, 'yyyy-MM-dd');
        if (dailyUsage[date]) {
          dailyUsage[date].tokensUsed += Math.abs(tx.amount);
        }
      }
    });

    // Aggregate API calls by day
    apiLogs.forEach((log: any) => {
      const date = format(log.createdAt, 'yyyy-MM-dd');
      if (dailyUsage[date]) {
        dailyUsage[date].apiCalls += 1;
      }
    });

    // Convert to array format
    const dailyUsageArray = Object.entries(dailyUsage)
      .map(([date, data]: any) => ({
        date,
        tokensUsed: data.tokensUsed,
        apiCalls: data.apiCalls,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate monthly stats
    const totalTokensUsed = dailyUsageArray.reduce((sum, day: any) => sum + day.tokensUsed, 0);
    const totalApiCalls = dailyUsageArray.reduce((sum, day: any) => sum + day.apiCalls, 0);
    const avgDailyUsage = totalTokensUsed / days;
    
    const peakUsageDay = dailyUsageArray.reduce((peak, day: any) => 
      day.tokensUsed > peak.tokensUsed ? day : peak
    );

    // Calculate growth rate (compare first half vs second half of period)
    const halfPoint = Math.floor(days / 2);
    const firstHalf = dailyUsageArray.slice(0, halfPoint);
    const secondHalf = dailyUsageArray.slice(halfPoint);
    
    const firstHalfAvg = firstHalf.reduce((sum, day: any) => sum + day.tokensUsed, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, day: any) => sum + day.tokensUsed, 0) / secondHalf.length;
    
    const growthRate = firstHalfAvg > 0 ? 
      ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100) : 0;

    // Token distribution
    const tokenDistribution = {
      subscription: user.subscriptionTokenBalance || 0,
      activity: user.activityTokenBalance || 0,
      purchased: user.purchasedTokenBalance || 0,
    };

    // Rate limit status (mock data - replace with actual rate limiting logic)
    const totalBalance = (user.tokenBalance || 0) + 
                        (user.subscriptionTokenBalance || 0) + 
                        (user.activityTokenBalance || 0) + 
                        (user.purchasedTokenBalance || 0);
    
    const rateLimitStatus = {
      currentUsage: totalTokensUsed,
      limit: Math.max(1000, totalBalance + totalTokensUsed), // Mock limit
      resetTime: endOfDay(new Date()).toISOString(),
      percentage: Math.min(100, (totalTokensUsed / Math.max(1000, totalBalance + totalTokensUsed)) * 100),
    };

    const usageData = {
      dailyUsage: dailyUsageArray,
      monthlyStats: {
        totalTokensUsed,
        totalApiCalls,
        avgDailyUsage,
        peakUsageDay: peakUsageDay.date,
        growthRate: Math.round(growthRate * 10) / 10,
      },
      tokenDistribution,
      rateLimitStatus,
    };

    return NextResponse.json(usageData);
  } catch (error) {
    logger.error('Failed to get usage report:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get usage report',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}