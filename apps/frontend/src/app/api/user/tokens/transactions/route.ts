import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { Logger } from '@/lib/core/Logger';

const logger = new Logger('USER-TOKENS-TRANSACTIONS-ROUTE');
/**
 * Get user token transactions
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type');
    const source = searchParams.get('source');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      userId: session.userId,
    };

    if (type) {
      where.type = type;
    }

    if (source) {
      where.source = source;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Get transactions
    const [transactions, total] = await Promise.all([
      prisma.tokenTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.tokenTransaction.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        transactions: transactions.map((tx: any) => ({
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
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get token transactions:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get token transactions',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}