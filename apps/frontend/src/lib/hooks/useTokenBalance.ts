"use client";

import { useQuery } from '@tanstack/react-query';
import { backend } from '@/shared/http/backend';

export type TokenBalance = {
  total?: number;
  remaining?: number;
  used?: number;
  [k: string]: unknown;
};

export function useTokenBalance() {
  return useQuery({
    queryKey: ['backend', 'tokens', 'balance'],
    queryFn: async (): Promise<TokenBalance> => backend.get<TokenBalance>('/api/tokens/balance'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

