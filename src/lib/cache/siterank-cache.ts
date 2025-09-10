import { SimpleCacheService, CacheOptions } from './simple-cache';
import { AnalysisResult } from '@/lib/siterank/types';

export interface SiteRankCacheKey {
  domain: string;
  type: 'similarweb';
  forceRefresh?: boolean;
}


export class SiteRankCacheService {
  private static readonly PREFIX = 'siterank:';
  
  // 单个域名查询缓存
  static async getDomainResult(
    key: SiteRankCacheKey
  ): Promise<AnalysisResult | null> {
    const cacheKey = this.buildDomainKey(key);
    const options: CacheOptions = {
      ttl: this.getTTL(key.type),
      tags: ['siterank', `siterank:${key.type}`]
    };
    
    return SimpleCacheService.get<AnalysisResult>(cacheKey);
  }
  
  static async setDomainResult(
    key: SiteRankCacheKey,
    result: AnalysisResult
  ): Promise<void> {
    const cacheKey = this.buildDomainKey(key);
    const ttl = this.getTTL(key.type, result.status === 'success');
    const options: CacheOptions = {
      ttl,
      tags: ['siterank', `siterank:${key.type}`]
    };
    
    await SimpleCacheService.set(cacheKey, result, options);
  }
  
    
  // 获取或设置（单个域名）
  static async getOrSetDomain(
    key: SiteRankCacheKey,
    factory: () => Promise<AnalysisResult>
  ): Promise<AnalysisResult> {
    const cacheKey = this.buildDomainKey(key);
    const options: CacheOptions = {
      ttl: this.getTTL(key.type),
      tags: ['siterank', `siterank:${key.type}`]
    };
    
    return SimpleCacheService.getOrSet(cacheKey, factory, options);
  }
  
  // 预热缓存
  static async warmup(
    domains: string[],
    type: 'similarweb' = 'similarweb'
  ): Promise<void> {
    const promises = domains.map(async (domain) => {
      const key: SiteRankCacheKey = { domain, type };
      const cached = await this.getDomainResult(key);
      if (!cached) {
        // 可以在这里触发后台预热任务
        console.log(`Cache miss for domain: ${domain}`);
      }
    });
    
    await Promise.allSettled(promises);
  }
  
  // 清除特定域名的缓存
  static async invalidateDomain(domain: string, type?: 'similarweb'): Promise<void> {
    const tags = type ? [`siterank:${type}`] : ['siterank'];
    await SimpleCacheService.deleteByTags(tags);
  }
  
  // 清除所有SiteRank缓存
  static async clearAll(): Promise<void> {
    await SimpleCacheService.deleteByTags(['siterank']);
  }
  
  // 获取缓存统计
  static async getStats(): Promise<{
    hits: number;
    hitRate: number;
  }> {
    const globalStats = SimpleCacheService.getStats();
    
    return {
      hits: globalStats.hits,
      hitRate: globalStats.hitRate
    };
  }
  
  // 构建缓存键
  private static buildDomainKey(key: SiteRankCacheKey): string {
    return `${this.PREFIX}${key.type}:${key.domain.toLowerCase()}`;
  }
  
    
  // 根据状态获取TTL
  private static getTTL(type: 'similarweb', isSuccess: boolean = true): number {
    if (!isSuccess) {
      return 3600; // 失败结果缓存1小时
    }
    
    return 7 * 24 * 3600; // 成功结果缓存7天
  }
  
  }