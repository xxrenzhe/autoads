"use client";

import { useContext, useMemo } from 'react';
import { TenantContext } from '../contexts/TenantContext';

// Permission structure
export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

// Role structure
export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  inherits?: string[];
}

// User permissions context
export interface UserPermissions {
  roles: Role[];
  permissions: Permission[];
  userId: string;
  tenantId: string;
}

// Permission check result
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

// Permission checker class
class PermissionChecker {
  private permissions: Permission[];
  private roles: Role[];

  constructor(permissions: Permission[], roles: Role[]) {
    this.permissions = permissions;
    this.roles = roles;
  }

  // Check if user has specific permission
  hasPermission(resource: string, action: string, context?: Record<string, any>): PermissionCheckResult {
    // Check direct permissions
    const directPermission = this.permissions.find(
      p => p.resource === resource && p.action === action
    );

    if (directPermission) {
      if (this.checkConditions(directPermission.conditions, context)) {
        return { allowed: true };
      }
    }

    // Check role-based permissions
    for (const role of this.roles) {
      const rolePermission = role.permissions.find(
        p => p.resource === resource && p.action === action
      );

      if (rolePermission && this.checkConditions(rolePermission.conditions, context)) {
        return { allowed: true };
      }
    }

    return { 
      allowed: false, 
      reason: `No permission for ${action} on ${resource}` 
    };
  }

  // Check if user has any of the specified permissions
  hasAnyPermission(permissions: Array<{ resource: string; action: string }>, context?: Record<string, any>): PermissionCheckResult {
    for (const perm of permissions) {
      const result = this.hasPermission(perm.resource, perm.action, context);
      if (result.allowed) {
        return result;
      }
    }

    return { 
      allowed: false, 
      reason: 'No matching permissions found' 
    };
  }

  // Check if user has all specified permissions
  hasAllPermissions(permissions: Array<{ resource: string; action: string }>, context?: Record<string, any>): PermissionCheckResult {
    for (const perm of permissions) {
      const result = this.hasPermission(perm.resource, perm.action, context);
      if (!result.allowed) {
        return result;
      }
    }

    return { allowed: true };
  }

  // Check if user has specific role
  hasRole(roleName: string): boolean {
    return this.roles.some(role => role.name === roleName);
  }

  // Check if user has any of the specified roles
  hasAnyRole(roleNames: string[]): boolean {
    return roleNames.some(roleName => this.hasRole(roleName));
  }

  // Check if user has all specified roles
  hasAllRoles(roleNames: string[]): boolean {
    return roleNames.every(roleName => this.hasRole(roleName));
  }

  // Get all permissions for a specific resource
  getResourcePermissions(resource: string): Permission[] {
    const directPermissions = this.permissions.filter((p: any) => p.resource === resource);
    const rolePermissions = this.roles.flatMap(role => 
      role.permissions.filter((p: any) => p.resource === resource)
    );

    return [...directPermissions, ...rolePermissions];
  }

  // Get all available actions for a resource
  getResourceActions(resource: string): string[] {
    const permissions = this.getResourcePermissions(resource);
    return [...new Set(permissions?.filter(Boolean)?.map((p: any) => p.action))];
  }

  // Check permission conditions
  private checkConditions(conditions?: Record<string, any>, context?: Record<string, any>): boolean {
    if (!conditions) return true;
    if (!context) return false;

    return Object.entries(conditions).every(([key, expectedValue]) => {
      const contextValue = context[key];
      
      if (Array.isArray(expectedValue)) {
        return expectedValue.includes(contextValue);
      }
      
      return contextValue === expectedValue;
    });
  }
}

// Main usePermissions hook
export function usePermissions() {
  const tenantContext = useContext(TenantContext);
  
  if (!tenantContext) {
    throw new Error('usePermissions must be used within a TenantProvider');
  }

  const { permissions, user } = tenantContext;

  const checker = useMemo(() => {
    if (!permissions || !user) {
      return new PermissionChecker([], []);
    }

    return new PermissionChecker(permissions, user.roles || []);
  }, [permissions, user]);

  // Permission checking functions
  const can = (resource: string, action: string, context?: Record<string, any>) => {
    return checker.hasPermission(resource, action, context).allowed;
  };

  const cannot = (resource: string, action: string, context?: Record<string, any>) => {
    return !can(resource, action, context);
  };

  const canAny = (permissions: Array<{ resource: string; action: string }>, context?: Record<string, any>) => {
    return checker.hasAnyPermission(permissions, context).allowed;
  };

  const canAll = (permissions: Array<{ resource: string; action: string }>, context?: Record<string, any>) => {
    return checker.hasAllPermissions(permissions, context).allowed;
  };

  const hasRole = (roleName: string) => {
    return checker.hasRole(roleName);
  };

  const hasAnyRole = (roleNames: string[]) => {
    return checker.hasAnyRole(roleNames);
  };

  const hasAllRoles = (roleNames: string[]) => {
    return checker.hasAllRoles(roleNames);
  };

  const getResourceActions = (resource: string) => {
    return checker.getResourceActions(resource);
  };

  const isAdmin = () => {
    return hasRole('admin') || hasRole('super_admin');
  };

  const isSuperAdmin = () => {
    return hasRole('super_admin');
  };

  return {
    // Permission checking
    can,
    cannot,
    canAny,
    canAll,
    
    // Role checking
    hasRole,
    hasAnyRole,
    hasAllRoles,
    
    // Utility functions
    getResourceActions,
    isAdmin,
    isSuperAdmin,
    
    // Raw data
    permissions: permissions || [],
    roles: user?.roles || [],
    user
  };
}

// Higher-order component for permission-based rendering
export interface WithPermissionsProps {
  resource: string;
  action: string;
  context?: Record<string, any>;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function WithPermissions({ 
  resource, 
  action, 
  context, 
  fallback = null, 
  children 
}: WithPermissionsProps) {
  const { can } = usePermissions();
  
  if (can(resource, action, context)) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
}

// Hook for conditional rendering based on permissions
export function usePermissionGuard() {
  const { can, cannot, hasRole, hasAnyRole } = usePermissions();

  const renderIf = (
    condition: boolean,
    component: React.ReactNode,
    fallback: React.ReactNode = null
  ) => {
    return condition ? component : fallback;
  };

  const renderIfCan = (
    resource: string,
    action: string,
    component: React.ReactNode,
    fallback: React.ReactNode = null,
    context?: Record<string, any>
  ) => {
    return renderIf(can(resource, action, context), component, fallback);
  };

  const renderIfCannot = (
    resource: string,
    action: string,
    component: React.ReactNode,
    fallback: React.ReactNode = null,
    context?: Record<string, any>
  ) => {
    return renderIf(cannot(resource, action, context), component, fallback);
  };

  const renderIfRole = (
    roleName: string,
    component: React.ReactNode,
    fallback: React.ReactNode = null
  ) => {
    return renderIf(hasRole(roleName), component, fallback);
  };

  const renderIfAnyRole = (
    roleNames: string[],
    component: React.ReactNode,
    fallback: React.ReactNode = null
  ) => {
    return renderIf(hasAnyRole(roleNames), component, fallback);
  };

  return {
    renderIf,
    renderIfCan,
    renderIfCannot,
    renderIfRole,
    renderIfAnyRole
  };
}