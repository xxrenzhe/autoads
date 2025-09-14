// 说明：根据架构优化方案，移除对本地 JSON 配置（config/environments/*.json）的读取。
// 本模块改为仅从 ENV 构建最小必需配置；更复杂、可热更的业务配置统一使用
// 只读配置适配器（remote-config.ts）从 Go 的 /go/admin/config/v1 获取。
//
// 注意：为保持兼容，保留原有导出 API（getEnvironmentManager、config、getConfig、
// isFeatureEnabled、isIntegrationEnabled 等），但内部实现不再访问本地文件。
// ENV 为唯一写时来源；远端聚合配置请使用 lib/config/remote-config.ts。

import type { } from 'node:fs'
import type { } from 'node:path'
import { getCachedRemoteConfig } from './remote-config'

interface DatabaseConfig {
  url: string
  maxConnections: number
  connectionTimeout: number
  enableLogging: boolean
  logLevel: string
}

interface RedisConfig {
  url: string
  maxRetries: number
  retryDelay: number
  keyPrefix: string
  ttl: number
}

interface ApiConfig {
  baseUrl: string
  timeout: number
  rateLimit: {
    windowMs: number
    maxRequests: number
  }
  cors: {
    origins: string[]
    credentials: boolean
  }
}

interface AuthConfig {
  jwtSecret: string
  jwtExpiresIn: string
  refreshTokenExpiresIn: string
  bcryptRounds: number
  sessionTimeout: number
}

interface EmailConfig {
  provider: 'smtp' | 'sendgrid' | 'ses'
  smtp?: {
    host: string
    port: number
    secure: boolean
    auth: {
      user: string
      pass: string
    }
  }
  sendgrid?: {
    apiKey: string
    from: string
  }
  ses?: {
    region: string
    accessKeyId: string
    secretAccessKey: string
    from: string
  }
  templates: {
    path: string
  }
}

interface StorageConfig {
  provider: 'local' | 's3'
  local?: {
    uploadPath: string
    maxFileSize: number
    allowedTypes: string[]
  }
  s3?: {
    bucket: string
    region: string
    accessKeyId: string
    secretAccessKey: string
    maxFileSize: number
    allowedTypes: string[]
    cdn?: {
      enabled: boolean
      domain: string
    }
  }
}

interface MonitoringConfig {
  enabled: boolean
  metricsInterval: number
  healthCheckInterval: number
  alerting: {
    enabled: boolean
    webhookUrl?: string
    channels?: string[]
    escalation?: {
      enabled: boolean
      pagerDutyKey: string
    }
  }
}

interface LoggingConfig {
  level: string
  format: string
  destinations: string[]
  file?: {
    path: string
    maxSize: string
    maxFiles: number
  }
  external?: {
    service: string
    apiKey: string
    source: string
    tags?: string[]
  }
  sensitiveFields: string[]
}

interface SecurityConfig {
  https: {
    enabled: boolean
    redirectHttp: boolean
    hsts?: {
      maxAge: number
      includeSubDomains: boolean
      preload: boolean
    }
  }
  headers: {
    contentSecurityPolicy: string
    hsts: boolean
    noSniff?: boolean
    frameOptions?: string
    xssProtection?: boolean
  }
  csrf: {
    enabled: boolean
    secret: string
  }
  rateLimit: {
    enabled: boolean
    windowMs: number
    maxRequests: number
    skipSuccessfulRequests?: boolean
  }
}

interface FeaturesConfig {
  registration: boolean
  emailVerification: boolean
  socialLogin: boolean
  analytics: boolean
  backup: boolean
  maintenance: boolean
}

interface IntegrationsConfig {
  stripe: {
    enabled: boolean
    publicKey: string
    secretKey: string
    webhookSecret: string
  }
  gmail: {
    enabled: boolean
    clientId: string
    clientSecret: string
    redirectUri: string
  }
  similarweb: {
    enabled: boolean
    apiKey: string
    baseUrl: string
  }
}

interface PerformanceConfig {
  caching?: {
    enabled: boolean
    ttl: number
    maxSize: string
  }
  compression?: {
    enabled: boolean
    level: number
  }
  clustering?: {
    enabled: boolean
    workers: string | number
  }
}

export interface EnvironmentConfig {
  name: string
  description: string
  database: DatabaseConfig
  redis: RedisConfig
  api: ApiConfig
  auth: AuthConfig
  email: EmailConfig
  storage: StorageConfig
  monitoring: MonitoringConfig
  logging: LoggingConfig
  security: SecurityConfig
  features: FeaturesConfig
  integrations: IntegrationsConfig
  performance?: PerformanceConfig
}

class EnvironmentManager {
  private config: EnvironmentConfig | null = null
  private environment: string

  constructor() {
    this.environment = process.env.NODE_ENV || 'development'
  }

  /**
   * Load configuration for the current environment
   */
  loadConfig(): EnvironmentConfig {
    if (this.config) {
      return this.config
    }
    // 优先使用缓存的远端只读配置快照（异步拉取由 remote-config.ts 负责）
    const remote = getCachedRemoteConfig()

    // 基于 ENV 的最小可用配置（满足校验需求，不依赖本地 JSON）
    const fallback: EnvironmentConfig = {
      name: this.environment,
      description: `Runtime environment (${this.environment}) from ENV-only`,
      database: {
        url: process.env.DATABASE_URL || '',
        maxConnections: Number(process.env.DB_MAX_CONNECTIONS || '20'),
        connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT || '10000'),
        enableLogging: (process.env.DB_LOGGING || 'false') === 'true',
        logLevel: process.env.DB_LOG_LEVEL || 'warn',
      },
      redis: {
        url: process.env.REDIS_URL || '',
        maxRetries: Number(process.env.REDIS_MAX_RETRIES || '3'),
        retryDelay: Number(process.env.REDIS_RETRY_DELAY || '250'),
        keyPrefix: process.env.REDIS_PREFIX || 'autoads:',
        ttl: Number(process.env.CACHE_TTL || '300'),
      },
      api: {
        baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '',
        timeout: Number(process.env.API_TIMEOUT || '30000'),
        rateLimit: {
          windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
          maxRequests: Number(process.env.RATE_LIMIT_DEFAULT_REQUESTS || '100'),
        },
        cors: {
          origins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
          credentials: true,
        },
      },
      auth: {
        jwtSecret: process.env.AUTH_SECRET || '',
        jwtExpiresIn: process.env.AUTH_JWT_EXPIRES_IN || '24h',
        refreshTokenExpiresIn: process.env.AUTH_REFRESH_EXPIRES_IN || '168h',
        bcryptRounds: Number(process.env.BCRYPT_ROUNDS || '10'),
        sessionTimeout: Number(process.env.SESSION_TIMEOUT || '86400'),
      },
      email: {
        provider: 'smtp',
        smtp: {
          host: process.env.SMTP_HOST || '',
          port: Number(process.env.SMTP_PORT || '465'),
          secure: (process.env.SMTP_SECURE || 'true') === 'true',
          auth: { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' },
        },
        templates: { path: process.env.EMAIL_TEMPLATES_PATH || 'templates' },
      },
      storage: {
        provider: (process.env.STORAGE_PROVIDER as any) || 'local',
        local: { uploadPath: process.env.UPLOAD_PATH || 'uploads', maxFileSize: Number(process.env.UPLOAD_MAX_MB || '10') * 1024 * 1024, allowedTypes: ['*'] },
      },
      monitoring: {
        enabled: (process.env.ENABLE_API_MONITORING || 'true') === 'true',
        metricsInterval: Number(process.env.METRICS_INTERVAL_MS || '60000'),
        healthCheckInterval: Number(process.env.HEALTH_CHECK_INTERVAL_MS || '30000'),
        alerting: { enabled: !!process.env.SLACK_WEBHOOK_URL, webhookUrl: process.env.SLACK_WEBHOOK_URL, channels: undefined, escalation: { enabled: false, pagerDutyKey: '' } },
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: 'json',
        destinations: ['stdout'],
        sensitiveFields: ['password', 'authorization', 'cookie']
      },
      security: {
        https: { enabled: (process.env.NODE_ENV === 'production'), redirectHttp: true, hsts: { maxAge: 31536000, includeSubDomains: true, preload: true } },
        headers: { contentSecurityPolicy: '', hsts: true },
        csrf: { enabled: false, secret: '' },
        rateLimit: { enabled: true, windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || '60000'), maxRequests: Number(process.env.RATE_LIMIT_DEFAULT_REQUESTS || '100') },
      },
      features: {
        registration: true,
        emailVerification: true,
        socialLogin: true,
        analytics: true,
        backup: false,
        maintenance: false,
      },
      integrations: {
        stripe: { enabled: (process.env.NEXT_PUBLIC_PAYMENTS_ENABLED || 'false') === 'true', publicKey: process.env.STRIPE_PUBLIC_KEY || '', secretKey: process.env.STRIPE_SECRET_KEY || '', webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '' },
        gmail: { enabled: false, clientId: '', clientSecret: '', redirectUri: '' },
        similarweb: { enabled: true, apiKey: process.env.SIMILARWEB_API_KEY || '', baseUrl: process.env.SIMILARWEB_API_URL || 'https://data.similarweb.com/api/v1/data' },
      },
      performance: { caching: { enabled: true, ttl: Number(process.env.CACHE_TTL || '300000'), maxSize: '1000' }, compression: { enabled: true, level: Number(process.env.COMPRESS_LEVEL || '6') }, clustering: { enabled: false, workers: 1 } },
    }

    // 若远端快照可用，则优先使用远端快照；否则用 ENV fallback
    const finalConfig = (remote?.config as EnvironmentConfig) || fallback

    // 校验并赋值
    this.validateConfig(finalConfig)
    this.config = finalConfig
    return this.config
  }

  /**
   * Get configuration for a specific section
   */
  getConfig<T extends keyof EnvironmentConfig>(section: T): EnvironmentConfig[T] {
    const config = this.loadConfig()
    return config[section]
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: keyof FeaturesConfig): boolean {
    const features = this.getConfig('features')
    return features[feature]
  }

  /**
   * Check if an integration is enabled
   */
  isIntegrationEnabled(integration: keyof IntegrationsConfig): boolean {
    const integrations = this.getConfig('integrations')
    return integrations[integration].enabled
  }

  /**
   * Get current environment name
   */
  getEnvironment(): string {
    return this.environment
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.environment === 'production'
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.environment === 'development'
  }

  /**
   * Check if running in staging
   */
  isStaging(): boolean {
    return this.environment === 'staging'
  }

  /**
   * Reload configuration (useful for hot reloading)
   */
  reloadConfig(): EnvironmentConfig {
    this.config = null
    return this.loadConfig()
  }

  /**
   * Validate environment variables are set
   */
  validateEnvironmentVariables(): { valid: boolean; missing: string[] } {
    const config = this.loadConfig()
    const missing: string[] = []

    // Check required environment variables based on configuration
    const requiredVars = this.extractRequiredEnvironmentVariables(config)
    
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missing.push(varName)
      }
    }

    return { valid: missing.length === 0, missing }
  }

  /**
   * Get configuration summary for debugging
   */
  getConfigSummary(): Record<string, any> {
    const config = this.loadConfig()
    
    return {
      environment: this.environment,
      database: {
        maxConnections: config.database.maxConnections,
        loggingEnabled: config.database.enableLogging
      },
      features: config.features,
      integrations: Object.entries(config.integrations).reduce((acc, [key, value]: any) => {
        acc[key] = { enabled: value.enabled }
        return acc
      }, {} as Record<string, any>),
      security: {
        httpsEnabled: config.security.https.enabled,
        csrfEnabled: config.security.csrf.enabled,
        rateLimitEnabled: config.security.rateLimit.enabled
      },
      monitoring: {
        enabled: config.monitoring.enabled,
        alertingEnabled: config.monitoring.alerting.enabled
      }
    }
  }

  /**
   * Interpolate environment variables in configuration
   */
  private interpolateEnvironmentVariables(config: any): any {
    // 远端快照中若包含 ${ENV_VAR} 模板，可在此进行插值；
    const interpolated = JSON.parse(JSON.stringify(config))
    
    const interpolate = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
          return process.env[varName] || match
        })
      } else if (Array.isArray(obj)) {
        return obj?.filter(Boolean)?.map((item: any) => interpolate(item))
      } else if (obj && typeof obj === 'object') {
        const result: any = {}
        for (const [key, value] of Object.entries(obj)) {
          result[key] = interpolate(value)
        }
        return result
      }
      return obj
    }

    return interpolate(interpolated)
  }

  /**
   * Validate configuration structure and required fields
   */
  private validateConfig(config: EnvironmentConfig): void {
    const requiredSections = [
      'database', 'redis', 'api', 'auth', 'email', 
      'storage', 'monitoring', 'logging', 'security', 
      'features', 'integrations'
    ]

    for (const section of requiredSections) {
      if (!config[section as keyof EnvironmentConfig]) {
        throw new Error(`Missing required configuration section: ${section}`)
      }
    }

    // Validate specific configurations
    if (!config.database || !config.database.url) {
      throw new Error('Database URL is required')
    }

    if (!config.auth || !config.auth.jwtSecret) {
      throw new Error('JWT secret is required')
    }

    if (config.security?.csrf?.enabled && !config.security.csrf.secret) {
      throw new Error('CSRF secret is required when CSRF is enabled')
    }
  }

  /**
   * Extract required environment variables from configuration
   */
  private extractRequiredEnvironmentVariables(config: any): string[] {
    const variables = new Set<string>()
    
    const extract = (obj: any): void => {
      if (typeof obj === 'string') {
        const matches = obj.match(/\$\{([^}]+)\}/g)
        if (matches) {
          matches.forEach((match: any) => {
            const varName = match.slice(2, -1)
            variables.add(varName)
          })
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item: any) => extract(item))
      } else if (obj && typeof obj === 'object') {
        Object.values(obj).forEach((value: any) => extract(value))
      }
    }

    extract(config)
    return Array.from(variables)
  }
}

// Singleton instance
let environmentManager: EnvironmentManager | null = null

export function getEnvironmentManager(): EnvironmentManager {
  if (!environmentManager) {
    environmentManager = new EnvironmentManager()
  }
  return environmentManager
}

export { EnvironmentManager }

// Convenience functions
export const config = () => getEnvironmentManager().loadConfig()
export const getConfig = <T extends keyof EnvironmentConfig>(section: T) => 
  getEnvironmentManager().getConfig(section)
export const isFeatureEnabled = (feature: keyof FeaturesConfig) => 
  getEnvironmentManager().isFeatureEnabled(feature)
export const isIntegrationEnabled = (integration: keyof IntegrationsConfig) => 
  getEnvironmentManager().isIntegrationEnabled(integration)
export const isProduction = () => getEnvironmentManager().isProduction()
export const isDevelopment = () => getEnvironmentManager().isDevelopment()
export const isStaging = () => getEnvironmentManager().isStaging()
