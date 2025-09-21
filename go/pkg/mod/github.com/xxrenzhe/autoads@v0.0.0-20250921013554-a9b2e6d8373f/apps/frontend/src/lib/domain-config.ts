/**
 * 环境域名配置工具
 * 根据不同环境自动适配域名和相关配置
 */

import { getServerConfig, getSyncClientConfig } from './config/runtime';
import { analyticsEnabled, debugModeEnabled } from './config/feature-flags';
import { getCachedRemoteConfig, getConfigValue } from './config/remote-config';

export type EnvironmentType = 'development' | 'preview' | 'production';

export interface DomainConfig {
  domain: string;
  baseUrl: string;
  oauthRedirectUri: string;
  isLocal: boolean;
  isHttps: boolean;
  apiBaseUrl: string;
  adsPowerApiUrl: string;
  enableHttps: boolean;
  secureCookies: boolean;
  enableAnalytics: boolean;
  enableErrorReporting: boolean;
  enablePerformanceMonitoring: boolean;
  debugMode: boolean;
}

// Cache for environment detection to avoid repeated computations
let cachedEnvironment: EnvironmentType | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * 检测当前环境类型
 */
export function detectEnvironment(): EnvironmentType {
  // Return cached result if available and fresh
  const now = Date.now();
  if (cachedEnvironment && now - cacheTimestamp < CACHE_TTL) {
    return cachedEnvironment;
  }
  // 优先使用运行时配置
  const config = typeof window === 'undefined' ? getServerConfig() : getSyncClientConfig();
  if (config.DEPLOYMENT_ENV) {
    cachedEnvironment = config.DEPLOYMENT_ENV as EnvironmentType;
    cacheTimestamp = now;
    return cachedEnvironment;
  }
  
  if (typeof window === 'undefined') {
    // 服务端环境检测
    if (process.env.NODE_ENV === 'production') {
      // 检测是否为预发环境
      const domain = config.DOMAIN || '';
      const deploymentEnv = config.DEPLOYMENT_ENV || '';
      
      // 明确的环境变量优先级最高
      if (config.DEPLOYMENT_ENV === 'preview') {
        cachedEnvironment = 'preview';
        cacheTimestamp = now;
        return cachedEnvironment;
      }
      
      // urlchecker.dev 及其子域名都是预发环境
      if (domain.includes('urlchecker.dev')) {
        cachedEnvironment = 'preview';
        cacheTimestamp = now;
        return cachedEnvironment;
      }
      cachedEnvironment = 'production';
      cacheTimestamp = now;
      return cachedEnvironment;
    }
    cachedEnvironment = 'development';
    cacheTimestamp = now;
    return cachedEnvironment;
  }
  
  // 客户端环境检测
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    cachedEnvironment = 'development';
    cacheTimestamp = now;
    return cachedEnvironment;
  }
  
  // 明确的环境变量优先级最高
  if (config.DEPLOYMENT_ENV) {
    cachedEnvironment = config.DEPLOYMENT_ENV as EnvironmentType;
    cacheTimestamp = now;
    return cachedEnvironment;
  }
  
  if (hostname.includes('urlchecker.dev')) {
    cachedEnvironment = 'preview'; // urlchecker.dev 及其子域名都是预发环境
    cacheTimestamp = now;
    return cachedEnvironment;
  }
  
  if (hostname.includes('autoads.dev')) {
    cachedEnvironment = 'production'; // autoads.dev 及其子域名都是生产环境
    cacheTimestamp = now;
    return cachedEnvironment;
  }
  
  // 如果都不匹配，则根据环境变量判断
  cachedEnvironment = 'production';
  cacheTimestamp = now;
  return cachedEnvironment;
}

// Cache for domain configuration
let cachedDomainConfig: DomainConfig | null = null;
let domainConfigTimestamp: number = 0;

/**
 * 获取当前环境的域名配置
 */
export function getDomainConfig(): DomainConfig {
  // Return cached result if available and fresh
  const now = Date.now();
  if (cachedDomainConfig && now - domainConfigTimestamp < CACHE_TTL) {
    return cachedDomainConfig;
  }
  const env = detectEnvironment();
  const isServer = typeof window === 'undefined';
  const config = isServer ? getServerConfig() : getSyncClientConfig();
  
  // 获取当前域名
  let currentDomain: string;
  let currentProtocol: string;
  
  if (isServer) {
    // 服务端使用运行时配置
    currentDomain = config.DOMAIN || 
                   process.env.DEPLOYMENT_DOMAIN || 
                   process.env.VERCEL_URL ||
                   'localhost:3000';
    
    // 根据环境和域名确定协议
    if (env === 'development') {
      currentProtocol = 'http';
    } else {
      currentProtocol = 'https';
    }
  } else {
    // 客户端使用当前URL
    currentDomain = window.location.hostname + (window.location.port ? `:${window.location.port}` : '');
    currentProtocol = window.location.protocol.replace(':', '');
  }
  
  // 根据环境确定配置
  let result: DomainConfig;
  switch (env) {
    case 'development':
      result = {
        domain: currentDomain,
        baseUrl: `${currentProtocol}://${currentDomain}`,
        oauthRedirectUri: config.OAUTH_REDIRECT_URI || `${currentProtocol}://${currentDomain}/oauth/callback`,
        isLocal: true,
        isHttps: false,
        apiBaseUrl: `${currentProtocol}://${currentDomain}/api`,
        adsPowerApiUrl: ((): string => { const snap = getCachedRemoteConfig(); const remote = snap ? (getConfigValue<string>('integrations.adsPower.apiUrl', snap) || getConfigValue<string>('Integrations.AdsPower.BaseURL', snap)) : undefined; return remote || process.env.NEXT_PUBLIC_ADSPOWER_API_URL || 'http://local.adspower.net:50325'; })(),
        enableHttps: false, // 开发环境禁用HTTPS重定向
        secureCookies: false,
        enableAnalytics: analyticsEnabled(),
        enableErrorReporting: false,
        enablePerformanceMonitoring: false,
        debugMode: debugModeEnabled(),
      };
      break;
      
    case 'preview':
      result = {
        domain: currentDomain,
        baseUrl: `https://${currentDomain}`,
        oauthRedirectUri: config.OAUTH_REDIRECT_URI || `https://${currentDomain}/oauth/callback`,
        isLocal: false,
        isHttps: true,
        apiBaseUrl: `https://${currentDomain}/api`,
        adsPowerApiUrl: ((): string => { const snap = getCachedRemoteConfig(); const remote = snap ? (getConfigValue<string>('integrations.adsPower.apiUrl', snap) || getConfigValue<string>('Integrations.AdsPower.BaseURL', snap)) : undefined; return remote || process.env.NEXT_PUBLIC_ADSPOWER_API_URL || 'http://local.adspower.net:50325'; })(),
        enableHttps: true, // 预发环境启用HTTPS
        secureCookies: true,
        enableAnalytics: analyticsEnabled(),
        enableErrorReporting: true,
        enablePerformanceMonitoring: true,
        debugMode: debugModeEnabled(),
      };
      break;
      
    case 'production':
      result = {
        domain: currentDomain,
        baseUrl: `https://${currentDomain}`,
        oauthRedirectUri: config.OAUTH_REDIRECT_URI || `https://${currentDomain}/oauth/callback`,
        isLocal: false,
        isHttps: true,
        apiBaseUrl: `https://${currentDomain}/api`,
        adsPowerApiUrl: ((): string => { const snap = getCachedRemoteConfig(); const remote = snap ? (getConfigValue<string>('integrations.adsPower.apiUrl', snap) || getConfigValue<string>('Integrations.AdsPower.BaseURL', snap)) : undefined; return remote || process.env.NEXT_PUBLIC_ADSPOWER_API_URL || 'http://local.adspower.net:50325'; })(),
        enableHttps: true, // 生产环境启用HTTPS
        secureCookies: true,
        enableAnalytics: analyticsEnabled(),
        enableErrorReporting: true,
        enablePerformanceMonitoring: true,
        debugMode: debugModeEnabled(),
      };
      break;
      
    default:
      throw new Error(`Unknown environment: ${env}`);
  }
  
  // Cache the result
  cachedDomainConfig = result;
  domainConfigTimestamp = now;
  return result;
}

/**
 * 获取环境特定的Google OAuth配置
 */
export function getGoogleOAuthConfig() {
  const config = getDomainConfig();
  const env = detectEnvironment();
  
  return {
    clientId: process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
    redirectUri: config.oauthRedirectUri,
    scope: process.env.NEXT_PUBLIC_GOOGLE_ADS_SCOPE || 'https://www.googleapis.com/auth/adwords',
    // 预发环境使用测试凭据，生产环境使用正式凭据
    developerToken: env === 'production' 
      ? process.env.GOOGLE_ADS_DEVELOPER_TOKEN 
      : process.env.NEXT_PUBLIC_GOOGLE_ADS_DEVELOPER_TOKEN,
  };
}

/**
 * 验证域名是否在允许列表中
 */
export function isDomainAllowed(domain: string): boolean {
  const allowedDomains = [
    'localhost',
    '127.0.0.1',
    'autoads.dev',
    'www.autoads.dev',
    'urlchecker.dev',
    'www.urlchecker.dev',
  ];
  
  // 移除端口号进行比较
  const domainWithoutPort = domain.split(':')[0];
  
  return allowedDomains.some(allowed => {
    if (allowed && typeof allowed === 'object' && 'test' in allowed) {
      return (allowed as RegExp).test(domainWithoutPort);
    }
    return domainWithoutPort === allowed || domainWithoutPort.endsWith(`.${allowed}`);
  });
}

/**
 * 获取CORS配置
 */
export function getCorsConfig() {
  const config = getDomainConfig();
  
  return {
    origin: config.isLocal ? '*' : [config.baseUrl],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  };
}

/**
 * 环境特定的日志工具
 */
export const logger = {
  debug: (message: string, data?: any) => {
    const config = getDomainConfig();
    if (config.debugMode) {
      console.debug(`[DEBUG] ${message}`, data || '');
    }
  },
  
  info: (message: string, data?: any) => {
    console.info(`[INFO] ${message}`, data || '');
  },
  
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data || '');
  },
  
  error: (message: string, error?: any) => {
    const config = getDomainConfig();
    if (config.enableErrorReporting) {
      // 在生产环境中，错误应该发送到错误追踪服务
      console.error(`[ERROR] ${message}`, error || '');
    } else {
      console.error(`[ERROR] ${message}`, error || '');
    }
  },
};

// 保持向后兼容的导出
export const DOMAIN_CONFIG = {
  // 主域名（新品牌）
  primary: process.env.NEXT_PUBLIC_PRIMARY_DOMAIN || 'autoads.dev',
  
  // 旧域名（向后兼容）
  legacy: process.env.NEXT_PUBLIC_LEGACY_DOMAIN || 'urlchecker.dev',
  
  // 支持的所有域名
  supported: (process.env.NEXT_PUBLIC_SUPPORTED_DOMAINS || 'autoads.dev,www.autoads.dev,urlchecker.dev,www.urlchecker.dev').split(','),
  
  // 获取当前域名
  getCurrentDomain: () => {
    const config = getDomainConfig();
    return config.domain;
  },
  
  // 检查是否为旧域名
  isLegacyDomain: (hostname?: string) => {
    const domain = hostname || getDomainConfig().domain;
    return domain.includes('urlchecker.dev');
  },
  
  // 检查是否为新域名
  isPrimaryDomain: (hostname?: string) => {
    const domain = hostname || getDomainConfig().domain;
    return domain.includes('autoads.dev');
  },
  
  // 获取品牌名称（根据当前域名）
  getBrandName: (hostname?: string) => {
    const domain = hostname || getDomainConfig().domain;
    return domain.includes('urlchecker.dev') ? 'URLChecker.dev' : 'AutoAds.dev';
  },
  
  // 获取品牌邮箱前缀
  getEmailDomain: (hostname?: string) => {
    const domain = hostname || getDomainConfig().domain;
    return domain.includes('urlchecker.dev') ? 'urlchecker.dev' : 'autoads.dev';
  },
  
  // 获取完整的站点URL
  getSiteUrl: (hostname?: string) => {
    const config = getDomainConfig();
    return config.baseUrl;
  },
  
  // 检查域名是否被支持
  isSupportedDomain: (hostname: string) => {
    const config = getDomainConfig();
    return isDomainAllowed(hostname);
  },
  
  // 获取应用名称
  getAppName: () => {
    const config = typeof window === 'undefined' ? getServerConfig() : getSyncClientConfig();
    return config.APP_NAME || 'URL Batch Checker';
  }
};

// 导出类型
export type LegacyDomainConfig = typeof DOMAIN_CONFIG;
