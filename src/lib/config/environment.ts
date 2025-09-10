import fs from 'fs'
import path from 'path'

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
  private configPath: string

  constructor() {
    this.environment = process.env.NODE_ENV || 'development'
    this.configPath = path.join(process.cwd(), 'config', 'environments')
  }

  /**
   * Load configuration for the current environment
   */
  loadConfig(): EnvironmentConfig {
    if (this.config) {
      return this.config
    }

    const configFile = path.join(this.configPath, `${this.environment}.json`)
    
    if (!fs.existsSync(configFile)) {
      throw new Error(`Configuration file not found for environment: ${this.environment}`)
    }

    try {
      const configContent = fs.readFileSync(configFile, 'utf8')
      const rawConfig = JSON.parse(configContent)
      
      // Interpolate environment variables
      this.config = this.interpolateEnvironmentVariables(rawConfig)
      
      // Validate configuration
      if (this.config) {
        this.validateConfig(this.config)
      }
      
      return this.config!
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : "Unknown error" as any}`)
    }
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
      integrations: Object.entries(config.integrations).reduce((acc, [key, value]) => {
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
    const interpolated = JSON.parse(JSON.stringify(config))
    
    const interpolate = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
          return process.env[varName] || match
        })
      } else if (Array.isArray(obj)) {
        return obj?.filter(Boolean)?.map(item => interpolate(item))
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
    if (!config.database.url) {
      throw new Error('Database URL is required')
    }

    if (!config.auth.jwtSecret) {
      throw new Error('JWT secret is required')
    }

    if (config.security.csrf.enabled && !config.security.csrf.secret) {
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
          matches.forEach(match => {
            const varName = match.slice(2, -1)
            variables.add(varName)
          })
        }
      } else if (Array.isArray(obj)) {
        obj.forEach(item => extract(item))
      } else if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(value => extract(value))
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