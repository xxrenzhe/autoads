import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { FeaturePermissionService } from '@/lib/services/feature-permission-service';

export interface FeatureGuardOptions {
  featureId?: string;
  featureIdResolver?: (session: any) => string | Promise<string>;
  // 注意：根据最新策略，功能守卫仅负责权限校验，不做任何扣费与余额判断。
}

/**
 * 功能权限守卫中间件
 */
export function withFeatureGuard(
  handler: (request: NextRequest, userId?: string, ...args: any[]) => Promise<NextResponse>,
  options: FeatureGuardOptions
) {
  return async function(request: NextRequest, ...args: any[]): Promise<NextResponse> {
    try {
      // 获取用户会话
      const session = await auth();
      
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      const userId = session.user.id;

      // 解析功能ID
      const featureId = options.featureIdResolver
        ? await options.featureIdResolver(session)
        : (options.featureId as string);

      if (!featureId) {
        return NextResponse.json(
          { error: 'Feature not specified' },
          { status: 400 }
        );
      }

      // 检查功能权限
      const featureAccess = await FeaturePermissionService.checkFeatureAccess(
        userId,
        featureId
      );

      if (!featureAccess.hasAccess) {
        return NextResponse.json(
          { 
            error: featureAccess.reason || 'Feature access denied',
            code: 'FEATURE_ACCESS_DENIED'
          },
          { status: 403 }
        );
      }

      // 按最新策略：守卫只做权限校验，不做余额预检或扣费。

      // 在响应头中添加功能限制信息
      const response = await handler(request, userId, ...args);
      
      if (response.ok && featureAccess.limits) {
        const headers = new Headers(response.headers);
        headers.set('X-Feature-Limits', JSON.stringify(featureAccess.limits));
        return new NextResponse(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      }

      return response;
    } catch (error) {
      console.error('Feature guard middleware error:', error);
      
      // 出错时调用原始处理器，确保功能不受影响
      return handler(request, undefined, ...args);
    }
  };
}

// 已废弃：守卫不再参与 Token 计算或扣费

/**
 * 权限检查Hook（用于客户端）
 */
export async function checkClientFeatureAccess(
  featureId: string
): Promise<{
  hasAccess: boolean;
  reason?: string;
  limits?: Record<string, any>;
}> {
  try {
    const response = await fetch(`/api/user/features/${featureId}/access`);
    if (!response.ok) {
      return { hasAccess: false, reason: 'Failed to check access' };
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to check feature access:', error);
    return { hasAccess: false, reason: 'Network error' };
  }
}
