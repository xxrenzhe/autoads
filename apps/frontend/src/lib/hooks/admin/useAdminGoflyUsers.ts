"use client";

import { useQuery } from '@tanstack/react-query';
import { robustFetch } from '@/lib/utils/api/robust-client';

export type GoflyUser = {
  id?: string | number;
  email?: string;
  username?: string;
  status?: string;
  created_at?: string;
  [k: string]: unknown;
};

export type GoflyUsersResponse = {
  data?: GoflyUser[] | { list?: GoflyUser[] } | unknown;
  total?: number;
  page?: number;
  limit?: number;
  [k: string]: unknown;
};

export function useAdminGoflyUsers({ search, status, page = 1, limit = 10 }: { search?: string; status?: string; page?: number; limit?: number; }) {
  return useQuery({
    queryKey: ['admin', 'gofly', 'users', search ?? '', status ?? '', page, limit],
    queryFn: async (): Promise<GoflyUsersResponse> => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (status) params.append('status', status);
      params.append('page', String(page ?? 1));
      params.append('limit', String(limit ?? 10));
      const res = await robustFetch(`/ops/api/v1/console/users?${params.toString()}`);
      if (!res.ok) throw new Error('failed to load users');
      return res.json();
    },
    staleTime: 60_000,
  });
}
