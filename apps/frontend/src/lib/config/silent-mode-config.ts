/**
 * 静默模式配置模块
 * 为静默批量访问模式提供最优化的配置参数
 */

export interface SilentModeConfig {
  // 代理获取配置
  proxy: {
    // 并发获取代理的数量
    fetchConcurrency: number;
    // 代理获取超时时间（毫秒）
    fetchTimeout: number;
    // 代理获取最大尝试次数
    maxFetchAttempts: number;
    // 智能缓存请求数量倍数
    cacheRequestMultiplier: number;
    // 最大缓存请求数量
    maxCacheRequest: number;
  };
  
  // 代理选择配置
  selection: {
    // 代理评分权重配置
    scoringWeights: {
      responseTime: number;     // 响应时间权重
      useFrequency: number;     // 使用频率权重
      idleTime: number;        // 闲置时间权重
      healthStatus: number;    // 健康状态权重
      urlUniqueness: number;   // URL唯一性权重
    };
    
    // 代理选择策略
    strategy: {
      // 是否启用智能代理选择
      enableSmartSelection: boolean;
      // 冷却时间（毫秒）
      coolingTime: number;
      // 是否强制URL唯一性
      enforceUrlUniqueness: boolean;
    };
  };
  
  // 缓存配置
  cache: {
    // Redis缓存TTL（毫秒）
    redisTTL: number;
    // 内存缓存TTL（毫秒）
    memoryTTL: number;
    // 缓存健康率阈值
    healthRateThreshold: number;
    // 缓存补充触发倍数
    supplementMultiplier: number;
    // 预热并发数量
    preheatConcurrency: number;
    // 补充分批大小
    supplementBatchSize: number;
  };
  
  // 执行配置
  execution: {
    // 默认并发限制
    defaultConcurrency: number;
    // 最大并发限制
    maxConcurrency: number;
    // 访问超时时间（毫秒）
    visitTimeout: number;
    // 重试次数
    retryAttempts: number;
    // 重试基础延迟（毫秒）
    retryBaseDelay: number;
  };
  
  // 性能监控配置
  monitoring: {
    // 是否启用性能监控
    enablePerformanceMonitoring: boolean;
    // 性能指标收集间隔（毫秒）
    metricsInterval: number;
    // 是否启用详细日志
    enableVerboseLogging: boolean;
  };
}

/**
 * 静默模式默认配置
 * 针对静默模式优化的参数设置
 */
export const DEFAULT_SILENT_MODE_CONFIG: SilentModeConfig = {
  proxy: {
    fetchConcurrency: 2,        // 降低并发以避免IPRocket API限制
    fetchTimeout: 30000,        // 30秒获取超时
    maxFetchAttempts: 5,        // 减少尝试次数
    cacheRequestMultiplier: 2,  // 请求2倍数量的缓存代理
    maxCacheRequest: 50,       // 最多请求50个缓存代理
  },
  
  selection: {
    scoringWeights: {
      responseTime: 0.25,      // 响应时间权重 25%
      useFrequency: 0.20,      // 使用频率权重 20%
      idleTime: 0.20,          // 闲置时间权重 20%
      healthStatus: 0.25,      // 健康状态权重 25%
      urlUniqueness: 0.10,     // URL唯一性权重 10%
    },
    strategy: {
      enableSmartSelection: true,  // 启用智能代理选择
      coolingTime: 5000,           // 5秒冷却时间
      enforceUrlUniqueness: true,  // 强制URL唯一性
    },
  },
  
  cache: {
    redisTTL: 30 * 60 * 1000,    // Redis缓存30分钟
    memoryTTL: 15 * 60 * 1000,   // 内存缓存15分钟
    healthRateThreshold: 0.6,   // 60%健康率阈值
    supplementMultiplier: 1.2,   // 1.2倍补充触发
    preheatConcurrency: 5,       // 预热并发5个（优化：增加预热并发）
    supplementBatchSize: 15,     // 补充分批15个（优化：增加分批大小）
  },
  
  execution: {
    defaultConcurrency: 4,       // 默认并发4个
    maxConcurrency: 8,           // 最大并发8个
    visitTimeout: 60000,        // 60秒访问超时
    retryAttempts: 2,            // 重试2次
    retryBaseDelay: 1000,        // 基础延迟1秒
  },
  
  monitoring: {
    enablePerformanceMonitoring: true,  // 启用性能监控
    metricsInterval: 5000,              // 5秒收集间隔
    enableVerboseLogging: true,         // 启用详细日志
  },
};

/**
 * 生产环境静默模式配置
 * 更保守的设置，确保稳定性
 */
export const PRODUCTION_SILENT_MODE_CONFIG: SilentModeConfig = {
  ...DEFAULT_SILENT_MODE_CONFIG,
  proxy: {
    ...DEFAULT_SILENT_MODE_CONFIG.proxy,
    fetchConcurrency: 2,        // 最保守的并发设置
    fetchTimeout: 45000,        // 增加超时时间
    maxFetchAttempts: 4,        // 减少尝试次数
  },
  execution: {
    ...DEFAULT_SILENT_MODE_CONFIG.execution,
    defaultConcurrency: 3,       // 更保守的并发设置
    maxConcurrency: 6,
    visitTimeout: 90000,        // 更长的超时时间
  },
};

/**
 * 开发环境静默模式配置
 * 更激进的设置，便于测试和调试
 */
export const DEVELOPMENT_SILENT_MODE_CONFIG: SilentModeConfig = {
  ...DEFAULT_SILENT_MODE_CONFIG,
  proxy: {
    ...DEFAULT_SILENT_MODE_CONFIG.proxy,
    fetchConcurrency: 3,        // 开发环境适度增加并发
    fetchTimeout: 30000,        // 保持30秒超时
    maxFetchAttempts: 6,        // 适度增加尝试次数
  },
  monitoring: {
    ...DEFAULT_SILENT_MODE_CONFIG.monitoring,
    enableVerboseLogging: true,  // 启用详细日志
    metricsInterval: 2000,       // 更频繁的指标收集
  },
};

/**
 * 获取当前环境的静默模式配置
 */
export function getSilentModeConfig(): SilentModeConfig {
  const environment = process.env.NODE_ENV || 'development';
  const vercelEnv = process.env.VERCEL_ENV;
  
  // Vercel production 环境
  if (vercelEnv === 'production') {
    return PRODUCTION_SILENT_MODE_CONFIG;
  }
  
  // 本地生产环境
  if (environment === 'production') {
    return PRODUCTION_SILENT_MODE_CONFIG;
  }
  
  // 开发环境
  if (environment === 'development') {
    return DEVELOPMENT_SILENT_MODE_CONFIG;
  }
  
  // 默认配置
  return DEFAULT_SILENT_MODE_CONFIG;
}

/**
 * 动态调整配置基于系统资源
 */
export function getAdaptiveSilentModeConfig(
  baseConfig: SilentModeConfig,
  systemLoad?: number
): SilentModeConfig {
  if (!systemLoad) {
    return baseConfig;
  }
  
  const config = { ...baseConfig };
  
  // 基于系统负载动态调整
  if (systemLoad > 0.8) {
    // 高负载，降低并发
    config.proxy.fetchConcurrency = Math.max(2, Math.floor(config.proxy.fetchConcurrency * 0.6));
    config.execution.defaultConcurrency = Math.max(2, Math.floor(config.execution.defaultConcurrency * 0.7));
    config.execution.maxConcurrency = Math.max(4, Math.floor(config.execution.maxConcurrency * 0.7));
  } else if (systemLoad > 0.6) {
    // 中等负载，适度调整
    config.proxy.fetchConcurrency = Math.max(3, Math.floor(config.proxy.fetchConcurrency * 0.8));
    config.execution.defaultConcurrency = Math.max(3, Math.floor(config.execution.defaultConcurrency * 0.85));
  } else if (systemLoad < 0.3) {
    // 低负载，可以更激进
    config.proxy.fetchConcurrency = Math.min(10, Math.floor(config.proxy.fetchConcurrency * 1.2));
    config.execution.defaultConcurrency = Math.min(6, Math.floor(config.execution.defaultConcurrency * 1.15));
  }
  
  return config;
}

/**
 * 验证配置的有效性
 */
export function validateSilentModeConfig(config: SilentModeConfig): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 验证代理配置
  if (config.proxy.fetchConcurrency < 1 || config.proxy.fetchConcurrency > 20) {
    errors.push('代理获取并发数必须在1-20之间');
  }
  
  if (config.proxy.fetchTimeout < 10000 || config.proxy.fetchTimeout > 120000) {
    errors.push('代理获取超时时间必须在10-120秒之间');
  }
  
  // 验证评分权重
  const totalWeight = Object.values(config.selection.scoringWeights).reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(totalWeight - 1.0) > 0.01) {
    errors.push('代理评分权重总和必须等于1.0');
  }
  
  // 验证执行配置
  if (config.execution.defaultConcurrency < 1 || config.execution.defaultConcurrency > 20) {
    errors.push('默认并发数必须在1-20之间');
  }
  
  if (config.execution.visitTimeout < 30000 || config.execution.visitTimeout > 180000) {
    errors.push('访问超时时间必须在30-180秒之间');
  }
  
  // 生成警告
  if (config.proxy.fetchConcurrency > 8) {
    warnings.push('代理获取并发数较高，可能会对代理服务造成压力');
  }
  
  if (config.execution.defaultConcurrency > 6) {
    warnings.push('并发数较高，可能会增加系统负载');
  }
  
  if (config.cache.healthRateThreshold < 0.5) {
    warnings.push('缓存健康率阈值较低，可能会频繁触发补充机制');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 导出配置类型和工具函数
 */