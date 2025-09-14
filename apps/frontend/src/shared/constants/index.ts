// 应用常量定义

// API相关常量
export const API_ENDPOINTS = {
  AUTH: '/api/auth',
  USERS: '/api/users',
  SITERANK: '/api/siterank',
  BATCHOPEN: '/api/batchopen',
  ADSCENTER: '/api/adscenter',
  ADMIN: '/api/admin',
} as const

// 缓存键常量
export const CACHE_KEYS = {
  USER_PROFILE: 'user:profile',
  USER_PERMISSIONS: 'user:permissions',
  TENANT_CONFIG: 'tenant:config',
  SITERANK_RESULTS: 'siterank:results',
  BATCH_TASKS: 'batch:tasks',
} as const

// 事件类型常量
export const EVENT_TYPES = {
  USER_UPDATED: 'user.updated',
  PERMISSION_CHANGED: 'permission.changed',
  TASK_COMPLETED: 'task.completed',
  SYSTEM_ALERT: 'system.alert',
} as const

// 状态常量
export const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const

// UI相关常量
export const THEME_COLORS = {
  PRIMARY: '#3b82f6',
  SECONDARY: '#64748b',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#06b6d4',
} as const

export const BREAKPOINTS = {
  SM: '640px',
  MD: '768px',
  LG: '1024px',
  XL: '1280px',
  '2XL': '1536px',
} as const

// 业务常量
export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const

export const RATE_LIMITS = {
  API_CALLS_PER_MINUTE: 60,
  CONCURRENT_TASKS: 5,
} as const
