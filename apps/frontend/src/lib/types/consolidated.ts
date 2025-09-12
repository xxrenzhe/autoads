/**
 * Consolidated Type Definitions - Centralized type system for the entire application
 * Reduces duplication and provides consistent typing across all modules
 */

// ========================================
// Base/Common Types
// ========================================

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceConfig {
  id: string;
  name: string;
  status: ServiceStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export type ServiceStatus = 'active' | 'inactive' | 'error' | 'pending';
export type Priority = 'high' | 'medium' | 'low';
export type RequestStatus = 'pending' | 'loading' | 'completed' | 'error' | 'failed' | 'success';

// ========================================
// API Types
// ========================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  requestId?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code: string;
  timestamp: string;
  requestId?: string;
  details?: Record<string, any>;
}

export interface ValidationResponse {
  success: false;
  error: string;
  code: 'VALIDATION_ERROR';
  details: Record<string, string>;
  timestamp: string;
}

// ========================================
// URL and Domain Types
// ========================================

export interface UrlResult {
  originalUrl: string;
  finalUrl: string;
  domain: string;
  rank: number;
  priority: Priority;
  status: RequestStatus | 'opened' | 'blocked' | 'invalidUrl';
  timestamp: string;
  error?: string;
}

export interface SiteRankData {
  id?: number;
  domain: string;
  "Website Url": string;
  rank: number | null;
  priority: number | null;
  commission?: number;
  traffic?: number;
  status: RequestStatus;
  error?: string;
  sources?: string[];
  [key: string]: unknown;
}

// ========================================
// Google Ads Types
// ========================================

export interface GoogleAdsConfig {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  loginCustomerId?: string;
}

export interface CustomerCredentials {
  customerId: string;
  accessToken: string;
  refreshToken: string;
}

export interface GoogleAdsAccount {
  id: string;
  name: string;
  customerId: string;
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  loginCustomerId?: string;
  isActive: boolean;
  status: 'connected' | 'disconnected' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface AccountInfo {
  id: string;
  descriptive_name: string;
  currency_code: string;
  time_zone: string;
  auto_tagging_enabled: boolean;
  test_account: boolean;
  manager: boolean;
  optimization_score?: number;
  conversion_tracking_id?: string;
}

export interface CampaignInfo {
  id: string;
  name: string;
  status: string;
  advertisingChannelType: string;
  budget: {
    id: string;
    name: string;
    amountMicros: number;
    deliveryMethod: string;
  };
  biddingStrategy: {
    type: string;
    targetCpa?: number;
    targetRoas?: number;
  };
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
    ctr: number;
    cpc: number;
    conversionRate: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AdGroupInfo {
  id: string;
  campaignId: string;
  name: string;
  status: string;
  type: string;
  cpcBidMicros?: number;
  cpmBidMicros?: number;
  targetCpaMicros?: number;
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AdInfo {
  id: string;
  adGroupId: string;
  campaignId: string;
  type: string;
  status: string;
  finalUrls: string[];
  finalMobileUrls?: string[];
  finalUrlSuffix?: string;
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AdUpdate {
  adId: string;
  finalUrl: string;
  finalUrlSuffix?: string;
}

export interface UpdateResult {
  success: boolean;
  adId: string;
  error?: string;
}

export interface BatchUpdateResult {
  successCount: number;
  failureCount: number;
  errors: string[];
  results: UpdateResult[];
}

// ========================================
// AdsPower Types
// ========================================

export interface AdsPowerEnvironment {
  id: string;
  name: string;
  environmentId: string;
  apiEndpoint: string;
  apiKey?: string;
  isActive: boolean;
  status: 'connected' | 'disconnected' | 'error';
  createdAt: string;
  updatedAt: string;
}

// ========================================
// Configuration Types
// ========================================

export interface AffiliateLink {
  id: string;
  name: string;
  affiliateUrl: string;
  description?: string;
  category?: string;
  isActive: boolean;
  status: 'valid' | 'invalid' | 'untested';
  createdAt: string;
  updatedAt: string;
}

export interface Configuration {
  id: string;
  name: string;
  description?: string;
  environmentId: string;
  repeatCount: number;
  notificationEmail?: string;
  originalLinks: string[];
  googleAdsAccounts: Array<{
    accountId: string;
    accountName: string;
  }>;
  adMappingConfig: Array<{
    originalUrl: string;
    adMappings: Array<{
      adId: string;
      executionNumber: number;
      campaignId?: string;
      adGroupId?: string;
    }>;
  }>;
  status: 'active' | 'paused' | 'stopped';
  createdAt: string;
  updatedAt: string;
  lastExecuted?: string;
}

// ========================================
// Cache Types
// ========================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

export interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  cleanupInterval: number;
  enableCompression: boolean;
}

// ========================================
// Performance Types
// ========================================

export interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  quotaUsage: {
    queries: number;
    mutations: number;
    remainingQueries: number;
    remainingMutations: number;
  };
  errorBreakdown: Record<string, number>;
  lastRequestTime: number;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: {
    connection: boolean;
    quotaAvailable: boolean;
    responseTime: number;
    errorRate: number;
  };
}

// ========================================
// Utility Types
// ========================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export interface AsyncResult<T> {
  data?: T;
  error?: Error;
  loading: boolean;
}

export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

// ========================================
// Event Types
// ========================================

export interface AppEvent {
  type: string;
  payload?: any;
  timestamp: string;
  source: string;
}

export interface SystemEvent extends AppEvent {
  type: 'system' | 'error' | 'warning' | 'info';
  level: 'critical' | 'error' | 'warning' | 'info' | 'debug';
}

export interface UserEvent extends AppEvent {
  type: 'click' | 'view' | 'submit' | 'navigate';
  userId?: string;
  sessionId: string;
}

// ========================================
// Form Types
// ========================================

export interface FormField {
  name: string;
  value: any;
  error?: string;
  touched: boolean;
  required: boolean;
}

export interface FormState<T> {
  fields: Record<keyof T, FormField>;
  isValid: boolean;
  isSubmitting: boolean;
  submitCount: number;
}

// ========================================
// Translation Types
// ========================================

export type TranslationFunction = (key: string) => string | string[];
export type Locale = 'en' | 'zh';

export interface TranslationConfig {
  locale: Locale;
  fallbackLocale: Locale;
  debug: boolean;
}

// ========================================
// Export All Types
// ========================================

// Re-export commonly used types
// Note: Google Ads enums commented out to prevent circular dependencies
// They can be imported from google-ads-api when needed

// Utility types are already exported above

// Export all interfaces
// Note: All interfaces are already defined above and available for import

// Note: Type aliases are already exported above

// ========================================
// Architecture Types Export
// ========================================

// Re-export core architecture types from core/types.ts
// These are imported to provide a unified type system
export type {
  IServiceLifecycle,
  HealthStatus,
  DomainEvent,
  EventHandler,
  EventMiddleware,
  EventResult,
  IEventBus,
  IQuery,
  ICommand,
  Result,
  IRepository,
  QueryOptions,
  IUnitOfWork,
  ILogger,
  IMetrics,
  ICache,
  IConfiguration
} from '../core/types';

// Export service-related types
export type {
  ServiceDependency,
  ServiceRegistration
} from '../core/types';