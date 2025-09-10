/**
 * SiteRank Configuration
 * Centralized configuration for SiteRank feature
 */

export interface SiteRankConfig {
  batchQueryLimit: number;
  enableRateLimiting: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

/**
 * Get SiteRank configuration from environment variables
 */
export function getSiteRankConfig(): SiteRankConfig {
  return {
    // 批量查询限制，默认100个域名
    batchQueryLimit: parseInt(process.env.SITERANK_BATCH_QUERY_LIMIT || '100', 10),
    
    // 是否启用速率限制，默认启用
    enableRateLimiting: process.env.SITERANK_ENABLE_RATE_LIMITING !== 'false',
    
    // 速率限制时间窗口（毫秒），默认1分钟
    rateLimitWindowMs: parseInt(process.env.SITERANK_RATE_LIMIT_WINDOW_MS || '60000', 10),
    
    // 速率限制最大请求数，默认5次
    rateLimitMaxRequests: parseInt(process.env.SITERANK_RATE_LIMIT_MAX_REQUESTS || '5', 10)
  };
}

/**
 * 验证批量查询请求数量
 */
export function validateBatchQueryCount(domains: string[]): { valid: boolean; error?: string } {
  const config = getSiteRankConfig();
  
  if (domains.length > config.batchQueryLimit) {
    return {
      valid: false,
      error: `域名列表不能超过${config.batchQueryLimit}个`
    };
  }
  
  return { valid: true };
}

/**
 * 导出默认配置
 */
export const defaultSiteRankConfig = getSiteRankConfig();