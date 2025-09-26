"use client";

import { useQuery } from '@tanstack/react-query';

export type TokenTransaction = {
  id: string;
  feature?: string;
  action?: string;
  amount?: number;
  balance?: number;
  isBatch?: boolean;
  batchId?: string;
  timestamp?: string;
  [k: string]: unknown;
};

export type TokenTransactionsResponse = {
  records?: TokenTransaction[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore?: boolean;
  };
  [k: string]: unknown;
};

export function useTokenTransactions(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ['tokens', 'transactions', page, limit],
    queryFn: async (): Promise<TokenTransactionsResponse> => {
      const res = await fetch(`/api/tokens/transactions`, { cache: 'no-store' })
      if (!res.ok) return { records: [], pagination: { page, limit, total: 0, totalPages: 0, hasMore: false } }
      return res.json()
    },
    staleTime: 30_000,
  });
}
