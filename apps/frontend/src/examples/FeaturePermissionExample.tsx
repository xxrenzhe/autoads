'use client';

import React from 'react';
import { useFeatureAccess, FeatureGuard } from '@/hooks/useFeatureAccess';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * SiteRank功能访问控制示例
 */
export function SiteRankFeatureExample() {
  // 检查基础功能权限
  const { hasAccess: hasBasicAccess, loading: basicLoading, limits: basicLimits } = useFeatureAccess('siterank_basic');
  
  // 检查专业版功能权限
  const { hasAccess: hasProAccess, loading: proLoading, limits: proLimits } = useFeatureAccess('siterank_pro');
  
  // 检查企业版功能权限
  const { hasAccess: hasMaxAccess, loading: maxLoading, limits: maxLimits } = useFeatureAccess('siterank_max');

  if (basicLoading || proLoading || maxLoading) => {
    return <div>Checking feature permissions...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">SiteRank 功能权限示例</h2>
      
      {/* 基础功能 - 所有用户可用 */}
      <FeatureGuard featureId="siterank_basic">
        <div className="p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">基础查询功能</h3>
            <Badge variant="secondary">Free</Badge>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            支持基础网站排名查询，批量查询上限：{basicLimits?.batchLimit || 100} 个域名
          </p>
          <Button>开始查询</Button>
        </div>
      </FeatureGuard>

      {/* 专业版功能 - Pro用户可用 */}
      <FeatureGuard featureId="siterank_pro">
        <div className="p-4 border rounded-lg bg-blue-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">专业查询功能</h3>
            <Badge variant="default">Pro</Badge>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            支持高级网站排名查询，批量查询上限：{proLimits?.batchLimit || 500} 个域名
          </p>
          <Button variant="default">使用专业功能</Button>
        </div>
      </FeatureGuard>

      {/* 企业版功能 - Max用户可用 */}
      <FeatureGuard featureId="siterank_max">
        <div className="p-4 border rounded-lg bg-purple-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">企业查询功能</h3>
            <Badge variant="destructive">Max</Badge>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            支持企业级网站排名查询，批量查询上限：{maxLimits?.batchLimit || 9999} 个域名
          </p>
          <Button variant="destructive">使用企业功能</Button>
        </div>
      </FeatureGuard>

      {/* 功能未授权提示 */}
      {!hasProAccess && (
        <Alert>
          <AlertDescription>
            升级到 Pro 套餐即可使用专业查询功能，支持更多域名批量查询。
            <Button 
              variant="link" 
              className="ml-2 p-0 h-auto"
              onClick={() => window.location.href = '/subscription'}
            >
              立即升级
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * 动态功能按钮示例
 */
export function DynamicFeatureButton({ 
  featureId, 
  children,
  fallback 
}: {
  featureId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) => {
  const { hasAccess, loading } = useFeatureAccess(featureId);

  if (loading) => {
    return <Button disabled>Loading...</Button>;
  }

  if (!hasAccess) => {
    if (fallback) => {
      return <>{fallback}</>;
    }
    return (
      <Button variant="outline" disabled>
        功能不可用
      </Button>
    );
  }

  return <>{children}</>;
}

/**
 * 使用示例：
 * 
 * <DynamicFeatureButton featureId="siterank_pro">
 *   <Button>批量查询（500个）</Button>
 * </DynamicFeatureButton>
 */