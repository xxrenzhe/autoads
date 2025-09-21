import { SiteRankCacheService } from '@/lib/cache/siterank-cache';
import { AnalysisResult } from '@/lib/siterank/types';
import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('OptimizedBatchQueryService');

/**
 * 优化的批量查询服务
 * 优先使用单域名缓存，只对未缓存的域名发起API调用
 */
export class OptimizedBatchQueryService {
  
  /**
   * 批量查询域名数据（优化版）
   * @param domains 域名列表
   * @param queryFunction 单个域名查询函数
   * @param options 查询选项
   */
  static async queryMultipleDomains(
    domains: string[],
    queryFunction: (domain: string) => Promise<AnalysisResult>,
    options?: {
      concurrency?: number;
      delayBetweenRequests?: number;
      delayBetweenBatches?: number;
    }
  ): Promise<{
    results: AnalysisResult[];
    cacheHits: number;
    apiCalls: number;
    totalTime: number;
  }> {
    const startTime = Date.now();
    const concurrency = options?.concurrency || 3;
    const delayBetweenRequests = options?.delayBetweenRequests || 3000;
    const delayBetweenBatches = options?.delayBetweenBatches || 5000;
    
    logger.info(`开始优化批量查询 ${domains.length} 个域名`);
    
    // 第一步：检查所有域名的缓存
    const cacheCheckPromises = domains.map(async (domain) => {
      const cacheKey = { domain, type: 'similarweb' as const };
      const cached = await SiteRankCacheService.getDomainResult(cacheKey);
      return { domain, cached };
    });
    
    const cacheResults = await Promise.all(cacheCheckPromises);
    
    // 第二步：分离已缓存和未缓存的域名
    const cachedResults: AnalysisResult[] = [];
    const uncachedDomains: string[] = [];
    const domainToIndexMap = new Map<string, number>();
    
    cacheResults.forEach(({ domain, cached }, index: any) => {
      domainToIndexMap.set(domain, index);
      
      if (cached) {
        cachedResults[index] = cached;
      } else {
        uncachedDomains.push(domain);
      }
    });
    
    const cacheHits = cachedResults.filter(Boolean).length;
    const apiCalls = uncachedDomains.length;
    
    logger.info(`缓存统计: ${cacheHits} 个命中, ${apiCalls} 个需要API调用`);
    
    // 第三步：只对未缓存的域名发起API调用
    const apiResults: AnalysisResult[] = [];
    
    if (uncachedDomains.length > 0) {
      // 分批处理未缓存的域名
      for (let i = 0; i < uncachedDomains.length; i += concurrency) {
        const batch = uncachedDomains.slice(i, i + concurrency);
        
        const batchPromises = batch.map(async (domain, index) => {
          // 域名间延迟
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
          }
          
          try {
            const result = await queryFunction(domain);
            
            // 缓存结果
            const cacheKey = { domain, type: 'similarweb' as const };
            await SiteRankCacheService.setDomainResult(cacheKey, result);
            
            return result;
          } catch (error) {
            logger.error(`查询域名失败: ${domain}`, error as Error);
            return {
              domain,
              globalRank: null,
              monthlyVisits: null,
              status: 'error',
              error: error instanceof Error ? error.message : '未知错误',
              timestamp: new Date().toISOString(),
              source: 'similarweb-api'
            } as AnalysisResult;
          }
        });
        
        // 等待当前批次完成
        const batchResults = await Promise.all(batchPromises);
        
        // 将API结果放到正确的位置
        batchResults.forEach((result, batchIndex: any) => {
          const domain = batch[batchIndex];
          const originalIndex = domainToIndexMap.get(domain);
          if (originalIndex !== undefined) {
            apiResults[originalIndex] = result;
          }
        });
        
        // 批次间延迟
        if (i + concurrency < uncachedDomains.length) {
          logger.info(`批次间等待 ${delayBetweenBatches}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }
    }
    
    // 第四步：合并结果
    const finalResults: AnalysisResult[] = [];
    for (let i = 0; i < domains.length; i++) {
      if (cachedResults[i]) {
        finalResults[i] = cachedResults[i];
      } else if (apiResults[i]) {
        finalResults[i] = apiResults[i];
      } else {
        // 理论上不应该到这里
        finalResults[i] = {
          domain: domains[i],
          status: 'error',
          error: '查询失败',
          timestamp: new Date().toISOString()
        } as AnalysisResult;
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    // 统计信息
    const successCount = finalResults.filter((r: any) => r.status === 'success').length;
    const errorCount = finalResults.filter((r: any) => r.status === 'error').length;
    
    logger.info(`批量查询完成:`, {
      totalDomains: domains.length,
      cacheHits,
      apiCalls,
      successCount,
      errorCount,
      totalTime: `${totalTime}ms`,
      cacheHitRate: `${((cacheHits / domains.length) * 100).toFixed(1)}%`
    });
    
    return {
      results: finalResults,
      cacheHits,
      apiCalls,
      totalTime
    };
  }
  
  /**
   * 获取批量查询的缓存统计
   */
  static async getCacheStats() {
    const stats = await SiteRankCacheService.getStats();
    return {
      ...stats,
      cacheHitRate: `${(stats.hitRate * 100).toFixed(2)}%`
    };
  }
}