/**
 * Secure Configuration Manager
 * 安全的配置管理器，用于处理敏感配置数据
 */

import { encrypt, decrypt, EncryptionResult } from './encryption';
import { getRequiredEnvVar, getEnvVar } from './env-validation';
import { defaultSecurityConfig, shouldFilterFromLogs } from '@/lib/config/security';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
const logger = createClientLogger('secure-config');

/**
 * 安全配置接口
 */
export interface SecureConfig {
  googleAds: {
    clientId: string;
    clientSecret: string;
    developerToken: string;
    refreshToken?: string;
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  oauth: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
  };
  api: {
    openPageRankKey?: string;
    baseUrl: string;
  };
  analytics: {
    trackingId?: string;
  };
  security: {
    encryptionKey: string;
    jwtSecret: string;
    sessionSecret: string;
  };
}

/**
 * 配置缓存
 */
let configCache: SecureConfig | null = null;

/**
 * 从环境变量加载配置
 */
function loadConfigFromEnv(): SecureConfig {
  return {
    googleAds: {
      clientId: getRequiredEnvVar('GOOGLE_ADS_CLIENT_ID'),
      clientSecret: getRequiredEnvVar('GOOGLE_ADS_CLIENT_SECRET'),
      developerToken: getRequiredEnvVar('GOOGLE_ADS_DEVELOPER_TOKEN'),
      refreshToken: getEnvVar('GOOGLE_ADS_REFRESH_TOKEN') || undefined
    },
    database: {
      host: getEnvVar('DB_HOST', 'localhost') || 'localhost',
      port: parseInt(getEnvVar('DB_PORT', '5432') || '5432', 10),
      name: getEnvVar('DB_NAME', 'google_ads_automation') || 'google_ads_automation',
      user: getEnvVar('DB_USER', 'postgres') || 'postgres',
      password: getEnvVar('DB_PASSWORD', '') || '',
      ssl: process.env.NODE_ENV === 'production'
    },
    oauth: {
      clientId: getRequiredEnvVar('GOOGLE_ADS_CLIENT_ID'),
      clientSecret: getRequiredEnvVar('GOOGLE_ADS_CLIENT_SECRET'),
      redirectUri: `${getRequiredEnvVar('NEXT_PUBLIC_BASE_URL')}/api/adscenter/oauth/callback`,
      scopes: [
        'https://www.googleapis.com/auth/adwords',
        'https://www.googleapis.com/auth/userinfo.email'
      ]
    },
    api: {
      openPageRankKey: getEnvVar('OPENPAGERANK_API_KEY') || undefined,
      baseUrl: getRequiredEnvVar('NEXT_PUBLIC_BASE_URL')
    },
    analytics: {
      trackingId: getEnvVar('GA_TRACKING_ID') || undefined
    },
    security: {
      encryptionKey: getRequiredEnvVar('ENCRYPTION_KEY'),
      jwtSecret: getRequiredEnvVar('JWT_SECRET'),
      sessionSecret: getRequiredEnvVar('SESSION_SECRET')
    }
  };
}

/**
 * 获取安全配置
 */
export function getSecureConfig(): SecureConfig {
  if (!configCache) {
    configCache = loadConfigFromEnv();
  }
  return configCache;
}

/**
 * 清除配置缓存
 */
export function clearConfigCache(): void {
  configCache = null;
}

/**
 * 获取数据库配置
 */
export function getDatabaseConfig() {
  const config = getSecureConfig();
  return config.database;
}

/**
 * 获取Google Ads配置
 */
export function getGoogleAdsConfig() {
  const config = getSecureConfig();
  return config.googleAds;
}

/**
 * 获取OAuth配置
 */
export function getOAuthConfig() {
  const config = getSecureConfig();
  return config.oauth;
}

/**
 * 获取API配置
 */
export function getApiConfig() {
  const config = getSecureConfig();
  return config.api;
}

/**
 * 获取安全配置
 */
export function getSecurityConfig() {
  const config = getSecureConfig();
  return config.security;
}

/**
 * 安全地记录配置信息（隐藏敏感数据）
 */
export function logConfigSafely(): void {
  const config = getSecureConfig();
  
  const safeConfig = {
    googleAds: {
      clientId: config.googleAds.clientId ? '[SET]' : '[NOT_SET]',
      clientSecret: config.googleAds.clientSecret,
      developerToken: config.googleAds.developerToken,
      refreshToken: config.googleAds.refreshToken ? '[SET]' : '[NOT_SET]'
    },
    database: {
      host: config.database.host,
      port: config.database.port,
      name: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl
    },
    oauth: {
      clientId: config.oauth.clientId ? '[SET]' : '[NOT_SET]',
      clientSecret: config.oauth.clientSecret,
      redirectUri: config.oauth.redirectUri,
      scopes: config.oauth.scopes
    },
    api: {
      openPageRankKey: config.api.openPageRankKey ? '[SET]' : '[NOT_SET]',
      baseUrl: config.api.baseUrl
    },
    analytics: {
      trackingId: config.analytics.trackingId ? '[SET]' : '[NOT_SET]'
    },
    security: {
      encryptionKey: config.security.encryptionKey,
      jwtSecret: config.security.jwtSecret,
      sessionSecret: config.security.sessionSecret
    }
  };
  
  logger.info('Configuration loaded:');
}

/**
 * 验证配置完整性
 */
export function validateConfig(): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  try {
    const config = getSecureConfig();
    
    // 验证Google Ads配置
    if (!config.googleAds.clientId) {
      errors.push('Google Ads Client ID is required');
    }
    
    if (!config.googleAds.clientSecret) {
      errors.push('Google Ads Client Secret is required');
    }
    
    if (!config.googleAds.developerToken) {
      errors.push('Google Ads Developer Token is required');
    }
    
    // 验证数据库配置
    if (!config.database.host) {
      errors.push('Database host is required');
    }
    
    if (!config.database.name) {
      errors.push('Database name is required');
    }
    
    // 验证安全配置
    if (!config.security.encryptionKey) {
      errors.push('Encryption key is required');
    }
    
    if (!config.security.jwtSecret) {
      errors.push('JWT secret is required');
    }
    
    if (!config.security.sessionSecret) {
      errors.push('Session secret is required');
    }
    
    // 验证API配置
    if (!config.api.baseUrl) {
      errors.push('Base URL is required');
    }
    
  } catch (error) {
    errors.push(`Configuration loading failed: ${error instanceof Error ? error.message : "Unknown error" as any}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 加密配置中的敏感数据
 */
export function encryptSensitiveConfig(config: Partial<SecureConfig>): unknown {
  const encrypted: any = {};
  
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'object' && value !== null) {
      encrypted[key] = {};
      for (const [subKey, subValue] of Object.entries(value)) {
        if (typeof subValue === 'string' && shouldFilterFromLogs(subKey)) {
          encrypted[key][subKey] = encrypt(subValue);
        } else {
          encrypted[key][subKey] = subValue;
        }
      }
    } else if (typeof value === 'string' && shouldFilterFromLogs(key)) {
      encrypted[key] = encrypt(value);
    } else {
      encrypted[key] = value;
    }
  }
  
  return encrypted;
}

/**
 * 解密配置中的敏感数据
 */
export function decryptSensitiveConfig(encryptedConfig: unknown): unknown {
  const decrypted: any = {};
  
  for (const [key, value] of Object.entries(encryptedConfig as any)) {
    if (typeof value === 'object' && value !== null) {
      decrypted[key] = {};
      for (const [subKey, subValue] of Object.entries(value)) {
        if (typeof subValue === 'object' && subValue !== null && 'encrypted' in subValue) {
          decrypted[key][subKey] = decrypt(subValue as EncryptionResult);
        } else {
          decrypted[key][subKey] = subValue;
        }
      }
    } else if (typeof value === 'object' && value !== null && 'encrypted' in value) {
      decrypted[key] = decrypt(value as EncryptionResult);
    } else {
      decrypted[key] = value;
    }
  }
  
  return decrypted;
}