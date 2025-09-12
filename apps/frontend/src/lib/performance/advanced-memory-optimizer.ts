/**
 * 高级内存优化器
 * 针对2C4G环境的深度内存优化
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { getOptimizedRedisClient } from '@/lib/cache/optimized-redis-client';

const logger = createLogger('AdvancedMemoryOptimizer');

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
}

interface OptimizationConfig {
  maxHeapSize: number;        // 最大堆内存 (MB)
  gcThreshold: number;        // GC触发阈值 (MB)
  cacheCleanupInterval: number; // 缓存清理间隔 (ms)
  memoryCheckInterval: number;  // 内存检查间隔 (ms)
  emergencyThreshold: number;   // 紧急清理阈值 (MB)
}

class AdvancedMemoryOptimizer {
  private config: OptimizationConfig;
  private memoryCheckTimer: NodeJS.Timeout | null = null;
  private cacheCleanupTimer: NodeJS.Timeout | null = null;
  private isOptimizing = false;
  private memoryHistory: MemoryStats[] = [];
  private maxHistorySize = 10;

  constructor(config: Partial<OptimizationConfig> = {}) {
    // 根据环境自动调整配置
    const isLowMemoryEnv = this.detectLowMemoryEnvironment();
    
    this.config = {
      maxHeapSize: config.maxHeapSize ?? (isLowMemoryEnv ? 768 : 1536),
      gcThreshold: config.gcThreshold ?? (isLowMemoryEnv ? 512 : 1024),
      cacheCleanupInterval: config.cacheCleanupInterval ?? 300000, // 5分钟
      memoryCheckInterval: config.memoryCheckInterval ?? 30000,    // 30秒
      emergencyThreshold: config.emergencyThreshold ?? (isLowMemoryEnv ? 600 : 1200)
    };

    logger.info('高级内存优化器已初始化', {
      config: this.config,
      lowMemoryEnv: isLowMemoryEnv
    });

    this.startMonitoring();
  }

  /**
   * 检测是否为低内存环境
   */
  private detectLowMemoryEnvironment(): boolean {
    // 检查环境变量
    if (process.env.LOW_MEMORY_MODE === 'true' || 
        process.env.MEMORY_LIMIT === '2C4G' ||
        process.env.NODE_OPTIONS?.includes('--max-old-space-size=768')) {
      return true;
    }

    // 检查可用内存
    try {
      const memInfo = process.memoryUsage();
      const totalMemory = memInfo.rss + memInfo.heapTotal;
      
      // 如果总内存使用超过3GB，认为是低内存环境
      return totalMemory > 3 * 1024 * 1024 * 1024;
    } catch (error) {
      logger.warn('无法检测内存环境，使用默认配置');
      return false;
    }
  }

  /**
   * 开始内存监控
   */
  private startMonitoring(): void {
    // 内存检查定时器
    this.memoryCheckTimer = setInterval(() => {
      this.checkMemoryUsage();
    }, this.config.memoryCheckInterval);

    // 缓存清理定时器
    this.cacheCleanupTimer = setInterval(() => {
      this.performCacheCleanup();
    }, this.config.cacheCleanupInterval);

    // 进程退出时清理
    process.on('beforeExit', () => {
      this.stopMonitoring();
    });

    logger.info('内存监控已启动');
  }

  /**
   * 停止内存监控
   */
  private stopMonitoring(): void {
    if (this.memoryCheckTimer) {
      clearInterval(this.memoryCheckTimer);
      this.memoryCheckTimer = null;
    }

    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
      this.cacheCleanupTimer = null;
    }

    logger.info('内存监控已停止');
  }

  /**
   * 检查内存使用情况
   */
  private checkMemoryUsage(): void {
    const memStats = this.getMemoryStats();
    this.updateMemoryHistory(memStats);

    const heapUsedMB = memStats.heapUsed / 1024 / 1024;
    const rssMB = memStats.rss / 1024 / 1024;

    // 检查是否需要优化
    if (heapUsedMB > this.config.emergencyThreshold) {
      logger.warn('内存使用超过紧急阈值，执行紧急优化', {
        heapUsed: `${heapUsedMB.toFixed(2)}MB`,
        threshold: `${this.config.emergencyThreshold}MB`
      });
      this.performEmergencyOptimization();
    } else if (heapUsedMB > this.config.gcThreshold) {
      logger.info('内存使用超过GC阈值，执行垃圾回收', {
        heapUsed: `${heapUsedMB.toFixed(2)}MB`,
        threshold: `${this.config.gcThreshold}MB`
      });
      this.performGarbageCollection();
    }

    // 记录内存趋势
    this.analyzeMemoryTrend();
  }

  /**
   * 获取内存统计信息
   */
  private getMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers || 0
    };
  }

  /**
   * 更新内存历史记录
   */
  private updateMemoryHistory(stats: MemoryStats): void {
    this.memoryHistory.push(stats);
    
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }
  }

  /**
   * 分析内存趋势
   */
  private analyzeMemoryTrend(): void {
    if (this.memoryHistory.length < 3) return;

    const recent = this.memoryHistory.slice(-3);
    const trend = recent.map(stat => stat.heapUsed);
    
    // 检查是否持续增长
    const isIncreasing = trend.every((val, i) => i === 0 || val > trend[i - 1]);
    
    if (isIncreasing) {
      const growthRate = (trend[trend.length - 1] - trend[0]) / trend[0];
      
      if (growthRate > 0.1) { // 10%增长
        logger.warn('检测到内存持续增长，执行预防性优化', {
          growthRate: `${(growthRate * 100).toFixed(2)}%`,
          currentHeap: `${(trend[trend.length - 1] / 1024 / 1024).toFixed(2)}MB`
        });
        this.performPreventiveOptimization();
      }
    }
  }

  /**
   * 执行垃圾回收
   */
  private performGarbageCollection(): void {
    if (this.isOptimizing) return;
    
    this.isOptimizing = true;
    
    try {
      if (global.gc) {
        const beforeGC = process.memoryUsage();
        global.gc();
        const afterGC = process.memoryUsage();
        
        const freedMemory = (beforeGC.heapUsed - afterGC.heapUsed) / 1024 / 1024;
        
        logger.info('垃圾回收完成', {
          freedMemory: `${freedMemory.toFixed(2)}MB`,
          heapBefore: `${(beforeGC.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          heapAfter: `${(afterGC.heapUsed / 1024 / 1024).toFixed(2)}MB`
        });
      } else {
        logger.warn('垃圾回收不可用，请使用 --expose-gc 启动');
      }
    } catch (error) {
      logger.error('垃圾回收失败', error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * 执行缓存清理
   */
  private async performCacheCleanup(): Promise<void> {
    if (this.isOptimizing) return;
    
    this.isOptimizing = true;
    
    try {
      logger.info('开始缓存清理');
      
      // 清理各种缓存
      await Promise.all([
        this.clearApplicationCaches(),
        this.clearRedisCaches(),
        this.clearNodeModuleCaches(),
        this.clearBufferCaches()
      ]);
      
      logger.info('缓存清理完成');
    } catch (error) {
      logger.error('缓存清理失败', error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * 清理应用程序缓存
   */
  private async clearApplicationCaches(): Promise<void> {
    try {
      // 清理动态导入缓存
      if (typeof require !== 'undefined' && require.cache) {
        const cacheKeys = Object.keys(require.cache);
        let cleared = 0;
        
        cacheKeys.forEach(key => {
          // 只清理非核心模块
          if (!key.includes('node_modules') && !key.includes('next')) {
            delete require.cache[key];
            cleared++;
          }
        });
        
        logger.debug(`清理了 ${cleared} 个模块缓存`);
      }
      
      // 清理其他应用缓存
      const cacheModule = await import('@/lib/cache/RedisCacheService').catch(() => null);
      const { apiCache, dbCache, configCache } = cacheModule || {};
      
      await Promise.all([
        apiCache?.clear?.(),
        dbCache?.clear?.(),
        configCache?.clear?.()
      ].filter(Boolean));
      
    } catch (error) {
      logger.debug('清理应用缓存时出错', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 清理Redis缓存
   */
  private async clearRedisCaches(): Promise<void> {
    try {
      const redisClient = getOptimizedRedisClient();
      const client = redisClient.getClient();
      
      if (client && redisClient.isRedisConnected()) {
        // 清理过期键
        const keys = await client.keys('urlchecker:*');
        const expiredKeys: string[] = [];
        
        for (const key of keys) {
          const ttl = await client.ttl(key);
          if (ttl === -1 || ttl < 60) { // 清理无过期时间或即将过期的键
            expiredKeys.push(key);
          }
        }
        
        if (expiredKeys.length > 0) {
          await client.del(...expiredKeys);
          logger.debug(`清理了 ${expiredKeys.length} 个Redis键`);
        }
      }
    } catch (error) {
      logger.debug('清理Redis缓存时出错', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 清理Node模块缓存
   */
  private async clearNodeModuleCaches(): Promise<void> {
    try {
      // 清理大型模块的缓存
      const largeModules = [
        'playwright',
        'puppeteer',
        'chromium',
        '@sparticuz/chromium'
      ];
      
      let cleared = 0;
      
      if (typeof require !== 'undefined' && require.cache) {
        Object.keys(require.cache).forEach(key => {
          if (largeModules.some(module => key.includes(module))) {
            delete require.cache[key];
            cleared++;
          }
        });
      }
      
      if (cleared > 0) {
        logger.debug(`清理了 ${cleared} 个大型模块缓存`);
      }
    } catch (error) {
      logger.debug('清理Node模块缓存时出错', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 清理Buffer缓存
   */
  private async clearBufferCaches(): Promise<void> {
    try {
      // 强制清理Buffer池
      if (Buffer.poolSize) {
        // 创建一个新的Buffer来触发池清理
        Buffer.alloc(0);
      }
      
      logger.debug('Buffer缓存清理完成');
    } catch (error) {
      logger.debug('清理Buffer缓存时出错', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 执行预防性优化
   */
  private performPreventiveOptimization(): void {
    if (this.isOptimizing) return;
    
    logger.info('执行预防性内存优化');
    
    // 执行轻量级优化
    this.performGarbageCollection();
    
    // 延迟执行缓存清理
    setTimeout(() => {
      this.performCacheCleanup();
    }, 5000);
  }

  /**
   * 执行紧急优化
   */
  private performEmergencyOptimization(): void {
    if (this.isOptimizing) return;
    
    logger.warn('执行紧急内存优化');
    
    this.isOptimizing = true;
    
    try {
      // 立即执行垃圾回收
      if (global.gc) {
        global.gc();
        global.gc(); // 执行两次确保彻底清理
      }
      
      // 立即清理缓存
      this.performCacheCleanup();
      
      // 清理全局变量
      this.clearGlobalVariables();
      
    } catch (error) {
      logger.error('紧急优化失败', error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * 清理全局变量
   */
  private clearGlobalVariables(): void {
    try {
      // 清理可能的内存泄漏源
      if (typeof global !== 'undefined') {
        // 清理临时全局变量
        Object.keys(global).forEach(key => {
          if (key.startsWith('temp_') || key.startsWith('cache_')) {
            delete (global as any)[key];
          }
        });
      }
      
      logger.debug('全局变量清理完成');
    } catch (error) {
      logger.debug('清理全局变量时出错', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 获取内存使用报告
   */
  getMemoryReport(): {
    current: MemoryStats;
    config: OptimizationConfig;
    history: MemoryStats[];
    recommendations: string[];
  } {
    const current = this.getMemoryStats();
    const recommendations = this.generateRecommendations(current);
    
    return {
      current,
      config: this.config,
      history: this.memoryHistory,
      recommendations
    };
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(stats: MemoryStats): string[] {
    const recommendations: string[] = [];
    const heapUsedMB = stats.heapUsed / 1024 / 1024;
    const rssMB = stats.rss / 1024 / 1024;
    
    if (heapUsedMB > this.config.maxHeapSize * 0.8) {
      recommendations.push('堆内存使用过高，建议增加垃圾回收频率');
    }
    
    if (rssMB > 3000) {
      recommendations.push('RSS内存过高，建议重启应用程序');
    }
    
    if (stats.external > 100 * 1024 * 1024) {
      recommendations.push('外部内存使用过高，检查Buffer和ArrayBuffer使用');
    }
    
    if (this.memoryHistory.length >= 3) {
      const trend = this.memoryHistory.slice(-3).map(s => s.heapUsed);
      const isIncreasing = trend.every((val, i) => i === 0 || val > trend[i - 1]);
      
      if (isIncreasing) {
        recommendations.push('检测到内存泄漏趋势，建议检查事件监听器和定时器');
      }
    }
    
    return recommendations;
  }

  /**
   * 手动触发优化
   */
  async optimizeNow(): Promise<void> {
    logger.info('手动触发内存优化');
    
    await Promise.all([
      this.performGarbageCollection(),
      this.performCacheCleanup()
    ]);
    
    logger.info('手动内存优化完成');
  }
}

// 单例实例
let advancedMemoryOptimizer: AdvancedMemoryOptimizer | null = null;

export function getAdvancedMemoryOptimizer(): AdvancedMemoryOptimizer {
  if (!advancedMemoryOptimizer) {
    advancedMemoryOptimizer = new AdvancedMemoryOptimizer();
  }
  return advancedMemoryOptimizer;
}

export { AdvancedMemoryOptimizer };