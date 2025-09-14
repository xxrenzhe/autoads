"use client";

import { useQuery } from '@tanstack/react-query';
import { backend } from '@/shared/http/backend';

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
    queryFn: async (): Promise<GoflyUsersResponse> =>
      backend.get<GoflyUsersResponse>('/admin/gofly-panel/api/users', { search, status, page, limit }),
    keepPreviousData: true,
    staleTime: 60_000,
  });
}

