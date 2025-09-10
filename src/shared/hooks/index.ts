// Custom hooks exports
export { 
  useApi, 
  useApiMutation, 
  useApiState, 
  useApiPagination,
  apiClient 
} from './useApi';

export { 
  usePermissions, 
  usePermissionGuard,
  WithPermissions 
} from './usePermissions';

export { 
  useTenant, 
  useTenantConfig, 
  useTenantUser, 
  useTenantStats, 
  useTenantSwitcher,
  useTenantScopedQuery 
} from './useTenant';

export { 
  useRealtime, 
  useRealtimeSubscription, 
  useRealtimeNotifications, 
  useRealtimeProgress 
} from './useRealtime';

// Type exports
export type { 
  ApiResponse, 
  ApiError, 
  HttpMethod, 
  ApiRequestConfig,
  PaginationParams,
  PaginatedResponse 
} from './useApi';

export type { 
  Permission, 
  Role, 
  UserPermissions, 
  PermissionCheckResult,
  WithPermissionsProps 
} from './usePermissions';

export type { 
  TenantConfig, 
  TenantUser, 
  TenantStats 
} from './useTenant';

export type { 
  WebSocketMessage, 
  ConnectionStatus, 
  WebSocketEventHandlers, 
  WebSocketConfig 
} from './useRealtime';