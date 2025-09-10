import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { FeaturePermissionService } from '@/lib/services/feature-permission-service';

// 动态渲染
export const dynamic = 'force-dynamic';

/**
 * GET /api/user/features/[featureId]/access
 * 检查用户对特定功能的访问权限
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { featureId: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { featureId } = params;
    const result = await FeaturePermissionService.checkFeatureAccess(
      session.user.id,
      featureId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Feature access check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}