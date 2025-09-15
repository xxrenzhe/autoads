"use client";

import { useQuery } from '@tanstack/react-query';
import { robustFetch } from '@/lib/utils/api/robust-client';

export type GoflyStats = {
  users?: { total?: number; active?: number; newToday?: number };
  tasks?: { total?: number; running?: number; completed?: number };
  system?: { uptime?: unknown; memory?: unknown; goroutine?: unknown };
  [k: string]: unknown;
};

export function useAdminGoflyStats() {
  return useQuery({
    queryKey: ['admin', 'gofly', 'stats'],
    queryFn: async (): Promise<GoflyStats> => {
      const res = await robustFetch('/ops/api/v1/console/monitoring/health');
      if (!res.ok) throw new Error('failed to load stats');
      const data = await res.json();
      return (data?.data ?? data) as GoflyStats;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
