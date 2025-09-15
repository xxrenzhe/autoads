"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { robustFetch } from '@/lib/utils/api/robust-client';

export type GoflyConfig = {
  app_name?: string;
  api_rate_limit?: number | string;
  max_concurrent?: number | string;
  cache_ttl?: number | string;
  [k: string]: unknown;
};

export function useAdminGoflyConfig() {
  return useQuery({
    queryKey: ['admin', 'gofly', 'config'],
    queryFn: async (): Promise<GoflyConfig> => {
      const res = await robustFetch('/ops/api/v1/console/system/config', { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('failed to load config');
      const data = await res.json();
      return (data?.data ?? data) as GoflyConfig;
    },
    staleTime: 60_000,
  });
}

export function useUpdateAdminGoflyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<GoflyConfig>) => {
      const res = await robustFetch('/ops/api/v1/console/system/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('failed to save config');
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'gofly', 'config'] });
    }
  });
}
