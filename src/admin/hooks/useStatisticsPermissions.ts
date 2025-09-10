import { usePermissions } from 'react-admin';

/**
 * Custom hook for statistics management permissions
 * Simplifies permission checking across statistics components
 */
export const useStatisticsPermissions = () => {
  const { permissions } = usePermissions();
  
  return {
    canViewUsage: permissions?.includes('read:statistics') || permissions?.includes('statistics:usage'),
    canViewBehavior: permissions?.includes('read:statistics') || permissions?.includes('statistics:behavior'),
    canExportData: permissions?.includes('export:statistics') || permissions?.includes('statistics:export'),
    canViewDetailedStats: permissions?.includes('read:detailed-statistics') || permissions?.includes('statistics:detailed'),
    
    // Convenience methods
    canViewBasicStats: function() { return this.canViewUsage; },
    canViewAdvancedStats: function() { return this.canViewBehavior && this.canViewDetailedStats; },
    canAccessDashboard: function() { return this.canViewUsage || this.canViewBehavior; },
    
    // Check if user has any statistics permissions
    hasAnyPermission: function() {
      return this.canViewUsage || this.canViewBehavior || this.canExportData;
    },
    
    // Get available features based on permissions
    getAvailableFeatures: function() {
      const features = [];
      if (this.canViewUsage) features.push('usage');
      if (this.canViewBehavior) features.push('behavior');
      if (this.canExportData) features.push('export');
      return features;
    }
  };
};