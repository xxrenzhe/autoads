/**
 * Unified Proxy Service Interface
 * 统一代理服务接口，整合所有代理相关功能
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { ProxyConfig, validateProxyUrl, extractProxyType, parseProxyResponse, parseMultipleProxiesResponse } from '@/lib/utils/proxy-utils';
import { EnhancedError } from '@/lib/utils/error-handling';
// Redis cache service removed for batchopen - using hybrid queue instead

const logger = createLogger('UnifiedProxyService');

// 代理服务配置接口
export interface UnifiedProxyServiceConfig {
  // Redis缓存配置
  redis: {
    minHealthyProxies: number;
    maxCacheSize: number;
    cacheTTL: number;
  };
  
  // 代理获取配置
  fetch: {
    batchSize: number;
    maxRetries: number;
    timeout: number;
    concurrency: number;
  };
  
  // 智能补充配置
  supplement: {
    triggerThreshold: number;
    supplementBatch: number;
    checkInterval: number;
  };
  
  // 健康检查配置
  health: {
    checkInterval: number;
    maxConsecutiveFailures: number;
    timeout: number;
  };
}

// 默认配置
const DEFAULT_CONFIG: UnifiedProxyServiceConfig = {
  redis: {
    minHealthyProxies: 12,
    maxCacheSize: 100,
    cacheTTL: 30 * 60 * 1000 // 30分钟
  },
  
  fetch: {
    batchSize: 20,
    maxRetries: 5,
    timeout: 35000,
    concurrency: 3
  },
  
  supplement: {
    triggerThreshold: 0.6,
    supplementBatch: 15,
    checkInterval: 30000
  },
  
  health: {
    checkInterval: 10 * 60 * 1000,
    maxConsecutiveFailures: 3,
    timeout: 10000
  }
};

// 代理分配策略
export enum ProxyAllocationStrategy {
  OPTIMIZED = 'optimized',
  FIFO = 'fifo',
  ROUND_ROBIN = 'round-robin',
  LEAST_USED = 'least-used'
}

// 代理需求计算结果
export interface ProxyRequirementPlan {
  totalRequired: number;
  allocationStrategy: ProxyAllocationStrategy;
  estimatedReuse: number;
  breakdown: {
    uniqueProxies: number;
    reusedProxies: number;
    bufferProxies: number;
  };
  recommendations: string[];
  warnings: string[];
}

// 统一代理服务类
export class UnifiedProxyService {
  private config: UnifiedProxyServiceConfig;
  private redisCache: any;
  private supplementTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private currentProxyUrl: string | null = null;
  private fallbackProxies: ProxyConfig[] = [];
  private lastFallbackUpdate: number = 0;
  private fallbackTTL: number = 30 * 60 * 1000;
  
  // 性能监控
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor(config: Partial<UnifiedProxyServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Redis cache removed for batchopen
    // this.redisCache = getRedisProxyCacheService();
    this.isRunning = true;
    
    logger.info('统一代理服务初始化', { config: this.config });
    
    // 启动后台服务
    this.startBackgroundServices();
  }

  /**
   * 启动后台服务
   */
  private startBackgroundServices(): void {
    // 启动智能补充机制
    this.startSmartSupplement();
    
    // 启动健康检查
    this.startHealthCheck();
    
    // 启动降级缓存清理
    this.startFallbackCleanup();
  }

  /**
   * 计算代理需求
   */
  calculateProxyRequirements(
    urlCount: number,
    totalVisits: number,
    strategy: ProxyAllocationStrategy = ProxyAllocationStrategy.OPTIMIZED
  ): ProxyRequirementPlan {
    const visitsPerUrl = Math.ceil(totalVisits / urlCount);
    let uniqueProxies: number;
    let reusedProxies: number;
    const estimatedReuse: number = 0;
    const recommendations: string[] = [];
    const warnings: string[] = [];

    switch (strategy) {
      case ProxyAllocationStrategy.OPTIMIZED:
        // 优化策略：基于访问模式智能计算
        if (urlCount <= 10) {
          uniqueProxies = Math.min(totalVisits, 50);
          reusedProxies = Math.max(0, totalVisits - uniqueProxies);
        } else if (urlCount <= 50) {
          uniqueProxies = Math.min(urlCount * 2, 100);
          reusedProxies = Math.max(0, totalVisits - uniqueProxies);
        } else {
          uniqueProxies = Math.min(urlCount, 150);
          reusedProxies = Math.max(0, totalVisits - uniqueProxies);
        }
        
        recommendations.push('使用优化分配策略，平衡性能和成本');
        break;
        
      case ProxyAllocationStrategy.FIFO:
        // FIFO策略：每个请求使用新的代理
        uniqueProxies = totalVisits;
        reusedProxies = 0;
        recommendations.push('使用FIFO策略，确保每个请求使用唯一代理');
        break;
        
      case ProxyAllocationStrategy.ROUND_ROBIN:
        // 轮询策略：循环使用代理
        uniqueProxies = Math.min(Math.ceil(totalVisits / 3), urlCount * 2);
        reusedProxies = totalVisits - uniqueProxies;
        recommendations.push('使用轮询策略，平衡代理使用频率');
        break;
        
      case ProxyAllocationStrategy.LEAST_USED:
        // 最少使用策略：优先使用使用次数最少的代理
        uniqueProxies = Math.min(urlCount * 1.5, 80);
        reusedProxies = totalVisits - uniqueProxies;
        recommendations.push('使用最少使用策略，优化代理寿命');
        break;
        
      default:
        uniqueProxies = Math.min(totalVisits, 100);
        reusedProxies = Math.max(0, totalVisits - uniqueProxies);
    }

    // 计算复用率
    const calculatedReuse = totalVisits > 0 ? (reusedProxies / totalVisits) * 100 : 0;

    // 添加缓冲代理
    const bufferProxies = Math.ceil(uniqueProxies * 0.2);
    const totalRequired = uniqueProxies + bufferProxies;

    // 检查警告条件
    if (totalRequired > 200) {
      warnings.push('代理需求量较大，建议分批处理');
    }
    
    if (calculatedReuse > 80) {
      warnings.push('代理复用率较高，可能影响访问效果');
    }

    const plan: ProxyRequirementPlan = {
      totalRequired,
      allocationStrategy: strategy,
      estimatedReuse: calculatedReuse,
      breakdown: {
        uniqueProxies,
        reusedProxies,
        bufferProxies
      },
      recommendations,
      warnings
    };

    logger.info('代理需求计算完成', {
      urlCount,
      totalVisits,
      strategy,
      plan
    });

    return plan;
  }

  /**
   * 初始化代理池
   */
  async initializeProxyPool(
    proxyUrl: string,
    requiredCount: number,
    progressCallback?: (current: number, total: number) => Promise<void>
  ): Promise<ProxyConfig[]> {
    logger.info('开始初始化代理池', {
      proxyUrl,
      requiredCount,
      strategy: 'unified'
    });

    this.currentProxyUrl = proxyUrl;
    const startTime = Date.now();
    let acquiredProxies: ProxyConfig[] = [];

    try {
      // 首先尝试从Redis缓存获取
      const cachedProxies = await this.redisCache.getHealthyProxies(requiredCount);
      
      if (cachedProxies.length >= requiredCount) {
        logger.info('从Redis缓存获取足够代理', {
          required: requiredCount,
          cached: cachedProxies.length
        });
        acquiredProxies = cachedProxies.slice(0, requiredCount);
        this.metrics.cacheHits++;
      } else {
        // 缓存不足，需要从API获取
        this.metrics.cacheMisses++;
        const neededFromApi = requiredCount - cachedProxies.length;
        
        logger.info('缓存不足，从API获取代理', {
          required: requiredCount,
          cached: cachedProxies.length,
          neededFromApi
        });

        const apiProxies = await this.fetchProxiesFromApi(proxyUrl, neededFromApi, progressCallback);
        
        // 合并缓存和API获取的代理
        acquiredProxies = [...cachedProxies, ...apiProxies];
        
        // 将新获取的代理存入Redis
        if (apiProxies.length > 0) {
          await this.redisCache.addProxies(apiProxies, proxyUrl);
        }
      }

      // 去重处理
      const uniqueProxies = this.deduplicateProxies(acquiredProxies);
      
      logger.info('代理池初始化完成', {
        required: requiredCount,
        acquired: uniqueProxies.length,
        duration: Date.now() - startTime,
        source: cachedProxies.length >= requiredCount ? 'cache' : 'api+cache'
      });

      return uniqueProxies;

    } catch (error) {
      logger.error('代理池初始化失败', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : String(error),
        proxyUrl,
        requiredCount
      });

      // 尝试使用降级代理
      if (this.fallbackProxies.length > 0) {
        logger.info('使用降级代理', {
          fallbackCount: this.fallbackProxies.length
        });
        return this.fallbackProxies.slice(0, Math.min(requiredCount, this.fallbackProxies.length));
      }

      throw new EnhancedError('代理池初始化失败', {
        code: 'PROXY_POOL_INIT_FAILED',
        details: { proxyUrl, requiredCount, error: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  /**
   * 从API获取代理
   */
  private async fetchProxiesFromApi(
    proxyUrl: string,
    requiredCount: number,
    progressCallback?: (current: number, total: number) => Promise<void>
  ): Promise<ProxyConfig[]> {
    const allProxies: ProxyConfig[] = [];
    const batchSize = this.config.fetch.batchSize;
    let remaining = requiredCount;
    let attempt = 0;

    while (remaining > 0 && attempt < this.config.fetch.maxRetries) {
      try {
        const currentBatch = Math.min(remaining, batchSize);
        
        // 构建请求URL
        const url = new URL(proxyUrl);
        url.searchParams.set('num', currentBatch.toString());
        url.searchParams.set('format', 'json');
        url.searchParams.set('country', 'all');
        url.searchParams.set('anonymity', 'all');
        url.searchParams.set('protocol', 'all');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.fetch.timeout);
        
        const response = await fetch(url.toString(), {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'AutoAds-ProxyService/1.0',
            'Accept': 'application/json'
          }
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 首先读取响应文本（避免重复读取响应体）
        let responseText: string = '';
        let data: any;
        
        try {
          responseText = await response.text();
          
          // 尝试解析为JSON
          try {
            data = JSON.parse(responseText);
            const parsedProxies = parseMultipleProxiesResponse(JSON.stringify(data));
            
            if (parsedProxies && parsedProxies.length > 0) {
              allProxies.push(...parsedProxies);
              remaining -= parsedProxies.length;
              
              if (progressCallback) {
                await progressCallback(allProxies.length, requiredCount);
              }
              
              logger.info('JSON解析获取代理成功', {
                attempt: attempt + 1,
                requested: currentBatch,
                received: parsedProxies.length,
                remaining,
                total: allProxies.length
              });
            }
          } catch (jsonError) {
            // JSON解析失败，使用已读取的文本处理
            logger.debug('JSON解析失败，尝试作为文本处理', { 
              attempt: attempt + 1,
              jsonError: jsonError instanceof Error ? jsonError.message : String(jsonError) 
            });
            const parsedProxies = parseMultipleProxiesResponse(responseText);
            
            if (parsedProxies && parsedProxies.length > 0) {
              allProxies.push(...parsedProxies);
              remaining -= parsedProxies.length;
              
              if (progressCallback) {
                await progressCallback(allProxies.length, requiredCount);
              }
              
              logger.info('文本解析获取代理成功', {
                attempt: attempt + 1,
                requested: currentBatch,
                received: parsedProxies.length,
                remaining,
                total: allProxies.length
              });
            } else {
              throw new Error('文本解析未获得任何代理');
            }
          }
        } catch (textError) {
          const errorMessage = `代理响应解析失败: ${textError instanceof Error ? textError.message : String(textError)}`;
          logger.error('代理响应解析完全失败', {
            error: {
              name: 'ProxyParseError',
              message: errorMessage,
              stack: textError instanceof Error ? textError.stack : undefined
            },
            attempt: attempt + 1,
            responseStatus: response.status,
            contentType: response.headers.get('content-type')
          });
          throw new Error(errorMessage);
        }

        // 如果本次没有获取到代理，等待后重试
        if (allProxies.length === 0 || remaining === requiredCount) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        logger.warn('获取代理失败', {
          attempt: attempt + 1,
          error: error instanceof Error ? error.message : String(error)
        });
        
        if (attempt === this.config.fetch.maxRetries - 1) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      attempt++;
    }

    return allProxies;
  }

  /**
   * 代理去重
   */
  private deduplicateProxies(proxies: ProxyConfig[]): ProxyConfig[] {
    const uniqueMap = new Map<string, ProxyConfig>();
    
    for (const proxy of proxies) {
      // 使用完整的代理信息作为唯一标识，包括协议、主机、端口、用户名和密码
      // 这确保了不同凭据的相同主机和端口被视为不同的代理
      const key = `${proxy.protocol}:${proxy.host}:${proxy.port}:${proxy.username || ''}:${proxy.password || ''}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, proxy);
      }
    }
    
    return Array.from(uniqueMap.values());
  }

  /**
   * 启动智能补充机制
   */
  private startSmartSupplement(): void {
    this.supplementTimer = setInterval(async () => {
      try {
        await this.checkAndSupplementProxies();
      } catch (error) {
        logger.warn('智能补充检查失败', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, this.config.supplement.checkInterval);
  }

  /**
   * 检查并补充代理
   */
  private async checkAndSupplementProxies(): Promise<void> {
    if (!this.currentProxyUrl) {
      return;
    }

    try {
      const healthyCount = await this.redisCache.getHealthyProxyCount();
      const minHealthy = this.config.redis.minHealthyProxies;
      const healthRatio = healthyCount / minHealthy;

      if (healthRatio < this.config.supplement.triggerThreshold) {
        logger.info('触发代理补充', {
          healthyCount,
          minHealthy,
          healthRatio,
          threshold: this.config.supplement.triggerThreshold
        });

        const supplementBatch = this.config.supplement.supplementBatch;
        const newProxies = await this.fetchProxiesFromApi(this.currentProxyUrl, supplementBatch);
        
        if (newProxies.length > 0) {
          await this.redisCache.addProxies(newProxies, this.currentProxyUrl);
          
          logger.info('代理补充完成', {
            supplementBatch,
            acquired: newProxies.length,
            totalHealthy: await this.redisCache.getHealthyProxyCount()
          });
        }
      }
    } catch (error) {
      logger.error('代理补充失败', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.redisCache.performHealthCheck();
      } catch (error) {
        logger.warn('代理健康检查失败', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, this.config.health.checkInterval);
  }

  /**
   * 启动降级缓存清理
   */
  private startFallbackCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      if (now - this.lastFallbackUpdate > this.fallbackTTL) {
        this.fallbackProxies = [];
        this.lastFallbackUpdate = now;
        logger.info('降级代理缓存已清理');
      }
    }, this.fallbackTTL);
  }

  /**
   * 获取服务状态
   */
  getServiceStatus(): any {
    return {
      isRunning: this.isRunning,
      config: this.config,
      currentProxyUrl: this.currentProxyUrl,
      fallbackProxiesCount: this.fallbackProxies.length,
      metrics: this.metrics,
      timers: {
        supplement: this.supplementTimer !== null,
        healthCheck: this.healthCheckTimer !== null
      }
    };
  }

  /**
   * 停止服务
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.supplementTimer) {
      clearInterval(this.supplementTimer);
      this.supplementTimer = null;
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    logger.info('统一代理服务已停止');
  }

  /**
   * 重新启动服务
   */
  restart(): void {
    this.stop();
    this.isRunning = true;
    this.startBackgroundServices();
    logger.info('统一代理服务已重启');
  }
}

// 创建全局实例
let unifiedProxyServiceInstance: UnifiedProxyService | null = null;

export function getUnifiedProxyService(): UnifiedProxyService {
  if (!unifiedProxyServiceInstance) {
    unifiedProxyServiceInstance = new UnifiedProxyService();
  }
  return unifiedProxyServiceInstance;
}

export function createUnifiedProxyService(config?: Partial<UnifiedProxyServiceConfig>): UnifiedProxyService {
  return new UnifiedProxyService(config);
}