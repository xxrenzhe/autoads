"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { robustFetch } from '@/lib/utils/api/robust-client';

export interface ProblemUrlRow {
  id: string;
  userId: string;
  urlHash: string;
  url: string;
  httpFailConsecutive: number;
  browserFailConsecutive: number;
  lastFailAt?: string;
  preferBrowserUntil?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export function useAdminAutoClickProblemUrls({ q = '', userId = '', page = 1, limit = 20 } = {}) {
  return useQuery({
    queryKey: ['admin', 'autoclick', 'problem-urls', q, userId, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (userId) params.set('userId', userId);
      params.set('page', String(page));
      params.set('limit', String(limit));
      const res = await robustFetch(`/ops/api/v1/console/autoclick/url-failures?${params}`);
      if (!res.ok) return { rows: [], total: 0 };
      const data = await res.json();
      const rows: ProblemUrlRow[] = (data?.data || []) as any;
      const total: number = data?.pagination?.total || rows.length;
      return { rows, total };
    },
    staleTime: 30_000,
  });
}

export function useAdminAutoClickProblemUrlsActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'autoclick', 'problem-urls'] });
  
  const preferBrowser = useMutation({
    mutationFn: async (id: string) => {
      const res = await robustFetch(`/ops/api/v1/console/autoclick/url-failures/${id}/prefer_browser`, { method: 'POST' });
      if (!res.ok) throw new Error('failed to prefer browser');
      return res.json().catch(() => ({}));
    },
    onSuccess: invalidate,
  });
  
  const resetCounters = useMutation({
    mutationFn: async (id: string) => {
      const res = await robustFetch(`/ops/api/v1/console/autoclick/url-failures/${id}/reset_counters`, { method: 'POST' });
      if (!res.ok) throw new Error('failed to reset counters');
      return res.json().catch(() => ({}));
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await robustFetch(`/ops/api/v1/console/autoclick/url-failures/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed to delete');
      return res.json().catch(() => ({}));
    },
    onSuccess: invalidate,
  });

  return { preferBrowser, resetCounters, remove };
}

export function useAdminAutoClickProblemUrlsBatchActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'autoclick', 'problem-urls'] });
  const batch = useMutation({
    mutationFn: async ({ ids, op }: { ids: string[]; op: 'prefer' | 'reset' | 'delete' }) => {
      const res = await robustFetch(`/ops/api/v1/console/autoclick/url-failures/batch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, op }) });
      if (!res.ok) throw new Error('batch op failed');
      return res.json().catch(() => ({}));
    },
    onSuccess: invalidate,
  });
  return batch;
}
