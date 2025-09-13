/**
 * Simple Multi-Layer Cache Implementation
 * 简化的多层缓存实现，基于现有的Cache系统
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { Cache, CacheConfig } from '@/lib/core/Cache';
import { ICache } from '@/lib/core/types';

const logger = createLogger('SimpleMultiLayerCache');

/**
 * 缓存选项接口
 */
export interface CacheOptions {
  ttl?: number;
  strategy?: 'l1-l2-l3' | 'l1-l2' | 'l1-only';
  forceRefresh?: boolean;
  namespace?: string;
}

/**
 * 简化的多层缓存管理器
 */
export class SimpleMultiLayerCache implements ICache {
  private l1Cache: Map<string, { value: any; expiresAt: number }>;
  private l2Cache: Cache;
  private l3Cache: Cache;
  private statistics: {
    hits: { l1: number; l2: number; l3: number };
    misses: number;
    totalRequests: number;
  };

  constructor(config: CacheConfig = {}) {
    this.l1Cache = new Map();
    this.l2Cache = new Cache(undefined, { ...config });
    this.l3Cache = new Cache(undefined, { ...config });
    
    this.statistics = {
      hits: { l1: 0, l2: 0, l3: 0 },
      misses: 0,
      totalRequests: 0
    };
  }

  /**
   * 获取缓存值
   */
  async get<T>(key: string): Promise<T | null> {
    this.statistics.totalRequests++;

    // L1: 内存缓存
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && Date.now() < l1Entry.expiresAt) {
      this.statistics.hits.l1++;
      return l1Entry.value as T;
    }

    // L2: 缓存层
    const l2Value = await this.l2Cache.get<T>(key);
    if (l2Value !== null) {
      // 提升到L1缓存
      this.l1Cache.set(key, {
        value: l2Value,
        expiresAt: Date.now() + 300000
      });
      this.statistics.hits.l2++;
      return l2Value;
    }

    // L3: 持久化缓存
    const l3Value = await this.l3Cache.get<T>(key);
    if (l3Value !== null) {
      // 提升到L1和L2缓存
      this.l1Cache.set(key, {
        value: l3Value,
        expiresAt: Date.now() + 300000
      });
      await this.l2Cache.set(key, l3Value, 300000);
      this.statistics.hits.l3++;
      return l3Value;
    }

    this.statistics.misses++;
    return null as any;
  }

  /**
   * 设置缓存值
   */
  async set<T>(key: string, value: T, ttl: number = 300000): Promise<void> {
    // L1缓存
    this.l1Cache.set(key, {
      value,
      expiresAt: Date.now() + ttl
    });

    // L2缓存
    await this.l2Cache.set(key, value, ttl);

    // L3缓存
    await this.l3Cache.set(key, value, ttl);
  }

  /**
   * 删除缓存值
   */
  async delete(key: string): Promise<void> {
    this.l1Cache.delete(key);
    await this.l2Cache.delete(key);
    await this.l3Cache.delete(key);
  }

  /**
   * 检查键是否存在
   */
  async exists(key: string): Promise<boolean> {
    // L1: 内存缓存
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && Date.now() < l1Entry.expiresAt) {
      return true;
    }

    // L2: 缓存层
    const l2Value = await this.l2Cache.get(key);
    if (l2Value !== null) {
      return true;
    }

    // L3: 持久化缓存
    const l3Value = await this.l3Cache.get(key);
    return l3Value !== null;
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    this.l1Cache.clear();
    await this.l2Cache.clear();
    await this.l3Cache.clear();
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    const totalHits = Object.values(this.statistics.hits).reduce((sum, hits: any) => sum + hits, 0);
    const hitRate = this.statistics.totalRequests > 0 ? totalHits / this.statistics.totalRequests : 0;

    return {
      ...this.statistics,
      hitRate,
      l1Size: this.l1Cache.size,
      l2Size: this.l2Cache.size ? this.l2Cache.size : 0,
      l3Size: this.l3Cache.size ? this.l3Cache.size : 0
    };
  }

  /**
   * 清理过期条目
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.l1Cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key: any) => this.l1Cache.delete(key));
  }
}

/**
 * 创建全局缓存实例
 */
let globalCache: SimpleMultiLayerCache | null = null;

export function getGlobalCache(): SimpleMultiLayerCache {
  if (!globalCache) {
    globalCache = new SimpleMultiLayerCache();
  }
  return globalCache;
}

export function createGlobalCache(config?: CacheConfig): SimpleMultiLayerCache {
  globalCache = new SimpleMultiLayerCache(config);
  return globalCache;
}

// 便捷函数
export async function cacheGet<T>(key: string): Promise<T | null> {
  const cache = getGlobalCache();
  return cache.get<T>(key);
}

export async function cacheSet<T>(key: string, value: T, ttl?: number): Promise<void> {
  const cache = getGlobalCache();
  return cache.set<T>(key, value, ttl);
}

export async function cacheDelete(key: string): Promise<void> {
  const cache = getGlobalCache();
  return cache.delete(key);
}

export async function cacheExists(key: string): Promise<boolean> {
  const cache = getGlobalCache();
  return cache.exists(key);
}

export function getCacheStatistics() {
  const cache = getGlobalCache();
  return cache.getStatistics();
}