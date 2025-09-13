export interface SecurityConfig {
  // Authentication settings
  auth: {
    sessionTimeout: number // in milliseconds
    maxConcurrentSessions: number
    requireEmailVerification: boolean
    passwordPolicy: {
      minLength: number
      requireUppercase: boolean
      requireLowercase: boolean
      requireNumbers: boolean
      requireSpecialChars: boolean
      maxAge: number // in days
      preventReuse: number // number of previous passwords to check
    }
  }

  // Encryption settings
  encryption: {
    algorithm: string
    keyLength: number
    saltLength: number
    iterations: number
  }

  // Rate limiting
  rateLimit: {
    windowMs: number
    maxRequests: number
    skipSuccessfulRequests: boolean
    skipFailedRequests: boolean
    standardHeaders: boolean
    legacyHeaders: boolean
  }

  // Threat detection
  threatDetection: {
    enabled: boolean
    patterns: {
      bruteForce: {
        enabled: boolean
        maxAttempts: number
        windowMs: number
        blockDuration: number
      }
      suspiciousActivity: {
        enabled: boolean
        maxApiRequests: number
        windowMs: number
      }
      privilegeEscalation: {
        enabled: boolean
        maxUnauthorizedAttempts: number
        windowMs: number
      }
    }
  }

  // Audit logging
  audit: {
    enabled: boolean
    retentionDays: number
    categories: string[]
    severityLevels: string[]
    batchSize: number
    flushInterval: number
  }

  // Session management
  session: {
    secure: boolean
    httpOnly: boolean
    sameSite: 'strict' | 'lax' | 'none'
    maxAge: number
    rolling: boolean
    regenerateOnAuth: boolean
  }

  // CORS settings
  cors: {
    origin: string[]
    methods: string[]
    allowedHeaders: string[]
    credentials: boolean
  }

  // Content Security Policy
  csp: {
    enabled: boolean
    directives: Record<string, string[]>
  }

  // IP blocking
  ipBlocking: {
    enabled: boolean
    whitelist: string[]
    blacklist: string[]
    maxBlockDuration: number
  }
}

export const defaultSecurityConfig: SecurityConfig = {
  auth: {
    sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
    maxConcurrentSessions: 5,
    requireEmailVerification: true,
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      maxAge: 90, // 90 days
      preventReuse: 5
    }
  },

  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    saltLength: 16,
    iterations: 100000
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    standardHeaders: true,
    legacyHeaders: false
  },

  threatDetection: {
    enabled: true,
    patterns: {
      bruteForce: {
        enabled: true,
        maxAttempts: 5,
        windowMs: 5 * 60 * 1000, // 5 minutes
        blockDuration: 60 * 60 * 1000 // 1 hour
      },
      suspiciousActivity: {
        enabled: true,
        maxApiRequests: 100,
        windowMs: 60 * 1000 // 1 minute
      },
      privilegeEscalation: {
        enabled: true,
        maxUnauthorizedAttempts: 3,
        windowMs: 5 * 60 * 1000 // 5 minutes
      }
    }
  },

  audit: {
    enabled: true,
    retentionDays: 90,
    categories: ['security', 'data_access', 'admin', 'user', 'system', 'compliance'],
    severityLevels: ['low', 'medium', 'high', 'critical'],
    batchSize: 100,
    flushInterval: 5000 // 5 seconds
  },

  session: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    rolling: true,
    regenerateOnAuth: true
  },

  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://autoads.dev', 'https://urlchecker.dev']
      : ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
  },

  csp: {
    enabled: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://js.stripe.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'https://api.stripe.com'],
      'frame-src': ["'self'", 'https://js.stripe.com'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': []
    }
  },

  ipBlocking: {
    enabled: true,
    whitelist: [], // Add trusted IPs here
    blacklist: [], // Add blocked IPs here
    maxBlockDuration: 24 * 60 * 60 * 1000 // 24 hours
  }
}

/**
 * Get security configuration with environment overrides
 */
export function getSecurityConfig(): SecurityConfig {
  const config = { ...defaultSecurityConfig }

  // Override with environment variables if available
  if (process.env.SESSION_TIMEOUT) {
    config.auth.sessionTimeout = parseInt(process.env.SESSION_TIMEOUT)
  }

  if (process.env.MAX_CONCURRENT_SESSIONS) {
    config.auth.maxConcurrentSessions = parseInt(process.env.MAX_CONCURRENT_SESSIONS)
  }

  if (process.env.RATE_LIMIT_WINDOW_MS) {
    config.rateLimit.windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS)
  }

  if (process.env.RATE_LIMIT_MAX_REQUESTS) {
    config.rateLimit.maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS)
  }

  if (process.env.THREAT_DETECTION_ENABLED) {
    config.threatDetection.enabled = process.env.THREAT_DETECTION_ENABLED === 'true'
  }

  if (process.env.AUDIT_RETENTION_DAYS) {
    config.audit.retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS)
  }

  return config
}

/**
 * Validate security configuration
 */
export function validateSecurityConfig(config: SecurityConfig): string[] {
  const errors: string[] = []

  // Validate auth settings
  if (config.auth.sessionTimeout < 60000) {
    errors.push('Session timeout must be at least 1 minute')
  }

  if (config.auth.maxConcurrentSessions < 1) {
    errors.push('Max concurrent sessions must be at least 1')
  }

  if (config.auth.passwordPolicy.minLength < 8) {
    errors.push('Password minimum length must be at least 8 characters')
  }

  // Validate rate limiting
  if (config.rateLimit.windowMs < 1000) {
    errors.push('Rate limit window must be at least 1 second')
  }

  if (config.rateLimit.maxRequests < 1) {
    errors.push('Rate limit max requests must be at least 1')
  }

  // Validate audit settings
  if (config.audit.retentionDays < 1) {
    errors.push('Audit retention days must be at least 1')
  }

  if (config.audit.batchSize < 1) {
    errors.push('Audit batch size must be at least 1')
  }

  // Validate encryption settings
  if (config.encryption.keyLength < 16) {
    errors.push('Encryption key length must be at least 16 bytes')
  }

  if (config.encryption.iterations < 1000) {
    errors.push('Encryption iterations must be at least 1000')
  }

  return errors
}

/**
 * Get Content Security Policy header value
 */
export function getCSPHeader(config: SecurityConfig): string {
  if (!config.csp.enabled) return ''

  const directives = Object.entries(config.csp.directives)
    .map(([key, values]: any) => `${key} ${values.join(' ')}`)
    .join('; ')

  return directives
}

/**
 * Check if IP is whitelisted
 */
export function isIPWhitelisted(ip: string, config: SecurityConfig): boolean {
  return config.ipBlocking.whitelist.includes(ip)
}

/**
 * Check if IP is blacklisted
 */
export function isIPBlacklisted(ip: string, config: SecurityConfig): boolean {
  return config.ipBlocking.blacklist.includes(ip)
}