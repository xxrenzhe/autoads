import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { statisticsCacheService } from '@/lib/services/statistics-cache-service';

/**
 * Get behavior analytics for admin dashboard (optimized)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') || 'day';
    const userSegment = searchParams.get('userSegment');
    const features = searchParams.get('features')?.split(',') || [];
    const simplified = searchParams.get('simplified') !== 'false'; // Default to simplified mode

    // Build filters object
    const filters = {
      startDate,
      endDate,
      groupBy,
      userSegment,
      features
    };

    // Use optimized cached service for behavior analytics
    const behaviorStats = await statisticsCacheService.getBehaviorAnalytics(filters);

    return NextResponse.json({
      success: true,
      data: {
        ...behaviorStats,
        simplified
      }
    });

  } catch (error) {
    console.error('Behavior analytics error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}