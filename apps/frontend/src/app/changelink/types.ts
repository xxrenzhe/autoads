/**
 * ChangeLink 核心类型定义
 * 统一管理所有数据结构和接口类型
 */

export interface AdsPowerConfig {
  id: string;
  name: string;
  environmentId: string;
  openCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoogleAdsConfig {
  id: string;
  accountName: string;
  customerId: string;
  refreshToken: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoogleAdsCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  developerToken: string;
  customerId?: string;
}

export interface GoogleAdsAccount {
  id: string;
  accountName: string;
  customerId: string;
  status: string;
  lastSync?: Date;
  campaignMappings?: CampaignMapping[];
  accountId?: string;
  clientId?: string;
  clientSecret?: string;
  developerToken?: string;
  refreshToken?: string;
  loginCustomerId?: string;
  credentials?: GoogleAdsCredentials;
  campaigns?: Array<{
    id: string;
    name: string;
    status: string;
    adGroups?: Array<{
      id: string;
      name: string;
      status: string;
      ads?: Advertisement[];
    }>;
  }>;
}

export interface CampaignMapping {
  id: string;
  name: string;
  campaignName?: string;
  campaignId?: string;
  originalUrlPattern?: string;
  adGroupMappings?: AdGroupMapping[];
}

export interface AdGroupMapping {
  id: string;
  name: string;
  adGroupName?: string;
  adGroupId?: string;
  adMappings?: AdMapping[];
}

export interface AdMapping {
  id: string;
  name: string;
  adId?: string;
  adName?: string;
  executionOrder: number;
}

export interface Advertisement {
  id: string;
  name: string;
  type: 'TEXT_AD' | 'EXPANDED_TEXT_AD' | 'DISPLAY_AD' | 'VIDEO_AD';
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  adGroupId: string;
  campaignId: string;
  finalUrl?: string;
  finalUrlSuffix?: string;
  displayUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LinkMapping {
  id: string;
  affiliateUrl: string;
  googleAdsConfigId: string;
  adGroupId: string;
  adId: string;
  isActive: boolean;
  lastUpdated: Date;
}

export interface TrackingConfiguration {
  id: string;
  name: string;
  description?: string;
  adsPowerConfigId: string;
  googleAdsConfigId: string;
  environmentId?: string;
  status?: string;
  notificationEmail?: string;
  linkMappings: LinkMapping[];
  adMappingConfig: Array<{
    originalUrl: string;
    adMappings: Array<{
      adId: string;
      finalUrl: string;
      finalUrlSuffix?: string;
      executionNumber: number;
      campaignId: string;
      adGroupId: string;
    }>;
  }>;
  originalLinks: string[];
  googleAdsAccounts: GoogleAdsAccount[];
  repeatCount?: number;
  schedulingConfig?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'custom';
    time: string;
    schedule: ScheduleConfig;
  };
  lastExecuted?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionConfig {
  id?: string;
  name: string;
  type: ExecutionType;
  adsPowerConfigId: string;
  googleAdsConfigIds: string[];
  linkMappings: string[];
  schedule?: ScheduleConfig;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ScheduleConfig {
  type: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  time: string; // HH:mm format
  days?: number[]; // For weekly: 0-6 (Sunday-Saturday)
  startDate?: Date;
  endDate?: Date;
  timezone?: string;
}

export type ExecutionType = 'LINK_UPDATE' | 'DATA_COLLECTION' | 'FULL_SYNC';

export interface Execution {
  id: string;
  type: ExecutionType;
  status: ExecutionStatus;
  config: ExecutionConfig;
  startTime?: Date;
  endTime?: Date;
  results: ExecutionResult[];
  logs: ExecutionLog[];
  error?: string;
  progress: number;
  totalItems: number;
  processedItems: number;
}

export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface ExecutionResult {
  id: string;
  executionId?: string;
  adId: string;
  originalUrl: string;
  extractedUrl?: string;
  finalUrl?: string;
  finalUrlSuffix?: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'running' | 'completed' | 'pending';
  error?: string;
  processingTime: number;
  retryCount: number;
  startTime?: Date | string;
  endTime?: Date | string;
  configurationId?: string;
  errors?: Array<{
    timestamp: Date | string;
    message: string;
    type?: string;
  }>;
  adUpdateResults?: Array<{
    timestamp: Date | string;
    adId: string;
    success: boolean;
    finalUrl?: string;
    error?: string;
  }>;
  googleAdsUpdates?: Array<{
    timestamp: Date | string;
    adId: string;
    accountId: string;
    success: boolean;
    finalUrl?: string;
    finalUrlSuffix?: string;
    error?: string;
  }>;
  stepResults?: Array<{
    stepId: string;
    name: string;
    startTime: Date | string;
    endTime: Date | string;
    status: string;
    result?: any;
  }>;
  metrics?: {
    totalExecutionTime?: number;
    totalLinks?: number;
    successfulLinks?: number;
  };
}

export interface ExecutionLog {
  id: string;
  timestamp: Date;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  details?: any;
  source: string;
}

export interface ExtractedUrl {
  originalUrl: string;
  finalUrl: string;
  finalUrlSuffix?: string;
  processingTime: number;
  retryCount: number;
  error?: string;
}

export interface LinkExtractionResult {
  originalUrl: string;
  finalUrl: string;
  finalUrlBase?: string;
  finalUrlSuffix?: string;
  parameters?: Record<string, string>;
  executionTime: number;
  attempts: number;
  success: boolean;
  error?: string;
}

export interface AdUpdateRequest {
  adId: string;
  finalUrl: string;
  finalUrlSuffix: string;
  customerId: string;
}

export interface AdUpdateResult {
  adId: string;
  success: boolean;
  error?: string;
  processingTime: number;
}

export interface LinkResult {
  id: string;
  originalUrl: string;
  finalUrl?: string;
  finalUrlBase?: string;
  parameters?: string;
  status: 'success' | 'failed' | 'pending';
  processingTime?: number;
  error?: string;
  executionOrder?: number;
}

export interface SystemHealth {
  overall: boolean;
  services: {
    [key: string]: {
      status: 'healthy' | 'unhealthy' | 'unknown';
      details?: string;
      lastCheck?: Date;
    };
  };
  metrics: {
    uptime: number;
    memoryUsage: number;
    activeConnections: number;
    errorRate: number;
  };
}

export interface DashboardStats {
  totalConfigurations: number;
  activeConfigurations: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecution?: Date;
  nextScheduledExecution?: Date;
}

export interface AdsPerformance {
  customerId: string;
  accountName: string;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number; // Click-through rate
  cpc: number; // Cost per click
  roas?: number; // Return on ad spend
}

export interface ReportConfig {
  customerId?: string;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  metrics: string[];
  dimensions?: string[];
}

export interface EmailNotificationConfig {
  enabled: boolean;
  recipients: string[];
  schedule: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  includeCharts: boolean;
  customMessage?: string;
}

// API Request/Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FilterRequest {
  search?: string;
  status?: ExecutionStatus;
  type?: ExecutionType;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
}

// Form Types
export interface AdsPowerConfigForm {
  name: string;
  environmentId: string;
  openCount: number;
}

export interface GoogleAdsConfigForm {
  accountName: string;
  customerId: string;
  authCode?: string; // For OAuth flow
}

export interface LinkMappingForm {
  affiliateUrl: string;
  googleAdsConfigId: string;
  adGroupId: string;
  adId: string;
}

// Error Types
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
  severity?: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
  severity?: 'warning' | 'info';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions?: string[];
}

export interface ServiceError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}

export interface AdsPowerEnvironment {
  id: string;
  name: string;
  userId?: string;
  group?: string;
  status?: string;
  lastActive?: Date;
  browserProfile?: string;
  os?: string;
  device?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RetryPolicy {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

// SchedulingConfig is already defined above in line 114

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Missing type that was referenced
export interface LinkAccountAssociation {
  id: string;
  linkId: string;
  accountId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}