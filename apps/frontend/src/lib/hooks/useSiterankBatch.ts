"use client";

import { useMutation } from '@tanstack/react-query';
import { backend } from '@/shared/http/backend';

export type SiterankBatchInput = {
  domains: string[];
  batch_size?: number;
};

export type SiterankBatchResult = {
  code?: number;
  data?: unknown;
  fromCache?: boolean;
  [k: string]: unknown;
};

export function useSiterankBatch() {
  return useMutation<SiterankBatchResult, Error, SiterankBatchInput>({
    mutationKey: ['siterank', 'batch'],
    mutationFn: async (input: SiterankBatchInput) => {
      const valid: SiterankBatchInput = {
        domains: Array.isArray(input.domains) ? input.domains.filter(Boolean) : [],
        batch_size: typeof input.batch_size === 'number' ? input.batch_size : undefined,
      };
      if (valid.domains.length === 0) return { code: -1 } as SiterankBatchResult;
      return backend.post<SiterankBatchResult>('/api/siterank/batch', valid);
    },
    retry: 1,
  });
}
