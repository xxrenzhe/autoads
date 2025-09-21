/**
 * 运行时配置系统
 * 用于在运行时获取环境变量，而不是在构建时内联
 */

// 运行时配置接口
export interface RuntimeConfig {
  // Google Analytics
  GA_ID?: string;
  GTAG_ID?: string;
  // API配置
  API_BASE_URL?: string;
  API_URL?: string;
  // SimilarWeb配置
  SIMILARWEB_API_URL?: string;
  SIMILARWEB_TIMEOUT?: number;
  // 部署环境
  DEPLOYMENT_ENV?: string;
  DEPLOYMENT_VERSION?: string;
  DEPLOYMENT_DOMAIN?: string;
  // 应用环境
  APP_ENV?: string;
  // 应用基础配置
  APP_NAME?: string;
  DOMAIN?: string;
  BASE_URL?: string;
  // 功能开关
  ENABLE_ANALYTICS?: boolean;
  DEBUG_MODE?: boolean;
  GOOGLE_ADS_AUTOMATION_ENABLED?: boolean;
  MAINTENANCE_MODE?: boolean;
  MAX_CONCURRENT_EXECUTIONS?: number;
  DEFAULT_TIMEOUT?: number;
  RETRY_ATTEMPTS?: number;
  // OAuth配置
  OAUTH_REDIRECT_URI?: string;
  // Google Ads配置
  GOOGLE_ADS_API_VERSION?: string;
  GOOGLE_ADS_SCOPE?: string;
  GOOGLE_ADS_CLIENT_ID?: string;
  GOOGLE_ADS_DEVELOPER_TOKEN?: string;
  GOOGLE_ADS_LOGIN_CUSTOMER_ID?: string;
  // AdsPower配置
  ADSPOWER_API_URL?: string;
  ADSPOWER_TIMEOUT?: number;
  // 安全配置
  HTTPS_ONLY?: boolean;
  SECURE_COOKIES?: boolean;
  ENABLE_ERROR_REPORTING?: boolean;
  ENABLE_PERFORMANCE_MONITORING?: boolean;
  // 其他配置
  [key: string]: any;
}

// 配置验证接口
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// 配置元数据
export interface ConfigMetadata {
  version: string;
  timestamp: string;
  environment: string;
  deploymentEnv: string;
  features: {
    analytics: boolean;
    debug: boolean;
    maintenance: boolean;
    googleAdsAutomation: boolean;
  };
  limits: {
    maxConcurrentExecutions: number;
    defaultTimeout: number;
    retryAttempts: number;
  };
}

// 服务器端获取配置
export function getServerConfig(): RuntimeConfig {
  return {
    // Google Analytics
    GA_ID: process.env.GA_ID || process.env.NEXT_PUBLIC_GA_ID,
    GTAG_ID: process.env.GTAG_ID || process.env.NEXT_PUBLIC_GTAG_ID,
    // API配置
    API_BASE_URL: process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '/api',
    API_URL: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL,
    // SimilarWeb配置
    SIMILARWEB_API_URL: process.env.SIMILARWEB_API_URL || process.env.NEXT_PUBLIC_SIMILARWEB_API_URL,
    SIMILARWEB_TIMEOUT: parseInt(process.env.SIMILARWEB_TIMEOUT || process.env.NEXT_PUBLIC_SIMILARWEB_TIMEOUT || "30000"),
    // 部署环境
    DEPLOYMENT_ENV: process.env.DEPLOYMENT_ENV || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || 'production',
    DEPLOYMENT_VERSION: process.env.DEPLOYMENT_VERSION || process.env.NEXT_PUBLIC_DEPLOYMENT_VERSION,
    DEPLOYMENT_DOMAIN: process.env.DEPLOYMENT_DOMAIN || process.env.NEXT_PUBLIC_DEPLOYMENT_DOMAIN,
    // 应用环境
    APP_ENV: process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'production',
    // 应用基础配置
    APP_NAME: process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || 'Google Ads Automation',
    DOMAIN: process.env.DOMAIN || process.env.NEXT_PUBLIC_DOMAIN,
    BASE_URL: process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL,
    // 功能开关
    ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS !== 'false' && process.env.NEXT_PUBLIC_ENABLE_ANALYTICS !== 'false',
    DEBUG_MODE: process.env.DEBUG_MODE === 'true' || process.env.NEXT_PUBLIC_DEBUG_MODE === 'true',
    GOOGLE_ADS_AUTOMATION_ENABLED: process.env.GOOGLE_ADS_AUTOMATION_ENABLED !== 'false' && process.env.NEXT_PUBLIC_GOOGLE_ADS_AUTOMATION_ENABLED !== 'false',
    MAINTENANCE_MODE: process.env.MAINTENANCE_MODE === 'true' || process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true',
    MAX_CONCURRENT_EXECUTIONS: parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || process.env.NEXT_PUBLIC_MAX_CONCURRENT_EXECUTIONS || "5"),
    DEFAULT_TIMEOUT: parseInt(process.env.DEFAULT_TIMEOUT || process.env.NEXT_PUBLIC_DEFAULT_TIMEOUT || "300000"),
    RETRY_ATTEMPTS: parseInt(process.env.RETRY_ATTEMPTS || process.env.NEXT_PUBLIC_RETRY_ATTEMPTS || "3"),
    // OAuth配置
    OAUTH_REDIRECT_URI: process.env.OAUTH_REDIRECT_URI || process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI,
    // Google Ads配置
    GOOGLE_ADS_API_VERSION: process.env.GOOGLE_ADS_API_VERSION || process.env.NEXT_PUBLIC_GOOGLE_ADS_API_VERSION || 'v16',
    GOOGLE_ADS_SCOPE: process.env.GOOGLE_ADS_SCOPE || process.env.NEXT_PUBLIC_GOOGLE_ADS_SCOPE || 'https://www.googleapis.com/auth/adwords',
    GOOGLE_ADS_CLIENT_ID: process.env.GOOGLE_ADS_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID,
    GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || process.env.NEXT_PUBLIC_GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || process.env.NEXT_PUBLIC_GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    // AdsPower配置
    ADSPOWER_API_URL: process.env.ADSPOWER_API_URL || process.env.NEXT_PUBLIC_ADSPOWER_API_URL || 'http://local.adspower.net:50325',
    ADSPOWER_TIMEOUT: parseInt(process.env.ADSPOWER_TIMEOUT || process.env.NEXT_PUBLIC_ADSPOWER_TIMEOUT || "30000"),
    // 安全配置
    HTTPS_ONLY: process.env.HTTPS_ONLY === 'true' || process.env.NEXT_PUBLIC_HTTPS_ONLY === 'true',
    SECURE_COOKIES: process.env.SECURE_COOKIES !== 'false' && process.env.NEXT_PUBLIC_SECURE_COOKIES !== 'false',
    ENABLE_ERROR_REPORTING: process.env.ENABLE_ERROR_REPORTING !== 'false' && process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING !== 'false',
    ENABLE_PERFORMANCE_MONITORING: process.env.ENABLE_PERFORMANCE_MONITORING !== 'false' && process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING !== 'false',
  };
}

// 验证配置
export function validateConfig(config: RuntimeConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 验证必需的配置
  if (!config.API_BASE_URL) {
    errors.push('API_BASE_URL is required');
  }

  // 验证超时配置
  if (config.DEFAULT_TIMEOUT && (config.DEFAULT_TIMEOUT < 1000 || config.DEFAULT_TIMEOUT > 600000)) {
    warnings.push('DEFAULT_TIMEOUT should be between 1000ms and 600000ms');
  }

  // 验证并发执行数
  if (config.MAX_CONCURRENT_EXECUTIONS && (config.MAX_CONCURRENT_EXECUTIONS < 1 || config.MAX_CONCURRENT_EXECUTIONS > 20)) {
    warnings.push('MAX_CONCURRENT_EXECUTIONS should be between 1 and 20');
  }

  // 验证重试次数
  if (config.RETRY_ATTEMPTS && (config.RETRY_ATTEMPTS < 0 || config.RETRY_ATTEMPTS > 10)) {
    warnings.push('RETRY_ATTEMPTS should be between 0 and 10');
  }

  // 验证Google Ads配置
  if (config.GOOGLE_ADS_AUTOMATION_ENABLED) {
    if (!config.GOOGLE_ADS_DEVELOPER_TOKEN) {
      errors.push('GOOGLE_ADS_DEVELOPER_TOKEN is required when Google Ads Automation is enabled');
    }
    if (!config.GOOGLE_ADS_CLIENT_ID) {
      errors.push('GOOGLE_ADS_CLIENT_ID is required when Google Ads Automation is enabled');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// 获取配置元数据
export function getConfigMetadata(config: RuntimeConfig): ConfigMetadata {
  return {
    version: config.DEPLOYMENT_VERSION || '2.5.5',
    timestamp: new Date().toISOString(),
    environment: config.APP_ENV || 'production',
    deploymentEnv: config.DEPLOYMENT_ENV || 'production',
    features: {
      analytics: config.ENABLE_ANALYTICS || false,
      debug: config.DEBUG_MODE || false,
      maintenance: config.MAINTENANCE_MODE || false,
      googleAdsAutomation: config.GOOGLE_ADS_AUTOMATION_ENABLED || false,
    },
    limits: {
      maxConcurrentExecutions: config.MAX_CONCURRENT_EXECUTIONS || 5,
      defaultTimeout: config.DEFAULT_TIMEOUT || 300000,
      retryAttempts: config.RETRY_ATTEMPTS || 3,
    },
  };
}

// 客户端配置存储
let clientConfig: RuntimeConfig | null = null;

import { http } from '@/shared/http/client'

// 客户端获取配置
export async function getClientConfig(): Promise<RuntimeConfig> {
  if (clientConfig) {
    return clientConfig;
  }

  try {
    // 使用带TTL的轻缓存，减少抖动（60s）
    const config = await http.getCached<RuntimeConfig>('/config', undefined, 60_000, false)
    clientConfig = config;
    return config;
  } catch (error) {
    console.error('Failed to fetch runtime config:', error);
    // 返回默认配置
    return {
      GA_ID: undefined,
      GTAG_ID: undefined,
      API_BASE_URL: '/api',
      API_URL: undefined,
      SIMILARWEB_API_URL: undefined,
      SIMILARWEB_TIMEOUT: 30000,
      DEPLOYMENT_ENV: 'production',
      DEPLOYMENT_VERSION: undefined,
      DEPLOYMENT_DOMAIN: undefined,
      APP_ENV: 'production',
      // 应用基础配置
      APP_NAME: 'Google Ads Automation',
      DOMAIN: undefined,
      BASE_URL: undefined,
      // 功能开关
      ENABLE_ANALYTICS: true,
      DEBUG_MODE: false,
      GOOGLE_ADS_AUTOMATION_ENABLED: false,
      MAINTENANCE_MODE: false,
      MAX_CONCURRENT_EXECUTIONS: 5,
      DEFAULT_TIMEOUT: 300000,
      RETRY_ATTEMPTS: 3,
      // OAuth配置
      OAUTH_REDIRECT_URI: undefined,
      // Google Ads配置
      GOOGLE_ADS_API_VERSION: 'v16',
      GOOGLE_ADS_SCOPE: 'https://www.googleapis.com/auth/adwords',
      GOOGLE_ADS_CLIENT_ID: undefined,
      GOOGLE_ADS_DEVELOPER_TOKEN: undefined,
      GOOGLE_ADS_LOGIN_CUSTOMER_ID: undefined,
      // AdsPower配置
      ADSPOWER_API_URL: 'http://local.adspower.net:50325',
      ADSPOWER_TIMEOUT: 30000,
      // 安全配置
      HTTPS_ONLY: false,
      SECURE_COOKIES: true,
      ENABLE_ERROR_REPORTING: true,
      ENABLE_PERFORMANCE_MONITORING: true,
    };
  }
}

// 同步获取客户端配置（仅在页面加载后可用）
export function getSyncClientConfig(): RuntimeConfig {
  if (typeof window === 'undefined') {
    return getServerConfig();
  }
  
  // 从全局变量获取
  if ((window as any).__RUNTIME_CONFIG__) {
    return (window as any).__RUNTIME_CONFIG__;
  }
  
  // 返回默认配置
  return {
    GA_ID: undefined,
    GTAG_ID: undefined,
    API_BASE_URL: '/api',
    API_URL: undefined,
    SIMILARWEB_API_URL: undefined,
    SIMILARWEB_TIMEOUT: 30000,
    DEPLOYMENT_ENV: 'production',
    DEPLOYMENT_VERSION: undefined,
    DEPLOYMENT_DOMAIN: undefined,
    APP_ENV: 'production',
    // 应用基础配置
    APP_NAME: 'Google Ads Automation',
    DOMAIN: undefined,
    BASE_URL: undefined,
    // 功能开关
    ENABLE_ANALYTICS: false,
    DEBUG_MODE: false,
    GOOGLE_ADS_AUTOMATION_ENABLED: false,
    MAINTENANCE_MODE: false,
    MAX_CONCURRENT_EXECUTIONS: 5,
    DEFAULT_TIMEOUT: 300000,
    RETRY_ATTEMPTS: 3,
    // OAuth配置
    OAUTH_REDIRECT_URI: undefined,
    // Google Ads配置
    GOOGLE_ADS_API_VERSION: 'v16',
    GOOGLE_ADS_SCOPE: 'https://www.googleapis.com/auth/adwords',
    GOOGLE_ADS_CLIENT_ID: undefined,
    GOOGLE_ADS_DEVELOPER_TOKEN: undefined,
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: undefined,
    // AdsPower配置
    ADSPOWER_API_URL: 'http://local.adspower.net:50325',
    ADSPOWER_TIMEOUT: 30000,
    // 安全配置
    HTTPS_ONLY: false,
    SECURE_COOKIES: true,
    ENABLE_ERROR_REPORTING: false,
    ENABLE_PERFORMANCE_MONITORING: false,
  };
}

// 初始化运行时配置（在客户端使用）
export function initRuntimeConfig(config: RuntimeConfig) {
  if (typeof window !== 'undefined') {
    (window as any).__RUNTIME_CONFIG__ = config;
    clientConfig = config;
  }
}

// 清除客户端配置缓存
export function clearClientConfigCache() {
  clientConfig = null;
  if (typeof window !== 'undefined') {
    delete (window as any).__RUNTIME_CONFIG__;
  }
}

// 获取特定的配置值
export function getConfigValue<T extends keyof RuntimeConfig>(key: T): RuntimeConfig[T] {
  if (typeof window === 'undefined') {
    const serverConfig = getServerConfig();
    return serverConfig[key];
  }
  
  const clientConfig = getSyncClientConfig();
  return clientConfig[key];
}

// 检查功能是否启用
export function isFeatureEnabled(feature: keyof RuntimeConfig): boolean {
  const value = getConfigValue(feature);
  return value === true || value === 'true';
}
