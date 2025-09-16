"use client";

import { useQuery } from '@tanstack/react-query';

async function fetchJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json().catch(() => ({}));
  return (data?.data ?? data) as T;
}

export function useSiterankStats() {
  return useQuery({
    queryKey: ['admin', 'stats', 'siterank'],
    queryFn: () => fetchJson('/go/api/v1/siterank/stats'),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useBatchopenStats() {
  return useQuery({
    queryKey: ['admin', 'stats', 'batchopen'],
    queryFn: () => fetchJson('/go/api/v1/batchopen/stats'),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

