import { createLogger } from "@/lib/utils/security/secure-logger";
import { APP_CONFIG } from '@/lib/config';
import { SiteRankCacheService } from '@/lib/cache/siterank-cache';
import { OptimizedBatchQueryService } from '@/lib/siterank/optimized-batch-query';
import { EnhancedError } from '@/lib/utils/error-handling';
import { AnalysisResult } from '@/lib/siterank/types';

const logger = createLogger('SimilarWebService');

export interface SimilarWebData {
  domain: string;
  globalRank: number | null;
  monthlyVisits: string | null;
  status: 'loading' | 'success' | 'error';
  error?: string;
  timestamp: Date;
  source: 'similarweb-api';
  apiEndpoint?: string;
  responseTime?: number;
  retries?: number;
}

export interface SimilarWebApiResponse {
  GlobalRank?: {
    Rank?: number;
  };
  Engagments?: {
    Visits?: number;
  };
  globalRank?: number;
  rank?: number;
  visits?: number;
  EstimatedVisits?: number;
  Traffic?: {
    EstimatedVisits?: number;
  };
  [key: string]: any;
}

interface ApiEndpoint {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  params?: Record<string, string>;
  weight: number; // 优先级权重
}

/**
 * SimilarWeb API 服务 (合并版)
 * 统一处理 SimilarWeb API 查询，包含缓存、批量操作和底层HTTP请求
 */
export class SimilarWebService {
  private baseUrl = process.env.SIMILARWEB_API_URL || (APP_CONFIG as any).similarWeb?.apiUrl || "https://data.similarweb.com/api/v1/data";
  private timeout = (APP_CONFIG as any).similarWeb?.timeout || 30000;
  private readonly REQUEST_DELAY = 2000; // 请求间隔
  private lastRequestTime = 0;
  
  // 使用新的缓存服务

  // SimilarWeb API 端点配置
  private readonly API_ENDPOINTS: ApiEndpoint[] = [
    {
      url: this.baseUrl,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://www.similarweb.com/',
        'Origin': 'https://www.similarweb.com'
      },
      weight: 15
    },
    {
      url: this.baseUrl,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://www.similarweb.com/',
        'Origin': 'https://www.similarweb.com'
      },
      weight: 10
    },
    {
      url: this.baseUrl,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://www.google.com/',
        'Origin': 'https://www.google.com'
      },
      weight: 8
    }
  ];
  
  constructor() {
    // 记录配置信息用于调试
    logger.info('SimilarWebService initialized with configuration:', {
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      envApiUrl: process.env.NEXT_PUBLIC_SIMILARWEB_API_URL || 'NOT_SET',
      envTimeout: process.env.NEXT_PUBLIC_SIMILARWEB_TIMEOUT || 'NOT_SET',
      configApiUrl: (APP_CONFIG as any).external?.similarWeb?.apiUrl || 'UNDEFINED',
      configTimeout: (APP_CONFIG as any).external?.similarWeb?.timeout || 'UNDEFINED',
      endpoints: this.API_ENDPOINTS.length
    });
  }

  /**
   * 验证域名格式
   * @private
   */
  private isValidDomain(domain: string): boolean {
    if (!domain || typeof domain !== 'string') {
      return false;
    }
    
    // 基本清理
    domain = domain.trim().toLowerCase();
    
    // 长度检查
    if (domain.length === 0 || domain.length > 253) {
      return false;
    }
    
    // 检查是否包含协议或路径
    if (domain.includes('://') || domain.includes('/') || domain.includes('?') || domain.includes('#')) {
      return false;
    }
    
    // 域名格式正则验证
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!domainRegex.test(domain)) {
      return false;
    }
    
    // 检查是否以点开头或结尾
    if (domain.startsWith('.') || domain.endsWith('.')) {
      return false;
    }
    
    // 检查是否有连续的点
    if (domain.includes('..')) {
      return false;
    }
    
    // 检查顶级域名
    const tld = domain.split('.').pop();
    if (!tld || tld.length < 2) {
      return false;
    }
    
    // 检查是否为已知的无效查询字符串（基于日志中的模式）
    const invalidPatterns = [
      /making%20each%20one/,
      /an exciting opportunity/,
      /a leading brand/,
      /athletic achievements/,
      /accessible haircare/,
      /one-of-a-kind%20addition/,
      /browse%20our%20selection/
    ];
    
    for (const pattern of invalidPatterns) {
      if (pattern.test(domain)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 查询域名的排名和流量数据
   * 纯净的 SimilarWeb API 查询方法
   */
  async queryDomainData(domain: string, options?: {
    forceRefresh?: boolean;
    timeout?: number;
    maxRetries?: number;
  }): Promise<SimilarWebData> {
    const timeout = options?.timeout || this.timeout;
    const maxRetries = options?.maxRetries || 3;

    logger.info(`开始查询域名数据: ${domain}`, { options });

    // 首先验证域名格式
    if (!this.isValidDomain(domain)) {
      logger.warn(`无效的域名格式: ${domain}`);
      const errorResult: SimilarWebData = {
        domain,
        globalRank: null,
        monthlyVisits: null,
        status: 'error',
        error: '无效的域名格式',
        timestamp: new Date(),
        source: 'similarweb-api'
      };
      return errorResult;
    }

    try {
      // 使用新的缓存服务
      const cacheKey = { domain, type: 'similarweb' as const, forceRefresh: options?.forceRefresh };
      
      // 检查缓存或获取结果
      const analysisResult = await SiteRankCacheService.getOrSetDomain(
        cacheKey,
        async () => {
          const apiResult = await this.executeApiQuery(domain, {
            timeout,
            maxRetries
          });
          
          // 转换为 AnalysisResult 格式
          const result: AnalysisResult = {
            domain: apiResult.domain,
            全球排名: apiResult.globalRank,
            网站流量: apiResult.monthlyVisits || undefined,
            status: apiResult.status,
            error: apiResult.error,
            source: apiResult.source,
            apiEndpoint: apiResult.apiEndpoint,
            responseTime: apiResult.responseTime?.toString() || undefined,
            retries: apiResult.retries?.toString() || undefined
          };
          return result;
        }
      );
      
      // 转换为 SimilarWebData 格式
      const result: SimilarWebData = {
        domain: analysisResult.domain || domain,
        globalRank: analysisResult.全球排名 === 'loading' || analysisResult.全球排名 === undefined ? null : (analysisResult.全球排名 || null),
        monthlyVisits: analysisResult.网站流量 === 'loading' ? null : (analysisResult.网站流量 || null),
        status: (analysisResult.status as 'loading' | 'success' | 'error') || 'error',
        error: analysisResult.error ? String(analysisResult.error) : undefined,
        timestamp: new Date(),
        source: 'similarweb-api',
        apiEndpoint: analysisResult.apiEndpoint ? String(analysisResult.apiEndpoint) : undefined,
        responseTime: analysisResult.responseTime ? parseInt(String(analysisResult.responseTime)) : undefined,
        retries: analysisResult.retries ? parseInt(String(analysisResult.retries)) : undefined
      };
      
      return result;

    } catch (error) {
      logger.error(`查询域名数据失败: ${domain}`, new EnhancedError(`查询域名数据失败: ${domain}`, { error: error instanceof Error ? error.message : String(error) }));
      const errorResult: SimilarWebData = {
        domain,
        globalRank: null,
        monthlyVisits: null,
        status: 'error',
        error: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date(),
        source: 'similarweb-api'
      };

      // 失败结果不缓存，允许立即重试
      logger.debug(`失败结果不缓存，允许立即重试: ${domain}`);
      
      return errorResult;
    }
  }

  /**
   * 执行API查询 (合并自 SimilarWebApiService)
   */
  private async executeApiQuery(domain: string, options: {
    timeout: number;
    maxRetries: number;
  }): Promise<SimilarWebData> {
    const { timeout, maxRetries } = options;
    
    let lastError: string | null = null;

    // 按权重排序端点
    const sortedEndpoints = [...this.API_ENDPOINTS].sort((a, b) => b.weight - a.weight);

    // 尝试每个端点
    for (const endpoint of sortedEndpoints) {

      for (let retry = 0; retry < maxRetries; retry++) {
        try {
          logger.info(`尝试端点 ${endpoint.url} (重试 ${retry + 1}/${maxRetries}): ${domain}`);

          // 控制请求速率
          await this.rateLimit();

          const startTime = Date.now();
          
          // 构建请求URL
          const url = new URL(endpoint.url);
          url.searchParams.append('domain', domain);
          
          // 添加额外参数
          if (endpoint.params) {
            Object.entries(endpoint.params).forEach(([key, value]) => {
              url.searchParams.append(key, value);
            });
          }

          // 发送请求
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          const response = await fetch(url.toString(), {
            method: endpoint.method,
            headers: endpoint.headers,
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          const responseTime = Date.now() - startTime;

          // 处理响应
          const result = await this.handleResponse(response, domain, endpoint.url, responseTime);
          
          if (result.status === 'success') {
            logger.info(`API 查询成功: ${domain}`, {
              endpoint: endpoint.url,
              globalRank: result.globalRank,
              monthlyVisits: result.monthlyVisits,
              responseTime,
              retries: retry + 1
            });

            return result;
          } else {
            // 记录失败结果用于分析
            logger.warn(`端点返回错误: ${endpoint.url}`, { error: lastError });
            
            lastError = result.error || '未知错误';
            logger.warn(`端点返回错误: ${endpoint.url}`, { error: lastError });
          }

        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          logger.warn(`请求异常: ${endpoint.url}`, { 
            error: lastError,
            retry: retry + 1
          });

          // 重试前等待
          if (retry < maxRetries - 1) {
            const waitTime = Math.min(5000 * Math.pow(2, retry), 30000);
            logger.info(`等待 ${waitTime}ms 后重试...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
    }

    // 所有端点都失败，返回错误结果
    const errorResult: SimilarWebData = {
      domain,
      globalRank: null,
      monthlyVisits: null,
      status: 'error',
      error: lastError || '所有 API 端点都失败',
      timestamp: new Date(),
      source: 'similarweb-api'
    };

    return errorResult;
  }

  /**
   * 批量查询多个域名（优化版）
   * 使用缓存优先策略，只对未缓存的域名发起API调用
   */
  async queryMultipleDomains(domains: string[], options?: {
    concurrency?: number;
  }): Promise<SimilarWebData[]> {
    logger.info(`开始批量查询 ${domains.length} 个域名`);

    // 预先验证所有域名
    const validDomains: string[] = [];
    const invalidDomains: string[] = [];
    
    for (const domain of domains) {
      if (this.isValidDomain(domain)) {
        validDomains.push(domain);
      } else {
        invalidDomains.push(domain);
        logger.warn(`批量查询中发现无效域名: ${domain}`);
      }
    }

    // 处理无效域名
    const invalidResults: SimilarWebData[] = invalidDomains.map(domain => ({
      domain,
      globalRank: null,
      monthlyVisits: null,
      status: 'error' as const,
      error: '无效的域名格式',
      timestamp: new Date(),
      source: 'similarweb-api'
    }));

    // 如果没有有效域名，直接返回结果
    if (validDomains.length === 0) {
      return invalidResults;
    }

    // 使用优化的批量查询服务
    const batchResult = await OptimizedBatchQueryService.queryMultipleDomains(
      validDomains,
      async (domain) => {
        const apiResult = await this.queryDomainData(domain, {
          timeout: 45000
        });
        
        // 转换为AnalysisResult格式
        const result: AnalysisResult = {
          domain: apiResult.domain,
          全球排名: apiResult.globalRank,
          网站流量: apiResult.monthlyVisits || undefined,
          status: apiResult.status,
          error: apiResult.error,
          source: apiResult.source,
          apiEndpoint: apiResult.apiEndpoint,
          responseTime: apiResult.responseTime?.toString() || undefined,
          retries: apiResult.retries?.toString() || undefined
        };
        return result;
      },
      {
        concurrency: options?.concurrency || 3,
        delayBetweenRequests: 3000 + Math.random() * 2000,
        delayBetweenBatches: 5000 + Math.random() * 3000
      }
    );

    // 将AnalysisResult转换回SimilarWebData格式
    const validResults: SimilarWebData[] = batchResult.results.map(result => ({
      domain: result.domain || result.域名 || '',
      globalRank: result.全球排名 === undefined || result.全球排名 === 'loading' ? null : result.全球排名,
      monthlyVisits: result.网站流量 || null,
      status: (result.status as 'loading' | 'success' | 'error') || 'error',
      error: result.error ? String(result.error) : undefined,
      timestamp: new Date(),
      source: 'similarweb-api',
      apiEndpoint: result.apiEndpoint ? String(result.apiEndpoint) : undefined,
      responseTime: result.responseTime ? parseInt(String(result.responseTime)) : undefined,
      retries: result.retries ? parseInt(String(result.retries)) : undefined
    }));

    // 合并结果，保持原始顺序
    const finalResults: SimilarWebData[] = [];
    let validIndex = 0;
    
    for (const domain of domains) {
      if (invalidDomains.includes(domain)) {
        const invalidResult = invalidResults.find(r => r.domain === domain);
        if (invalidResult) {
          finalResults.push(invalidResult);
        }
      } else {
        if (validIndex < validResults.length) {
          finalResults.push(validResults[validIndex]);
          validIndex++;
        }
      }
    }

    // 统计信息
    const successCount = finalResults.filter(r => r.status === 'success').length;
    const errorCount = finalResults.filter(r => r.status === 'error').length;

    logger.info(`批量查询完成:`, {
      totalDomains: domains.length,
      validDomains: validDomains.length,
      invalidDomains: invalidDomains.length,
      cacheHits: batchResult.cacheHits,
      apiCalls: batchResult.apiCalls,
      successCount,
      errorCount,
      totalTime: `${batchResult.totalTime}ms`,
      cacheHitRate: `${((batchResult.cacheHits / validDomains.length) * 100).toFixed(1)}%`
    });

    return finalResults;
  }

  /**
   * 处理 API 响应
   */
  private async handleResponse(
    response: Response, 
    domain: string, 
    endpoint: string,
    responseTime: number
  ): Promise<SimilarWebData> {
    try {
      // 检查 HTTP 状态码
      if (!response.ok) {
        const errorText = (await response.text()).substring(0, 500);
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // 特定错误处理
        if (response.status === 401) {
          errorMessage = 'API 认证失败：需要有效的 API 密钥';
        } else if (response.status === 403) {
          errorMessage = 'API 访问被禁止：可能已达到速率限制';
        } else if (response.status === 404) {
          errorMessage = 'API 端点不存在：可能已更改或移除';
        } else if (response.status === 429) {
          errorMessage = '请求过于频繁：请降低请求频率';
        } else if (response.status >= 500) {
          errorMessage = '服务器错误：SimilarWeb API 服务暂时不可用';
        }

        return {
          domain,
          globalRank: null,
          monthlyVisits: null,
          status: 'error',
          error: errorMessage,
          timestamp: new Date(),
          source: 'similarweb-api',
          apiEndpoint: endpoint,
          responseTime
        };
      }

      // 检查内容类型
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        
        // 检查是否是 HTML 错误页面
        if (text.includes('<html') || text.includes('Access Denied')) {
          return {
            domain,
            globalRank: null,
            monthlyVisits: null,
            status: 'error',
            error: 'API 返回了错误页面：可能需要认证或服务不可用',
            timestamp: new Date(),
            source: 'similarweb-api',
            apiEndpoint: endpoint,
            responseTime
          };
        }

        return {
          domain,
          globalRank: null,
          monthlyVisits: null,
          status: 'error',
          error: `无效的响应格式: ${contentType}`,
          timestamp: new Date(),
          source: 'similarweb-api',
          apiEndpoint: endpoint,
          responseTime
        };
      }

      // 解析 JSON
      const data = await response.json() as SimilarWebApiResponse;
      
      // 解析数据
      const result = this.parseApiResponse(domain, data);
      result.apiEndpoint = endpoint;
      result.responseTime = responseTime;

      return result;

    } catch (error) {
      return {
        domain,
        globalRank: null,
        monthlyVisits: null,
        status: 'error',
        error: `响应解析失败: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        source: 'similarweb-api',
        apiEndpoint: endpoint,
        responseTime
      };
    }
  }

  /**
   * 解析 API 响应数据
   */
  private parseApiResponse(domain: string, data: SimilarWebApiResponse): SimilarWebData {
    try {
      let globalRank: number | null = null;
      let monthlyVisits: string | null = null;

      // 全球排名 - 基于实际数据结构
      if (data.GlobalRank && typeof data.GlobalRank === 'object' && 'Rank' in data.GlobalRank) {
        globalRank = data.GlobalRank.Rank ?? null;
      } else if (typeof data.GlobalRank === 'number') {
        globalRank = data.GlobalRank;
      }

      // 月访问量 - 基于实际数据结构，优先使用 Engagments.Visits
      let visits: number | null = null;
      if (data.Engagments && typeof data.Engagments === 'object' && 'Visits' in data.Engagments) {
        // Engagments.Visits 是字符串，需要转换为数字
        const visitsValue = data.Engagments.Visits;
        if (typeof visitsValue === 'string') {
          visits = parseInt(visitsValue, 10);
        } else if (typeof visitsValue === 'number') {
          visits = visitsValue;
        }
      } else if (data.EstimatedMonthlyVisits && typeof data.EstimatedMonthlyVisits === 'object') {
        // 获取最新的月访问量数据
        const latestMonth = Object.keys(data.EstimatedMonthlyVisits).sort().pop();
        if (latestMonth) {
          visits = data.EstimatedMonthlyVisits[latestMonth as keyof typeof data.EstimatedMonthlyVisits] as number;
        }
      } else if (data.EstimatedVisits !== undefined) {
        visits = data.EstimatedVisits as number;
      }

      // 格式化访问量
      if (visits !== null && !isNaN(visits)) {
        if (visits >= 1000000) {
          monthlyVisits = `${(visits / 1000000).toFixed(1)}M`;
        } else if (visits >= 1000) {
          monthlyVisits = `${(visits / 1000).toFixed(1)}K`;
        } else {
          monthlyVisits = visits.toString();
        }
      }

      // 验证数据有效性（"0" 是有效数据）
      const hasValidData = globalRank !== null || monthlyVisits !== null;

      // 记录解析结果用于调试
      logger.debug(`解析 API 响应: ${domain}`, {
        globalRank,
        rawVisits: visits,
        monthlyVisits,
        hasValidData,
        dataKeys: Object.keys(data)
      });

      return {
        domain,
        globalRank,
        monthlyVisits,
        status: hasValidData ? 'success' : 'error',
        error: hasValidData ? undefined : 'API 返回的数据无效或为空',
        timestamp: new Date(),
        source: 'similarweb-api'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`解析 API 响应失败: ${domain}`, new Error(errorMessage));
      return {
        domain,
        globalRank: null,
        monthlyVisits: null,
        status: 'error',
        error: `数据解析失败: ${errorMessage}`,
        timestamp: new Date(),
        source: 'similarweb-api'
      };
    }
  }

  
  /**
   * 控制请求速率
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.REQUEST_DELAY) {
      const waitTime = this.REQUEST_DELAY - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  
  /**
   * 清理过期缓存
   */
  public async clearExpiredCache(): Promise<void> {
    try {
      // MultiLevelCache 会自动清理过期缓存
      logger.info('MultiLevelCache 自动清理过期缓存中...');
      
      // 获取缓存统计信息
      const stats = await SiteRankCacheService.getStats();
      logger.info('缓存统计:', {
        hits: stats.hits,
        hitRate: `${(stats.hitRate * 100).toFixed(2)}%`
      });
    } catch (error) {
      logger.warn('清理缓存失败:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * 获取服务状态
   */
  async getStatus() {
    const stats = await SiteRankCacheService.getStats();
    return {
      cacheStats: stats,
      endpoints: this.API_ENDPOINTS?.filter(Boolean)?.map(e => ({ url: e.url, weight: e.weight })),
      lastRequestTime: this.lastRequestTime
    };
  }
}

// 导出单例实例
export const similarWebService = new SimilarWebService();