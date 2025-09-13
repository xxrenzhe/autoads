import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { Logger } from '@/lib/core/Logger';

const logger = new Logger('USER-TOKENS-TRANSACTIONS-STATS-ROUTE');
/**
 * Get user token transaction statistics
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { timeRange } = body;

    const where: any = {
      userId: session.userId,
    };

    if (timeRange?.start && timeRange?.end) {
      where.createdAt = {
        gte: new Date(timeRange.start),
        lte: new Date(timeRange.end),
      };
    }

    // Get all transactions for stats
    const transactions = await prisma.tokenTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Calculate statistics
    const stats = {
      totalTransactions: transactions.length,
      totalAcquired: transactions.filter((tx: any) => tx.amount > 0).reduce((sum, tx: any) => sum + tx.amount, 0),
      totalConsumed: Math.abs(transactions.filter((tx: any) => tx.amount < 0).reduce((sum, tx: any) => sum + tx.amount, 0)),
      byType: {} as Record<string, { acquired: number; consumed: number }>,
      bySource: {} as Record<string, number>,
      recentTransactions: transactions.slice(0, 10).map((tx: any) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        balanceBefore: tx.balanceBefore || 0,
        balanceAfter: tx.balanceAfter || 0,
        source: tx.source || 'unknown',
        description: tx.description,
        createdAt: tx.createdAt.toISOString(),
        metadata: tx.metadata,
      })),
    };

    // Group by type
    transactions.forEach((tx: any) => {
      const type = tx.type || 'UNKNOWN';
      if (!stats.byType[type]) {
        stats.byType[type] = { acquired: 0, consumed: 0 };
      }
      
      if (tx.amount > 0) {
        stats.byType[type].acquired += tx.amount;
      } else {
        stats.byType[type].consumed += Math.abs(tx.amount);
      }
    });

    // Group by source
    transactions.forEach((tx: any) => {
      const source = tx.source || 'unknown';
      if (!stats.bySource[source]) {
        stats.bySource[source] = 0;
      }
      stats.bySource[source] += Math.abs(tx.amount);
    });

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get token transaction stats:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get token transaction stats',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}