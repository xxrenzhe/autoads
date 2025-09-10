// 环境配置管理

export type Environment = 'development' | 'preview' | 'production' | 'test'

export interface EnvironmentConfig {
  NODE_ENV: Environment
  DATABASE_URL: string
  REDIS_URL?: string
  API_BASE_URL: string
  DOMAIN: string

  // 第三方服务配置
  GOOGLE_ADS_CLIENT_ID?: string
  GOOGLE_ADS_CLIENT_SECRET?: string
  SIMILARWEB_API_KEY?: string
  ADSPOWER_API_URL?: string

  // 功能开关
  FEATURES: {
    MULTI_TENANT: boolean
    REAL_TIME_UPDATES: boolean
    ADVANCED_ANALYTICS: boolean
    REACT_ADMIN: boolean
  }

  // 性能配置
  CACHE_TTL: number
  MAX_CONCURRENT_TASKS: number
  API_RATE_LIMIT: number
}

// 环境特定配置
const environmentConfigs: Record<Environment, Partial<EnvironmentConfig>> = {
  development: {
    DOMAIN: 'localhost',
    API_BASE_URL: 'http://localhost:3000/api',
    FEATURES: {
      MULTI_TENANT: true,
      REAL_TIME_UPDATES: true,
      ADVANCED_ANALYTICS: true,
      REACT_ADMIN: false, // 开发阶段逐步启用
    },
    CACHE_TTL: 300, // 5分钟
    MAX_CONCURRENT_TASKS: 3,
    API_RATE_LIMIT: 100,
  },
  preview: {
    DOMAIN: 'urlchecker.dev',
    API_BASE_URL: 'https://urlchecker.dev/api',
    FEATURES: {
      MULTI_TENANT: true,
      REAL_TIME_UPDATES: true,
      ADVANCED_ANALYTICS: true,
      REACT_ADMIN: true,
    },
    CACHE_TTL: 600, // 10分钟
    MAX_CONCURRENT_TASKS: 5,
    API_RATE_LIMIT: 200,
  },
  production: {
    DOMAIN: 'autoads.dev',
    API_BASE_URL: 'https://autoads.dev/api',
    FEATURES: {
      MULTI_TENANT: true,
      REAL_TIME_UPDATES: true,
      ADVANCED_ANALYTICS: true,
      REACT_ADMIN: true,
    },
    CACHE_TTL: 1800, // 30分钟
    MAX_CONCURRENT_TASKS: 10,
    API_RATE_LIMIT: 500,
  },
  test: {
    DOMAIN: 'localhost',
    API_BASE_URL: 'http://localhost:3000/api',
    FEATURES: {
      MULTI_TENANT: false,
      REAL_TIME_UPDATES: false,
      ADVANCED_ANALYTICS: false,
      REACT_ADMIN: false,
    },
    CACHE_TTL: 60, // 1分钟
    MAX_CONCURRENT_TASKS: 1,
    API_RATE_LIMIT: 1000,
  },
}

// 获取当前环境
export function getCurrentEnvironment(): Environment {
  const env = process.env.NODE_ENV as Environment
  return env || 'development'
}

// 获取环境配置
export function getEnvironmentConfig(): EnvironmentConfig {
  const currentEnv = getCurrentEnvironment()
  const baseConfig = environmentConfigs[currentEnv] || environmentConfigs.development

  return {
    NODE_ENV: currentEnv,
    DATABASE_URL: process.env.DATABASE_URL || '',
    REDIS_URL: process.env.REDIS_URL,
    API_BASE_URL: baseConfig.API_BASE_URL || 'http://localhost:3000/api',
    DOMAIN: baseConfig.DOMAIN || 'localhost',

    // 第三方服务
    GOOGLE_ADS_CLIENT_ID: process.env.GOOGLE_ADS_CLIENT_ID,
    GOOGLE_ADS_CLIENT_SECRET: process.env.GOOGLE_ADS_CLIENT_SECRET,
    SIMILARWEB_API_KEY: process.env.SIMILARWEB_API_KEY,
    ADSPOWER_API_URL: process.env.ADSPOWER_API_URL,

    // 功能开关
    FEATURES: {
      MULTI_TENANT:
        process.env.FEATURE_MULTI_TENANT === 'true' || baseConfig.FEATURES?.MULTI_TENANT || false,
      REAL_TIME_UPDATES:
        process.env.FEATURE_REAL_TIME_UPDATES === 'true' ||
        baseConfig.FEATURES?.REAL_TIME_UPDATES ||
        false,
      ADVANCED_ANALYTICS:
        process.env.FEATURE_ADVANCED_ANALYTICS === 'true' ||
        baseConfig.FEATURES?.ADVANCED_ANALYTICS ||
        false,
      REACT_ADMIN:
        process.env.FEATURE_REACT_ADMIN === 'true' || baseConfig.FEATURES?.REACT_ADMIN || false,
    },

    // 性能配置
    CACHE_TTL: parseInt(process.env.CACHE_TTL || '') || baseConfig.CACHE_TTL || 600,
    MAX_CONCURRENT_TASKS:
      parseInt(process.env.MAX_CONCURRENT_TASKS || '') || baseConfig.MAX_CONCURRENT_TASKS || 5,
    API_RATE_LIMIT: parseInt(process.env.API_RATE_LIMIT || '') || baseConfig.API_RATE_LIMIT || 100,
  }
}

// 配置验证
export function validateEnvironmentConfig(config: EnvironmentConfig): string[] {
  const errors: string[] = []

  if (!config.DATABASE_URL) {
    errors.push('DATABASE_URL is required')
  }

  if (!config.API_BASE_URL) {
    errors.push('API_BASE_URL is required')
  }

  if (!config.DOMAIN) {
    errors.push('DOMAIN is required')
  }

  if (config.CACHE_TTL < 0) {
    errors.push('CACHE_TTL must be non-negative')
  }

  if (config.MAX_CONCURRENT_TASKS < 1) {
    errors.push('MAX_CONCURRENT_TASKS must be at least 1')
  }

  if (config.API_RATE_LIMIT < 1) {
    errors.push('API_RATE_LIMIT must be at least 1')
  }

  return errors
}

// 导出配置实例
export const config = getEnvironmentConfig()

// 验证配置
const configErrors = validateEnvironmentConfig(config)
if (configErrors.length > 0 && config.NODE_ENV !== 'test') {
  console.error('Environment configuration errors:', configErrors)
  if (config.NODE_ENV === 'production') {
    throw new Error(`Invalid environment configuration: ${configErrors.join(', ')}`)
  }
}
