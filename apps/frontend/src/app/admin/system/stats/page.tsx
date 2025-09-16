"use client";

import React from 'react';
import { AdminDashboardLayout } from '@/components/layout/DashboardLayout';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';
import { useSiterankStats, useBatchopenStats } from '@/lib/hooks/admin/useFeatureStats';

function StatCard({ title, items }: { title: string; items: { label: string; value: any }[] }) {
  return (
    <div className={`${UI_CONSTANTS.cards.simple} p-6`}>
      <h3 className={UI_CONSTANTS.typography.h3}>{title}</h3>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((it, idx) => (
          <div key={idx} className="rounded-lg border bg-white p-4">
            <div className="text-sm text-gray-500">{it.label}</div>
            <div className="text-2xl font-semibold text-gray-900">{String(it.value ?? '-') }</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SystemStatsPage() {
  const siterank = useSiterankStats();
  const batch = useBatchopenStats();
  return (
    <AdminDashboardLayout title="系统统计" description="SiteRank 与 BatchOpen 关键指标（最近7天）">
      <div className="space-y-6">
        <StatCard
          title="SiteRank"
          items={[
            { label: '总记录', value: siterank.data?.total },
            { label: '请求次数', value: siterank.data?.requestCount },
            { label: '7天失败', value: siterank.data?.failed7d },
            { label: '7天退款', value: siterank.data?.refunds7d },
          ]}
        />
        <StatCard
          title="BatchOpen"
          items={[
            { label: '7天消费', value: batch.data?.consumes7d },
            { label: '7天退款', value: batch.data?.refunds7d },
          ]}
        />
      </div>
    </AdminDashboardLayout>
  );
}

