import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/prisma';
import { Logger } from '@/lib/core/Logger';

const logger = new Logger('STATISTICS-BEHAVIOR-EXPORT');

/**
 * Export behavior statistics data
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await auth();
    
    if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'csv';
    const userSegment = searchParams.get('userSegment');

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Build user segment filter
    let userFilter: any = {};
    if (userSegment && userSegment !== 'all') {
      switch (userSegment) {
        case 'trial':
          userFilter = {
            subscriptions: {
              some: {
                status: 'ACTIVE',
                provider: 'system',
                metadata: {
                  path: ['isTrial'],
                  equals: true,
                },
              },
            },
          };
          break;
        case 'paid':
          userFilter = {
            subscriptions: {
              some: {
                status: 'ACTIVE',
                provider: { not: 'system' },
              },
            },
          };
          break;
        case 'free':
          userFilter = {
            subscriptions: {
              none: {
                status: 'ACTIVE',
              },
            },
          };
          break;
      }
    }

    // Fetch user activity data
    const activityData = await prisma.user.findMany({
      where: {
        ...userFilter,
        createdAt: dateFilter,
      },
      include: {
        tokenTransactions: {
          where: {
            createdAt: dateFilter,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
        },
        checkIns: {
          where: {
            createdAt: dateFilter,
          },
        },
      },
    });

    // Process data for export
    const exportData = activityData.map((user: any) => {
      const totalTokensUsed = user.tokenTransactions.reduce((sum: any, tx: any) => sum + Math.abs(tx.amount), 0);
      const totalTransactions = user.tokenTransactions.length;
      const checkInCount = user.checkIns.length;
      const userType = user.subscriptions.length > 0 
        ? (user.subscriptions[0].provider === 'system' ? 'trial' : 'paid')
        : 'free';
      
      // Calculate activity level
      let activityLevel = 'low';
      if (totalTransactions > 50 || totalTokensUsed > 100) {
        activityLevel = 'high';
      } else if (totalTransactions > 10 || totalTokensUsed > 20) {
        activityLevel = 'medium';
      }

      return {
        userId: user.id,
        userEmail: user.email,
        userName: user.name || '',
        userType,
        registrationDate: user.createdAt.toISOString(),
        totalTokensUsed,
        totalTransactions,
        checkInCount,
        activityLevel,
        lastActivity: user.tokenTransactions[0]?.createdAt?.toISOString() || '',
        averageTokensPerTransaction: totalTransactions > 0 ? Math.round(totalTokensUsed / totalTransactions) : 0,
      };
    });

    // Generate response based on format
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: exportData,
        metadata: {
          totalUsers: exportData.length,
          exportDate: new Date().toISOString(),
          filters: {
            startDate,
            endDate,
            userSegment,
          },
          summary: {
            totalTokensUsed: exportData.reduce((sum: any, user: any) => sum + user.totalTokensUsed, 0),
            totalTransactions: exportData.reduce((sum: any, user: any) => sum + user.totalTransactions, 0),
            totalCheckIns: exportData.reduce((sum: any, user: any) => sum + user.checkInCount, 0),
            activityDistribution: {
              high: exportData.filter((u: any) => u.activityLevel === 'high').length,
              medium: exportData.filter((u: any) => u.activityLevel === 'medium').length,
              low: exportData.filter((u: any) => u.activityLevel === 'low').length,
            },
          },
        },
      });
    }

    if (format === 'csv') {
      const headers = [
        'User ID',
        'User Email',
        'User Name',
        'User Type',
        'Registration Date',
        'Total Tokens Used',
        'Total Transactions',
        'Check-in Count',
        'Activity Level',
        'Last Activity',
        'Avg Tokens Per Transaction',
      ];

      const csvContent = [
        headers.join(','),
        ...exportData.map((row: any) => [
          row.userId,
          `\"${row.userEmail}\"`,
          `\"${row.userName}\"`,
          row.userType,
          row.registrationDate,
          row.totalTokensUsed,
          row.totalTransactions,
          row.checkInCount,
          row.activityLevel,
          row.lastActivity,
          row.averageTokensPerTransaction,
        ].join(',')),
      ].join('\\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=\"behavior-statistics-${new Date().toISOString().split('T')[0]}.csv\"`,
        },
      });
    }

    if (format === 'excel') {
      const headers = [
        'User ID',
        'User Email',
        'User Name',
        'User Type',
        'Registration Date',
        'Total Tokens Used',
        'Total Transactions',
        'Check-in Count',
        'Activity Level',
        'Last Activity',
        'Avg Tokens Per Transaction',
      ];

      const csvContent = [
        headers.join('\\t'),
        ...exportData.map((row: any) => [
          row.userId,
          row.userEmail,
          row.userName,
          row.userType,
          row.registrationDate,
          row.totalTokensUsed,
          row.totalTransactions,
          row.checkInCount,
          row.activityLevel,
          row.lastActivity,
          row.averageTokensPerTransaction,
        ].join('\\t')),
      ].join('\\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'application/vnd.ms-excel',
          'Content-Disposition': `attachment; filename=\"behavior-statistics-${new Date().toISOString().split('T')[0]}.xls\"`,
        },
      });
    }

    return NextResponse.json(
      { error: 'Unsupported format' },
      { status: 400 }
    );

  } catch (error) {
    logger.error('Failed to export behavior statistics:', error instanceof Error ? error.message : String(error));
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export statistics',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}
