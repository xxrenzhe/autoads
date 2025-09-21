/**
 * Enhanced Application Configuration
 * 增强的应用配置，包含所有优化后的配置项
 */

// 基础配置
const BASE_CONFIG = {
  // AutoAds 配置
  autoads: {
    site: {
      name: "AutoAds",
      title: "AutoAds - 一站式自动化营销平台 | 真实点击、网站排名分析、智能广告投放",
      description: "AutoAds是一站式自动化营销平台，提供真实点击、网站排名分析、智能广告投放三大核心功能。支持批量URL打开、PageRank评估、自动化广告管理、数据导出等，助力企业提升数字营销效率。",
      email: "contact@autoads.dev",
      github: "https://github.com/autoads-dev",
      twitter: "https://twitter.com/autoads_dev",
    },
  },
  
  // URLChecker 配置
  urlchecker: {
    site: {
      name: "URLChecker",
      title: "URLChecker.dev - 专业URL批量检测工具 | 网站状态监控、批量链接检查",
      description: "URLChecker.dev是专业的URL批量检测工具，提供网站状态监控、批量链接检查、HTTP状态码检测、重定向跟踪等功能。支持大规模URL处理，实时监控网站可用性。",
      email: "contact@urlchecker.dev",
      github: "https://github.com/xxrenzhe/url-batch-checker",
      twitter: "https://twitter.com/urlchecker_dev",
    },
  },
};

// 任务执行配置
export const TASK_EXECUTION_CONFIG = {
  // 任务队列配置
  taskQueue: {
    concurrency: 15,           // 增加并发数
    timeout: 120000,          // 2分钟超时
    retry: {
      attempts: 3,
      delay: 5000,
      backoffFactor: 2,
      maxDelay: 30000
    }
  },
  
  // 重试策略配置
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true,
    retryableErrors: [
      'timeout',
      'connection_reset',
      'network_error',
      'proxy_error',
      'err_connection_reset',
      'err_tunnel_connection_failed',
      'err_socket_timeout',
      'err_timed_out',
      'navigation timeout'
    ],
    nonRetryableErrors: [
      'permission_denied',
      'invalid_url',
      'authentication_failed',
      'ssl_error',
      'dns_not_found',
      'task_terminated'
    ]
  },
  
  // 超时配置
  timeouts: {
    pageLoad: 30000,
    elementWait: 10000,
    scriptExecution: 5000,
    totalTask: 300000
  }
};

// 浏览器实例配置
export const BROWSER_CONFIG = {
  // 实例管理
  instances: {
    production: {
      maxInstances: 50,
      maxTasksPerInstance: 15,
      maxPagesPerInstance: 10,
      instanceTimeout: 30000,
      idleTimeout: 60000
    },
    development: {
      maxInstances: 20,
      maxTasksPerInstance: 10,
      maxPagesPerInstance: 8,
      instanceTimeout: 60000,
      idleTimeout: 120000
    },
    test: {
      maxInstances: 10,
      maxTasksPerInstance: 5,
      maxPagesPerInstance: 5,
      instanceTimeout: 120000,
      idleTimeout: 300000
    }
  },
  
  // 健康检查
  healthCheck: {
    interval: 30000,
    timeoutThreshold: 0.8,
    failureThreshold: 0.2
  },
  
  // 性能优化
  performance: {
    adaptiveTimeout: {
      enabled: true,
      minTimeout: 10000,
      maxTimeout: 120000,
      baseTimeout: 30000
    },
    memoryManagement: {
      threshold: 0.8,
      checkInterval: 30000,
      autoCleanup: true
    }
  }
};

// 代理配置
export const PROXY_CONFIG = {
  // 代理获取
  acquisition: {
    batchSize: 50,
    timeout: 30000,
    maxRetries: 3,
    cacheEnabled: true,
    cacheTTL: 3600000 // 1小时
  },
  
  // 代理验证
  validation: {
    timeout: 10000,
    retryCount: 2,
    strictMode: true
  },
  
  // 代理使用
  usage: {
    strategy: 'round-robin', // round-robin, random, least-used
    healthCheck: true,
    failurePenalty: 300 // 5分钟冷却期
  }
};

// 资源管理配置
export const RESOURCE_CONFIG = {
  // 监控配置
  monitoring: {
    interval: 30000,
    historySize: 100,
    autoCleanup: true,
    cleanupInterval: 300000
  },
  
  // 阈值配置
  thresholds: {
    memory: 0.8,      // 80%
    cpu: 0.7,         // 70%
    disk: 0.9,        // 90%
    connections: 1000
  },
  
  // 自动处理
  autoActions: {
    enabled: true,
    cleanup: true,
    throttle: true,
    restart: true
  }
};

// 日志配置
export const LOGGING_CONFIG = {
  // 日志级别
  level: process.env.LOG_LEVEL || 'info',
  
  // 日志格式
  format: {
    timestamp: true,
    level: true,
    context: true,
    stack: false
  },
  
  // 日志轮转
  rotation: {
    enabled: true,
    maxSize: '10MB',
    maxFiles: 5,
    compress: true
  },
  
  // 性能日志
  performance: {
    enabled: true,
    interval: 60000,
    includeMemory: true,
    includeCPU: true
  }
};

// 缓存配置
export const CACHE_CONFIG = {
  // Redis缓存（如果可用）
  redis: {
    enabled: process.env.REDIS_URL ? true : false,
    url: process.env.REDIS_URL,
    ttl: 3600,
    prefix: 'urlbatch:'
  },
  
  // 内存缓存
  memory: {
    maxSize: 1000,
    ttl: 1800,
    cleanupInterval: 300000
  },
  
  // 缓存策略
  strategy: {
    default: 'memory',
    proxyData: 'memory',
    taskResults: 'memory',
    apiResponses: 'memory'
  }
};

// API配置
export const API_CONFIG = {
  // 基础配置
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '/api',
  timeout: 30000,
  retries: 3,
  
  // 限流配置
  rateLimit: {
    enabled: true,
    requests: 100,
    window: 60000, // 1分钟
    skipSuccessfulRequests: false
  },
  
  // 响应缓存
  cache: {
    enabled: true,
    ttl: 300, // 5分钟
    maxSize: 1000
  }
};

// 安全配置
export const SECURITY_CONFIG = {
  // 输入验证
  validation: {
    maxUrlLength: 2048,
    allowedProtocols: ['http', 'https'],
    sanitizeInput: true,
    validateUrls: true
  },
  
  // 访问控制
  access: {
    rateLimit: {
      enabled: true,
      maxRequests: 1000,
      windowMs: 60000
    },
    cors: {
      enabled: true,
      origins: ['*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }
  },
  
  // 数据保护
  data: {
    encryptSensitive: true,
    maskPersonalInfo: true,
    logSanitization: true
  }
};

// 性能配置
export const PERFORMANCE_CONFIG = {
  // 并发控制
  concurrency: {
    maxConcurrentTasks: 20,
    maxConcurrentRequests: 10,
    requestDelay: 100
  },
  
  // 缓存优化
  cache: {
    enabled: true,
    ttl: 300000, // 5分钟
    maxSize: 1000,
    strategy: 'lru'
  },
  
  // 监控
  monitoring: {
    enabled: true,
    interval: 60000,
    metrics: [
      'memory',
      'cpu',
      'responseTime',
      'errorRate',
      'throughput'
    ]
  }
};

// 环境特定的配置合并
export const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  return {
    // 基础配置
    app: BASE_CONFIG,
    
    // 功能配置
    taskExecution: TASK_EXECUTION_CONFIG,
    browser: BROWSER_CONFIG,
    proxy: PROXY_CONFIG,
    resource: RESOURCE_CONFIG,
    logging: LOGGING_CONFIG,
    cache: CACHE_CONFIG,
    api: API_CONFIG,
    security: SECURITY_CONFIG,
    performance: PERFORMANCE_CONFIG,
    
    // 环境特定配置
    env: {
      name: env,
      isProduction: env === 'production',
      isDevelopment: env === 'development',
      isTest: env === 'test'
    },
    
    // 特性开关
    features: {
      // 开启的功能
      enabled: [
        'enhancedRetry',
        'resourceMonitoring',
        'browserOptimization',
        'proxyCaching',
        'performanceTracking'
      ],
      
      // 关闭的功能
      disabled: [
        'debugMode',
        'verboseLogging'
      ]
    }
  };
};

// 获取环境特定的配置
export const getEnvironmentConfig = (env?: string) => {
  const environment = env || process.env.NODE_ENV || 'development';
  const config = getConfig();
  
  // 根据环境调整配置
  switch (environment) {
    case 'production':
      return {
        ...config,
        logging: {
          ...config.logging,
          level: 'warn'
        },
        browser: {
          ...config.browser,
          instances: config.browser.instances.production
        },
        performance: {
          ...config.performance,
          monitoring: {
            ...config.performance.monitoring,
            enabled: true
          }
        }
      };
      
    case 'development':
      return {
        ...config,
        logging: {
          ...config.logging,
          level: 'debug'
        },
        browser: {
          ...config.browser,
          instances: config.browser.instances.development
        }
      };
      
    case 'test':
      return {
        ...config,
        logging: {
          ...config.logging,
          level: 'error'
        },
        browser: {
          ...config.browser,
          instances: config.browser.instances.test
        },
        features: {
          ...config.features,
          disabled: [
            ...config.features.disabled,
            'resourceMonitoring',
            'performanceTracking'
          ]
        }
      };
      
    default:
      return config;
  }
};

// 导出默认配置
export default getConfig();