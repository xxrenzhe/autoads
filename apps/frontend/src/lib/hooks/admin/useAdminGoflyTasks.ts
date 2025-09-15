"use client";

import { useQuery } from '@tanstack/react-query';
import { robustFetch } from '@/lib/utils/api/robust-client';

export type GoflyTask = {
  id?: string | number;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
};

export function useAdminGoflyTasks({ page = 1, limit = 10 }: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['admin', 'gofly', 'tasks', page, limit],
    queryFn: async (): Promise<GoflyTask[]> => {
      try {
        const res = await robustFetch('/ops/api/v1/console/scheduler/jobs');
        if (!res.ok) return []
        const data = await res.json();
        const arr = (data?.data ?? data) as any[];
        if (Array.isArray(arr)) {
          return arr.map((j: any) => ({ id: j.name, name: j.name, status: j.enabled ? 'enabled' : 'disabled', created_at: '', updated_at: '' }))
        }
        return []
      } catch { return [] }
    },
    staleTime: 60_000,
    keepPreviousData: true,
  });
}
