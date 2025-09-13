'use client';

import { useState, useEffect } from 'react';

export interface FeaturePermission {
  featureId: string;
  name: string;
  description: string;
  requiredPlan: string;
  requiredPermissions: string[];
  limits?: Record<string, any>;
}

export interface UserFeatures {
  features: FeaturePermission[];
  limits: Record<string, any>;
}

export function useFeatureAccess(featureId?: string) {
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [limits, setLimits] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (!featureId) return;

    const checkAccess = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/user/features/${featureId}/access`);
        
        if (!response.ok) {
          throw new Error('Failed to check feature access');
        }
        
        const result = await response.json();
        setHasAccess(result.hasAccess);
        setLimits(result.limits || null);
        
        if (result.reason) {
          setError(result.reason);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [featureId]);

  return {
    hasAccess,
    loading,
    error,
    limits,
    refetch: () => {
      setLoading(true);
      setError(null);
      // Trigger refetch
      fetch(`/api/user/features/${featureId}/access`)
        .then(response => response.json())
        .then(result => {
          setHasAccess(result.hasAccess);
          setLimits(result.limits || null);
          if (result.reason) setError(result.reason);
        })
        .catch(err => {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setHasAccess(false);
        })
        .finally(() => setLoading(false));
    }
  };
}

export function useUserFeatures() {
  const [data, setData] = useState<UserFeatures | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/user/features');
        
        if (!response.ok) {
          throw new Error('Failed to fetch user features');
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: () => {
      setLoading(true);
      setError(null);
      fetch('/api/user/features')
        .then(response => response.json())
        .then(result => {
          setData(result);
        })
        .catch(err => {
          setError(err instanceof Error ? err.message : 'Unknown error');
        })
        .finally(() => setLoading(false));
    }
  };
}

/**
 * 功能访问控制组件
 */
export function FeatureGuard({
  featureId,
  children,
  fallback,
  showUpgradePrompt = true
}: {
  featureId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}) {
  const { hasAccess, loading, error } = useFeatureAccess(featureId);

  if (loading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showUpgradePrompt) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            {error || 'This feature requires a higher subscription plan.'}
          </p>
          <button
            onClick={((: any): any) => window.location.href = '/subscription'}
            className="mt-2 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Upgrade Plan
          </button>
        </div>
      );
    }

    return null as any;
  }

  return <>{children}</>;
}