import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { Logger } from '@/lib/core/Logger';

const logger = new Logger('USER-TOKENS-BALANCE-HISTORY-ROUTE');
/**
 * Get user token balance history
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

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get transactions within the date range
    const transactions = await prisma.tokenTransaction.findMany({
      where: {
        userId: session.userId,
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get current user balance
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        tokenBalance: true,
        subscriptionTokenBalance: true,
        activityTokenBalance: true,
        purchasedTokenBalance: true,
      },
    });

    const currentBalance = (user?.tokenBalance || 0) + 
                          (user?.subscriptionTokenBalance || 0) + 
                          (user?.activityTokenBalance || 0) + 
                          (user?.purchasedTokenBalance || 0);

    // Build balance history
    const history: Array<{ date: string; balance: number; change: number }> = [];
    let runningBalance = currentBalance;

    // Work backwards from current balance
    for (let i = transactions.length - 1; i >= 0; i--) {
      const tx = transactions[i];
      runningBalance -= tx.amount;
      
      history.unshift({
        date: tx.createdAt.toISOString().split('T')[0],
        balance: runningBalance + tx.amount,
        change: tx.amount,
      });
    }

    // Fill in missing days with no changes
    const filledHistory: Array<{ date: string; balance: number; change: number }> = [];
    let currentDate = new Date(startDate);
    let historyIndex = 0;
    let lastBalance = runningBalance;

    while (currentDate <= new Date()) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Check if we have transactions for this date
      const dayTransactions = history.filter(h => h.date === dateStr);
      
      if (dayTransactions.length > 0) {
        const dayChange = dayTransactions.reduce((sum, h) => sum + h.change, 0);
        lastBalance += dayChange;
        filledHistory.push({
          date: dateStr,
          balance: lastBalance,
          change: dayChange,
        });
      } else {
        filledHistory.push({
          date: dateStr,
          balance: lastBalance,
          change: 0,
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return NextResponse.json({
      success: true,
      data: filledHistory,
    });
  } catch (error) {
    logger.error('Failed to get token balance history:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get token balance history',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}