/**
 * 简化的代理缓存服务
 * 核心功能：
 * 1. 从动态代理API获取代理IP并存入Redis
 * 2. 批量访问时直接从Redis获取代理IP
 * 3. 智能补充机制确保Redis缓存始终保持可用代理
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
// Redis cache service removed for batchopen - using hybrid queue instead
import { ProxyConfig, fetchWithRetry, parseProxyResponse, validateProxyUrl, extractProxyType, parseMultipleProxiesResponse } from '@/lib/utils/proxy-utils';
import { EnhancedError } from '@/lib/utils/error-handling';

// 声明全局任务执行状态标志
declare global {
  var globalTaskExecutionFlags: Map<string, { startTime: number; active: boolean }> | undefined;
}

const logger = createLogger('SimplifiedProxyService');

interface SimplifiedProxyConfig {
  // Redis缓存配置
  redis: {
    minHealthyProxies: number;     // 最小健康代理数量
    maxCacheSize: number;         // 最大缓存大小
    cacheTTL: number;             // 缓存TTL（毫秒）
  };
  
  // 代理获取配置
  fetch: {
    batchSize: number;           // 每次获取的代理数量
    maxRetries: number;           // 最大重试次数
    timeout: number;              // 获取超时时间
    concurrency: number;          // 并发获取数量
  };
  
  // 智能补充配置
  supplement: {
    triggerThreshold: number;     // 触发补充的阈值
    supplementBatch: number;     // 补充批次大小
    checkInterval: number;       // 检查间隔（毫秒）
  };
}

const DEFAULT_CONFIG: SimplifiedProxyConfig = {
  redis: {
    minHealthyProxies: 12,       // 至少保持12个健康代理
    maxCacheSize: 100,           // 最多缓存100个代理
    cacheTTL: 30 * 60 * 1000     // 30分钟TTL
  },
  
  fetch: {
    batchSize: 20,               // 每次获取20个代理
    maxRetries: 5,               // 增加到5次重试以应对高去重率
    timeout: 35000,              // 增加到35秒超时
    concurrency: 3               // 减少并发数避免API限制
  },
  
  supplement: {
    triggerThreshold: 0.6,       // 健康率低于60%时触发补充
    supplementBatch: 15,        // 每次补充15个
    checkInterval: 30000         // 30秒检查一次
  }
};

class SimplifiedProxyService {
  private config: SimplifiedProxyConfig;
  private redisCache: any;
  private supplementTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private currentProxyUrl: string | null = null; // 存储当前代理URL，用于智能补充
  private fallbackProxies: ProxyConfig[] = []; // 降级代理缓存
  private lastFallbackUpdate: number = 0;
  private fallbackTTL: number = 30 * 60 * 1000; // 30分钟

  constructor(config: Partial<SimplifiedProxyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Redis cache removed for batchopen
    // this.redisCache = getRedisProxyCacheService();
    this.isRunning = true;
    
    logger.info('简化代理服务初始化', { config: this.config });
    
    // 启动智能补充机制
    this.startSmartSupplement();
    
    // 启动降级缓存清理
    this.startFallbackCleanup();
  }

  /**
   * 初始化代理池 - 从动态代理API获取代理并存入Redis
   * 优化：适应单一代理API的限制，采用"尽力而为"策略
   */
  async initializeProxyPool(proxyUrl: string, requiredCount: number, progressCallback?: (current: number, total: number) => Promise<void>): Promise<ProxyConfig[]> {
    logger.info('开始初始化代理池', { 
      proxyUrl, 
      requiredCount,
      strategy: '正常获取策略' 
    });

    // 验证代理URL
    if (!proxyUrl || proxyUrl.trim() === '') {
      logger.error('代理URL为空，无法初始化代理池');
      throw new Error('代理URL不能为空');
    }

    // 存储代理URL用于智能补充
    this.currentProxyUrl = proxyUrl;
    logger.info('已存储代理URL用于智能补充', { proxyUrl });

    try {
      // 第一步：检查Redis缓存中是否已有足够的代理
      const existingProxies = await this.getHealthyProxiesFromRedis(requiredCount);
      logger.info(`Redis缓存状态：${existingProxies.length}/${requiredCount} 个健康代理`);
      
      if (existingProxies.length >= requiredCount) {
        logger.info(`✅ Redis缓存中已有足够代理：${existingProxies.length}/${requiredCount}`);
        return existingProxies.slice(0, requiredCount);
      }

      // 第二步：计算需要获取的新代理数量，采用保守策略
      const neededCount = requiredCount - existingProxies.length;
      
      // 第三步：从动态代理API获取新代理，使用实际需要的数量
      const fetchResult = await this.fetchProxiesFromAPIWithGuarantee(
        proxyUrl, 
        neededCount, 
        Math.ceil(neededCount * 1.5), // 多获取50%以应对去重
        progressCallback
      );
      const newProxies = fetchResult.proxies;
      
      if (newProxies.length === 0) {
        logger.warn('⚠️ 未能从API获取到任何代理', {
          proxyUrl,
          neededCount,
          totalAttempts: fetchResult.totalAttempts,
          successfulAttempts: fetchResult.successfulAttempts,
          retryCount: fetchResult.retryCount
        } as any);
        
        // 如果获取失败，尝试使用现有代理继续执行
        if (existingProxies.length > 0) {
          logger.info(`使用现有代理继续执行：${existingProxies.length}个`);
          return existingProxies;
        }
        
        throw new Error(`代理API未能返回有效的代理配置。建议：1. 检查API状态 2. 稍后重试 3. 考虑添加备用代理API`);
      }

      // 第四步：将新代理存入Redis缓存
      await this.addProxiesToRedis(newProxies, proxyUrl);
      
      // 第五步：合并现有代理和新代理
      const allProxies = [...existingProxies, ...newProxies];
      const finalProxies = allProxies.slice(0, requiredCount);

      // 计算实际满足程度
      const satisfactionRate = Math.min(100, Math.round((finalProxies.length / requiredCount) * 100));
      
      logger.info(`✅ 代理池初始化完成`, {
        existingCount: existingProxies.length,
        newCount: newProxies.length,
        finalCount: finalProxies.length,
        requiredCount,
        satisfactionRate: `${satisfactionRate}%`,
        cacheSize: await this.getRedisCacheSize(),
        strategy: finalProxies.length >= requiredCount ? '成功满足需求' : '部分满足，继续执行'
      });

      return finalProxies;

    } catch (error) {
      logger.error('代理池初始化失败', new EnhancedError('代理池初始化失败', {
        error: error instanceof Error ? error.message : String(error),
        proxyUrl,
        requiredCount
      }));
      throw error;
    }
  }

  /**
   * 从Redis获取健康代理 - 增强版带降级策略
   */
  async getHealthyProxiesFromRedis(count: number): Promise<ProxyConfig[]> {
    let retryCount = 0;
    const maxRetries = 3;
    let lastError: Error | null = null;

    while (retryCount <= maxRetries) {
      try {
        // 检查Redis连接状态，如果未连接则尝试重连
        const stats = await this.redisCache.getStats();
        const connectionStatus = this.redisCache.getConnectionStatus ? this.redisCache.getConnectionStatus() : { isConnected: stats.redisConnected };
        
        if (!connectionStatus.isConnected) {
          logger.warn(`Redis未连接，尝试重连 [${retryCount + 1}/${maxRetries + 1}]`, {
            requested: count,
            connectionStatus,
            retryCount
          });
          
          if (retryCount < maxRetries) {
            // 指数退避重试
            const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
            logger.info(`Redis重连延迟: ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retryCount++;
            continue;
          } else {
            logger.warn('Redis重连失败，使用降级策略', {
              requested: count,
              totalRetries: retryCount + 1,
              fallbackCacheSize: this.fallbackProxies.length
            });
            
            // 降级策略：使用本地缓存
            return this.getFallbackProxies(count);
          }
        }
        
        const healthyProxies = await this.redisCache.getHealthyProxies(count);
        
        // 如果Redis成功返回代理，更新降级缓存
        if (healthyProxies.length > 0) {
          this.updateFallbackCache(healthyProxies);
        }
        
        logger.debug(`从Redis获取 ${healthyProxies.length} 个健康代理`, {
          requested: count,
          actual: healthyProxies.length,
          retryCount
        });

        return healthyProxies;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`从Redis获取代理失败 [${retryCount + 1}/${maxRetries + 1}]`, { 
          error: lastError.message,
          requested: count,
          retryCount
        });
        
        if (retryCount < maxRetries) {
          // 指数退避重试
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          logger.info(`错误重试延迟: ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retryCount++;
        } else {
          logger.error('从Redis获取代理最终失败，使用降级策略', new EnhancedError('从Redis获取代理最终失败', {
            error: lastError.message,
            requested: count,
            totalRetries: retryCount + 1,
            fallbackCacheSize: this.fallbackProxies.length
          }));
          
          // 降级策略：使用本地缓存
          return this.getFallbackProxies(count);
        }
      }
    }
    
    return [];
  }

  /**
   * 从动态代理API获取代理 - 确保数量满足要求
   * 优化：自动补充机制确保去重后数量满足要求
   */
  private async fetchProxiesFromAPIWithGuarantee(proxyUrl: string, requiredCount: number, estimatedFetchCount: number, progressCallback?: (current: number, total: number) => Promise<void>): Promise<{
    proxies: ProxyConfig[];
    totalAttempts: number;
    successfulAttempts: number;
    retryCount: number;
    strategy: 'batch' | 'individual';
  }> {
    logger.info(`🎯 从API获取代理（确保数量）`, { 
      proxyUrl, 
      requiredCount,
      estimatedFetchCount,
      strategy: '自动补充：确保去重后数量满足要求' 
    });

    if (!proxyUrl || proxyUrl.trim() === '') {
      logger.error('代理URL为空，无法获取代理');
      return {
        proxies: [],
        totalAttempts: 0,
        successfulAttempts: 0,
        retryCount: 0,
        strategy: 'batch'
      };
    }

    const proxyType = extractProxyType(proxyUrl);
    const uniqueProxies = new Map<string, ProxyConfig>();
    let totalAttempts = 0;
    let successfulAttempts = 0;
    let retryCount = 0;
    const maxRetries = 5; // 增加重试次数以应对高去重率

    // 自动补充获取循环
    while (uniqueProxies.size < requiredCount && retryCount <= maxRetries) {
      try {
        const currentNeeded = requiredCount - uniqueProxies.size;
        
        // 动态调整请求数量：根据去重效果调整请求数量
        const deduplicationRatio = uniqueProxies.size > 0 ? 
          (uniqueProxies.size / (uniqueProxies.size + currentNeeded)) : 0.3;
        
        // 优化倍数计算：当去重率低时，大幅增加请求数量
        let multiplier;
        if (deduplicationRatio < 0.3) {
          // 去重率很低，需要大量请求
          multiplier = Math.max(5, 8 - (deduplicationRatio * 10));
        } else if (deduplicationRatio < 0.6) {
          // 去重率中等，适度增加请求
          multiplier = Math.max(3, 6 - (deduplicationRatio * 5));
        } else {
          // 去重率较高，正常请求
          multiplier = Math.max(2, 4 - (deduplicationRatio * 2));
        }
        
        const requestCount = Math.min(
          Math.ceil(currentNeeded * multiplier), // 根据去重效果动态调整倍数
          Math.max(estimatedFetchCount, currentNeeded * 3) // 确保至少请求3倍所需数量
        );

        logger.info(`🔄 第${retryCount + 1}次获取尝试`, {
          currentUnique: uniqueProxies.size,
          requiredCount,
          currentNeeded,
          requestCount,
          retryCount
        });

        // 策略1: 尝试使用ips=n参数批量获取（优化版：添加timestamp和延迟机制）
        logger.info(`🔄 第${retryCount + 1}次批量获取尝试`, {
          currentUnique: uniqueProxies.size,
          requiredCount,
          requestCount,
          strategy: '使用timestamp和延迟机制减少重复率'
        });
        
        const batchResult = await this.tryBatchFetch(proxyUrl, requestCount, proxyType);
        totalAttempts += batchResult.totalAttempts;
        successfulAttempts += batchResult.successfulAttempts;
        
        // 添加新获取的代理到唯一集合
        batchResult.proxies.forEach(proxy => {
          const key = `${proxy.host}:${proxy.port}`;
          if (!uniqueProxies.has(key)) {
            uniqueProxies.set(key, proxy);
          }
        });

        // 更新进度
        if (progressCallback) {
          await progressCallback(uniqueProxies.size, requiredCount);
        }

        logger.info(`📊 批量获取后状态`, {
          obtainedThisBatch: batchResult.proxies.length,
          uniqueThisBatch: batchResult.proxies.filter(p => {
            const key = `${p.host}:${p.port}`;
            return uniqueProxies.get(key) === p;
          }).length,
          totalUnique: uniqueProxies.size,
          requiredCount
        });

        // 检查是否已满足要求
        if (uniqueProxies.size >= requiredCount) {
          logger.info(`✅ 批量获取策略成功满足数量要求：${uniqueProxies.size}/${requiredCount}`);
          break;
        }

        // 如果批量获取不足，尝试单独请求补充
        if (uniqueProxies.size < requiredCount) {
          const stillNeeded = requiredCount - uniqueProxies.size;
          logger.info(`🔄 批量获取不足，尝试单独请求补充 ${stillNeeded} 个代理`);
          
          const individualResult = await this.tryIndividualFetch(
            proxyUrl, 
            stillNeeded, 
            proxyType, 
            Array.from(uniqueProxies.values())
          );
          
          totalAttempts += individualResult.totalAttempts;
          successfulAttempts += individualResult.successfulAttempts;
          
          // 添加单独请求获取的代理
          individualResult.proxies.forEach(proxy => {
            const key = `${proxy.host}:${proxy.port}`;
            if (!uniqueProxies.has(key)) {
              uniqueProxies.set(key, proxy);
            }
          });

          logger.info(`📊 单独补充后状态`, {
            obtainedThisBatch: individualResult.proxies.length,
            uniqueThisBatch: individualResult.proxies.filter(p => {
              const key = `${p.host}:${p.port}`;
              return uniqueProxies.get(key) === p;
            }).length,
            totalUnique: uniqueProxies.size,
            requiredCount
          });
        }

        // 检查是否已满足要求
        if (uniqueProxies.size >= requiredCount) {
          logger.info(`✅ 组合策略成功满足数量要求：${uniqueProxies.size}/${requiredCount}`);
          break;
        }

        // 如果仍然不足，准备重试
        if (uniqueProxies.size < requiredCount && retryCount < maxRetries) {
          retryCount++;
          const stillNeeded = requiredCount - uniqueProxies.size;
          
          logger.warn(`⚠️ 第${retryCount}次重试准备`, {
            currentUnique: uniqueProxies.size,
            requiredCount,
            stillNeeded,
            totalAttempts,
            successfulAttempts
          });
          
          // 重试前等待，使用阶梯式延迟避免API缓存，参考单独获取机制
          const baseDelay = retryCount * 2000; // 基础延迟：2s, 4s, 6s
          const randomDelay = Math.random() * 500 + 200; // 200-700ms随机延迟（优化）
          const retryDelay = Math.min(baseDelay + randomDelay, 10000); // 最大10秒
          
          logger.info(`⏳ 批量获取重试延迟: ${retryDelay}ms (基础: ${baseDelay}ms, 随机: ${randomDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

      } catch (error) {
        if (retryCount < maxRetries) {
          retryCount++;
          logger.warn(`获取过程中出现异常，准备第${retryCount}次重试`, { 
            error: error instanceof Error ? error.message : String(error),
            currentUnique: uniqueProxies.size,
            requiredCount
          });
          
          // 使用阶梯式延迟，与批量获取机制保持一致
          const baseDelay = retryCount * 2000; // 基础延迟：2s, 4s, 6s
          const randomDelay = Math.random() * 500 + 200; // 200-700ms随机延迟（优化）
          const retryDelay = Math.min(baseDelay + randomDelay, 10000); // 最大10秒
          
          logger.info(`⏳ 异常处理重试延迟: ${retryDelay}ms (基础: ${baseDelay}ms, 随机: ${randomDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        } else {
          logger.error('获取代理最终失败', new EnhancedError('获取代理最终失败', {
            error: error instanceof Error ? error.message : String(error),
            totalAttempts,
            successfulAttempts,
            finalUniqueCount: uniqueProxies.size,
            requiredCount
          }));
          throw error;
        }
      }
    }

    const proxyArray = Array.from(uniqueProxies.values());
    const strategy = proxyArray.length >= requiredCount ? 'batch' : 'individual';
    
    logger.info(`🎯 代理获取完成（确保数量）`, {
      requested: requiredCount,
      obtained: proxyArray.length,
      totalAttempts,
      successfulAttempts,
      retryCount,
      success: proxyArray.length >= requiredCount,
      strategy
    });

    return {
      proxies: proxyArray,
      totalAttempts,
      successfulAttempts,
      retryCount,
      strategy
    };
  }

  /**
   * 从动态代理API获取代理 - 优化策略（保持向后兼容）
   * 优先使用ips=n参数一次获取多个代理，失败后降级到多次请求
   */
  private async fetchProxiesFromAPI(proxyUrl: string, count: number): Promise<{
    proxies: ProxyConfig[];
    totalAttempts: number;
    successfulAttempts: number;
    retryCount: number;
    strategy: 'batch' | 'individual';
  }> {
    logger.info(`从API获取代理`, { 
      proxyUrl, 
      count,
      config: this.config.fetch 
    });

    if (!proxyUrl || proxyUrl.trim() === '') {
      logger.error('代理URL为空，无法获取代理');
      return {
        proxies: [],
        totalAttempts: 0,
        successfulAttempts: 0,
        retryCount: 0,
        strategy: 'batch'
      };
    }

    const proxyType = extractProxyType(proxyUrl);
    
    // 策略1: 尝试使用ips=n参数一次获取多个代理（优化版：添加timestamp和延迟机制）
    logger.info(`🚀 策略1: 尝试使用ips=${count}参数批量获取代理（含timestamp机制）`);
    const batchResult = await this.tryBatchFetch(proxyUrl, count, proxyType);
    
    if (batchResult.proxies.length >= count) {
      logger.info(`✅ 批量获取策略成功: ${batchResult.proxies.length}/${count}个代理`);
      return {
        ...batchResult,
        strategy: 'batch'
      };
    }
    
    logger.warn(`⚠️ 批量获取策略不足: ${batchResult.proxies.length}/${count}个代理，降级到单独请求策略`);
    
    // 策略2: 降级到多次单独请求
    logger.info(`🔄 策略2: 降级到多次单独请求获取代理`);
    const individualResult = await this.tryIndividualFetch(proxyUrl, count, proxyType, batchResult.proxies);
    
    return {
      ...individualResult,
      strategy: 'individual'
    };
  }

  /**
   * 策略1: 使用ips=n参数批量获取代理 - 优化版：添加延迟和timestamp机制
   */
  private async tryBatchFetch(proxyUrl: string, count: number, proxyType: string): Promise<{
    proxies: ProxyConfig[];
    totalAttempts: number;
    successfulAttempts: number;
    retryCount: number;
  }> {
    try {
      // 构建批量获取URL - 添加timestamp参数避免缓存
      const batchUrl = this.buildBatchProxyUrlWithTimestamp(proxyUrl, count);
      logger.info(`📡 批量获取请求:`, { url: batchUrl, count, strategy: '添加timestamp和延迟机制' });
      
      // 添加随机延迟避免同时请求，参考单独获取机制
      const randomDelay = Math.random() * 500 + 200; // 200-700ms随机延迟（优化）
      logger.debug(`批量获取延迟: ${randomDelay}ms`);
      await new Promise(resolve => setTimeout(resolve, randomDelay));
      
      const response = await fetchWithRetry(batchUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/plain, */*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        timeout: this.config.fetch.timeout,
        maxRetries: 2
      });

      if (response.status === 200) {
        const responseText = await response.text();
        
        logger.info(`📄 批量获取响应:`, {
          contentLength: responseText.length,
          preview: responseText.substring(0, 200),
          hasTimestamp: batchUrl.includes('timestamp=')
        });
        
        // 检查是否为JSON错误响应（如IPRocket API的参数错误）
        if (responseText.trim().startsWith('{') && responseText.includes('"success":false')) {
          try {
            const errorResponse = JSON.parse(responseText);
            if (errorResponse.success === false && errorResponse.message) {
              logger.warn(`⚠️ API返回参数错误:`, { 
                errors: errorResponse.message,
                apiType: batchUrl.includes('iprocket.io') ? 'IPRocket' : 'Other'
              });
              
              // 如果是IPRocket API的参数错误，记录日志并继续使用单独请求策略
              if (batchUrl.includes('iprocket.io')) {
                logger.info(`🔄 IPRocket API不支持批量参数，降级到单独请求策略`);
              }
            }
          } catch (parseError) {
            // JSON解析失败，继续正常的代理解析
          }
        }
        
        // 使用多代理解析函数
        const proxies = parseMultipleProxiesResponse(responseText, proxyType as 'http' | 'https' | 'socks4' | 'socks5');
        
        if (proxies.length > 0) {
          logger.info(`✅ 批量获取成功: ${proxies.length}个代理`);
          return {
            proxies,
            totalAttempts: 1,
            successfulAttempts: 1,
            retryCount: 0
          };
        } else {
          logger.warn(`❌ 批量获取解析失败`);
        }
      } else {
        logger.warn(`❌ 批量获取HTTP错误: ${response.status}`);
      }
      
    } catch (error) {
      logger.warn(`❌ 批量获取异常:`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
    
    return {
      proxies: [],
      totalAttempts: 1,
      successfulAttempts: 0,
      retryCount: 0
    };
  }

  /**
   * 策略2: 多次单独请求获取代理
   */
  private async tryIndividualFetch(
    proxyUrl: string, 
    count: number, 
    proxyType: string,
    existingProxies: ProxyConfig[] = []
  ): Promise<{
    proxies: ProxyConfig[];
    totalAttempts: number;
    successfulAttempts: number;
    retryCount: number;
  }> {
    const uniqueProxies = new Map<string, ProxyConfig>();
    
    // 添加已存在的代理
    existingProxies.forEach(proxy => {
      const key = `${proxy.host}:${proxy.port}`;
      uniqueProxies.set(key, proxy);
    });
    
    let retryCount = 0;
    const maxRetries = this.config.fetch.maxRetries;
    let totalAttempts = 0;
    let successfulAttempts = 0;

    logger.info(`🔄 开始单独请求策略，需要获取 ${count - uniqueProxies.size} 个额外代理`);

    while (retryCount <= maxRetries && uniqueProxies.size < count) {
      try {
        const fetchPromises: Promise<void>[] = [];
        const neededCount = count - uniqueProxies.size;
        const concurrency = Math.min(this.config.fetch.concurrency, neededCount);
        
        for (let i = 0; i < concurrency && uniqueProxies.size < count; i++) {
          const promise = (async (attemptIndex: number) => {
            totalAttempts++;
            try {
              // 添加随机延迟避免同时请求，并且根据索引增加延迟
              const baseDelay = attemptIndex * 150; // 优化：每个请求间隔150ms
              const randomDelay = Math.random() * 300 + 100; // 优化：100-400ms随机延迟
              const totalDelay = baseDelay + randomDelay;
              
              await new Promise(resolve => setTimeout(resolve, totalDelay));
              
              logger.debug(`单独请求${attemptIndex + 1}延迟: ${totalDelay}ms`);
              
              // 为每个个别请求构建带随机参数的URL
              const individualUrl = this.buildIndividualProxyUrl(proxyUrl, attemptIndex, retryCount);
              
              const response = await fetchWithRetry(individualUrl, {
                method: 'GET',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Accept': 'text/plain, */*',
                  'Cache-Control': 'no-cache'
                },
                timeout: this.config.fetch.timeout,
                maxRetries: 2
              });

              if (response.status === 200) {
                const proxyText = await response.text();
                
                const proxyConfig = parseProxyResponse(proxyText, proxyType as 'http' | 'https' | 'socks4' | 'socks5');
                
                if (proxyConfig) {
                  const proxyKey = `${proxyConfig.host}:${proxyConfig.port}`;
                  if (!uniqueProxies.has(proxyKey)) {
                    uniqueProxies.set(proxyKey, proxyConfig);
                    successfulAttempts++;
                    logger.info(`✅ 单独请求获取新代理: ${proxyKey} (总计: ${uniqueProxies.size}/${count})`);
                  } else {
                    logger.debug(`⚠️ 单独请求重复代理，跳过: ${proxyKey}`);
                  }
                } else {
                  logger.debug(`❌ 单独请求代理解析失败`);
                }
              } else {
                logger.debug(`❌ 单独请求HTTP错误: ${response.status}`);
              }
            } catch (error) {
              logger.debug(`单独请求失败 (尝试 ${attemptIndex + 1}):`, { 
                error: error instanceof Error ? error.message : String(error) 
              });
            }
          })(i);
          
          fetchPromises.push(promise);
        }

        await Promise.allSettled(fetchPromises);

        // 检查是否获取到足够的代理
        if (uniqueProxies.size >= count) {
          logger.info(`✅ 单独请求策略成功：${uniqueProxies.size}/${count}`);
          break;
        }

        retryCount++;
        
        if (retryCount <= maxRetries) {
          logger.warn(`⚠️ 单独请求不足，准备第${retryCount}次重试`, {
            current: uniqueProxies.size,
            required: count,
            retryCount,
            maxRetries
          });
          
          // 重试前等待
          const retryDelay = Math.min(2000 * retryCount, 5000);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

      } catch (error) {
        if (retryCount < maxRetries) {
          retryCount++;
          logger.warn(`单独请求异常，准备第${retryCount}次重试`, { 
            error: error instanceof Error ? error.message : String(error) 
          });
          
          const retryDelay = Math.min(2000 * retryCount, 5000);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        throw error;
      }
    }

    const proxyArray = Array.from(uniqueProxies.values());
    
    logger.info(`📊 单独请求策略统计`, {
      requested: count,
      obtained: proxyArray.length,
      totalAttempts,
      successfulAttempts,
      retryCount
    });

    return {
      proxies: proxyArray,
      totalAttempts,
      successfulAttempts,
      retryCount
    };
  }

  /**
   * 构建批量获取代理URL
   */
  private buildBatchProxyUrl(originalUrl: string, count: number): string {
    try {
      const urlObj = new URL(originalUrl);
      
      // 设置或更新ips参数
      urlObj.searchParams.set('ips', count.toString());
      
      // 保留responseType参数，因为IPRocket API需要此参数
      // 如果没有responseType参数，设置为txt格式
      if (!urlObj.searchParams.has('responseType')) {
        urlObj.searchParams.set('responseType', 'txt');
      }
      
      return urlObj.toString();
    } catch (error) {
      logger.warn('构建批量URL失败，使用原URL:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return originalUrl;
    }
  }

  /**
   * 构建个别获取代理URL - 为每个请求添加唯一参数
   */
  private buildIndividualProxyUrl(originalUrl: string, attemptIndex: number, retryCount: number): string {
    try {
      const urlObj = new URL(originalUrl);
      
      // 确保ips参数为1（个别请求）
      urlObj.searchParams.set('ips', '1');
      
      // 检测API类型
      const isIPRocketAPI = originalUrl.includes('iprocket.io');
      
      if (isIPRocketAPI) {
        // IPRocket API：只使用原生支持的参数，不添加任何额外参数
        // 保留responseType参数（如果原URL中有的话）
        if (!urlObj.searchParams.has('responseType')) {
          urlObj.searchParams.set('responseType', 'txt');
        }
        
        // 不添加任何额外参数，IPRocket API对参数非常严格
        
      } else {
        // 其他API使用完整随机化参数
        const timestamp = Date.now();
        const microtime = performance.now();
        const randomSeed = Math.floor(Math.random() * 1000000);
        
        urlObj.searchParams.set('timestamp', timestamp.toString());
        urlObj.searchParams.set('microtime', microtime.toString());
        urlObj.searchParams.set('seed', randomSeed.toString());
        urlObj.searchParams.set('attempt', attemptIndex.toString());
        urlObj.searchParams.set('retry', retryCount.toString());
        
        if (!urlObj.searchParams.has('responseType')) {
          urlObj.searchParams.set('responseType', 'txt');
        }
      }
      
      return urlObj.toString();
    } catch (error) {
      logger.warn('构建个别代理URL失败，使用原URL:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return originalUrl;
    }
  }

  /**
   * 构建批量获取代理URL - 智能版：根据API兼容性选择参数
   */
  private buildBatchProxyUrlWithTimestamp(originalUrl: string, count: number): string {
    try {
      const urlObj = new URL(originalUrl);
      
      // 设置或更新ips参数
      urlObj.searchParams.set('ips', count.toString());
      
      // 检测API类型并选择合适的参数策略
      const isIPRocketAPI = originalUrl.includes('iprocket.io');
      const isGeoNodeAPI = originalUrl.includes('geonode.com');
      
      if (isIPRocketAPI) {
        // IPRocket API优化策略：只使用支持的基本参数
        logger.debug(`检测到IPRocket API，使用基本参数策略`);
        
        // 保留responseType参数，IPRocket API需要此参数
        if (!urlObj.searchParams.has('responseType')) {
          urlObj.searchParams.set('responseType', 'txt');
        }
        
        // 不添加任何额外参数，IPRocket API对参数非常严格
        
      } else {
        // 其他API使用完整优化参数
        logger.debug(`使用标准优化参数策略`);
        
        // 添加timestamp参数避免缓存
        const timestamp = Date.now();
        urlObj.searchParams.set('timestamp', timestamp.toString());
        
        // 添加随机数参数进一步确保不同响应
        const randomSeed = Math.floor(Math.random() * 1000000);
        urlObj.searchParams.set('seed', randomSeed.toString());
        
        // 添加毫秒级时间戳
        const microtime = performance.now();
        urlObj.searchParams.set('microtime', microtime.toString());
        
        // 保留responseType参数
        if (!urlObj.searchParams.has('responseType')) {
          urlObj.searchParams.set('responseType', 'txt');
        }
      }
      
      const finalUrl = urlObj.toString();
      logger.debug(`构建批量URL（智能策略）:`, {
        originalUrl,
        finalUrl,
        apiType: isIPRocketAPI ? 'IPRocket' : isGeoNodeAPI ? 'GeoNode' : 'Other',
        strategy: isIPRocketAPI ? '基本参数' : '优化参数',
        params: Array.from(urlObj.searchParams.entries())
      });
      
      return finalUrl;
    } catch (error) {
      logger.warn('构建批量URL（智能策略）失败，使用原URL:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return originalUrl;
    }
  }

  /**
   * 将代理添加到Redis缓存
   */
  private async addProxiesToRedis(proxies: ProxyConfig[], sourceUrl: string): Promise<void> {
    if (proxies.length === 0) return;

    try {
      await this.redisCache.addProxies(proxies, sourceUrl);
      
      logger.info(`成功添加 ${proxies.length} 个代理到Redis缓存`, {
        sourceUrl,
        cacheSize: await this.getRedisCacheSize()
      });
    } catch (error) {
      logger.warn('添加代理到Redis缓存失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * 获取Redis缓存大小
   */
  private async getRedisCacheSize(): Promise<number> {
    try {
      const stats = await this.redisCache.getStats();
      return stats.total || 0;
    } catch (error) {
      logger.warn('获取Redis缓存大小失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return 0;
    }
  }

  /**
   * 批量访问阶段：从Redis获取代理IP - 适应单一API限制
   */
  async getProxiesForBatchAccess(count: number): Promise<ProxyConfig[]> {
    logger.info(`批量访问阶段：从Redis获取代理`, { 
      count,
      strategy: '优先使用Redis缓存，智能补充' 
    });

    try {
      // 第一步：从Redis获取健康代理
      const proxies = await this.getHealthyProxiesFromRedis(count);
      
      // 第二步：如果Redis代理不足，触发智能补充
      if (proxies.length < count) {
        const shortage = count - proxies.length;
        logger.warn(`Redis代理不足：${proxies.length}/${count}，触发智能补充`, { 
          shortage,
          currentCacheSize: await this.getRedisCacheSize()
        });
        
        // 使用存储的代理URL进行智能补充
        if (this.currentProxyUrl) {
          try {
            await this.performSmartSupplementWithCount(shortage);
            
            // 补充后重新尝试获取代理
            const supplementedProxies = await this.getHealthyProxiesFromRedis(count);
            
            // 计算满足程度
            const satisfactionRate = Math.min(100, Math.round((supplementedProxies.length / count) * 100));
            
            logger.info(`智能补充完成`, {
              obtained: supplementedProxies.length,
              required: count,
              satisfactionRate: `${satisfactionRate}%`,
              strategy: supplementedProxies.length >= count ? '满足需求' : '部分满足，继续执行'
            });
            
            return supplementedProxies;
          } catch (supplementError) {
            logger.warn('智能补充失败，返回现有代理', {
              supplementError: supplementError instanceof Error ? supplementError.message : String(supplementError),
              willReturn: proxies.length
            });
          }
        } else {
          logger.warn('智能补充失败：未找到代理URL配置', {
            currentProxyUrl: this.currentProxyUrl,
            hint: '请确保已调用initializeProxyPool方法'
          });
        }
      }

      // 计算最终满足程度
      const finalProxies = proxies.slice(0, count);
      const satisfactionRate = Math.min(100, Math.round((finalProxies.length / count) * 100));

      logger.info(`批量访问代理获取完成`, {
        requested: count,
        actual: finalProxies.length,
        satisfactionRate: `${satisfactionRate}%`,
        source: 'Redis缓存',
        strategy: finalProxies.length >= count ? '成功满足需求' : '部分满足，继续执行'
      });

      return finalProxies;

    } catch (error) {
      logger.error('批量访问代理获取失败', new EnhancedError('批量访问代理获取失败', {
        error: error instanceof Error ? error.message : String(error),
        count
      }));
      throw error;
    }
  }

  /**
   * 启动智能补充机制
   */
  private startSmartSupplement(): void {
    if (this.supplementTimer) {
      clearInterval(this.supplementTimer);
    }

    this.supplementTimer = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.checkAndSupplementProxies();
      } catch (error) {
        logger.warn('智能补充检查失败', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }, this.config.supplement.checkInterval);

    logger.info('智能补充机制已启动', { 
      interval: this.config.supplement.checkInterval 
    });
  }

  /**
   * 检查并补充代理
   */
  private async checkAndSupplementProxies(): Promise<void> {
    try {
      // 检查是否有任务正在执行，如果有则跳过代理补充
      if (global.globalTaskExecutionFlags && global.globalTaskExecutionFlags.size > 0) {
        const activeTasks = Array.from(global.globalTaskExecutionFlags.entries())
          .filter(([_, flag]) => flag.active)
          .map(([taskId, _]) => taskId);
        
        if (activeTasks.length > 0) {
          logger.debug(`检测到任务正在执行，跳过代理补充`, { 
            activeTasks,
            count: activeTasks.length 
          });
          return;
        }
      }
      
      const stats = await this.redisCache.getStats();
      const healthRate = stats.total > 0 ? stats.healthy / stats.total : 0;
      
      // 触发补充条件
      const shouldSupplement = 
        stats.healthy < this.config.redis.minHealthyProxies ||
        healthRate < this.config.supplement.triggerThreshold;

      if (shouldSupplement) {
        logger.info('触发智能代理补充', {
          currentHealthy: stats.healthy,
          minRequired: this.config.redis.minHealthyProxies,
          healthRate: `${(healthRate * 100).toFixed(1)}%`,
          triggerRate: `${(this.config.supplement.triggerThreshold * 100).toFixed(1)}%`
        });

        // 使用存储的代理URL进行智能补充
        if (this.currentProxyUrl) {
          await this.performSmartSupplement();
        } else {
          logger.warn('智能补充失败：未找到代理URL配置', {
            currentProxyUrl: this.currentProxyUrl,
            hint: '请确保已调用initializeProxyPool方法'
          });
        }
      } else {
        logger.debug('代理缓存状态良好，无需补充', {
          healthyProxies: stats.healthy,
          healthRate: `${(healthRate * 100).toFixed(1)}%`
        });
      }
    } catch (error) {
      logger.warn('检查代理补充状态失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * 执行智能补充 - 优化版：确保补充数量满足要求
   */
  private async performSmartSupplement(): Promise<void> {
    if (!this.currentProxyUrl) {
      logger.warn('智能补充失败：代理URL未配置');
      return;
    }

    try {
      const stats = await this.redisCache.getStats();
      const neededCount = this.config.supplement.supplementBatch;
      
      logger.info('开始智能补充代理', {
        currentHealthy: stats.healthy,
        minRequired: this.config.redis.minHealthyProxies,
        neededCount,
        proxyUrl: this.currentProxyUrl
      });

      // 从API获取新代理，使用合理的数量要求
      const estimatedFetchCount = Math.ceil(neededCount * 1.5); // 多获取50%以应对去重
      
      const fetchResult = await this.fetchProxiesFromAPIWithGuarantee(this.currentProxyUrl, neededCount, estimatedFetchCount);
      
      if (fetchResult.proxies.length > 0) {
        // 将新代理添加到Redis缓存
        await this.addProxiesToRedis(fetchResult.proxies, this.currentProxyUrl);
        
        const successRate = Math.min(100, Math.round((fetchResult.proxies.length / neededCount) * 100));
        
        logger.info('✅ 智能补充完成', {
          addedProxies: fetchResult.proxies.length,
          required: neededCount,
          successRate: `${successRate}%`,
          totalAttempts: fetchResult.totalAttempts,
          successfulAttempts: fetchResult.successfulAttempts,
          strategy: fetchResult.strategy,
          success: fetchResult.proxies.length >= neededCount,
          newCacheSize: await this.getRedisCacheSize()
        });
      } else {
        logger.warn('⚠️ 智能补充未能获取到新代理', {
          neededCount,
          estimatedFetchCount,
          totalAttempts: fetchResult.totalAttempts,
          successfulAttempts: fetchResult.successfulAttempts,
          strategy: fetchResult.strategy
        });
      }
    } catch (error) {
      logger.error('智能补充执行失败', new EnhancedError('智能补充执行失败', {
        error: error instanceof Error ? error.message : String(error),
        proxyUrl: this.currentProxyUrl
      }));
    }
  }

  /**
   * 执行智能补充 - 指定数量版本（适应单一API限制）
   */
  public async performSmartSupplementWithCount(targetCount: number): Promise<void> {
    if (!this.currentProxyUrl) {
      logger.warn('智能补充失败：代理URL未配置');
      return;
    }

    try {
      const stats = await this.redisCache.getStats();
      
      logger.info('开始智能补充代理（指定数量）', {
        currentHealthy: stats.healthy,
        targetCount,
        proxyUrl: this.currentProxyUrl
      });

      // 从API获取新代理，使用合理的估算
      const estimatedFetchCount = Math.ceil(targetCount * 1.8); // 多获取80%以应对高去重率
      
      const fetchResult = await this.fetchProxiesFromAPIWithGuarantee(
        this.currentProxyUrl, 
        targetCount, 
        estimatedFetchCount
      );
      
      if (fetchResult.proxies.length > 0) {
        // 将新代理添加到Redis缓存
        await this.addProxiesToRedis(fetchResult.proxies, this.currentProxyUrl);
        
        const successRate = Math.min(100, Math.round((fetchResult.proxies.length / targetCount) * 100));
        
        logger.info('✅ 智能补充完成（指定数量）', {
          addedProxies: fetchResult.proxies.length,
          targetCount,
          successRate: `${successRate}%`,
          totalAttempts: fetchResult.totalAttempts,
          successfulAttempts: fetchResult.successfulAttempts,
          strategy: fetchResult.strategy,
          newCacheSize: await this.getRedisCacheSize()
        });
      } else {
        logger.warn('⚠️ 智能补充未能获取到新代理', {
          targetCount,
          estimatedFetchCount,
          totalAttempts: fetchResult.totalAttempts,
          successfulAttempts: fetchResult.successfulAttempts,
          strategy: fetchResult.strategy
        });
      }
    } catch (error) {
      logger.error('智能补充执行失败（指定数量）', new EnhancedError('智能补充执行失败', {
        error: error instanceof Error ? error.message : String(error),
        proxyUrl: this.currentProxyUrl,
        targetCount
      }));
    }
  }

  /**
   * 验证代理URL
   */
  async validateProxyUrl(proxyUrl: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      const validation = validateProxyUrl(proxyUrl);
      if (!validation.isValid) {
        return validation;
      }

      // 尝试获取一个代理进行测试
      const testResult = await this.fetchProxiesFromAPI(proxyUrl, 1);
      
      if (testResult.proxies.length > 0) {
        return { isValid: true };
      } else {
        return { isValid: false, error: '代理API未能返回有效的代理配置' };
      }
    } catch (error) {
      return { 
        isValid: false, 
        error: `代理API验证失败: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    redis: any;
    healthRate: number;
    isAdequate: boolean;
  }> {
    try {
      const redisStats = await this.redisCache.getStats();
      const healthRate = redisStats.total > 0 ? redisStats.healthy / redisStats.total : 0;
      
      return {
        redis: redisStats,
        healthRate,
        isAdequate: redisStats.healthy >= this.config.redis.minHealthyProxies && 
                   healthRate >= this.config.supplement.triggerThreshold
      };
    } catch (error) {
      logger.warn('获取缓存统计失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return {
        redis: { total: 0, healthy: 0 },
        healthRate: 0,
        isAdequate: false
      };
    }
  }

  /**
   * 设置代理URL - 用于智能补充机制
   */
  setProxyUrl(proxyUrl: string): void {
    this.currentProxyUrl = proxyUrl;
    logger.info('代理URL已更新', { proxyUrl });
  }

  /**
   * 获取当前代理URL
   */
  getCurrentProxyUrl(): string | null {
    return this.currentProxyUrl;
  }

  /**
   * 更新降级缓存
   */
  private updateFallbackCache(proxies: ProxyConfig[]): void {
    const now = Date.now();
    
    // 清理过期的降级缓存
    if (now - this.lastFallbackUpdate > this.fallbackTTL) {
      this.fallbackProxies = [];
    }
    
    // 添加新的代理到降级缓存
    for (const proxy of proxies) {
      const exists = this.fallbackProxies.some(p => 
        p.host === proxy.host && p.port === proxy.port
      );
      
      if (!exists) {
        this.fallbackProxies.push(proxy);
      }
    }
    
    // 限制降级缓存大小
    if (this.fallbackProxies.length > this.config.redis.maxCacheSize) {
      this.fallbackProxies = this.fallbackProxies.slice(-this.config.redis.maxCacheSize);
    }
    
    this.lastFallbackUpdate = now;
    
    logger.debug('降级缓存已更新', {
      cacheSize: this.fallbackProxies.length,
      addedProxies: proxies.length
    });
  }

  /**
   * 从降级缓存获取代理
   */
  private getFallbackProxies(count: number): ProxyConfig[] {
    const now = Date.now();
    
    // 检查降级缓存是否过期
    if (now - this.lastFallbackUpdate > this.fallbackTTL) {
      logger.warn('降级缓存已过期，清空缓存');
      this.fallbackProxies = [];
      return [];
    }
    
    // 返回可用的代理
    const availableProxies = this.fallbackProxies.slice(0, count);
    
    logger.info(`从降级缓存返回 ${availableProxies.length} 个代理`, {
      requested: count,
      available: availableProxies.length,
      cacheSize: this.fallbackProxies.length,
      cacheAge: now - this.lastFallbackUpdate
    });
    
    return availableProxies;
  }

  /**
   * 启动降级缓存清理定时器
   */
  private startFallbackCleanup(): void {
    // 每小时清理一次过期缓存
    setInterval(() => {
      const now = Date.now();
      if (now - this.lastFallbackUpdate > this.fallbackTTL) {
        logger.info('清理过期的降级缓存');
        this.fallbackProxies = [];
      }
    }, 60 * 60 * 1000);
  }

  /**
   * 获取服务状态信息
   */
  getServiceStatus(): {
    isRunning: boolean;
    redisConnected: boolean;
    fallbackCacheSize: number;
    fallbackCacheAge: number;
    currentProxyUrl: string | null;
    lastHeartbeat?: number;
    connectionStatus?: any;
  } {
    const now = Date.now();
    const connectionStatus = this.redisCache.getConnectionStatus ? this.redisCache.getConnectionStatus() : null;
    
    return {
      isRunning: this.isRunning,
      redisConnected: connectionStatus?.isConnected || false,
      fallbackCacheSize: this.fallbackProxies.length,
      fallbackCacheAge: now - this.lastFallbackUpdate,
      currentProxyUrl: this.currentProxyUrl,
      lastHeartbeat: connectionStatus?.lastHeartbeat,
      connectionStatus
    };
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.isRunning = false;
    this.currentProxyUrl = null;
    this.fallbackProxies = [];
    
    if (this.supplementTimer) {
      clearInterval(this.supplementTimer);
      this.supplementTimer = null;
    }
    
    logger.info('简化代理服务已销毁');
  }
}

// 全局单例实例
let simplifiedProxyService: SimplifiedProxyService | null = null;

/**
 * 获取简化代理服务实例
 */
export function getSimplifiedProxyService(): SimplifiedProxyService {
  if (!simplifiedProxyService) {
    simplifiedProxyService = new SimplifiedProxyService();
  }
  return simplifiedProxyService;
}

/**
 * 重置简化代理服务（主要用于测试）
 */
export function resetSimplifiedProxyService(): void {
  if (simplifiedProxyService) {
    simplifiedProxyService.destroy();
    simplifiedProxyService = null;
  }
}

// 导出类和配置供测试使用
export { SimplifiedProxyService, type SimplifiedProxyConfig, DEFAULT_CONFIG };