"use client";

import { useQuery } from '@tanstack/react-query';
import { backend } from '@/shared/http/backend';
import { validateHealth, type HealthResponse } from '@/lib/api/schemas/health';

export function useHealthQuery() {
  return useQuery({
    queryKey: ['backend', 'health'],
    queryFn: async (): Promise<HealthResponse> => validateHealth(await backend.get<unknown>('/health')),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
