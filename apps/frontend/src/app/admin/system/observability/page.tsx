"use client";

import React from 'react';
import { AdminDashboardLayout } from '@/components/layout/DashboardLayout';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';
import { useQuery } from '@tanstack/react-query';

function useBffObs() {
  return useQuery({
    queryKey: ['admin', 'ops', 'bff-obs'],
    queryFn: async () => {
      const res = await fetch('/api/admin/ops/bff-obs', { cache: 'no-store' });
      if (!res.ok) throw new Error('failed');
      const json = await res.json();
      return (json?.data || []) as any[];
    },
    refetchInterval: 5000,
  });
}

export default function ObservabilityPage() {
  const { data = [], isLoading } = useBffObs();
  return (
    <AdminDashboardLayout title="BFF 观测" description="最近上游响应的限流与请求ID">
      <div className={`${UI_CONSTANTS.cards.simple} p-6`}>
        {isLoading ? (
          <div className="text-gray-500">加载中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">时间</th>
                  <th className="py-2 pr-4">路径</th>
                  <th className="py-2 pr-4">状态</th>
                  <th className="py-2 pr-4">X-Request-Id</th>
                  <th className="py-2 pr-4">RateLimit</th>
                </tr>
              </thead>
              <tbody>
                {data.map((it: any, idx: number) => (
                  <tr key={idx} className="border-t">
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(it.ts).toLocaleTimeString()}</td>
                    <td className="py-2 pr-4">{it.path}</td>
                    <td className="py-2 pr-4">{it.status}</td>
                    <td className="py-2 pr-4">{it.requestId || '-'}</td>
                    <td className="py-2 pr-4">{[it?.rateLimit?.limit, it?.rateLimit?.remaining, it?.rateLimit?.reset].filter(Boolean).join(' / ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminDashboardLayout>
  );
}

