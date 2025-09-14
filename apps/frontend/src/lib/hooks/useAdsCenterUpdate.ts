"use client";

import { useMutation } from '@tanstack/react-query';
import { backend } from '@/shared/http/backend';

export type AdsCenterUpdateInput = {
  name?: string;
  affiliate_links: string[];
  adspower_profile: string;
  google_ads_account: string;
};

export type AdsCenterUpdateResult = {
  taskId: string;
  status: string;
};

/**
 * useAdsCenterUpdate
 * Calls Go atomic endpoints for AdsCenter link update with precheck → execute flow.
 */
export function useAdsCenterUpdate() {
  return useMutation<AdsCenterUpdateResult, any, AdsCenterUpdateInput>({
    mutationKey: ['adscenter', 'link', 'update'],
    mutationFn: async (input: AdsCenterUpdateInput) => {
      const body = {
        name: input.name || `adscenter_${Date.now()}`,
        affiliate_links: (input.affiliate_links || []).filter(Boolean),
        adspower_profile: input.adspower_profile,
        google_ads_account: input.google_ads_account,
      } as any;

      if (!Array.isArray(body.affiliate_links) || body.affiliate_links.length === 0) {
        throw Object.assign(new Error('请输入至少一个链接'), { status: 400 });
      }

      // 1) Precheck
      const check = await backend.post<any>('/api/v1/adscenter/link:update:check', body);
      if (check && check.sufficient === false) {
        const err: any = new Error('INSUFFICIENT_TOKENS');
        err.status = 402;
        err.details = { required: check.required, balance: check.balance };
        throw err;
      }

      // 2) Execute (atomic in Go)
      const exec = await backend.post<any>('/api/v1/adscenter/link:update:execute', body);
      if (!exec || !exec.taskId) {
        const msg = exec?.message || '执行失败';
        const err: any = new Error(msg);
        err.status = 500;
        throw err;
      }
      return { taskId: exec.taskId, status: exec.status || 'running' } as AdsCenterUpdateResult;
    },
    retry: 1,
  });
}

