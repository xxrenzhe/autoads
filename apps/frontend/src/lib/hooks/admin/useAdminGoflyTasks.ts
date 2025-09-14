"use client";

import { useQuery } from '@tanstack/react-query';
import { backend } from '@/shared/http/backend';

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
      // 尝试常见路径，若不存在则返回空数组（零破坏）
      const tryPaths = ['/admin/gofly-panel/api/tasks', '/admin/gofly-panel/api/batch-tasks'];
      for (const p of tryPaths) {
        try {
          const res = await backend.get<any>(p, { page, limit });
          if (Array.isArray(res)) return res as GoflyTask[];
          if (res && typeof res === 'object') {
            if (Array.isArray(res.data)) return res.data as GoflyTask[];
            if (res.data?.list && Array.isArray(res.data.list)) return res.data.list as GoflyTask[];
          }
        } catch (e) {
          // ignore and try next
        }
      }
      return [];
    },
    staleTime: 60_000,
    keepPreviousData: true,
  });
}

