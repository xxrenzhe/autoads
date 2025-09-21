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
      // 新路径：先预检，再原子执行（Go 为准），通过 /go 代理到容器内 8080
      // 1) 预检
      try {
        const check = await backend.post<any>('/api/v1/siterank/batch:check', { domains: valid.domains });
        if (check && check.sufficient === false) {
          const err: any = new Error('INSUFFICIENT_TOKENS');
          err.status = 402;
          err.details = { required: check.required, balance: check.balance };
          throw err;
        }
      } catch (e: any) {
        // 预检错误直接上抛
        throw e;
      }
      // 2) 执行（原子扣费 + 业务执行）
      return backend.post<SiterankBatchResult>('/api/v1/siterank/batch:execute', { domains: valid.domains });
    },
    retry: 1,
  });
}
