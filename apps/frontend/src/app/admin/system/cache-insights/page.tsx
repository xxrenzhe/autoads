"use client";

import React from 'react';
import { AdminDashboardLayout } from '@/components/layout/DashboardLayout';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';
import { useQuery } from '@tanstack/react-query';

function useCacheInsights() {
  return useQuery({
    queryKey: ['admin','siterank','cache-insights'],
    queryFn: async () => {
      const res = await fetch('/go/api/v1/siterank/cache-insights', { cache: 'no-store', headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('failed');
      return await res.json();
    },
    refetchInterval: 60000,
  });
}

export default function CacheInsightsPage() {
  const { data, isLoading } = useCacheInsights();
  const hitRate = typeof data?.estimatedHitRate === 'number' ? `${Math.round(data.estimatedHitRate*100)}%` : '-';
  return (
    <AdminDashboardLayout title="SiteRank 缓存洞察" description="命中率估算与TTL建议">
      <div className={`${UI_CONSTANTS.cards.simple} p-6`}>
        {isLoading ? (
          <div className="text-gray-500">加载中...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="rounded border bg-white p-4"><div className="text-xs text-gray-500">总记录</div><div className="text-xl font-semibold">{data?.totalRows ?? '-'}</div></div>
            <div className="rounded border bg-white p-4"><div className="text-xs text-gray-500">总请求</div><div className="text-xl font-semibold">{data?.totalRequests ?? '-'}</div></div>
            <div className="rounded border bg-white p-4"><div className="text-xs text-gray-500">活跃缓存条目</div><div className="text-xl font-semibold">{data?.activeCacheRows ?? '-'}</div></div>
            <div className="rounded border bg-white p-4"><div className="text-xs text-gray-500">7天失败</div><div className="text-xl font-semibold">{data?.failed7d ?? '-'}</div></div>
            <div className="rounded border bg-white p-4"><div className="text-xs text-gray-500">估算命中率</div><div className="text-xl font-semibold">{hitRate}</div></div>
            <div className="rounded border bg-white p-4"><div className="text-xs text-gray-500">TTL建议（小时）</div><div className="text-xl font-semibold">{data?.suggestedTTLHours ?? '-'}</div></div>
          </div>
        )}
      </div>
    </AdminDashboardLayout>
  );
}

