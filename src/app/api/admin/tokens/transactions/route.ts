import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { PermissionService } from '@/lib/services/permission-service';
import { TokenTransactionService } from '@/lib/services/token-transaction-service';

/**
 * GET /api/admin/tokens/transactions/system-stats
 * Get system-wide token transaction statistics (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permissions
    const hasPermission = await PermissionService.hasPermission(
      session.user.id,
      'tokens',
      'read'
    );
    
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let timeRange;
    if (startDate && endDate) {
      timeRange = {
        start: new Date(startDate),
        end: new Date(endDate)
      };
    }

    const stats = await TokenTransactionService.getSystemStats(timeRange);

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get system token stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tokens/transactions/export
 * Export token transaction data (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permissions
    const hasPermission = await PermissionService.hasPermission(
      session.user.id,
      'tokens',
      'admin'
    );
    
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, type, source, startDate, endDate } = body;

    const filter: any = {};
    
    if (userId) filter.userId = userId;
    if (type) filter.type = type;
    if (source) filter.source = source;
    if (startDate) filter.startDate = new Date(startDate);
    if (endDate) filter.endDate = new Date(endDate);

    const exportData = await TokenTransactionService.exportTransactions(filter);

    // For now, return JSON data. In production, you might want to
    // generate and return a CSV file
    return NextResponse.json({
      success: true,
      data: exportData
    });

  } catch (error) {
    console.error('Export transactions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}