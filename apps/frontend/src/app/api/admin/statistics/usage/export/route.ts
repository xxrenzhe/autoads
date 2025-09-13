import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { statisticsCacheService } from '@/lib/services/statistics-cache-service';

/**
 * Export usage statistics data (optimized)
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
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'csv';
    const userSegment = searchParams.get('userSegment');
    const features = searchParams.get('features')?.split(',') || [];
    const simplified = searchParams.get('simplified') !== 'false';

    // Use simplified export for better performance
    if (simplified) {
      const filters = { startDate, endDate, userSegment, features };
      const stats = await statisticsCacheService.getUsageStatistics(filters);
      
      // Generate simplified export data
      const exportData = [
        ...(stats.overallTrends || []).map((trend: any: any) => ({
          date: trend.period,
          type: 'trend',
          metric: 'overall_usage',
          value: trend.totalTokens || 0,
          users: trend.uniqueUsers || 0,
          transactions: trend.usageCount || 0
        })),
        ...(stats.featurePopularity || []).map((feature: any: any) => ({
          date: new Date().toISOString().split('T')[0],
          type: 'feature',
          metric: feature.feature || 'unknown',
          value: feature.totalTokens || 0,
          users: 0,
          transactions: feature._count?.id || 0
        }))
      ];

      return generateExportResponse(exportData, format, 'simplified-usage-statistics');
    }

    // Fallback to detailed export (limited to recent data for performance)
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    
    // Limit to last 90 days for detailed export to prevent performance issues
    const maxStartDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    if (start < maxStartDate) {
      start.setTime(maxStartDate.getTime());
    }

    const whereClause: any = {
      type: 'DEBIT',
      createdAt: { gte: start, lte: end },
    };

    // Add feature filters if provided
    if (features.length > 0) {
      whereClause.OR = features.map((feature: string: any) => ({
        metadata: {
          path: ['feature'],
          equals: feature,
        },
      }));
    }

    const usageData = await prisma.tokenTransaction.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10000, // Limit to 10k records for performance
    });

    // Process data for export
    const exportData = usageData.map((transaction: any: any) => ({
      date: transaction.createdAt.toISOString(),
      userId: transaction.user?.id || 'unknown',
      userEmail: transaction.user?.email || 'unknown',
      userName: transaction.user?.name || '',
      feature: transaction.metadata?.feature || 'unknown',
      tokenAmount: Math.abs(transaction.amount || 0),
      transactionType: transaction.type,
      description: transaction.description || '',
    }));

    return generateExportResponse(exportData, format, 'detailed-usage-statistics');

  } catch (error) {
    console.error('Failed to export usage statistics:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export statistics',
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Generate export response based on format
 */
function generateExportResponse(data: any[], format: string, filename: string): NextResponse {
  const timestamp = new Date().toISOString().split('T')[0];
  
  if (format === 'json') {
    return NextResponse.json({
      success: true,
      data,
      metadata: {
        totalRecords: data.length,
        exportDate: new Date().toISOString(),
      },
    });
  }

  if (format === 'csv') {
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map((row: any: any) => 
        headers.map((header: any) => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        }).join(',')
      ),
    ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}-${timestamp}.csv"`,
      },
    });
  }

  // Default to CSV if unsupported format
  return generateExportResponse(data, 'csv', filename);
}

