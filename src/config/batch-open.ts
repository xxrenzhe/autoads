/**
 * Batch Open Configuration
 * 批量打开功能的配置常量
 */

export const BATCH_OPEN_CONFIG = {
  // 超时配置
  timeouts: {
    proxy: { default: 30000, retry: 15000 },
    url: { default: 20000, fallback: 30000 },
    batch: { default: 30000, max: 300000 }
  },
  
  // 限制配置
  limits: {
    maxTabs: 10,
    maxUrls: 1000,
    maxRetries: 3,
    maxConcurrent: 5,
    maxCycleCount: 60,
    maxOpenCount: 1000,
    maxOpenInterval: 60,
    minOpenInterval: 1,
    minCycleCount: 1,
    minOpenCount: 1
  },
  
  // 轮询配置
  polling: {
    pluginDetection: { attempts: 10, interval: 1000 },
    progress: { interval: 1000, staticThreshold: 3 }
  },
  
  // 防抖配置
  debounce: {
    urlParsing: 300,
    inputValidation: 500
  },
  
  // 代理配置 - 扩展版
  proxy: {
    // 基础配置
    batchSize: 50,
    validationTimeout: 30000,
    fetchTimeout: 30000,
    maxRetries: 2,
    
    // 代理获取配置
    acquisition: {
      maxBatchAttempts: 3,
      maxIndividualAttempts: 5,
      batchTimeout: 30000,
      individualTimeout: 15000,
      retryDelay: 1000,
      maxRetryDelay: 30000,
      backoffMultiplier: 2,
      jitterFactor: 0.1
    },
    
    // 代理池配置
    pool: {
      lowThreshold: 10,
      maxPoolSize: 500,
      proxyTtl: 30 * 60 * 1000, // 30分钟
      replenishmentTimeout: 300, // 5分钟
      cleanupInterval: 10 * 60 * 1000, // 10分钟
      healthCheckInterval: 60 * 1000, // 1分钟
      maxConcurrentValidations: 5
    },
    
    // 代理验证配置 - 仅验证代理API URL
    validation: {
      enabled: true, // 启用代理验证功能，但仅验证代理API URL
      timeout: 10000,
      testUrls: [
        'https://www.example.com'
      ],
      maxConcurrentValidations: 5,
      retryAttempts: 2,
      healthCheckInterval: 60000
    },
    
    // 代理分配配置
    allocation: {
      strategy: 'optimized', // 'optimized' | 'fifo' | 'round-robin'
      concurrencyLimit: 5,
      failureRate: 0.1,
      bufferMultiplier: 1.2,
      enableOptimization: true,
      maxProxyLimit: 100,
      minProxyLimit: 1,
      uniquePerRequest: true
    },
    
    // 错误处理配置
    errorHandling: {
      maxRetryAttempts: 3,
      baseRetryDelay: 1000,
      maxRetryDelay: 30000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      enableFallback: true,
      fallbackTimeout: 5000,
      blacklistDuration: 30 * 60 * 1000 // 30分钟
    },
    
    // 监控配置
    monitoring: {
      enableAutoReplenishment: true,
      checkInterval: 5 * 60 * 1000, // 5分钟
      replenishmentBatchSize: 50,
      maxReplenishmentAttempts: 3,
      performanceTracking: true,
      statisticsRetention: 24 * 60 * 60 * 1000 // 24小时
    }
  },
  
  // 任务配置
  task: {
    maxDuration: 300, // 5分钟
    cleanupInterval: 10 * 60 * 1000, // 10分钟
    taskExpiration: 60 * 60 * 1000, // 1小时
    defaultConcurrency: 3
  },
  
    
  } as const;


// 并发限制配置
export function getConcurrencyLimit(totalUrls: number) {
  if (totalUrls <= 5) return 2;
  if (totalUrls <= 10) return 3;
  if (totalUrls <= 20) return 4;
  return BATCH_OPEN_CONFIG.limits.maxConcurrent;
}

// 验证配置
export function validateBatchOpenParams(params: {
  cycleCount: number;
  openCount: number;
  openInterval: number;
  urls: string[];
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (params.cycleCount < BATCH_OPEN_CONFIG.limits.minCycleCount || 
      params.cycleCount > BATCH_OPEN_CONFIG.limits.maxCycleCount) {
    errors.push(`循环次数必须在${BATCH_OPEN_CONFIG.limits.minCycleCount}-${BATCH_OPEN_CONFIG.limits.maxCycleCount}之间`);
  }
  
  if (params.openCount < BATCH_OPEN_CONFIG.limits.minOpenCount || 
      params.openCount > BATCH_OPEN_CONFIG.limits.maxOpenCount) {
    errors.push(`打开次数必须在${BATCH_OPEN_CONFIG.limits.minOpenCount}-${BATCH_OPEN_CONFIG.limits.maxOpenCount}之间`);
  }
  
  if (params.openInterval < BATCH_OPEN_CONFIG.limits.minOpenInterval || 
      params.openInterval > BATCH_OPEN_CONFIG.limits.maxOpenInterval) {
    errors.push(`打开间隔必须在${BATCH_OPEN_CONFIG.limits.minOpenInterval}-${BATCH_OPEN_CONFIG.limits.maxOpenInterval}秒之间`);
  }
  
  if (params.urls.length === 0) {
    errors.push('请输入至少一个URL');
  }
  
  if (params.urls.length > BATCH_OPEN_CONFIG.limits.maxUrls) {
    errors.push(`URL数量不能超过${BATCH_OPEN_CONFIG.limits.maxUrls}个`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// 代理配置验证
export function validateProxyConfiguration(config: {
  proxyUrl?: string;
  requiredCount?: number;
  strategy?: string;
}): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 验证代理URL
  if (config.proxyUrl) {
    try {
      const url = new URL(config.proxyUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('代理URL必须使用HTTP或HTTPS协议');
      }
    } catch (error) {
      errors.push('代理URL格式无效');
    }
  }
  
  // 验证代理数量
  if (config.requiredCount !== undefined) {
    if (config.requiredCount < BATCH_OPEN_CONFIG.proxy.allocation.minProxyLimit) {
      errors.push(`代理数量不能少于${BATCH_OPEN_CONFIG.proxy.allocation.minProxyLimit}个`);
    }
    if (config.requiredCount > BATCH_OPEN_CONFIG.proxy.allocation.maxProxyLimit) {
      warnings.push(`代理数量超过推荐上限${BATCH_OPEN_CONFIG.proxy.allocation.maxProxyLimit}个，可能影响性能`);
    }
  }
  
  // 验证分配策略
  if (config.strategy && !['optimized', 'fifo', 'round-robin'].includes(config.strategy)) {
    errors.push('无效的代理分配策略');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// 获取代理获取配置
export function getProxyAcquisitionConfig() {
  return {
    ...BATCH_OPEN_CONFIG.proxy.acquisition,
    timeout: BATCH_OPEN_CONFIG.proxy.fetchTimeout,
    validation: BATCH_OPEN_CONFIG.proxy.validation
  };
}

// 获取代理池配置
export function getProxyPoolConfig() {
  return {
    ...BATCH_OPEN_CONFIG.proxy.pool,
    monitoring: BATCH_OPEN_CONFIG.proxy.monitoring
  };
}

// 获取代理分配配置
export function getProxyAllocationConfig() {
  return {
    ...BATCH_OPEN_CONFIG.proxy.allocation,
    concurrencyLimit: BATCH_OPEN_CONFIG.limits.maxConcurrent
  };
}

// 获取代理错误处理配置
export function getProxyErrorHandlingConfig() {
  return {
    ...BATCH_OPEN_CONFIG.proxy.errorHandling,
    maxRetries: BATCH_OPEN_CONFIG.limits.maxRetries
  };
}

// 动态调整代理配置
export function getAdaptiveProxyConfig(params: {
  urlCount: number;
  totalVisits: number;
  priority: 'high' | 'medium' | 'low';
}) {
  const baseConfig = BATCH_OPEN_CONFIG.proxy;
  
  // 根据URL数量和访问次数调整配置
  const adjustedConfig = JSON.parse(JSON.stringify(baseConfig));
  
  if (params.urlCount > 50 || params.totalVisits > 200) {
    // 大量任务：增加超时时间和重试次数
    adjustedConfig.acquisition.batchTimeout = baseConfig.acquisition.batchTimeout * 1.5;
    adjustedConfig.acquisition.maxBatchAttempts = Math.min(baseConfig.acquisition.maxBatchAttempts + 1, 5);
    adjustedConfig.pool.maxPoolSize = Math.min(baseConfig.pool.maxPoolSize * 1.2, 1000);
  } else if (params.urlCount < 10 && params.totalVisits < 50) {
    // 小量任务：减少超时时间，提高响应速度
    adjustedConfig.acquisition.batchTimeout = baseConfig.acquisition.batchTimeout * 0.8;
    adjustedConfig.pool.lowThreshold = Math.max(baseConfig.pool.lowThreshold * 0.5, 5);
  }
  
  // 根据优先级调整
  if (params.priority === 'high') {
    adjustedConfig.acquisition.maxBatchAttempts = Math.min(baseConfig.acquisition.maxBatchAttempts + 1, 5);
    adjustedConfig.validation.retryAttempts = Math.min(baseConfig.validation.retryAttempts + 1, 3);
  } else if (params.priority === 'low') {
    adjustedConfig.acquisition.batchTimeout = baseConfig.acquisition.batchTimeout * 1.2;
    adjustedConfig.validation.timeout = baseConfig.validation.timeout * 1.5;
  }
  
  return adjustedConfig;
}

// 获取代理配置常量
export const PROXY_CONFIG_CONSTANTS = {
  PHASES: {
    VALIDATION: 'proxy-validation',
    ACQUISITION: 'proxy-acquisition',
    DISTRIBUTION: 'proxy-distribution',
    CACHING: 'proxy-caching',
    HEALTH_CHECK: 'proxy-health-check',
    REPLENISHMENT: 'proxy-replenishment',
    BATCH_EXECUTION: 'batch-execution'
  },
  
  STRATEGIES: {
    OPTIMIZED: 'optimized',
    FIFO: 'fifo',
    ROUND_ROBIN: 'round-robin'
  },
  
  SOURCES: {
    CACHE: 'cache',
    BATCH: 'batch',
    INDIVIDUAL: 'individual'
  },
  
  ERROR_TYPES: {
    TEMPORARY: 'temporary',
    PERMANENT: 'permanent',
    NETWORK: 'network',
    AUTHENTICATION: 'authentication',
    TIMEOUT: 'timeout',
    RATE_LIMIT: 'rate_limit'
  }
} as const;