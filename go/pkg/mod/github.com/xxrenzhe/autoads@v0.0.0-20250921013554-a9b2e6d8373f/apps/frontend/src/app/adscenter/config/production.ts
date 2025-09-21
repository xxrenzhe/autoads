/**
 * 生产环境配置
 * 包含生产环境特定的配置项
 */

export const PRODUCTION_CONFIG = {
  // 域名配置
  DOMAIN: process.env.NEXT_PUBLIC_DOMAIN || 'autoads.dev',
  BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'https://autoads.dev',
  
  // OAuth配置
  OAUTH_REDIRECT_URI: process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI || 'https://autoads.dev/oauth/callback',
  
  // API配置
  API_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/api` : 'https://autoads.dev/api',
  
  // AdsPower配置
  ADSPOWER_API_URL: process.env.NEXT_PUBLIC_ADSPOWER_API_URL || 'http://local.adspower.net:50325',
  
  // Google Ads API配置
  GOOGLE_ADS_API_VERSION: process.env.NEXT_PUBLIC_GOOGLE_ADS_API_VERSION || 'v14',
  GOOGLE_ADS_SCOPE: process.env.NEXT_PUBLIC_GOOGLE_ADS_SCOPE || 'https://www.googleapis.com/auth/adwords',
  
  // 安全配置
  HTTPS_ONLY: process.env.NEXT_PUBLIC_HTTPS_ONLY === 'true',
  SECURE_COOKIES: process.env.NEXT_PUBLIC_SECURE_COOKIES === 'true',
  
  // 性能配置
  CACHE_TTL: 300, // 5分钟
  REQUEST_TIMEOUT: parseInt(process.env.NEXT_PUBLIC_ADSPOWER_TIMEOUT || '30000'),
  
  // 功能开关
  FEATURES: {
    ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
    ERROR_REPORTING: process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING === 'true',
    PERFORMANCE_MONITORING: process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING === 'true',
    DEBUG_MODE: process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'
  }
};

export const DEVELOPMENT_CONFIG = {
  // 域名配置
  DOMAIN: process.env.NEXT_PUBLIC_DOMAIN || 'localhost:3000',
  BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  
  // OAuth配置
  OAUTH_REDIRECT_URI: process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
  
  // API配置
  API_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/api` : 'http://localhost:3000/api',
  
  // AdsPower配置
  ADSPOWER_API_URL: process.env.NEXT_PUBLIC_ADSPOWER_API_URL || 'http://local.adspower.net:50325',
  
  // Google Ads API配置
  GOOGLE_ADS_API_VERSION: process.env.NEXT_PUBLIC_GOOGLE_ADS_API_VERSION || 'v14',
  GOOGLE_ADS_SCOPE: process.env.NEXT_PUBLIC_GOOGLE_ADS_SCOPE || 'https://www.googleapis.com/auth/adwords',
  
  // 安全配置
  HTTPS_ONLY: process.env.NEXT_PUBLIC_HTTPS_ONLY === 'true',
  SECURE_COOKIES: process.env.NEXT_PUBLIC_SECURE_COOKIES === 'true',
  
  // 性能配置
  CACHE_TTL: 60, // 1分钟
  REQUEST_TIMEOUT: parseInt(process.env.NEXT_PUBLIC_ADSPOWER_TIMEOUT || '10000'),
  
  // 功能开关
  FEATURES: {
    ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
    ERROR_REPORTING: process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING === 'true',
    PERFORMANCE_MONITORING: process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING === 'true',
    DEBUG_MODE: process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'
  }
};

// 根据环境自动选择配置
export const getConfig = () => {
  if (typeof window !== 'undefined') {
    const isProduction = window.location.hostname === 'autoads.dev' || 
                        window.location.hostname.includes('vercel.app');
    return isProduction ? PRODUCTION_CONFIG : DEVELOPMENT_CONFIG;
  }
  
  // 服务端环境判断
  const isProduction = process.env.NODE_ENV === 'production' || 
                      process.env.VERCEL_ENV === 'production' ||
                      process.env.VERCEL === '1';
  return isProduction ? PRODUCTION_CONFIG : DEVELOPMENT_CONFIG;
};

// 导出当前环境配置
export const CONFIG = getConfig();