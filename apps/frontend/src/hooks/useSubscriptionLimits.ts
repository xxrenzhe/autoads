'use client';

import { useState, useEffect } from 'react';
import { http } from '@/shared/http/client';

export interface SubscriptionLimits {
  siterank: {
    batchLimit: number;
  };
  batchopen: {
    versions: string[];
  };
  adscenter: {
    maxCampaigns: number;
  };
  api: {
    rateLimit: number;
  };
}

export interface SubscriptionData {
  limits: SubscriptionLimits;
  planName: string;
  planId: string;
  subscriptionId?: string;
}

export function useSubscriptionLimits() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLimits = async () => {
      try {
        const result = await http.get<SubscriptionData>('/user/subscription/limits');
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchLimits();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: () => {
      setLoading(true);
      setError(null);
      // Trigger refetch
      http.get<SubscriptionData>('/user/subscription/limits')
        .then(result => {
          setData(result);
          setLoading(false);
        })
        .catch(err => {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        });
    }
  };
}
