"use client";

import { useQuery } from '@tanstack/react-query';
import { backend } from '@/shared/http/backend';

export type SiterankPriority = {
  code?: number;
  data?: { priority?: string };
  [k: string]: unknown;
};

export function useSiterankPriority(domain: string | undefined) {
  return useQuery({
    enabled: !!domain,
    queryKey: ['siterank', 'priority', domain],
    queryFn: async (): Promise<SiterankPriority> => backend.get<SiterankPriority>('/api/siterank/priority', { domain }),
    staleTime: 60_000,
    retry: 1,
  });
}
