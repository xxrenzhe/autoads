"use client";

import { useQuery } from '@tanstack/react-query';
import { backend } from '@/shared/http/backend';

export type SiteRankResponse = {
  code?: number;
  status?: string;
  domain?: string;
  global_rank?: number;
  monthly_visits?: number | string;
  globalRank?: number;
  monthlyVisits?: number | string;
  [k: string]: unknown;
};

export function useSiterankRank(domain: string | undefined) {
  return useQuery({
    enabled: !!domain,
    queryKey: ['siterank', 'rank', domain],
    // 直接请求 Go 原子端点（通过 /go 反代）
    queryFn: async (): Promise<SiteRankResponse> => backend.get<SiteRankResponse>('/api/v1/siterank/rank', { domain }),
    staleTime: 60_000,
    retry: 1,
  });
}
