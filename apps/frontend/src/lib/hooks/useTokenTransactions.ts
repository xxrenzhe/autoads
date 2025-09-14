"use client";

import { useQuery } from '@tanstack/react-query';
import { backend } from '@/shared/http/backend';

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
    queryKey: ['backend', 'tokens', 'transactions', page, limit],
    queryFn: async (): Promise<TokenTransactionsResponse> =>
      backend.get<TokenTransactionsResponse>('/api/tokens/transactions', { page, limit }),
    keepPreviousData: true,
    staleTime: 30_000,
  });
}

