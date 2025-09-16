"use client";

import React from 'react';
import { AdminDashboardLayout } from '@/components/layout/DashboardLayout';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';
import { useBatchopenPerf, useAdscenterPerf } from '@/lib/hooks/admin/usePerformance';

function DistCard({ title, data }: { title: string; data: any }) {
  const counts = data?.counts || {};
  const d = data?.duration_ms || {};
  return (
    <div className={`${UI_CONSTANTS.cards.simple} p-6`}>
      <h3 className={UI_CONSTANTS.typography.h3}>{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        {Object.keys(counts).map((k) => (
          <div key={k} className="rounded border bg-white p-4">
            <div className="text-xs text-gray-500">{k}</div>
            <div className="text-xl font-semibold">{counts[k]}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {['avg','p50','p90','p99'].map((k) => (
          <div key={k} className="rounded border bg-white p-4">
            <div className="text-xs text-gray-500">{k} (ms)</div>
            <div className="text-xl font-semibold">{d?.[k] ?? '-'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const batch = useBatchopenPerf();
  const ads = useAdscenterPerf();
  return (
    <AdminDashboardLayout title="性能分布" description="最近200条执行统计（耗时分位与状态分布）">
      <div className="space-y-6">
        <DistCard title="BatchOpen" data={batch.data} />
        <DistCard title="AdsCenter" data={ads.data} />
      </div>
    </AdminDashboardLayout>
  );
}

