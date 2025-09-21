"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { robustFetch } from '@/lib/utils/api/robust-client';

export interface APIEndpoint {
  id: string; path: string; method: string; description?: string; isActive?: boolean;
  rateLimitPerMinute?: number; rateLimitPerHour?: number; requiresAuth?: boolean; requiredRole?: string;
  responseTime?: number; successRate?: number; totalRequests?: number; errorCount?: number;
  lastAccessed?: string; createdAt?: string; updatedAt?: string;
}

export interface APIKey {
  id: string; name: string; keyPrefix?: string; userId?: string; permissions?: string[];
  rateLimitOverride?: number; isActive?: boolean; expiresAt?: string; lastUsed?: string; totalRequests?: number; createdAt?: string;
}

async function requestJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await robustFetch(url, { ...(init || {}), headers: { 'Accept': 'application/json', ...(init?.headers || {}) } });
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json().catch(() => ({}));
  return (data?.data ?? data) as T;
}

export function useAdminApiEndpoints() {
  return useQuery({
    queryKey: ['admin', 'api-management', 'endpoints'],
    queryFn: async (): Promise<APIEndpoint[]> => {
      const data = await requestJson<any>('/ops/api/v1/console/api-management/endpoints');
      return Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    },
    staleTime: 60_000,
  });
}

export function useAdminApiKeys() {
  return useQuery({
    queryKey: ['admin', 'api-management', 'keys'],
    queryFn: async (): Promise<APIKey[]> => {
      const data = await requestJson<any>('/ops/api/v1/console/api-management/keys');
      return Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    },
    staleTime: 60_000,
  });
}

export function useAdminApiAnalytics() {
  return useQuery({
    queryKey: ['admin', 'api-management', 'analytics'],
    queryFn: async () => requestJson<any>('/ops/api/v1/console/api-management/analytics'),
    staleTime: 60_000,
  });
}

export function useCreateEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<APIEndpoint>) => requestJson('/ops/api/v1/console/api-management/endpoints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'api-management', 'endpoints'] }),
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<APIKey>) => requestJson('/ops/api/v1/console/api-management/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'api-management', 'keys'] }),
  });
}
