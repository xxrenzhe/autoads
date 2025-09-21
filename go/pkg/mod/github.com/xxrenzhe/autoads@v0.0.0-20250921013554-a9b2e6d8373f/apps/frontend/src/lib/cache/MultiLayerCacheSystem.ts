/**
 * Multi-Layer Caching Integration
 * 多层缓存系统集成，统一管理所有缓存服务
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { UnifiedCacheManager, CacheOptions } from './UnifiedCacheManager';
import { CacheWarmer, PrewarmConfig, PREDEFINED_STRATEGIES } from './CacheWarmer';
import { CacheMonitor } from './CacheMonitor';
import { Cache, CacheConfig } from '@/lib/core/Cache';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('MultiLayerCache');

/**
 * 缓存层配置接口
 */
export interface CacheLayerConfig {
  l1: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
  };
  l2: {
    enabled: boolean;
    redis?: {
      url: string;
      db: number;
    };
    ttl: number;
  };
  l3: {
    enabled: boolean;
    storagePath: string;
    maxSize: number;
    ttl: number;
  };
  l4: {
    enabled: boolean;
    strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
    ttl: number;
  };
}

/**
 * 多层缓存系统集成类
 */
export class MultiLayerCacheSystem {
  private unifiedCacheManager: UnifiedCacheManager;
  private cacheWarmer: CacheWarmer;
  private cacheMonitor: CacheMonitor;
  private isInitialized: boolean = false;
  private config: CacheLayerConfig;

  constructor(config: CacheLayerConfig) {
    this.config = config;
    this.unifiedCacheManager = this.createUnifiedCacheManager();
    this.cacheWarmer = this.createCacheWarmer();
    this.cacheMonitor = this.createCacheMonitor();
  }

  /**
   * 初始化缓存系统
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('多层缓存系统已经初始化');
      return;
    }

    try {
      logger.info('开始初始化多层缓存系统');

      // 初始化统一缓存管理器
      await this.initializeUnifiedCache();
      
      // 初始化缓存预热服务
      await this.initializeCacheWarmer();
      
      // 初始化缓存监控服务
      await this.initializeCacheMonitor();

      this.isInitialized = true;
      logger.info('多层缓存系统初始化完成');

    } catch (error) {
      logger.error('多层缓存系统初始化失败', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 获取缓存值
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    this.ensureInitialized();
    return this.unifiedCacheManager.get<T>(key);
  }

  /**
   * 设置缓存值
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    this.ensureInitialized();
    return this.unifiedCacheManager.set<T>(key, value, options.ttl);
  }

  /**
   * 缓存失效
   */
  async invalidate(key: string): Promise<boolean> {
    this.ensureInitialized();
    return this.unifiedCacheManager.invalidate(key);
  }

  /**
   * 预热缓存
   */
  async prewarm(keys: string[], options: CacheOptions = {}): Promise<string> {
    this.ensureInitialized();
    return this.cacheWarmer.triggerManualPrewarm(keys, options);
  }

  /**
   * 获取缓存统计信息
   */
  getStatistics() {
    this.ensureInitialized();
    return this.unifiedCacheManager.getStatistics();
  }

  /**
   * 获取缓存健康状态
   */
  getHealthStatus() {
    this.ensureInitialized();
    return this.unifiedCacheManager.getHealthStatus();
  }

  /**
   * 获取监控指标
   */
  getCurrentMetrics() {
    this.ensureInitialized();
    return this.cacheMonitor.getCurrentMetrics();
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts() {
    this.ensureInitialized();
    return this.cacheMonitor.getActiveAlerts();
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(period: '1h' | '6h' | '24h' | '7d' = '24h') {
    this.ensureInitialized();
    return this.cacheMonitor.generatePerformanceReport(period);
  }

  /**
   * 启动所有服务
   */
  async start(): Promise<void> {
    this.ensureInitialized();
    
    logger.info('启动多层缓存系统服务');
    
    // 启动缓存监控
    this.cacheMonitor.start();
    
    // 启动缓存预热
    await this.cacheWarmer.start();
    
    logger.info('多层缓存系统服务已启动');
  }

  /**
   * 停止所有服务
   */
  async stop(): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('多层缓存系统未初始化');
      return;
    }

    logger.info('停止多层缓存系统服务');
    
    // 停止缓存预热
    await this.cacheWarmer.stop();
    
    // 停止缓存监控
    this.cacheMonitor.stop();
    
    logger.info('多层缓存系统服务已停止');
  }

  /**
   * 重置缓存系统
   */
  async reset(): Promise<void> {
    logger.info('重置多层缓存系统');
    
    // 停止所有服务
    await this.stop();
    
    // 清空所有缓存
    await this.unifiedCacheManager.clearAll();
    
    // 重新初始化
    await this.initialize();
    
    logger.info('多层缓存系统重置完成');
  }

  /**
   * 获取系统状态
   */
  getSystemStatus() {
    return {
      initialized: this.isInitialized,
      config: this.config,
      statistics: this.isInitialized ? this.getStatistics() : null,
      health: this.isInitialized ? this.getHealthStatus() : null,
      activeAlerts: this.isInitialized ? this.getActiveAlerts().length : 0,
      uptime: this.isInitialized ? process.uptime() : 0
    };
  }

  // 私有方法

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('多层缓存系统未初始化');
    }
  }

  private createUnifiedCacheManager(): UnifiedCacheManager {
    return UnifiedCacheManager.getInstance();
  }

  private createCacheWarmer(): CacheWarmer {
    const prewarmConfig: PrewarmConfig = {
      enabled: true,
      strategies: PREDEFINED_STRATEGIES,
      criticalKeys: [],
      batchSize: 10,
      interval: 5 * 60 * 1000, // 5分钟
      maxConcurrent: 3
    };

    return new CacheWarmer(this.unifiedCacheManager, prewarmConfig);
  }

  private createCacheMonitor(): CacheMonitor {
    return new CacheMonitor(this.unifiedCacheManager);
  }

  private async initializeUnifiedCache(): Promise<void> {
    logger.info('初始化统一缓存管理器');
    
    // 测试缓存操作
    await this.unifiedCacheManager.set('test-key', 'test-value', 60000);
    const testValue = await this.unifiedCacheManager.get('test-key');
    
    if (testValue !== 'test-value') {
      throw new Error('统一缓存管理器初始化失败');
    }
    
    // 清理测试数据
    await this.unifiedCacheManager.invalidate('test-key');
    
    logger.info('统一缓存管理器初始化完成');
  }

  private async initializeCacheWarmer(): Promise<void> {
    logger.info('初始化缓存预热服务');
    
    // 添加预热策略
    PREDEFINED_STRATEGIES.forEach((strategy: any) => {
      this.cacheWarmer.addStrategy(strategy);
    });
    
    logger.info('缓存预热服务初始化完成');
  }

  private async initializeCacheMonitor(): Promise<void> {
    logger.info('初始化缓存监控服务');
    
    // 添加自定义告警规则
    this.cacheMonitor.addAlertRule({
      id: 'cache_system_error',
      name: '缓存系统错误',
      description: '当缓存系统出现错误时触发告警',
      condition: 'error_rate_high',
      threshold: 0.1,
      severity: 'critical',
      enabled: true,
      cooldown: 2 * 60 * 1000
    });
    
    logger.info('缓存监控服务初始化完成');
  }
}

/**
 * 创建默认的多层缓存系统
 */
export function createMultiLayerCacheSystem(config?: Partial<CacheLayerConfig>): MultiLayerCacheSystem {
  const defaultConfig: CacheLayerConfig = {
    l1: {
      enabled: true,
      maxSize: 1000,
      ttl: 300000 // 5分钟
    },
    l2: {
      enabled: !!process.env.REDIS_URL, // 只有配置了REDIS_URL才启用Redis层
      redis: {
        url: process.env.REDIS_URL || '', // 统一使用REDIS_URL
        db: parseInt(process.env.REDIS_DB || '0')
      },
      ttl: 1800000 // 30分钟
    },
    l3: {
      enabled: true,
      storagePath: './cache',
      maxSize: 10000,
      ttl: 3600000 // 1小时
    },
    l4: {
      enabled: true,
      strategy: 'stale-while-revalidate',
      ttl: 86400000 // 24小时
    }
  };

  return new MultiLayerCacheSystem({ ...defaultConfig, ...config });
}

/**
 * 全局多层缓存系统实例
 */
let globalCacheSystem: MultiLayerCacheSystem | null = null;

/**
 * 获取全局多层缓存系统实例
 */
export function getGlobalCacheSystem(): MultiLayerCacheSystem {
  if (!globalCacheSystem) {
    globalCacheSystem = createMultiLayerCacheSystem();
  }
  return globalCacheSystem;
}

/**
 * 初始化全局缓存系统
 */
export async function initializeGlobalCacheSystem(config?: Partial<CacheLayerConfig>): Promise<MultiLayerCacheSystem> {
  globalCacheSystem = createMultiLayerCacheSystem(config);
  await globalCacheSystem.initialize();
  await globalCacheSystem.start();
  return globalCacheSystem;
}

/**
 * 便捷的缓存操作函数
 */

/**
 * 获取缓存值
 */
export async function cacheGet<T>(key: string, options?: CacheOptions): Promise<T | null> {
  const cacheSystem = getGlobalCacheSystem();
  return cacheSystem.get<T>(key, options);
}

/**
 * 设置缓存值
 */
export async function cacheSet<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
  const cacheSystem = getGlobalCacheSystem();
  return cacheSystem.set<T>(key, value, options);
}

/**
 * 缓存失效
 */
export async function cacheInvalidate(key: string, options?: any): Promise<void> {
  const cacheSystem = getGlobalCacheSystem();
  await cacheSystem.invalidate(key);
}

/**
 * 预热缓存
 */
export async function cachePrewarm(keys: string[], options?: CacheOptions): Promise<string> {
  const cacheSystem = getGlobalCacheSystem();
  return cacheSystem.prewarm(keys, options);
}

/**
 * 获取缓存统计
 */
export function getCacheStatistics() {
  const cacheSystem = getGlobalCacheSystem();
  return cacheSystem.getStatistics();
}

/**
 * 获取缓存健康状态
 */
export function getCacheHealthStatus() {
  const cacheSystem = getGlobalCacheSystem();
  return cacheSystem.getHealthStatus();
}