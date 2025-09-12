"use client";

import { useContext, useMemo } from 'react';
import { TenantContext, TenantContextType } from '../contexts/TenantContext';

// Tenant configuration interface
export interface TenantConfig {
  id: string;
  name: string;
  domain?: string;
  settings: {
    theme?: {
      primaryColor?: string;
      logo?: string;
      favicon?: string;
    };
    features?: {
      siterank?: boolean;
      batchopen?: boolean;
      adscenter?: boolean;
      analytics?: boolean;
    };
    limits?: {
      maxUsers?: number;
      maxProjects?: number;
      maxApiCalls?: number;
      storageLimit?: number;
    };
    integrations?: {
      googleAds?: boolean;
      similarWeb?: boolean;
      adsPower?: boolean;
    };
  };
  subscription?: {
    plan: string;
    status: 'active' | 'inactive' | 'suspended' | 'trial';
    expiresAt?: Date;
    features: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// Tenant user interface
export interface TenantUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  roles: Array<{
    id: string;
    name: string;
    permissions: Array<{
      resource: string;
      action: string;
      conditions?: Record<string, any>;
    }>;
  }>;
  tenantId: string;
  isOwner: boolean;
  joinedAt: Date;
  lastActiveAt?: Date;
}

// Tenant statistics interface
export interface TenantStats {
  users: {
    total: number;
    active: number;
    inactive: number;
  };
  usage: {
    apiCalls: number;
    storage: number;
    projects: number;
  };
  limits: {
    apiCalls: number;
    storage: number;
    projects: number;
    users: number;
  };
  features: {
    enabled: string[];
    available: string[];
  };
}

// Main useTenant hook
export function useTenant(): TenantContextType {
  const context = useContext(TenantContext);
  
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }

  return context;
}

// Hook for tenant configuration
export function useTenantConfig() {
  const { tenant } = useTenant();

  const config = useMemo(() => {
    if (!tenant) return null as any;
    return tenant as TenantConfig;
  }, [tenant]);

  const hasFeature = (feature: string): boolean => {
    return config?.settings.features?.[feature as keyof typeof config.settings.features] ?? false;
  };

  const getFeatureLimit = (feature: string): number | undefined => {
    return config?.settings.limits?.[feature as keyof typeof config.settings.limits];
  };

  const isFeatureEnabled = (feature: string): boolean => {
    const subscriptionFeatures = config?.subscription?.features || [];
    const settingsFeatures = config?.settings.features || {};
    
    return subscriptionFeatures.includes(feature) && 
           settingsFeatures[feature as keyof typeof settingsFeatures] !== false;
  };

  const getThemeConfig = () => {
    return config?.settings.theme || {};
  };

  const isSubscriptionActive = (): boolean => {
    return config?.subscription?.status === 'active';
  };

  const isTrialActive = (): boolean => {
    return config?.subscription?.status === 'trial';
  };

  const getSubscriptionStatus = () => {
    return config?.subscription?.status || 'inactive';
  };

  const getDaysUntilExpiry = (): number | null => {
    if (!config?.subscription?.expiresAt) return null as any;
    
    const expiryDate = new Date(config.subscription.expiresAt);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  return {
    config,
    hasFeature,
    getFeatureLimit,
    isFeatureEnabled,
    getThemeConfig,
    isSubscriptionActive,
    isTrialActive,
    getSubscriptionStatus,
    getDaysUntilExpiry
  };
}

// Hook for tenant user management
export function useTenantUser() {
  const { user, switchTenant } = useTenant();

  const currentUser = useMemo(() => {
    return user as TenantUser | null;
  }, [user]);

  const isOwner = (): boolean => {
    return currentUser?.isOwner ?? false;
  };

  const hasRole = (roleName: string): boolean => {
    return currentUser?.roles.some(role => role.name === roleName) ?? false;
  };

  const getRoles = (): string[] => {
    return currentUser?.roles?.filter(Boolean)?.map(role => role.name) || [];
  };

  const getPermissions = () => {
    if (!currentUser) return [];
    
    return currentUser.roles.flatMap(role => role.permissions);
  };

  const canSwitchTenant = (): boolean => {
    // Logic to determine if user can switch tenants
    // This could be based on user roles, subscription, etc.
    return isOwner() || hasRole('admin');
  };

  return {
    user: currentUser,
    isOwner,
    hasRole,
    getRoles,
    getPermissions,
    canSwitchTenant,
    switchTenant
  };
}

// Hook for tenant statistics and usage
export function useTenantStats() {
  const { tenantId } = useTenant();
  // This would typically fetch stats from an API
  // For now, we'll return a placeholder structure

  const stats: TenantStats | null = useMemo(() => {
    if (!tenantId) return null as any;
    
    // This would be replaced with actual API call
    return {
      users: {
        total: 0,
        active: 0,
        inactive: 0
      },
      usage: {
        apiCalls: 0,
        storage: 0,
        projects: 0
      },
      limits: {
        apiCalls: 10000,
        storage: 1000000000, // 1GB in bytes
        projects: 10,
        users: 5
      },
      features: {
        enabled: [],
        available: []
      }
    };
  }, [tenantId]);

  const getUsagePercentage = (metric: keyof TenantStats['usage']): number => {
    if (!stats) return 0;
    
    const usage = stats.usage[metric];
    const limit = stats.limits[metric];
    
    return limit > 0 ? (usage / limit) * 100 : 0;
  };

  const isNearLimit = (metric: keyof TenantStats['usage'], threshold: number = 80): boolean => {
    return getUsagePercentage(metric) >= threshold;
  };

  const isOverLimit = (metric: keyof TenantStats['usage']): boolean => {
    return getUsagePercentage(metric) >= 100;
  };

  const getRemainingQuota = (metric: keyof TenantStats['usage']): number => {
    if (!stats) return 0;
    
    return Math.max(0, stats.limits[metric] - stats.usage[metric]);
  };

  return {
    stats,
    getUsagePercentage,
    isNearLimit,
    isOverLimit,
    getRemainingQuota
  };
}

// Hook for tenant switching
export function useTenantSwitcher() {
  const { tenantId, switchTenant } = useTenant();
  const { canSwitchTenant } = useTenantUser();

  // This would typically fetch available tenants from an API
  const availableTenants = useMemo(() => {
    // Placeholder - would be replaced with actual API call
    return [];
  }, []);

  const switchToTenant = async (newTenantId: string): Promise<boolean> => {
    if (!canSwitchTenant()) {
      throw new Error('User does not have permission to switch tenants');
    }

    try {
      await switchTenant(newTenantId);
      return Promise.resolve(true);
    } catch (error) {
      console.error('Failed to switch tenant:', error);
      return Promise.resolve(false);
    }
  };

  return {
    currentTenantId: tenantId,
    availableTenants,
    canSwitch: canSwitchTenant(),
    switchToTenant
  };
}

// Hook for tenant-scoped data fetching
export function useTenantScopedQuery<T>(
  queryKey: string[],
  queryFn: (tenantId: string) => Promise<T>,
  options?: any
) {
  const { tenantId } = useTenant();

  // This would integrate with React Query or similar
  // For now, it's a placeholder structure
  return useMemo(() => {
    if (!tenantId) {
      return {
        data: null,
        loading: false,
        error: new Error('No tenant context available')
      };
    }

    // Actual implementation would use React Query with tenant-scoped keys
    return {
      data: null,
      loading: false,
      error: null
    };
  }, [tenantId, queryKey, queryFn, options]);
}