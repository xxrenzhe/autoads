"use client";

import { useQuery } from '@tanstack/react-query';
// fetch via Next API BFF

export type TokenBalance = {
  total?: number;
  remaining?: number;
  used?: number;
  [k: string]: unknown;
};

export function useTokenBalance() {
  return useQuery({
    queryKey: ['backend', 'tokens', 'balance'],
    queryFn: async (): Promise<TokenBalance> => {
      const res = await fetch('/api/billing/tokens/balance', { cache: 'no-store' })
      if (!res.ok) return { total: undefined, remaining: undefined, used: undefined }
      return res.json()
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
