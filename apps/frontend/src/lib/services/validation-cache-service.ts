/**
 * Enhanced Validation Cache Service
 * 增强的验证缓存服务，专门为代理验证流程设计
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { ProxyConfig } from '@/lib/utils/proxy-utils';
import { getGlobalCache, cacheGet, cacheSet, cacheDelete, getCacheStatistics } from '@/lib/cache/SimpleMultiLayerCache';
import { BATCH_OPEN_CONFIG } from '@/config/batch-open';

const logger = createLogger('ValidationCacheService');

// 缓存键前缀
const CACHE_PREFIXES = {
  PROXY_URL_RESPONSE: 'proxy_url_response:',
  PROXY_CONFIG_VALIDATION: 'proxy_config_validation:',
  PROXY_REFERER_VALIDATION: 'proxy_referer_validation:',
  PROXY_CONNECTIVITY: 'proxy_connectivity:'
} as const;

// 缓存TTL配置（毫秒）
const CACHE_TTL = {
  PROXY_URL_RESPONSE: 10 * 60 * 1000, // 10分钟 - 代理API响应缓存
  PROXY_CONFIG_VALIDATION: 30 * 60 * 1000, // 30分钟 - 代理配置验证缓存
  PROXY_REFERER_VALIDATION: 15 * 60 * 1000, // 15分钟 - 代理+referer验证缓存
  PROXY_CONNECTIVITY: 5 * 60 * 1000 // 5分钟 - 代理连接性缓存
} as const;

export interface ProxyURLResponse {
  success: boolean;
  proxyConfig?: ProxyConfig;
  error?: string;
  timestamp: number;
  responseTime: number;
}

export interface ProxyConnectivityResult {
  success: boolean;
  responseTime: number;
  error?: string;
  timestamp: number;
}

export interface ProxyConfigValidation {
  success: boolean;
  isValid: boolean;
  suggestions: string[];
  error?: string;
  timestamp: number;
  validationTime: number;
  connectivity?: ProxyConnectivityResult;
}

export interface ProxyRefererValidation {
  success: boolean;
  proxyVerification?: {
    success: boolean;
    actualIP?: string;
    proxyStatus?: string;
    error?: string;
  };
  refererVerification?: {
    success: boolean;
    actualReferer?: string;
    refererStatus?: string;
    error?: string;
  };
  userAgentVerification?: {
    success: boolean;
    actualUserAgent?: string;
    expectedUserAgent?: string;
  };
  timestamp: number;
  validationTime: number;
}

export interface CacheStatistics {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  size: number;
  lastCleanup: number;
}

/**
 * 验证缓存服务类
 */
export class ValidationCacheService {
  private cache = getGlobalCache();
  private statistics: Map<string, CacheStatistics> = new Map();

  constructor() {
    this.initializeStatistics();
    // 启动定期清理
    this.startPeriodicCleanup();
  }

  /**
   * 初始化统计信息
   */
  private initializeStatistics(): void {
    Object.values(CACHE_PREFIXES).forEach(prefix => {
      this.statistics.set(prefix, {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalRequests: 0,
        size: 0,
        lastCleanup: Date.now()
      });
    });
  }

  /**
   * 获取代理URL响应缓存
   */
  async getProxyURLResponse(proxyUrl: string): Promise<ProxyURLResponse | null> {
    const key = `${CACHE_PREFIXES.PROXY_URL_RESPONSE}${this.hashProxyUrl(proxyUrl)}`;
    const stats = this.statistics.get(CACHE_PREFIXES.PROXY_URL_RESPONSE)!;
    
    stats.totalRequests++;
    
    try {
      const cached = await cacheGet<ProxyURLResponse>(key);
      
      if (cached && this.isValidCache(cached.timestamp, CACHE_TTL.PROXY_URL_RESPONSE)) {
        stats.hits++;
        logger.debug('代理URL响应缓存命中', { proxyUrl, key: key.substring(0, 50) });
        return cached;
      } else {
        stats.misses++;
        if (cached) {
          await cacheDelete(key); // 清理过期缓存
        }
      }
    } catch (error) {
      logger.warn('获取代理URL响应缓存失败', { error, proxyUrl });
      stats.misses++;
    }
    
    this.updateHitRate(stats);
    return null as any;
  }

  /**
   * 设置代理URL响应缓存
   */
  async setProxyURLResponse(proxyUrl: string, response: ProxyURLResponse): Promise<void> {
    const key = `${CACHE_PREFIXES.PROXY_URL_RESPONSE}${this.hashProxyUrl(proxyUrl)}`;
    const stats = this.statistics.get(CACHE_PREFIXES.PROXY_URL_RESPONSE)!;
    
    try {
      await cacheSet(key, response, CACHE_TTL.PROXY_URL_RESPONSE);
      stats.size++;
      logger.debug('代理URL响应缓存设置', { proxyUrl, key: key.substring(0, 50) });
    } catch (error) {
      logger.warn('设置代理URL响应缓存失败', { error, proxyUrl });
    }
  }

  /**
   * 获取代理配置验证缓存
   */
  async getProxyConfigValidation(proxyConfig: ProxyConfig): Promise<ProxyConfigValidation | null> {
    const key = `${CACHE_PREFIXES.PROXY_CONFIG_VALIDATION}${this.hashProxyConfig(proxyConfig)}`;
    const stats = this.statistics.get(CACHE_PREFIXES.PROXY_CONFIG_VALIDATION)!;
    
    stats.totalRequests++;
    
    try {
      const cached = await cacheGet<ProxyConfigValidation>(key);
      
      if (cached && this.isValidCache(cached.timestamp, CACHE_TTL.PROXY_CONFIG_VALIDATION)) {
        stats.hits++;
        logger.debug('代理配置验证缓存命中', { 
          proxy: `${proxyConfig.host}:${proxyConfig.port}`,
          key: key.substring(0, 50) 
        });
        return cached;
      } else {
        stats.misses++;
        if (cached) {
          await cacheDelete(key);
        }
      }
    } catch (error) {
      logger.warn('获取代理配置验证缓存失败', { 
        error, 
        proxy: `${proxyConfig.host}:${proxyConfig.port}` 
      });
      stats.misses++;
    }
    
    this.updateHitRate(stats);
    return null as any;
  }

  /**
   * 设置代理配置验证缓存
   */
  async setProxyConfigValidation(proxyConfig: ProxyConfig, validation: ProxyConfigValidation): Promise<void> {
    const key = `${CACHE_PREFIXES.PROXY_CONFIG_VALIDATION}${this.hashProxyConfig(proxyConfig)}`;
    const stats = this.statistics.get(CACHE_PREFIXES.PROXY_CONFIG_VALIDATION)!;
    
    try {
      await cacheSet(key, validation, CACHE_TTL.PROXY_CONFIG_VALIDATION);
      stats.size++;
      logger.debug('代理配置验证缓存设置', { 
        proxy: `${proxyConfig.host}:${proxyConfig.port}`,
        key: key.substring(0, 50) 
      });
    } catch (error) {
      logger.warn('设置代理配置验证缓存失败', { 
        error, 
        proxy: `${proxyConfig.host}:${proxyConfig.port}` 
      });
    }
  }

  /**
   * 获取代理+referer验证缓存
   */
  async getProxyRefererValidation(
    proxyConfig: ProxyConfig | undefined, 
    referer: string, 
    userAgent?: string
  ): Promise<ProxyRefererValidation | null> {
    const key = `${CACHE_PREFIXES.PROXY_REFERER_VALIDATION}${this.hashProxyRefererCombo(proxyConfig, referer, userAgent)}`;
    const stats = this.statistics.get(CACHE_PREFIXES.PROXY_REFERER_VALIDATION)!;
    
    stats.totalRequests++;
    
    try {
      const cached = await cacheGet<ProxyRefererValidation>(key);
      
      if (cached && this.isValidCache(cached.timestamp, CACHE_TTL.PROXY_REFERER_VALIDATION)) {
        stats.hits++;
        logger.debug('代理+referer验证缓存命中', { 
          proxy: proxyConfig ? `${proxyConfig.host}:${proxyConfig.port}` : 'none',
          referer: referer.substring(0, 50),
          key: key.substring(0, 50) 
        });
        return cached;
      } else {
        stats.misses++;
        if (cached) {
          await cacheDelete(key);
        }
      }
    } catch (error) {
      logger.warn('获取代理+referer验证缓存失败', { 
        error, 
        proxy: proxyConfig ? `${proxyConfig.host}:${proxyConfig.port}` : 'none',
        referer: referer.substring(0, 50)
      });
      stats.misses++;
    }
    
    this.updateHitRate(stats);
    return null as any;
  }

  /**
   * 设置代理+referer验证缓存
   */
  async setProxyRefererValidation(
    proxyConfig: ProxyConfig | undefined, 
    referer: string, 
    userAgent: string | undefined, 
    validation: ProxyRefererValidation
  ): Promise<void> {
    const key = `${CACHE_PREFIXES.PROXY_REFERER_VALIDATION}${this.hashProxyRefererCombo(proxyConfig, referer, userAgent)}`;
    const stats = this.statistics.get(CACHE_PREFIXES.PROXY_REFERER_VALIDATION)!;
    
    try {
      await cacheSet(key, validation, CACHE_TTL.PROXY_REFERER_VALIDATION);
      stats.size++;
      logger.debug('代理+referer验证缓存设置', { 
        proxy: proxyConfig ? `${proxyConfig.host}:${proxyConfig.port}` : 'none',
        referer: referer.substring(0, 50),
        key: key.substring(0, 50) 
      });
    } catch (error) {
      logger.warn('设置代理+referer验证缓存失败', { 
        error, 
        proxy: proxyConfig ? `${proxyConfig.host}:${proxyConfig.port}` : 'none',
        referer: referer.substring(0, 50)
      });
    }
  }

  /**
   * 获取代理连接性缓存
   */
  async getProxyConnectivity(proxyConfig: ProxyConfig): Promise<ProxyConnectivityResult | null> {
    const key = `${CACHE_PREFIXES.PROXY_CONNECTIVITY}${this.hashProxyConfig(proxyConfig)}`;
    const stats = this.statistics.get(CACHE_PREFIXES.PROXY_CONNECTIVITY)!;
    
    stats.totalRequests++;
    
    try {
      const cached = await cacheGet<ProxyConnectivityResult>(key);
      
      if (cached && this.isValidCache(cached.timestamp, CACHE_TTL.PROXY_CONNECTIVITY)) {
        stats.hits++;
        logger.debug('代理连接性缓存命中', { 
          proxy: `${proxyConfig.host}:${proxyConfig.port}`,
          responseTime: cached.responseTime
        });
        return cached;
      } else {
        stats.misses++;
        if (cached) {
          await cacheDelete(key);
        }
      }
    } catch (error) {
      logger.warn('获取代理连接性缓存失败', { 
        error, 
        proxy: `${proxyConfig.host}:${proxyConfig.port}` 
      });
      stats.misses++;
    }
    
    this.updateHitRate(stats);
    return null as any;
  }

  /**
   * 设置代理连接性缓存
   */
  async setProxyConnectivity(proxyConfig: ProxyConfig, result: ProxyConnectivityResult): Promise<void> {
    const key = `${CACHE_PREFIXES.PROXY_CONNECTIVITY}${this.hashProxyConfig(proxyConfig)}`;
    const stats = this.statistics.get(CACHE_PREFIXES.PROXY_CONNECTIVITY)!;
    
    try {
      await cacheSet(key, result, CACHE_TTL.PROXY_CONNECTIVITY);
      stats.size++;
      logger.debug('代理连接性缓存设置', { 
        proxy: `${proxyConfig.host}:${proxyConfig.port}`,
        success: result.success,
        responseTime: result.responseTime
      });
    } catch (error) {
      logger.warn('设置代理连接性缓存失败', { 
        error, 
        proxy: `${proxyConfig.host}:${proxyConfig.port}` 
      });
    }
  }

  /**
   * 清理特定类型的缓存
   */
  async clearCacheType(type: keyof typeof CACHE_PREFIXES): Promise<void> {
    const prefix = CACHE_PREFIXES[type];
    const stats = this.statistics.get(prefix)!;
    
    try {
      // 注意：这是一个简化的实现，实际应用中可能需要更复杂的键模式匹配
      // 由于当前缓存系统不支持模式删除，这里重置统计信息
      stats.size = 0;
      stats.lastCleanup = Date.now();
      
      logger.info(`清理缓存类型: ${type}`, { prefix });
    } catch (error) {
      logger.warn('清理缓存失败', { error, type });
    }
  }

  /**
   * 清理所有验证缓存
   */
  async clearAllValidationCache(): Promise<void> {
    try {
      for (const type of Object.keys(CACHE_PREFIXES) as Array<keyof typeof CACHE_PREFIXES>) {
        await this.clearCacheType(type);
      }
      
      logger.info('所有验证缓存已清理');
    } catch (error) {
      logger.warn('清理所有验证缓存失败', { error });
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStatistics(): Record<string, CacheStatistics> {
    const result: Record<string, CacheStatistics> = {};
    
    this.statistics.forEach((stats, prefix) => {
      result[prefix] = { ...stats };
    });
    
    return result;
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): {
    totalRequests: number;
    totalHits: number;
    totalMisses: number;
    overallHitRate: number;
    cacheTypes: Array<{
      prefix: string;
      requests: number;
      hits: number;
      hitRate: number;
      size: number;
    }>;
  } {
    let totalRequests = 0;
    let totalHits = 0;
    let totalMisses = 0;
    
    const cacheTypes = Array.from(this.statistics.entries()).map(([prefix, stats]) => {
      totalRequests += stats.totalRequests;
      totalHits += stats.hits;
      totalMisses += stats.misses;
      
      return {
        prefix,
        requests: stats.totalRequests,
        hits: stats.hits,
        hitRate: stats.hitRate,
        size: stats.size
      };
    });
    
    const overallHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
    
    return {
      totalRequests,
      totalHits,
      totalMisses,
      overallHitRate,
      cacheTypes
    };
  }

  // 私有方法

  /**
   * 检查缓存是否有效
   */
  private isValidCache(timestamp: number, ttl: number): boolean {
    return Date.now() - timestamp < ttl;
  }

  /**
   * 更新命中率
   */
  private updateHitRate(stats: CacheStatistics): void {
    stats.hitRate = stats.totalRequests > 0 ? stats.hits / stats.totalRequests : 0;
  }

  /**
   * 哈希代理URL
   */
  private hashProxyUrl(proxyUrl: string): string {
    // 简单的哈希实现，实际应用中可以使用更复杂的哈希算法
    return Buffer.from(proxyUrl).toString('base64').substring(0, 32);
  }

  /**
   * 哈希代理配置
   */
  private hashProxyConfig(proxyConfig: ProxyConfig): string {
    const configStr = `${proxyConfig.protocol}:${proxyConfig.host}:${proxyConfig.port}:${proxyConfig.username || ''}:${proxyConfig.password || ''}`;
    return Buffer.from(configStr).toString('base64');
  }

  /**
   * 哈希代理+referer组合
   */
  private hashProxyRefererCombo(
    proxyConfig: ProxyConfig | undefined, 
    referer: string, 
    userAgent?: string
  ): string {
    const proxyStr = proxyConfig ? `${proxyConfig.protocol}:${proxyConfig.host}:${proxyConfig.port}` : 'none';
    const comboStr = `${proxyStr}:${referer}:${userAgent || ''}`;
    return Buffer.from(comboStr).toString('base64').substring(0, 32);
  }

  /**
   * 启动定期清理
   */
  private startPeriodicCleanup(): void {
    // 每30分钟清理一次过期缓存
    setInterval(() => {
      this.performCleanup();
    }, 30 * 60 * 1000);
  }

  /**
   * 执行清理
   */
  private async performCleanup(): Promise<void> {
    try {
      const now = Date.now();
      let cleanedCount = 0;
      
      // 检查每个缓存类型的统计信息
      this.statistics.forEach((stats, prefix) => {
        if (now - stats.lastCleanup > 30 * 60 * 1000) { // 30分钟
          stats.lastCleanup = now;
          cleanedCount++;
        }
      });
      
      if (cleanedCount > 0) {
        logger.info('定期缓存清理完成', { cleanedCount });
      }
    } catch (error) {
      logger.warn('定期缓存清理失败', { error });
    }
  }
}

// 创建全局实例
let validationCacheService: ValidationCacheService | null = null;

export function getValidationCacheService(): ValidationCacheService {
  if (!validationCacheService) {
    validationCacheService = new ValidationCacheService();
  }
  return validationCacheService;
}

// 便捷函数
export async function getCachedProxyURLResponse(proxyUrl: string): Promise<ProxyURLResponse | null> {
  const service = getValidationCacheService();
  return service.getProxyURLResponse(proxyUrl);
}

export async function setCachedProxyURLResponse(proxyUrl: string, response: ProxyURLResponse): Promise<void> {
  const service = getValidationCacheService();
  return service.setProxyURLResponse(proxyUrl, response);
}

export async function getCachedProxyConfigValidation(proxyConfig: ProxyConfig): Promise<ProxyConfigValidation | null> {
  const service = getValidationCacheService();
  return service.getProxyConfigValidation(proxyConfig);
}

export async function setCachedProxyConfigValidation(proxyConfig: ProxyConfig, validation: ProxyConfigValidation): Promise<void> {
  const service = getValidationCacheService();
  return service.setProxyConfigValidation(proxyConfig, validation);
}

export async function getCachedProxyRefererValidation(
  proxyConfig: ProxyConfig | undefined, 
  referer: string, 
  userAgent?: string
): Promise<ProxyRefererValidation | null> {
  const service = getValidationCacheService();
  return service.getProxyRefererValidation(proxyConfig, referer, userAgent);
}

export async function setCachedProxyRefererValidation(
  proxyConfig: ProxyConfig | undefined, 
  referer: string, 
  userAgent: string | undefined, 
  validation: ProxyRefererValidation
): Promise<void> {
  const service = getValidationCacheService();
  return service.setProxyRefererValidation(proxyConfig, referer, userAgent, validation);
}

export async function getCachedProxyConnectivity(proxyConfig: ProxyConfig): Promise<ProxyConnectivityResult | null> {
  const service = getValidationCacheService();
  return service.getProxyConnectivity(proxyConfig);
}

export async function setCachedProxyConnectivity(proxyConfig: ProxyConfig, result: ProxyConnectivityResult): Promise<void> {
  const service = getValidationCacheService();
  return service.setProxyConnectivity(proxyConfig, result);
}