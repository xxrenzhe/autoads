/**
 * SiteRank 批量查询优化示例
 * 展示如何使用新的缓存优先批量查询功能
 */

import { similarWebService } from '@/lib/siterank/similarweb-service';
import { OptimizedBatchQueryService } from '@/lib/siterank/optimized-batch-query';
import { AnalysisResult } from '@/lib/siterank/types';

// 示例1：使用SimilarWebService的批量查询（已优化）
export async function exampleBatchQuery() {
  const domains = [
    'google.com',
    'facebook.com',
    'twitter.com',
    'example.com',
    'nonexistent-domain-12345.com'
  ];
  
  console.log('=== 批量查询示例 ===');
  
  try {
    const results = await similarWebService.queryMultipleDomains(domains, {
      concurrency: 3
    });
    
    console.log('查询结果:');
    results.forEach((result: any) => {
      console.log(`- ${result.domain}: ${result.status}`);
      if (result.status === 'success') {
        console.log(`  排名: ${result.globalRank}, 访问量: ${result.monthlyVisits}`);
      } else {
        console.log(`  错误: ${result.error}`);
      }
    });
    
  } catch (error) {
    console.error('批量查询失败:', error);
  }
}

// 示例2：直接使用OptimizedBatchQueryService
export async function exampleOptimizedBatchQuery() {
  const domains = ['google.com', 'facebook.com', 'twitter.com'];
  
  console.log('=== 优化批量查询示例 ===');
  
  try {
    const { results, cacheHits, apiCalls, totalTime } = 
      await OptimizedBatchQueryService.queryMultipleDomains(
        domains,
        async (domain) => {
          // 这里可以替换为任何查询函数
          const similarWebData = await similarWebService.queryDomainData(domain);
          // 转换为 AnalysisResult 类型
          return {
            domain: similarWebData.domain,
            域名: similarWebData.domain,
            GlobalRank: similarWebData.globalRank,
            全球排名: similarWebData.globalRank,
            MonthlyVisits: similarWebData.monthlyVisits,
            网站流量: similarWebData.monthlyVisits,
            priority: 1,
            status: similarWebData.status
          } as AnalysisResult;
        },
        {
          concurrency: 2,
          delayBetweenRequests: 2000,
          delayBetweenBatches: 3000
        }
      );
    
    console.log(`查询完成 - 总耗时: ${totalTime}ms`);
    console.log(`缓存命中: ${cacheHits}, API调用: ${apiCalls}`);
    console.log(`缓存命中率: ${((cacheHits / domains.length) * 100).toFixed(1)}%`);
    
    results.forEach((result: any) => {
      console.log(`- ${result.domain}: ${result.status}`);
    });
    
  } catch (error) {
    console.error('优化批量查询失败:', error);
  }
}

// 示例3：获取缓存统计
export async function exampleCacheStats() {
  console.log('=== 缓存统计示例 ===');
  
  try {
    const stats = await OptimizedBatchQueryService.getCacheStats();
    console.log('缓存统计信息:');
    console.log(`- 总命中次数: ${stats.hits}`);
    console.log(`- 命中率: ${stats.cacheHitRate}`);
    
  } catch (error) {
    console.error('获取缓存统计失败:', error);
  }
}

// 使用示例
// import { exampleBatchQuery, exampleOptimizedBatchQuery, exampleCacheStats } from './examples';
// await exampleBatchQuery();
// await exampleOptimizedBatchQuery();
// await exampleCacheStats();