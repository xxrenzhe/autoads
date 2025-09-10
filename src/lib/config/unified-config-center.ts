/**
 * Unified Configuration Center
 * 统一配置管理中心，集中管理所有配置
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('UnifiedConfigCenter');

// 配置类型定义
export interface AppConfig {
  site: SiteConfig;
  api: ApiConfig;
  urlProcessing: UrlProcessingConfig;
  performance: PerformanceConfig;
  security: SecurityConfig;
  features: FeatureConfig;
  proxy: ProxyConfig;
  cache: CacheConfig;
  monitoring: MonitoringConfig;
}

export interface SiteConfig {
  name: string;
  title: string;
  description: string;
  url: string;
  email: string;
  github: string;
  twitter: string;
}

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  rateLimit: {
    requests: number;
    window: number;
  };
}

export interface UrlProcessingConfig {
  maxUrls: number;
  batchSize: number;
  timeout: number;
  maxRetries: number;
  userAgent: string;
}

export interface PerformanceConfig {
  maxConcurrentRequests: number;
  requestDelay: number;
  cacheTimeout: number;
  maxCacheSize: number;
}

export interface SecurityConfig {
  allowedDomains: string[];
  blockedDomains: string[];
  maxUrlLength: number;
  validateUrls: boolean;
  sanitizeInput: boolean;
}

export interface FeatureConfig {
  urlAnalysis: boolean;
  siteRanking: boolean;
  dataExport: boolean;
  chromeExtension: boolean;
  manualInput: boolean;
  realTimeUpdates: boolean;
  advancedAnalytics: boolean;
}

export interface ProxyConfig {
  enabled: boolean;
  defaultStrategy: 'optimized' | 'fifo' | 'round-robin' | 'least-used';
  maxRetries: number;
  timeout: number;
  concurrency: number;
  bufferFactor: number;
  healthCheck: {
    enabled: boolean;
    interval: number;
    timeout: number;
  };
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

export interface CacheConfig {
  enabled: boolean;
  provider: 'memory' | 'redis' | 'both';
  redis: {
    url: string;
    password?: string;
    db: number;
    connectTimeout: number;
  };
  memory: {
    maxSize: number;
    ttl: number;
  };
}

export interface MonitoringConfig {
  enabled: boolean;
  metrics: {
    enabled: boolean;
    interval: number;
  };
  health: {
    enabled: boolean;
    interval: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
  };
}

// 默认配置
const DEFAULT_CONFIG: AppConfig = {
  site: {
    name: 'AutoAds',
    title: 'AutoAds - 一站式自动化营销平台 | 真实点击、网站排名分析、智能广告投放',
    description: 'AutoAds是一站式自动化营销平台，提供真实点击、网站排名分析、智能广告投放三大核心功能。',
    url: 'https://autoads.dev',
    email: 'contact@autoads.dev',
    github: 'https://github.com/autoads-dev',
    twitter: 'https://twitter.com/autoads_dev'
  },
  
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.autoads.dev',
    timeout: parseInt(process.env.API_TIMEOUT || '45000'),
    retries: 3,
    rateLimit: {
      requests: 100,
      window: 60000
    }
  },
  
  urlProcessing: {
    maxUrls: 1000,
    batchSize: 50,
    timeout: parseInt(process.env.HTTP_TIMEOUT || '30000'),
    maxRetries: 3,
    userAgent: 'AutoAds-Dev/1.0 (Professional URL Analysis Tool)'
  },
  
  performance: {
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '10'),
    requestDelay: 100,
    cacheTimeout: 300000,
    maxCacheSize: 1000
  },
  
  security: {
    allowedDomains: ['*'],
    blockedDomains: [],
    maxUrlLength: 2048,
    validateUrls: true,
    sanitizeInput: true
  },
  
  features: {
    urlAnalysis: true,
    siteRanking: true,
    dataExport: true,
    chromeExtension: true,
    manualInput: true,
    realTimeUpdates: true,
    advancedAnalytics: false
  },
  
  proxy: {
    enabled: true,
    defaultStrategy: 'optimized',
    maxRetries: parseInt(process.env.PROXY_MAX_RETRIES || '5'),
    timeout: parseInt(process.env.PROXY_TIMEOUT || '60000'),
    concurrency: 3,
    bufferFactor: 1.2,
    healthCheck: {
      enabled: true,
      interval: 10 * 60 * 1000,
      timeout: 10000
    },
    cache: {
      enabled: true,
      ttl: 30 * 60 * 1000,
      maxSize: 100
    }
  },
  
  cache: {
    enabled: true,
    provider: 'both',
    redis: {
      url: process.env.REDIS_URL || '',
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      connectTimeout: 10000
    },
    memory: {
      maxSize: 1000,
      ttl: 30 * 60 * 1000
    }
  },
  
  monitoring: {
    enabled: true,
    metrics: {
      enabled: true,
      interval: 60000
    },
    health: {
      enabled: true,
      interval: 30000
    },
    logging: {
      level: 'info',
      format: 'json'
    }
  }
};

// 配置验证器
export class ConfigValidator {
  static validate(config: Partial<AppConfig>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      // 验证站点配置
      if (config.site) {
        if (!config.site.name || config.site.name.trim() === '') {
          errors.push('站点名称不能为空');
        }
        
        if (!config.site.url || !this.isValidUrl(config.site.url)) {
          errors.push('站点URL无效');
        }
      }
      
      // 验证API配置
      if (config.api) {
        if (config.api.timeout && (config.api.timeout < 1000 || config.api.timeout > 300000)) {
          errors.push('API超时时间必须在1000-300000毫秒之间');
        }
        
        if (config.api.retries && (config.api.retries < 0 || config.api.retries > 10)) {
          errors.push('API重试次数必须在0-10之间');
        }
      }
      
      // 验证URL处理配置
      if (config.urlProcessing) {
        if (config.urlProcessing.maxUrls && (config.urlProcessing.maxUrls < 1 || config.urlProcessing.maxUrls > 10000)) {
          errors.push('URL最大数量必须在1-10000之间');
        }
        
        if (config.urlProcessing.batchSize && (config.urlProcessing.batchSize < 1 || config.urlProcessing.batchSize > 1000)) {
          errors.push('批处理大小必须在1-1000之间');
        }
      }
      
      // 验证性能配置
      if (config.performance) {
        if (config.performance.maxConcurrentRequests && (config.performance.maxConcurrentRequests < 1 || config.performance.maxConcurrentRequests > 100)) {
          errors.push('最大并发请求数必须在1-100之间');
        }
      }
      
      // 验证代理配置
      if (config.proxy) {
        if (config.proxy.maxRetries && (config.proxy.maxRetries < 0 || config.proxy.maxRetries > 10)) {
          errors.push('代理最大重试次数必须在0-10之间');
        }
        
        if (config.proxy.timeout && (config.proxy.timeout < 1000 || config.proxy.timeout > 300000)) {
          errors.push('代理超时时间必须在1000-300000毫秒之间');
        }
      }
      
      // 验证缓存配置
      if (config.cache) {
        if (config.cache.redis && config.cache.redis.url && !this.isValidRedisUrl(config.cache.redis.url)) {
          errors.push('Redis URL格式无效');
        }
      }
      
    } catch (error) {
      errors.push(`配置验证失败: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  private static isValidRedisUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'redis:' || parsed.protocol === 'rediss:';
    } catch {
      return false;
    }
  }
}

// 统一配置管理中心类
export class UnifiedConfigCenter {
  private config: AppConfig;
  private configPath: string;
  private watchers: Map<string, Set<(config: AppConfig) => void>> = new Map();
  private isInitialized: boolean = false;

  constructor(configPath: string = '/config/app-config.json') {
    this.configPath = configPath;
    this.config = { ...DEFAULT_CONFIG };
    
    logger.info('统一配置管理中心初始化', { configPath });
  }

  /**
   * 初始化配置中心
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('配置中心已经初始化');
      return;
    }

    try {
      // 加载配置
      await this.loadConfig();
      
      // 验证配置
      const validation = ConfigValidator.validate(this.config);
      if (!validation.isValid) {
        throw new EnhancedError('配置验证失败', {
          code: 'CONFIG_VALIDATION_FAILED',
          details: { errors: validation.errors }
        });
      }
      
      this.isInitialized = true;
      logger.info('配置中心初始化完成');
      
    } catch (error) {
      logger.error('配置中心初始化失败', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 加载配置
   */
  private async loadConfig(): Promise<void> {
    try {
      // 在实际实现中，这里可以从文件、数据库或环境变量加载配置
      // 现在使用环境变量覆盖默认配置
      this.loadFromEnvironment();
      
      logger.info('配置加载完成');
      
    } catch (error) {
      logger.error('配置加载失败', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 从环境变量加载配置
   */
  private loadFromEnvironment(): void {
    // API配置
    if (process.env.NEXT_PUBLIC_API_BASE_URL) {
      this.config.api.baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    }
    
    if (process.env.API_TIMEOUT) {
      this.config.api.timeout = parseInt(process.env.API_TIMEOUT);
    }
    
    // URL处理配置
    if (process.env.MAX_URLS) {
      this.config.urlProcessing.maxUrls = parseInt(process.env.MAX_URLS);
    }
    
    if (process.env.BATCH_SIZE) {
      this.config.urlProcessing.batchSize = parseInt(process.env.BATCH_SIZE);
    }
    
    // 性能配置
    if (process.env.MAX_CONCURRENT_REQUESTS) {
      this.config.performance.maxConcurrentRequests = parseInt(process.env.MAX_CONCURRENT_REQUESTS);
    }
    
    // 缓存配置
    if (process.env.REDIS_URL) {
      this.config.cache.redis.url = process.env.REDIS_URL;
    }
    
    if (process.env.REDIS_PASSWORD) {
      this.config.cache.redis.password = process.env.REDIS_PASSWORD;
    }
    
    if (process.env.REDIS_DB) {
      this.config.cache.redis.db = parseInt(process.env.REDIS_DB);
    }
    
    // 监控配置
    if (process.env.LOG_LEVEL) {
      this.config.monitoring.logging.level = process.env.LOG_LEVEL as any;
    }
    
    // 功能开关
    if (process.env.ENABLE_ADVANCED_ANALYTICS) {
      this.config.features.advancedAnalytics = process.env.ENABLE_ADVANCED_ANALYTICS === 'true';
    }
  }

  /**
   * 获取配置
   */
  getConfig(): AppConfig {
    if (!this.isInitialized) {
      throw new EnhancedError('配置中心未初始化', {
        code: 'CONFIG_NOT_INITIALIZED'
      });
    }
    
    return { ...this.config };
  }

  /**
   * 获取特定配置部分
   */
  getConfigSection<K extends keyof AppConfig>(section: K): AppConfig[K] {
    return this.getConfig()[section];
  }

  /**
   * 更新配置
   */
  async updateConfig(updates: Partial<AppConfig>): Promise<void> {
    try {
      // 验证更新
      const validation = ConfigValidator.validate(updates);
      if (!validation.isValid) {
        throw new EnhancedError('配置更新验证失败', {
          code: 'CONFIG_UPDATE_VALIDATION_FAILED',
          details: { errors: validation.errors }
        });
      }
      
      // 合并配置
      this.config = this.mergeConfig(this.config, updates);
      
      // 通知观察者
      this.notifyWatchers();
      
      logger.info('配置更新完成', { updates });
      
    } catch (error) {
      logger.error('配置更新失败', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 合并配置
   */
  private mergeConfig(base: AppConfig, updates: Partial<AppConfig>): AppConfig {
    const merged = { ...base };
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
        merged[key as keyof AppConfig] = {
          ...merged[key as keyof AppConfig],
          ...value
        } as any;
      } else {
        merged[key as keyof AppConfig] = value as any;
      }
    }
    
    return merged;
  }

  /**
   * 重置配置
   */
  async resetConfig(): Promise<void> {
    try {
      this.config = { ...DEFAULT_CONFIG };
      this.notifyWatchers();
      
      logger.info('配置重置完成');
      
    } catch (error) {
      logger.error('配置重置失败', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 保存配置
   */
  async saveConfig(): Promise<void> {
    try {
      // 在实际实现中，这里可以保存到文件或数据库
      logger.info('配置保存完成');
      
    } catch (error) {
      logger.error('配置保存失败', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 监听配置变化
   */
  watchConfig(callback: (config: AppConfig) => void): () => void {
    const id = Math.random().toString(36).substr(2, 9);
    
    if (!this.watchers.has('config')) {
      this.watchers.set('config', new Set());
    }
    
    this.watchers.get('config')!.add(callback);
    
    // 返回取消监听的函数
    return () => {
      const watchers = this.watchers.get('config');
      if (watchers) {
        watchers.delete(callback);
        if (watchers.size === 0) {
          this.watchers.delete('config');
        }
      }
    };
  }

  /**
   * 通知观察者
   */
  private notifyWatchers(): void {
    const watchers = this.watchers.get('config');
    if (watchers) {
      const config = this.getConfig();
      watchers.forEach(callback => {
        try {
          callback(config);
        } catch (error) {
          logger.error('配置观察者回调失败', error instanceof Error ? error : new Error(String(error)));
        }
      });
    }
  }

  /**
   * 验证配置
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    return ConfigValidator.validate(this.config);
  }

  /**
   * 获取配置状态
   */
  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      configPath: this.configPath,
      watcherCount: this.watchers.size,
      validation: this.validateConfig(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// 创建全局实例
let configCenterInstance: UnifiedConfigCenter | null = null;

export function getConfigCenter(): UnifiedConfigCenter {
  if (!configCenterInstance) {
    configCenterInstance = new UnifiedConfigCenter();
  }
  return configCenterInstance;
}

export function createConfigCenter(configPath?: string): UnifiedConfigCenter {
  return new UnifiedConfigCenter(configPath);
}

// 便捷函数
export async function initializeConfig(): Promise<UnifiedConfigCenter> {
  const center = getConfigCenter();
  await center.initialize();
  return center;
}

export function getAppConfig(): AppConfig {
  return getConfigCenter().getConfig();
}

export function getConfigSection<K extends keyof AppConfig>(section: K): AppConfig[K] {
  return getConfigCenter().getConfigSection(section);
}