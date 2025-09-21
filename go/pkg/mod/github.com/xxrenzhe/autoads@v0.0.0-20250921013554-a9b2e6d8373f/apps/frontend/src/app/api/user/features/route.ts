import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { FeaturePermissionService } from '@/lib/services/feature-permission-service';

// 动态渲染
export const dynamic = 'force-dynamic';

/**
 * GET /api/user/features
 * 获取用户可访问的所有功能
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const result = await FeaturePermissionService.getUserFeatures(session.user.id);

    const response = NextResponse.json(result);
    
    // Cache for 5 minutes since user features don't change frequently
    response.headers.set('Cache-Control', 'private, s-maxage=300, stale-while-revalidate=600')
    
    return response;
  } catch (error) {
    console.error('Get user features error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}