"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Tenant context interface
export interface TenantContextType {
  tenantId: string | null;
  tenant: any | null;
  user: any | null;
  permissions: any[] | null;
  switchTenant: (tenantId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

// Create the context
export const TenantContext = createContext<TenantContextType | null>(null);

// Provider props
interface TenantProviderProps {
  children: ReactNode;
  initialTenantId?: string;
}

// Tenant provider component
export function TenantProvider({ children, initialTenantId }: TenantProviderProps) {
  const [tenantId, setTenantId] = useState<string | null>(initialTenantId || null);
  const [tenant, setTenant] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [permissions, setPermissions] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchTenant = async (newTenantId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      // Here you would typically make API calls to switch tenant
      // For now, just update the state
      setTenantId(newTenantId);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch tenant');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Load tenant data when tenantId changes
  useEffect(() => {
    if (tenantId) {
      // Load tenant data, user data, permissions, etc.
      // This would typically be API calls
      setTenant({ id: tenantId, name: `Tenant ${tenantId}` });
      setUser({ id: 'user1', name: 'Test User', roles: [] });
      setPermissions([]);
    }
  }, [tenantId]);

  const value: TenantContextType = {
    tenantId,
    tenant,
    user,
    permissions,
    switchTenant,
    loading,
    error
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

// Hook to use tenant context
export function useTenantContext(): TenantContextType {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenantContext must be used within a TenantProvider');
  }
  return context;
}