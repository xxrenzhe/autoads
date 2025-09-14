"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/shared/http/backend';

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
    queryFn: async (): Promise<GoflyConfig> => backend.get<GoflyConfig>('/admin/gofly-panel/api/config'),
    staleTime: 60_000,
  });
}

export function useUpdateAdminGoflyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<GoflyConfig>) => backend.post('/admin/gofly-panel/api/config', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'gofly', 'config'] });
    }
  });
}

