/**
 * Optimized SimilarWeb Service
 * Performance improvements with caching, circuit breaker, and connection pooling
 */

import { createLogger } from "@/lib/utils/security/secure-logger";
import { APP_CONFIG } from '@/lib/config';
import { EnhancedError } from '@/lib/utils/error-handling';
import { CircuitBreaker, ConnectionPool, BatchProcessor, queryCache } from '@/lib/utils/performance';

const logger = createLogger('OptimizedSimilarWebService');

export interface OptimizedSimilarWebData {
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
  confidence?: number;
}

interface ApiEndpoint {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  params?: Record<string, string>;
  weight: number;
  lastUsed?: number;
  failureCount?: number;
}

interface HTTPClient {
  request(url: string, options: RequestInit): Promise<Response>;
  close(): Promise<void>;
}

/**
 * HTTP Connection Pool for SimilarWeb requests
 */
class SimilarWebHTTPPool extends ConnectionPool<HTTPClient> {
  constructor() {
    super(
      async () => {
        // Create a simple HTTP client wrapper
        return {
          request: async (url: string, options: RequestInit) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            try {
              const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                keepalive: true
              });
              clearTimeout(timeoutId);
              return response;
            } catch (error) {
              clearTimeout(timeoutId);
              throw error;
            }
          },
          close: async () => {
            // No explicit close needed for fetch
          }
        };
      },
      async (client) => {
        await client.close();
      },
      {
        max: 5,
        min: 2,
        idleTimeout: 2 * 60 * 1000
      }
    );
  }
}

/**
 * Optimized SimilarWeb Service with performance improvements
 */
export class OptimizedSimilarWebService {
  private baseUrl = (APP_CONFIG as any).external?.similarWeb?.apiUrl || "https://data.similarweb.com/api/v1/data";
  private timeout = (APP_CONFIG as any).external?.similarWeb?.timeout || 30000;
  private readonly MIN_REQUEST_DELAY = 1000; // Reduced from 2000ms
  private lastRequestTime = 0;
  
  // Circuit breaker for external API
  private circuitBreaker: CircuitBreaker;
  
  // HTTP connection pool
  private httpPool: SimilarWebHTTPPool;
  
  // Batch processor for bulk requests
  private batchProcessor: BatchProcessor<string, OptimizedSimilarWebData>;
  
  // API endpoints with health tracking
  private readonly API_ENDPOINTS: ApiEndpoint[] = [
    {
      url: 'https://data.similarweb.com/api/v1/data',
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
      url: 'https://data.similarweb.com/api/v1/data',
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
    }
  ];

  constructor() {
    this.circuitBreaker = new CircuitBreaker(5, 60 * 1000); // 5 failures, 1 minute timeout
    this.httpPool = new SimilarWebHTTPPool();
    
    // Initialize batch processor
    this.batchProcessor = new BatchProcessor(
      async (domains: string[]) => {
        return this.processBatchDomains(domains);
      },
      {
        batchSize: 10,
        batchDelay: 500,
        maxQueueSize: 100
      }
    );
    
    logger.info('优化版 SimilarWeb 服务初始化完成');
  }

  /**
   * Get domain data with optimized caching and circuit breaker
   */
  async getDomainData(domain: string, forceRefresh: boolean = false): Promise<OptimizedSimilarWebData> {
    const normalizedDomain = this.normalizeDomain(domain);
    const cacheKey = `similarweb:${normalizedDomain}`;
    
    // Check cache first
    if (!forceRefresh) {
      const cached = queryCache.get(cacheKey);
      if (cached) {
        return {
          ...cached,
          source: 'similarweb-cache'
        };
      }
    }
    
    return this.circuitBreaker.execute(async () => {
      const startTime = Date.now();
      
      try {
        const client = await this.httpPool.acquire();
        
        // Select best endpoint based on health
        const endpoint = this.selectBestEndpoint();
        
        const params = new URLSearchParams({
          domain: normalizedDomain,
          format: 'json'
        });
        
        const url = `${endpoint.url}?${params}`;
        
        logger.debug('请求 SimilarWeb API', { domain: normalizedDomain, endpoint: endpoint.url });
        
        const response = await client.request(url, {
          method: endpoint.method,
          headers: endpoint.headers || {}
        });
        
        await this.httpPool.release(client);
        
        // Update endpoint health
        endpoint.lastUsed = Date.now();
        endpoint.failureCount = 0;
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const responseTime = Date.now() - startTime;
        
        const result = this.parseResponse(data, normalizedDomain, responseTime);
        
        // Cache successful results
        queryCache.set(cacheKey, result, 30 * 60 * 1000); // 30 minutes
        
        return result;
        
      } catch (error) {
        // Update failure count for endpoint
        const endpoint = this.API_ENDPOINTS.find((e: any) => e.url === this.baseUrl);
        if (endpoint) {
          endpoint.failureCount = (endpoint.failureCount || 0) + 1;
        }
        
        logger.error('获取 SimilarWeb 数据失败', { error: error as Error, domain: normalizedDomain });
        
        // Return cached data if available on error
        const cached = queryCache.get(cacheKey);
        if (cached && cached.status === 'success') {
          logger.info('返回缓存数据', { domain: normalizedDomain });
          return {
            ...cached,
            source: 'similarweb-cache-fallback',
            error: (error as Error).message
          };
        }
        
        return {
          domain: normalizedDomain,
          globalRank: null,
          monthlyVisits: null,
          status: 'error',
          error: (error as Error).message,
          timestamp: new Date(),
          source: 'similarweb-api',
          responseTime: Date.now() - startTime
        };
      }
    });
  }

  /**
   * Batch process multiple domains
   */
  async getMultipleDomainsData(domains: string[]): Promise<OptimizedSimilarWebData[]> {
    const promises = domains.map((domain: any) => 
      this.batchProcessor.add(domain)
    );
    
    return Promise.all(promises);
  }

  /**
   * Process batch of domains
   */
  private async processBatchDomains(domains: string[]): Promise<OptimizedSimilarWebData[]> {
    const results: OptimizedSimilarWebData[] = [];
    
    // Process in chunks to avoid overwhelming the API
    for (let i = 0; i < domains.length; i += 5) {
      const chunk = domains.slice(i, i + 5);
      
      const chunkPromises = chunk.map(async (domain) => {
        try {
          try {

          return await this.getDomainData(domain);

          } catch (error) {

            console.error(error);

            return false;

          }
        } catch (error) {
          logger.error('批量处理域名失败', { error: error as Error, domain });
          return {
            domain,
            globalRank: null,
            monthlyVisits: null,
            status: 'error',
            error: (error as Error).message,
            timestamp: new Date(),
            source: 'similarweb-api'
          };
        }
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      // Filter out any false values and ensure all results are OptimizedSimilarWebData
      results.push(...chunkResults.filter((result): result is OptimizedSimilarWebData => result !== false));
      
      // Small delay between chunks
      if (i + 5 < domains.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  /**
   * Select best endpoint based on health and weight
   */
  private selectBestEndpoint(): ApiEndpoint {
    // Calculate scores based on weight, failure rate, and last used time
    const scoredEndpoints = this.API_ENDPOINTS.map((endpoint: any) => {
      const failureRate = (endpoint.failureCount || 0) / Math.max(1, (endpoint.lastUsed || 0) / 1000 / 60);
      const timeSinceLastUse = endpoint.lastUsed ? Date.now() - endpoint.lastUsed : Infinity;
      
      // Higher score is better
      let score = endpoint.weight;
      score -= failureRate * 10; // Penalize failures
      score += Math.min(timeSinceLastUse / 1000 / 60, 5); // Bonus for idle time
      
      return { endpoint, score };
    });
    
    // Sort by score and return the best
    scoredEndpoints.sort((a, b) => b.score - a.score);
    return scoredEndpoints[0].endpoint;
  }

  /**
   * Parse API response
   */
  private parseResponse(data: any, domain: string, responseTime: number): OptimizedSimilarWebData {
    // Try different response formats
    const globalRank = data.GlobalRank?.Rank || 
                      data.globalRank || 
                      data.rank || 
                      null;
    
    const visits = data.Engagments?.Visits || 
                   data.visits || 
                   data.EstimatedVisits || 
                   data.Traffic?.EstimatedVisits || 
                   null;
    
    const monthlyVisits = visits ? this.formatNumber(visits) : null;
    
    return {
      domain,
      globalRank,
      monthlyVisits,
      status: 'success',
      timestamp: new Date(),
      source: 'similarweb-api',
      responseTime,
      confidence: this.calculateConfidence(globalRank, visits)
    };
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(rank: number | null, visits: number | null): number {
    if (rank === null && visits === null) return 0;
    if (rank !== null && visits !== null) return 100;
    if (rank !== null && rank < 100000) return 90;
    return 70;
  }

  /**
   * Format large numbers
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }

  /**
   * Normalize domain name
   */
  private normalizeDomain(domain: string): string {
    return domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      endpoints: this.API_ENDPOINTS.map((e: any) => ({
        url: e.url,
        weight: e.weight,
        failureCount: e.failureCount || 0,
        lastUsed: e.lastUsed
      })),
      circuitBreaker: {
        state: this.circuitBreaker['state'],
        failures: this.circuitBreaker['failures']
      },
      httpPool: {
        active: this.httpPool['pool'].length,
        available: this.httpPool['available'].length
      }
    };
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    await this.httpPool.destroy();
    logger.info('SimilarWeb 服务已关闭');
  }
}

// Export singleton instance
export const optimizedSimilarWebService = new OptimizedSimilarWebService();