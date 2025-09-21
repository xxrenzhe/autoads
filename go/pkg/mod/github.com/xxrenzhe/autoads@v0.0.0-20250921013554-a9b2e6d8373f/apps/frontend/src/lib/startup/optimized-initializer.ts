/**
 * 优化的应用程序初始化器
 * 在应用启动时执行内存优化和Redis连接初始化
 */

import { getOptimizedRedisClient } from '@/lib/cache/optimized-redis-client';
import { getAdvancedMemoryOptimizer } from '@/lib/performance/advanced-memory-optimizer';
import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('OptimizedInitializer');

interface InitializationResult {
  success: boolean;
  redis: {
    connected: boolean;
    type: 'redis' | 'cluster' | 'fallback';
    config: any;
  };
  memory: {
    optimizerActive: boolean;
    currentUsage: string;
    config: any;
  };
  performance: {
    startupTime: number;
    optimizations: string[];
  };
  errors: string[];
}

class OptimizedInitializer {
  private startTime: number;
  private errors: string[] = [];
  private optimizations: string[] = [];

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * 执行完整的初始化流程
   */
  async initialize(): Promise<InitializationResult> {
    logger.info('开始优化初始化流程');

    try {
      // 1. 环境检测和配置
      await this.detectEnvironment();

      // 2. Redis连接初始化
      const redisResult = await this.initializeRedis();

      // 3. 内存优化器初始化
      const memoryResult = await this.initializeMemoryOptimizer();

      // 4. 性能优化
      await this.applyPerformanceOptimizations();

      // 5. 健康检查
      await this.performHealthCheck();

      const startupTime = Date.now() - this.startTime;

      const result: InitializationResult = {
        success: this.errors.length === 0,
        redis: redisResult,
        memory: memoryResult,
        performance: {
          startupTime,
          optimizations: this.optimizations
        },
        errors: this.errors
      };

      logger.info('初始化完成', {
        success: result.success,
        startupTime: `${startupTime}ms`,
        optimizations: this.optimizations.length,
        errors: this.errors.length
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errors.push(errorMessage);
      
      logger.error('初始化失败', new Error(errorMessage));

      return {
        success: false,
        redis: { connected: false, type: 'fallback', config: {} },
        memory: { optimizerActive: false, currentUsage: '0MB', config: {} },
        performance: { startupTime: Date.now() - this.startTime, optimizations: [] },
        errors: this.errors
      };
    }
  }

  /**
   * 检测运行环境
   */
  private async detectEnvironment(): Promise<void> {
    logger.info('检测运行环境');

    // 检测内存环境
    const memoryUsage = process.memoryUsage();
    const totalMemoryMB = memoryUsage.rss / 1024 / 1024;

    if (totalMemoryMB < 3000 || process.env.LOW_MEMORY_MODE === 'true') {
      process.env.LOW_MEMORY_MODE = 'true';
      this.optimizations.push('启用低内存模式');
      logger.info('检测到低内存环境，启用优化模式');
    }

    // 检测容器环境
    if (process.env.DOCKER_ENV === 'true' || process.env.KUBERNETES_SERVICE_HOST) {
      this.optimizations.push('容器环境优化');
      logger.info('检测到容器环境');
    }

    // 检测生产环境
    if (process.env.NODE_ENV === 'production') {
      this.optimizations.push('生产环境优化');
      logger.info('生产环境模式');
    }
  }

  /**
   * 初始化Redis连接
   */
  private async initializeRedis(): Promise<{
    connected: boolean;
    type: 'redis' | 'cluster' | 'fallback';
    config: any;
  }> {
    logger.info('初始化Redis连接');

    try {
      const redisClient = getOptimizedRedisClient();
      
      // 等待连接建立（最多10秒）
      let attempts = 0;
      const maxAttempts = 20; // 10秒，每500ms检查一次
      
      while (attempts < maxAttempts && !redisClient.isRedisConnected()) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      const connectionInfo = redisClient.getConnectionInfo();
      
      if (connectionInfo.connected) {
        this.optimizations.push(`Redis${connectionInfo.type === 'cluster' ? '集群' : ''}连接成功`);
        logger.info('Redis连接建立成功', connectionInfo);
      } else {
        this.optimizations.push('使用内存fallback缓存');
        logger.warn('Redis连接失败，使用fallback');
      }

      return connectionInfo;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errors.push(`Redis初始化失败: ${errorMessage}`);
      
      return {
        connected: false,
        type: 'fallback',
        config: {}
      };
    }
  }

  /**
   * 初始化内存优化器
   */
  private async initializeMemoryOptimizer(): Promise<{
    optimizerActive: boolean;
    currentUsage: string;
    config: any;
  }> {
    logger.info('初始化内存优化器');

    try {
      const memoryOptimizer = getAdvancedMemoryOptimizer();
      const memoryReport = memoryOptimizer.getMemoryReport();
      
      const currentUsageMB = memoryReport.current.heapUsed / 1024 / 1024;
      
      this.optimizations.push('内存优化器已启动');
      logger.info('内存优化器初始化成功', {
        currentUsage: `${currentUsageMB.toFixed(2)}MB`,
        config: memoryReport.config
      });

      return {
        optimizerActive: true,
        currentUsage: `${currentUsageMB.toFixed(2)}MB`,
        config: memoryReport.config
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errors.push(`内存优化器初始化失败: ${errorMessage}`);
      
      return {
        optimizerActive: false,
        currentUsage: '0MB',
        config: {}
      };
    }
  }

  /**
   * 应用性能优化
   */
  private async applyPerformanceOptimizations(): Promise<void> {
    logger.info('应用性能优化');

    try {
      // 1. 设置进程优化
      if (process.setMaxListeners) {
        process.setMaxListeners(20); // 增加事件监听器限制
        this.optimizations.push('增加事件监听器限制');
      }

      // 2. 垃圾回收优化
      if (global.gc) {
        // 执行一次初始垃圾回收
        global.gc();
        this.optimizations.push('执行初始垃圾回收');
      }

      // 3. 设置环境变量优化
      if (!process.env.UV_THREADPOOL_SIZE) {
        process.env.UV_THREADPOOL_SIZE = '16'; // 增加线程池大小
        this.optimizations.push('优化线程池大小');
      }

      // 4. 预热关键模块
      await this.preloadCriticalModules();

      logger.info('性能优化应用完成');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errors.push(`性能优化失败: ${errorMessage}`);
    }
  }

  /**
   * 预加载关键模块
   */
  private async preloadCriticalModules(): Promise<void> {
    try {
      // 预加载关键模块以减少首次使用延迟
      const criticalModules = [
        '@/lib/utils/proxy-utils',
        '@/lib/services/smart-request-scheduler',
        '@/lib/utils/session-manager'
      ];

      for (const modulePath of criticalModules) {
        try {
          await import(modulePath);
        } catch (error) {
          // 忽略预加载失败，不影响主流程
          logger.debug(`预加载模块失败: ${modulePath}`, { 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      this.optimizations.push('关键模块预加载完成');

    } catch (error) {
      logger.debug('模块预加载过程中出错', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    logger.info('执行系统健康检查');

    try {
      // 1. 内存健康检查
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
      
      if (heapUsedMB > 1000) {
        this.errors.push(`启动时内存使用过高: ${heapUsedMB.toFixed(2)}MB`);
      }

      // 2. Redis健康检查
      const redisClient = getOptimizedRedisClient();
      if (redisClient.isRedisConnected()) {
        const client = redisClient.getClient();
        try {
          await client.ping();
          this.optimizations.push('Redis健康检查通过');
        } catch (error) {
          this.errors.push('Redis健康检查失败');
        }
      }

      // 3. 环境变量检查
      const requiredEnvVars = ['DATABASE_URL', 'NEXTAUTH_SECRET'];
      const missingVars = requiredEnvVars.filter((varName: any) => !process.env[varName]);
      
      if (missingVars.length > 0) {
        this.errors.push(`缺少必要环境变量: ${missingVars.join(', ')}`);
      } else {
        this.optimizations.push('环境变量检查通过');
      }

      logger.info('健康检查完成', {
        memoryUsage: `${heapUsedMB.toFixed(2)}MB`,
        errors: this.errors.length
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errors.push(`健康检查失败: ${errorMessage}`);
    }
  }

  /**
   * 获取初始化统计信息
   */
  getInitializationStats(): {
    startupTime: number;
    optimizations: string[];
    errors: string[];
  } {
    return {
      startupTime: Date.now() - this.startTime,
      optimizations: this.optimizations,
      errors: this.errors
    };
  }
}

// 单例实例
let optimizedInitializer: OptimizedInitializer | null = null;

export async function initializeOptimizedSystem(): Promise<InitializationResult> {
  if (!optimizedInitializer) {
    optimizedInitializer = new OptimizedInitializer();
  }
  
  return await optimizedInitializer.initialize();
}

export { OptimizedInitializer };