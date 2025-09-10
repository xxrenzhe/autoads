import { usePermissions } from 'react-admin';

/**
 * Custom hook for user management permissions
 * Simplifies permission checking across user management components
 */
export const useUserPermissions = () => {
  const { permissions } = usePermissions();
  
  return {
    canRead: permissions?.includes('read:users') || permissions?.includes('users:read'),
    canWrite: permissions?.includes('write:users') || permissions?.includes('users:write'),
    canDelete: permissions?.includes('delete:users') || permissions?.includes('users:delete'),
    canManageTokens: permissions?.includes('manage:tokens') || permissions?.includes('tokens:manage'),
    canExport: permissions?.includes('export:users') || permissions?.includes('users:export'),
    
    // Convenience methods
    canEdit: function() { return this.canWrite; },
    canCreate: function() { return this.canWrite; },
    canBulkEdit: function() { return this.canWrite; },
    canRechargeTokens: function() { return this.canManageTokens; },
    
    // Check if user has any admin permissions
    hasAnyPermission: function() {
      return this.canRead || this.canWrite || this.canDelete || this.canManageTokens;
    }
  };
};