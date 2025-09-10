/**
 * Simplified URL Visitor with Single Proxy Strategy
 * 使用单代理策略的简化URL访问器
 * 
 * 主要功能：
 * 1. 集成单代理每轮访问策略
 * 2. 简化的接口设计
 * 3. 自动代理管理和轮换
 * 4. 高效的资源利用
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { ProxyConfig } from '@/lib/utils/proxy-utils';
import { fetchProxyPool } from './proxy-service';
import { SimpleConcurrentExecutor } from './simple-concurrent-executor';
import { EnhancedError } from '@/lib/utils/error-handling';
import { getSimplifiedProxyService } from './simplified-proxy-service';

const logger = createLogger('SimplifiedUrlVisitor');

export interface SimplifiedUrlVisitorOptions {
  proxyUrl: string;
  urls: string[];
  cycleCount: number;
  visitInterval: number;
  timeout: number;
  maxRetries: number;
  concurrency?: number;
  proxyRotationStrategy?: 'round-robin' | 'random';
  taskId?: string;
  refererOption?: 'social' | 'custom';
  selectedSocialMedia?: string;
  customReferer?: string;
  onProgress?: (progress: any) => void;
  onComplete?: (result: any) => void;
  onError?: (error: any) => void;
}

export interface SimplifiedUrlVisitorResult {
  success: boolean;
  completedRounds: number;
  totalVisits: number;
  executionTime: number;
  successCount: number;
  failCount: number;
  proxyUsage: Map<string, number>;
  errors?: string[];
  performance?: {
    averagePageLoadTime: number;
    totalContextsCreated: number;
    contextReuseRate: number;
  };
}

export class SimplifiedUrlVisitor {
  private options: SimplifiedUrlVisitorOptions;
  private proxyPool: ProxyConfig[] = [];
  private executor: SimpleConcurrentExecutor | null = null;
  private strategy: any = null;
  private isInitialized = false;

  constructor(options: SimplifiedUrlVisitorOptions) {
    this.options = {
      ...options,
      concurrency: options.concurrency || 1,
      proxyRotationStrategy: options.proxyRotationStrategy || 'round-robin'
    };
    
    logger.info('简化URL访问器初始化', {
      urlsCount: options.urls.length,
      cycleCount: options.cycleCount,
      concurrency: this.options.concurrency
    });
  }

  /**
   * 初始化访问器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('访问器已初始化，跳过');
      return;
    }

    try {
      // 获取代理池
      const requiredProxyCount = this.options.cycleCount;
      
      this.proxyPool = await fetchProxyPool(
        this.options.proxyUrl,
        requiredProxyCount,
        true, // isSilentMode
        undefined, // taskId
        this.options.urls.length,
        true // 启用代理缓存
      );

      if (!this.proxyPool || this.proxyPool.length === 0) {
        throw new Error('代理获取失败：未能获取到任何代理');
      }

      // 如果代理数量不足，自动触发补充获取
      if (this.proxyPool.length < requiredProxyCount) {
        const shortage = requiredProxyCount - this.proxyPool.length;
        logger.warn('代理数量不足，触发自动补充', {
          required: requiredProxyCount,
          actual: this.proxyPool.length,
          shortage
        });

        try {
          // 使用简化代理服务的智能补充机制
          const simplifiedProxyService = getSimplifiedProxyService();
          
          // 确保代理URL已设置
          if (!simplifiedProxyService.getCurrentProxyUrl()) {
            simplifiedProxyService.setProxyUrl(this.options.proxyUrl);
          }

          // 执行智能补充
          await simplifiedProxyService.performSmartSupplementWithCount(shortage);
          
          // 重新获取代理池（现在应该包含补充的代理）
          const supplementedProxies = await fetchProxyPool(
            this.options.proxyUrl,
            requiredProxyCount,
            true, // isSilentMode
            undefined, // taskId
            this.options.urls.length,
            true // 启用代理缓存
          );

          if (supplementedProxies.length > this.proxyPool.length) {
            logger.info('代理补充成功', {
              originalCount: this.proxyPool.length,
              supplementedCount: supplementedProxies.length,
              shortage,
              satisfied: supplementedProxies.length >= requiredProxyCount
            });
            
            this.proxyPool = supplementedProxies;
          } else {
            logger.warn('代理补充未能增加新的唯一代理', {
              originalCount: this.proxyPool.length,
              supplementedCount: supplementedProxies.length,
              shortage
            });
          }
        } catch (supplementError) {
          logger.error('代理自动补充失败，将使用现有代理继续执行', new EnhancedError('代理自动补充失败', {
            error: supplementError instanceof Error ? supplementError.message : String(supplementError),
            shortage,
            willContinueWith: this.proxyPool.length
          }));
        }
      }

      // 创建简单并发执行器
      this.executor = new SimpleConcurrentExecutor({
        taskId: this.options.taskId || `simplified-${Date.now()}`,
        urls: this.options.urls,
        cycleCount: this.options.cycleCount,
        visitInterval: this.options.visitInterval || 1000,
        roundInterval: 2000,
        timeout: this.options.timeout || 30000,
        proxyPool: this.proxyPool,
        refererOption: this.options.refererOption,
        selectedSocialMedia: this.options.selectedSocialMedia || undefined,
        customReferer: this.options.customReferer,
        enableUrlConcurrency: this.options.concurrency! > 1,
        maxConcurrentUrls: this.options.concurrency! || 1,
        onProgress: this.options.onProgress
      });

      this.isInitialized = true;
      
      logger.info('简化URL访问器初始化完成', {
        proxyPoolSize: this.proxyPool.length,
        requiredProxyCount,
        executor: 'simple-concurrent'
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('初始化失败', new EnhancedError('初始化失败', { error: errorMessage }));
      throw error;
    }
  }

  /**
   * 开始访问
   */
  async start(): Promise<SimplifiedUrlVisitorResult> {
    if (!this.isInitialized) {
      throw new Error('访问器未初始化');
    }

    if (!this.executor) {
      throw new Error('执行器未创建');
    }

    logger.info('开始执行URL访问', {
      urls: this.options.urls.length,
      cycles: this.options.cycleCount,
      concurrency: this.options.concurrency
    });

    const result = await this.executor.start();
    
    // 转换结果格式
    const visitorResult: SimplifiedUrlVisitorResult = {
      success: result.success,
      completedRounds: result.performance.totalRounds,
      totalVisits: result.completed + result.failed,
      executionTime: result.executionTime,
      successCount: result.completed,
      failCount: result.failed,
      proxyUsage: new Map(),
      errors: result.errors,
      performance: {
        averagePageLoadTime: result.performance.averageUrlTime || 0,
        totalContextsCreated: 0,
        contextReuseRate: 0
      }
    };

    return visitorResult;
  }

  /**
   * 停止访问
   */
  async stop(): Promise<void> {
    logger.info('停止URL访问');
    if (this.executor) {
      await this.executor.stop();
    }
  }

  /**
   * 获取状态
   */
  getStatus(): {
    isInitialized: boolean;
    isRunning: boolean;
    proxyPoolSize: number;
    status?: string;
    progress?: any;
  } {
    const baseStatus = {
      isInitialized: this.isInitialized,
      isRunning: this.strategy ? (this.strategy.getStatus ? this.strategy.getStatus().isRunning : false) : false,
      proxyPoolSize: this.proxyPool.length
    };

    if (this.strategy && this.strategy.getStatus) {
      const strategyStatus = this.strategy.getStatus();
      return {
        ...baseStatus,
        status: strategyStatus.isRunning ? 'running' : 'ready',
        progress: {
          completedRounds: strategyStatus.completedRounds || 0,
          totalRounds: strategyStatus.totalRounds || 0,
          completedVisits: strategyStatus.completedVisits || 0,
          failedVisits: strategyStatus.failedVisits || 0,
          totalVisits: (strategyStatus.urlsCount || 0) * (strategyStatus.totalRounds || 0)
        }
      };
    }

    return {
      ...baseStatus,
      status: this.isInitialized ? 'ready' : 'not_initialized'
    };
  }

  /**
   * 获取统计信息
   */
  getStats(): any {
    if (!this.strategy) {
      return {
        proxyPoolSize: this.proxyPool.length,
        strategy: 'not_initialized'
      };
    }

    return {
      ...(this.strategy.getStats ? this.strategy.getStats() : {}),
      proxyPoolSize: this.proxyPool.length,
      strategy: 'single-proxy-round'
    };
  }

  /**
   * 销毁访问器
   */
  async destroy(): Promise<void> {
    logger.info('销毁简化URL访问器');
    
    if (this.strategy) {
      await this.strategy.destroy();
      this.strategy = null;
    }
    
    this.proxyPool = [];
    this.isInitialized = false;
    
    logger.info('简化URL访问器已销毁');
  }
}

// 导出便捷函数
export async function visitUrlsWithSingleProxy(
  options: SimplifiedUrlVisitorOptions
): Promise<SimplifiedUrlVisitorResult> {
  const visitor = new SimplifiedUrlVisitor(options);
  
  try {
    await visitor.initialize();
    try {

    return await visitor.start();

    } catch (error) {

      console.error(error);

      return {
        success: false,
        completedRounds: 0,
        totalVisits: 0,
        executionTime: 0,
        successCount: 0,
        failCount: 0,
        proxyUsage: new Map(),
        errors: [error instanceof Error ? error.message : "Unknown error" as any]
      };

    }
  } finally {
    await visitor.destroy();
  }
}