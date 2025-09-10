import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { FeaturePermissionService } from '@/lib/services/feature-permission-service';

export interface FeatureGuardOptions {
  featureId: string;
  requireToken?: boolean; // 是否需要消耗Token
  getTokenCost?: (request: NextRequest) => number | Promise<number>;
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

      // 检查功能权限
      const featureAccess = await FeaturePermissionService.checkFeatureAccess(
        userId,
        options.featureId
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

      // 如果需要Token检查
      if (options.requireToken) {
        const { TokenService } = await import('@/lib/services/token-service');
        const tokenCost = options.getTokenCost 
          ? await options.getTokenCost(request)
          : 1;

        const tokenResult = await TokenService.checkAndConsumeTokens(
          userId,
          options.featureId,
          'access',
          {
            batchSize: tokenCost,
            metadata: {
              endpoint: request.url,
              method: request.method,
              featureId: options.featureId
            }
          }
        );

        if (!tokenResult.success) {
          return NextResponse.json(
            {
              error: tokenResult.error || 'Insufficient tokens',
              code: 'INSUFFICIENT_TOKENS',
              required: tokenCost,
              balance: tokenResult.newBalance
            },
            { status: 402 }
          );
        }
      }

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

/**
 * 创建批量查询的Token消耗函数
 */
export function createBatchTokenCostExtractor(
  domainsKey: string = 'domains'
) {
  return async (request: NextRequest): Promise<number> => {
    if (request.method !== 'POST') {
      return 1;
    }

    try {
      const body = await request.clone().json();
      const domains = body[domainsKey] || [];
      return domains.length;
    } catch {
      return 1;
    }
  };
}

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