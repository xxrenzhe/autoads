"use client";

import { useQuery } from '@tanstack/react-query';
import { backend } from '@/shared/http/backend';

export type GoflyStats = {
  users?: { total?: number; active?: number; newToday?: number };
  tasks?: { total?: number; running?: number; completed?: number };
  system?: { uptime?: unknown; memory?: unknown; goroutine?: unknown };
  [k: string]: unknown;
};

export function useAdminGoflyStats() {
  return useQuery({
    queryKey: ['admin', 'gofly', 'stats'],
    queryFn: async (): Promise<GoflyStats> => backend.get<GoflyStats>('/admin/gofly-panel/api/stats'),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

