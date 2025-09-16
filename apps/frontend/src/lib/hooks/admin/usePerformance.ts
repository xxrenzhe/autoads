"use client";

import { useQuery } from '@tanstack/react-query';

async function get<T=any>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status}`);
  return await res.json();
}

export function useBatchopenPerf() {
  return useQuery({ queryKey: ['admin','perf','batchopen'], queryFn: () => get('/go/api/v1/batchopen/metrics'), refetchInterval: 10000 });
}
export function useAdscenterPerf() {
  return useQuery({ queryKey: ['admin','perf','adscenter'], queryFn: () => get('/go/api/v1/adscenter/metrics'), refetchInterval: 10000 });
}

