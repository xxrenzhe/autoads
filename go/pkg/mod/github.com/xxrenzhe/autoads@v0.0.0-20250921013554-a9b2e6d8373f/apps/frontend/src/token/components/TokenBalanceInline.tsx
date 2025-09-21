"use client";

import { useTokenBalance } from '@/lib/hooks/useTokenBalance';

export function TokenBalanceInline({ fallback }: { fallback?: number }) {
  const { data } = useTokenBalance();
  const balance = data?.remaining ?? data?.total ?? fallback ?? 0;
  return <>{balance}</>;
}

export default TokenBalanceInline;

