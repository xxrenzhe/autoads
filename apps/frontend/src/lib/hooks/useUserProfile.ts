"use client";

import { useQuery } from '@tanstack/react-query';
import { backend } from '@/shared/http/backend';

export type UserProfile = {
  id?: string;
  email?: string;
  name?: string;
  status?: string;
  [k: string]: unknown;
};

export function useUserProfile() {
  return useQuery({
    queryKey: ['backend', 'user', 'profile'],
    queryFn: async (): Promise<UserProfile> => backend.get<UserProfile>('/api/user/profile'),
    staleTime: 60_000,
  });
}

