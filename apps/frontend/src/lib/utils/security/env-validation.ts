/**
 * Environment Variable Validation
 * 用于验证和安全处理环境变量
 */

import { isValidApiKey } from './validation';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('env-validation');


/**
 * 必需的环境变量列表
 */
const REQUIRED_ENV_VARS = [
  'GOOGLE_ADS_CLIENT_ID',
  'GOOGLE_ADS_CLIENT_SECRET',
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'NEXT_PUBLIC_BASE_URL'
] as const;

/**
 * 可选的环境变量列表
 */
const OPTIONAL_ENV_VARS = [
  'GOOGLE_ADS_REFRESH_TOKEN',
  'OPENPAGERANK_API_KEY',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'GA_TRACKING_ID'
] as const;

/**
 * 敏感环境变量列表（不应在日志中显示）
 */
const SENSITIVE_ENV_VARS = [
  'GOOGLE_ADS_CLIENT_SECRET',
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'GOOGLE_ADS_REFRESH_TOKEN',
  'OPENPAGERANK_API_KEY',
  'DB_PASSWORD'
] as const;

/**
 * 环境变量验证结果
 */
export interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
  invalid: string[];
  warnings: string[];
}

/**
 * 验证环境变量格式
 */
function validateEnvVarFormat(key: string, value: string): boolean {
  switch (key) {
    case 'GOOGLE_ADS_CLIENT_ID':
      // Google OAuth Client ID format
      return /^[0-9]+-[a-zA-Z0-9_]+\.apps\.googleusercontent\.com$/.test(value);
    
    case 'GOOGLE_ADS_CLIENT_SECRET':
      // Google OAuth Client Secret format
      return /^[a-zA-Z0-9_-]{24}$/.test(value);
    
    case 'GOOGLE_ADS_DEVELOPER_TOKEN':
      // Google Ads Developer Token format
      return /^[a-zA-Z0-9_-]{22}$/.test(value);
    
    case 'OPENPAGERANK_API_KEY':
      return isValidApiKey(value);
    
    case 'NEXT_PUBLIC_BASE_URL':
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    
    case 'GA_TRACKING_ID':
      // Google Analytics tracking ID format
      return /^(G-[A-Z0-9]+|UA-\d+-\d+)$/.test(value);
    
    case 'DB_PORT':
      const port = parseInt(value, 10);
      return !isNaN(port) && port > 0 && port <= 65535;
    
    default:
      return true; // 对于未知的环境变量，假设有效
  }
}

/**
 * 验证所有环境变量
 */
export function validateEnvironmentVariables(): EnvValidationResult {
  const missing: string[] = [];
  const invalid: string[] = [];
  const warnings: string[] = [];

  // 检查必需的环境变量
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar];
    
    if (!value) {
      missing.push(envVar);
    } else if (!validateEnvVarFormat(envVar, value)) {
      invalid.push(envVar);
    }
  }

  // 检查可选的环境变量格式
  for (const envVar of OPTIONAL_ENV_VARS) {
    const value = process.env[envVar];
    
    if (value && !validateEnvVarFormat(envVar, value)) {
      invalid.push(envVar);
    }
  }

  // 检查是否在生产环境中使用了默认值
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.OPENPAGERANK_API_KEY) {
      warnings.push('OPENPAGERANK_API_KEY is not set in production');
    }
    
    if (!process.env.GA_TRACKING_ID) {
      warnings.push('GA_TRACKING_ID is not set in production');
    }
  }

  return {
    isValid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    warnings
  };
}

/**
 * 获取环境变量的安全值（用于日志记录）
 */
export function getSafeEnvValue(key: string): string {
  const value = process.env[key];
  
  if (!value) {
    return '[NOT_SET]';
  }
  
  // Sensitive variable masking has been removed as requested
  
  return value;
}

/**
 * 获取所有环境变量的安全摘要
 */
export function getEnvSummary(): Record<string, string> {
  const summary: Record<string, string> = {};
  
  [...REQUIRED_ENV_VARS, ...OPTIONAL_ENV_VARS].forEach((key: any) => {
    summary[key] = getSafeEnvValue(key);
  });
  
  return summary;
}

/**
 * 检查环境变量是否为敏感信息
 */
export function isSensitiveEnvVar(key: string): boolean {
  return SENSITIVE_ENV_VARS.includes(key as typeof SENSITIVE_ENV_VARS[number]);
}

/**
 * 安全地获取环境变量
 */
export function getEnvVar(key: string, defaultValue?: string): string | undefined {
  const value = process.env[key];
  
  if (!value && defaultValue !== undefined) {
    return defaultValue;
  }
  
  return value;
}

/**
 * 获取必需的环境变量，如果不存在则抛出错误
 */
export function getRequiredEnvVar(key: string): string {
  const value = process.env[key];
  
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  
  return value;
}

/**
 * 在应用启动时验证环境变量
 */
export function validateEnvOnStartup(): void {
  const result = validateEnvironmentVariables();
  
  if (!result.isValid) {
    logger.error('Environment variable validation failed:');
    
    if (result.missing.length > 0) {
      logger.error('Missing required variables:', new EnhancedError('Missing required variables', { 
        data: result.missing 
      }));
    }
    
    if (result.invalid.length > 0) {
      logger.error('Invalid format variables:', new EnhancedError('Invalid format variables', { 
        data: result.invalid 
      }));
    }
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid environment configuration in production');
    }
  }
  
  if (result.warnings.length > 0) {
    logger.warn('Environment warnings:', { data: result.warnings });
  }
  
  logger.info('Environment validation passed');
}