"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/shared/http/backend';

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

async function tryBackendThenFallback<T>(backendCall: () => Promise<T>, fallbackCall: () => Promise<T>): Promise<T> {
  try { return await backendCall(); } catch { return await fallbackCall(); }
}

export function useAdminApiEndpoints() {
  return useQuery({
    queryKey: ['admin', 'api-management', 'endpoints'],
    queryFn: async (): Promise<APIEndpoint[]> =>
      tryBackendThenFallback(
        async () => backend.get<APIEndpoint[]>('/admin/api-management/endpoints'),
        async () => {
          const res = await fetch('/api/admin/api-management/endpoints');
          if (!res.ok) throw new Error('fallback endpoints failed');
          const data = await res.json();
          return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        }
      ),
    staleTime: 60_000,
  });
}

export function useAdminApiKeys() {
  return useQuery({
    queryKey: ['admin', 'api-management', 'keys'],
    queryFn: async (): Promise<APIKey[]> =>
      tryBackendThenFallback(
        async () => backend.get<APIKey[]>('/admin/api-management/keys'),
        async () => {
          const res = await fetch('/api/admin/api-management/keys');
          if (!res.ok) throw new Error('fallback keys failed');
          const data = await res.json();
          return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        }
      ),
    staleTime: 60_000,
  });
}

export function useAdminApiAnalytics() {
  return useQuery({
    queryKey: ['admin', 'api-management', 'analytics'],
    queryFn: async () =>
      tryBackendThenFallback(
        async () => backend.get<any>('/admin/api-management/analytics'),
        async () => {
          const res = await fetch('/api/admin/api-management/analytics');
          if (!res.ok) throw new Error('fallback analytics failed');
          const data = await res.json();
          return data?.data ?? data;
        }
      ),
    staleTime: 60_000,
  });
}

export function useCreateEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<APIEndpoint>) =>
      tryBackendThenFallback(
        async () => backend.post('/admin/api-management/endpoints', payload),
        async () => fetch('/api/admin/api-management/endpoints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'api-management', 'endpoints'] }),
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial[APIKey]) =>
      tryBackendThenFallback(
        async () => backend.post('/admin/api-management/keys', payload),
        async () => fetch('/api/admin/api-management/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'api-management', 'keys'] }),
  });
}

