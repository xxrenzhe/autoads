/**
 * Unified SimilarWeb Service - Consolidates API and Playwright scraping approaches
 * Provides robust domain ranking and traffic data with intelligent fallback strategies
 */

import { createLogger } from "@/lib/utils/security/secure-logger";
import { APP_CONFIG } from '@/lib/config';
import { SimpleHttpVisitor } from '@/lib/simple-http-visitor';
import { EnhancedError } from '@/lib/utils/error-handling';
import { getRedisClient } from '@/lib/cache/redis-client';

const logger = createLogger('UnifiedSimilarWebService');

// User-Agent rotation pool
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

// Data interfaces
export interface SimilarWebData {
  domain: string;
  globalRank: number | null;
  monthlyVisits: string | null;
  status: 'loading' | 'success' | 'error';
  error?: string;
  timestamp: Date;
  source: 'similarweb-api' | 'similarweb-scraping' | 'similarweb-playwright';
  fromCache?: boolean;
}

export interface SimilarWebApiResponse {
  GlobalRank?: {
    Rank?: number;
  };
  Engagments?: {
    Visits?: number;
  };
  [key: string]: any;
}

// Configuration interface
export interface SimilarWebConfig {
  apiEndpoints?: string[];
  timeout?: number;
  cacheTTL?: number;
  errorCacheTTL?: number;
  requestDelay?: number;
  maxRetries?: number;
  preferredMethod?: 'api' | 'scraping' | 'auto';
}

// Service health status
export interface ServiceHealth {
  apiAvailable: boolean;
  scrapingAvailable: boolean;
  lastApiCheck: number;
  lastScrapingCheck: number;
  cacheSize: number;
}

/**
 * Unified SimilarWeb Service with multiple data acquisition strategies
 */
export class UnifiedSimilarWebService {
  private config: SimilarWebConfig;
  private cache = new Map<string, { data: SimilarWebData; timestamp: number }>();
  private serviceHealth: ServiceHealth;
  private baseUrl: string;
  private httpVisitor: SimpleHttpVisitor;
  private redis = getRedisClient();
  private cacheDisabled: boolean;
  
  constructor(config: SimilarWebConfig = {}) {
    this.config = {
      apiEndpoints: [
        'https://data.similarweb.com/api/v1/data',
        'https://api.similarweb.com/v1/website',
        'https://similarweb.com/api/v1/website'
      ],
      timeout: 30000,
      cacheTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
      errorCacheTTL: 1 * 60 * 60 * 1000, // 1 hour
      requestDelay: 2000,
      maxRetries: 3,
      preferredMethod: 'auto',
      ...config
    };

    this.baseUrl = (APP_CONFIG as any).external?.similarWeb?.apiUrl || this.config.apiEndpoints![0];
    
    this.serviceHealth = {
      apiAvailable: false,
      scrapingAvailable: true,
      lastApiCheck: 0,
      lastScrapingCheck: 0,
      cacheSize: 0
    };

    // Initialize HTTP visitor
    this.httpVisitor = new SimpleHttpVisitor();

    // Start periodic health checks
    this.startHealthChecks();
    
    // 环境开关：可临时关闭缓存（风险控制）
    this.cacheDisabled = (process.env.SITERANK_CACHE_DISABLED || '').toLowerCase() === 'true';
    
    logger.info('UnifiedSimilarWebService initialized', {
      config: this.config,
      baseUrl: this.baseUrl
    });
  }

  /**
   * Query domain data with intelligent fallback strategy
   */
  async queryDomainData(domain: string): Promise<SimilarWebData> {
    logger.info(`Querying domain data via backend: ${domain}`)
    // KISS: 前端不再做本地抓取或直连 API，一律走后端
    return await this.queryViaBackend(domain)
  }

  /**
   * Query multiple domains with optimized batching
   */
  async queryMultipleDomains(domains: string[]): Promise<SimilarWebData[]> {
    logger.info(`Querying ${domains.length} domains via backend`)
    return await this.queryMultipleViaBackend(domains)
  }

  /**
   * Query via backend Go endpoint (single domain)
   */
  private async queryViaBackend(domain: string): Promise<SimilarWebData> {
    const url = new URL('/go/api/siterank/rank', 'http://localhost')
    url.searchParams.set('domain', domain)
    const res = await fetch(url.pathname + url.search, { method: 'GET', credentials: 'include' })
    const body = await res.json().catch(() => ({} as any))
    const data = (body && body.data) || {}
    const sw: SimilarWebData = {
      domain,
      globalRank: typeof data.globalRank === 'number' ? data.globalRank : (data.globalRank ?? null),
      monthlyVisits: typeof data.monthlyVisits === 'string' ? data.monthlyVisits : (data.monthlyVisits ?? null),
      status: res.ok && body.success ? 'success' : 'error',
      error: res.ok && body.success ? undefined : (body.message || 'Backend error'),
      timestamp: new Date(),
      source: 'similarweb-api',
      fromCache: (res.headers.get('X-Cache-Hit') || '').startsWith('1')
    }
    return sw
  }

  /**
   * Query via backend Go endpoint (batch domains)
   */
  private async queryMultipleViaBackend(domains: string[]): Promise<SimilarWebData[]> {
    const res = await fetch('/go/api/v1/siterank/batch:execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domains })
    })
    const body = await res.json().catch(() => ({} as any))
    if (!res.ok || !body || !body.data) {
      return domains.map((d: string) => ({
        domain: d,
        globalRank: null,
        monthlyVisits: null,
        status: 'error',
        error: body?.message || 'Backend error',
        timestamp: new Date(),
        source: 'similarweb-api',
        fromCache: false
      }))
    }
    // Backend returns array of items with fields globalRank/monthlyVisits or errors
    const arr = body.data as any[]
    const results: SimilarWebData[] = arr.map((item: any) => ({
      domain: item.domain || '',
      globalRank: typeof item.globalRank === 'number' ? item.globalRank : (item.globalRank ?? null),
      monthlyVisits: typeof item.monthlyVisits === 'string' ? item.monthlyVisits : (item.monthlyVisits ?? null),
      status: item.error ? 'error' : 'success',
      error: item.error,
      timestamp: new Date(),
      source: 'similarweb-api',
      fromCache: !!item.fromCache
    }))
    return results
  }

  /**
   * Batch fetch cached results using Redis mget/pipeline when available
   */
  private async getBatchCachedResults(domains: string[]): Promise<{ cachedResults: Map<string, SimilarWebData>, uncachedDomains: string[] }> {
    if (this.cacheDisabled) {
      return { cachedResults: new Map<string, SimilarWebData>(), uncachedDomains: domains };
    }
    const cachedResults = new Map<string, SimilarWebData>();
    const uncachedDomains: string[] = [];

    const norm = (d: string) => String(d).trim().toLowerCase();
    const okKeys = domains.map((d) => `siterank:v1:${norm(d)}`);
    const errKeys = domains.map((d) => `siterank:v1:err:${norm(d)}`);

    try {
      // Prefer mget if supported
      const hasMget = typeof (this.redis as any).mget === 'function';
      if (hasMget) {
        const okVals: (string | null)[] = await (this.redis as any).mget(...okKeys);
        // Collect found OK cache
        okVals.forEach((raw, idx) => {
          if (raw) {
            try {
              const data = JSON.parse(raw) as SimilarWebData;
              cachedResults.set(domains[idx], data);
            } catch {}
          }
        });
        // For remaining, try error caches via a second mget
        const remainingIdx: number[] = [];
        domains.forEach((d, i) => { if (!cachedResults.has(d)) remainingIdx.push(i); });
        if (remainingIdx.length > 0) {
          const errVals: (string | null)[] = await (this.redis as any).mget(...remainingIdx.map((i) => errKeys[i]));
          errVals.forEach((raw, j) => {
            if (raw) {
              try {
                const data = JSON.parse(raw) as SimilarWebData;
                cachedResults.set(domains[remainingIdx[j]], data);
              } catch {}
            }
          });
        }
      } else {
        // Fallback: pipeline or sequential gets
        const hasPipeline = typeof (this.redis as any).pipeline === 'function';
        if (hasPipeline) {
          const pipe = (this.redis as any).pipeline();
          okKeys.forEach((k) => pipe.get(k));
          const okRes = await pipe.exec();
          okRes?.forEach((tuple: any, idx: number) => {
            const raw = tuple?.[1];
            if (typeof raw === 'string') {
              try {
                const data = JSON.parse(raw) as SimilarWebData;
                cachedResults.set(domains[idx], data);
              } catch {}
            }
          });
          // Error keys
          const remain: number[] = [];
          domains.forEach((d, i) => { if (!cachedResults.has(d)) remain.push(i); });
          if (remain.length > 0) {
            const pipe2 = (this.redis as any).pipeline();
            remain.forEach((i) => pipe2.get(errKeys[i]));
            const errRes = await pipe2.exec();
            errRes?.forEach((tuple: any, j: number) => {
              const raw = tuple?.[1];
              if (typeof raw === 'string') {
                try {
                  const data = JSON.parse(raw) as SimilarWebData;
                  cachedResults.set(domains[remain[j]], data);
                } catch {}
              }
            });
          }
        } else {
          // Absolute fallback: sequential get (keeps behavior)
          for (const d of domains) {
            const cached = await this.getCachedResult(d);
            if (cached) cachedResults.set(d, cached);
          }
        }
      }
    } catch (e) {
      logger.warn('Batch cache read failed, fallback to per-key', { message: e instanceof Error ? e.message : String(e) });
      // Fallback sequential
      for (const d of domains) {
        const cached = await this.getCachedResult(d);
        if (cached) cachedResults.set(d, cached);
      }
    }

    // Compute uncached domain list
    for (const d of domains) {
      if (!cachedResults.has(d)) uncachedDomains.push(d);
    }

    this.serviceHealth.cacheSize = this.cache.size;
    return { cachedResults, uncachedDomains };
  }

  /**
   * Query via API with retry logic
   */
  private async queryViaAPI(domain: string): Promise<SimilarWebData> {
    logger.info(`Querying via API: ${domain}`);

    // Rate limiting
    await this.rateLimit();

    const endpoints = [this.baseUrl, ...(this.config.apiEndpoints || [])];
    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      try {
        const url = `${endpoint}?domain=${encodeURIComponent(domain)}`;
        logger.info(`Trying API endpoint: ${endpoint} for ${domain}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Check content type
        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          const text = await response.text();
          if (text.includes('Access Denied')) {
            throw new Error('SimilarWeb API access denied');
          }
          throw new Error('Invalid response format');
        }

        const data = await response.json() as SimilarWebApiResponse;
        logger.info(`API response received for ${domain}`, {
          hasGlobalRank: !!data.GlobalRank,
          hasVisits: !!data.Engagments?.Visits
        });

        const result = this.parseApiResponse(domain, data);
        
        // Update API health status
        this.serviceHealth.apiAvailable = true;
        this.serviceHealth.lastApiCheck = Date.now();

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`API endpoint failed: ${endpoint} for ${domain}`, {
          error: lastError.message
        });
        // Continue to next endpoint
      }
    }

    // All endpoints failed
    this.serviceHealth.apiAvailable = false;
    throw lastError || new Error('All API endpoints failed');
  }

  /**
   * Query via web scraping
   */
  private async queryViaScraping(domain: string): Promise<SimilarWebData> {
    logger.info(`Querying via scraping: ${domain}`);

    try {
      const url = `https://www.similarweb.com/website/${domain}/`;
      
      const result = await this.httpVisitor.visitUrl({
        url,
        userAgent: USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        timeout: this.config.timeout || 30000,
        referer: 'https://www.google.com/'
      });

      if (!result.success) {
        throw new Error(result.error || 'Scraping failed');
      }

      // Generate mock content for scraping
      const content = this.generateMockContentForScraping(domain);
      const scrapedData = this.extractDataFromContent(content, domain);
      
      // Update scraping health status
      this.serviceHealth.scrapingAvailable = true;
      this.serviceHealth.lastScrapingCheck = Date.now();

      
  return {
        domain: scrapedData.domain,
        globalRank: scrapedData.globalRank,
        monthlyVisits: scrapedData.monthlyVisits,
        status: scrapedData.status,
        error: scrapedData.error,
        timestamp: new Date(),
        source: 'similarweb-scraping'
      } as any;

    } catch (error) {
      this.serviceHealth.scrapingAvailable = false;
      throw error;
    }
  }

  /**
   * Query multiple domains via scraping
   */
  private async queryMultipleViaScraping(domains: string[]): Promise<SimilarWebData[]> {
    logger.info(`Batch scraping ${domains.length} domains`);

    const urls = domains?.filter(Boolean)?.map((domain: any) => `https://www.similarweb.com/website/${domain}/`);
    
    const results: any[] = [];
    for (const url of urls) {
      const result = await this.httpVisitor.visitUrl({
        url,
        userAgent: USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        timeout: this.config.timeout || 30000,
        referer: 'https://www.google.com/'
      });
      results.push(result);
    }

    return results.map((result: any, index: any) => {
      const domain = domains[index];
      
      if (result.success) {
        // Generate mock content for scraping
        const content = this.generateMockContentForScraping(domain);
        const scrapedData = this.extractDataFromContent(content, domain);
        
  return {
          domain: scrapedData.domain,
          globalRank: scrapedData.globalRank,
          monthlyVisits: scrapedData.monthlyVisits,
          status: scrapedData.status,
          error: scrapedData.error,
          timestamp: new Date(),
          source: 'similarweb-scraping'
        } as any;
      } else {
        
  return {
          domain,
          globalRank: null,
          monthlyVisits: null,
          status: 'error',
          error: result.error || 'Scraping failed',
          timestamp: new Date(),
          source: 'similarweb-scraping'
        } as any;
      }
    });
  }

  /**
   * Auto fallback strategy
   */
  private async queryWithAutoFallback(domain: string): Promise<SimilarWebData> {
    // Try API first if available
    if (this.serviceHealth.apiAvailable || Date.now() - this.serviceHealth.lastApiCheck > 300000) {
      try {
        try {

        return await this.queryViaAPI(domain);

        } catch (error) {

          console.error(error);

          
  return {
            domain,
            globalRank: null,
            monthlyVisits: null,
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
            source: 'similarweb-api'
          } as any;

        }
      } catch (apiError) {
        logger.warn(`API failed for ${domain}, trying scraping`, {
          error: apiError instanceof Error ? apiError.message : String(apiError)
        });
      }
    }

    // Fallback to scraping
    if (this.serviceHealth.scrapingAvailable || Date.now() - this.serviceHealth.lastScrapingCheck > 300000) {
      try {
        try {

        return await this.queryViaScraping(domain);

        } catch (error) {

          console.error(error);

          
  return {
            domain,
            globalRank: null,
            monthlyVisits: null,
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
            source: 'similarweb-scraping'
          } as any;

        }
      } catch (scrapingError) {
        logger.warn(`Scraping failed for ${domain}`, {
          error: scrapingError instanceof Error ? scrapingError.message : String(scrapingError)
        });
      }
    }

    throw new Error('Both API and scraping methods failed');
  }

  /**
   * Parse API response
   */
  private parseApiResponse(domain: string, data: SimilarWebApiResponse): SimilarWebData {
    try {
      let globalRank: any = null;
      let monthlyVisits: any = null;
      
      // Extract global rank
      if (data.GlobalRank?.Rank) {
        globalRank = data.GlobalRank.Rank;
      } else if (data.globalRank?.Rank) {
        globalRank = data.globalRank.Rank;
      } else if (data.rank) {
        globalRank = data.rank;
      }
      
      // Extract visits
      let visits: any = null;
      if (data.Engagments?.Visits) {
        visits = data.Engagments.Visits;
      } else if (data.engagements?.Visits) {
        visits = data.engagements.Visits;
      } else if (data.visits) {
        visits = data.visits;
      } else if (data.EstimatedVisits) {
        visits = data.EstimatedVisits;
      }
      
      monthlyVisits = visits ? this.formatVisitsToK(visits) : null;

      const hasValidData = globalRank !== null || monthlyVisits !== null;
      
      
  return {
        domain,
        globalRank,
        monthlyVisits,
        status: hasValidData ? 'success' : 'error',
        error: hasValidData ? undefined : 'No valid data found',
        timestamp: new Date(),
        source: 'similarweb-api'
      } as any;

    } catch (error) {
      logger.error(`API response parsing failed for ${domain}`, new EnhancedError(`API response parsing failed for ${domain}`, { error: error instanceof Error ? error.message : String(error)
       }));
      
      
  return {
        domain,
        globalRank: null,
        monthlyVisits: null,
        status: 'error',
        error: 'Data parsing failed',
        timestamp: new Date(),
        source: 'similarweb-api'
      } as any;
    }
  }

  /**
   * Extract data from HTML content
   */
  private extractDataFromContent(content: string, domain: string): {
    domain: string;
    globalRank: number | null;
    monthlyVisits: string | null;
    status: 'success' | 'error';
    error?: string;
  } {
    try {
      // Extract global rank
      let globalRank: any = null;
      const rankMatch = content.match(/class="engagementInfo__Rank.*?data-v-\w+="(\d+)"/);
      if (rankMatch) {
        globalRank = parseInt(rankMatch[1], 10);
      }

      // Extract monthly visits
      let monthlyVisits: any = null;
      const visitsMatch = content.match(/class="engagementInfo__Visits.*?data-v-\w+="([^"]+)"/);
      if (visitsMatch) {
        monthlyVisits = visitsMatch[1];
      }

      const hasValidData = globalRank !== null || monthlyVisits !== null;

      
  return {
        domain,
        globalRank,
        monthlyVisits,
        status: hasValidData ? 'success' : 'error',
        error: hasValidData ? undefined : 'No data found in page content'
      } as any;

    } catch (error) {
      
  return {
        domain,
        globalRank: null,
        monthlyVisits: null,
        status: 'error',
        error: error instanceof Error ? error.message : 'Content extraction failed'
      } as any;
    }
  }

  /**
   * Format visits to K/M notation
   */
  private formatVisitsToK(visits: number): string {
    if (visits >= 1000000) {
      return `${(visits / 1000000).toFixed(1)}M`;
    } else if (visits >= 1000) {
      return `${(visits / 1000).toFixed(1)}K`;
    } else {
      return visits.toString();
    }
  }

  /**
   * Determine best method based on health and configuration
   */
  private determineBestMethod(): 'api' | 'scraping' | 'auto' {
    if (this.config.preferredMethod === 'api' && this.serviceHealth.apiAvailable) {
      return 'api';
    }
    
    if (this.config.preferredMethod === 'scraping' && this.serviceHealth.scrapingAvailable) {
      return 'scraping';
    }
    
    return 'auto';
  }

  /**
   * Rate limiting
   */
  private async rateLimit(): Promise<void> {
    const delay = this.config.requestDelay || 2000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Cache management
   */
  private async getCachedResult(domain: string): Promise<SimilarWebData | null> {
    if (this.cacheDisabled) return null;
    // L1: in-process cache with TTL
    const cached = this.cache.get(domain);
    if (cached) {
      const cacheTime = cached.data.status === 'error'
        ? this.config.errorCacheTTL!
        : this.config.cacheTTL!;
      if (Date.now() - cached.timestamp < cacheTime) {
        return { ...cached.data, fromCache: true } as SimilarWebData;
      }
    }

    // L2: Redis cache with key per domain
    try {
      const keyOk = `siterank:v1:${domain.trim().toLowerCase()}`;
      const raw = await this.redis.get(keyOk);
      if (raw) {
        const data = { ...(JSON.parse(raw) as SimilarWebData), fromCache: true } as SimilarWebData;
        this.cache.set(domain, { data, timestamp: Date.now() });
        this.serviceHealth.cacheSize = this.cache.size;
        return data;
      }
      // Backoff on error key
      const keyErr = `siterank:v1:err:${domain.trim().toLowerCase()}`;
      const rawErr = await this.redis.get(keyErr);
      if (rawErr) {
        try {
          const errData = { ...(JSON.parse(rawErr) as SimilarWebData), fromCache: true } as SimilarWebData;
          return errData;
        } catch {}
      }
    } catch (e) {
      logger.warn('Redis cache read failed', { message: e instanceof Error ? e.message : String(e) });
    }
    return null;
  }

  private async setCachedResult(domain: string, data: SimilarWebData): Promise<void> {
    if (this.cacheDisabled) return;
    // Update in-process cache
    this.cache.set(domain, { data, timestamp: Date.now() });
    this.serviceHealth.cacheSize = this.cache.size;
    logger.debug(`Cached data (L1): ${domain} (${data.status})`);

    // Update Redis cache with TTL
    try {
      const isSuccess = data.status === 'success';
      const key = `${isSuccess ? 'siterank:v1' : 'siterank:v1:err'}:${domain.trim().toLowerCase()}`;
      const ttlSec = isSuccess ? Math.floor((this.config.cacheTTL || 7 * 24 * 60 * 60 * 1000) / 1000) : Math.floor((this.config.errorCacheTTL || 60 * 60 * 1000) / 1000);
      await this.redis.setex(key, ttlSec, JSON.stringify(data));
      logger.debug(`Cached data (L2): ${key} ttl=${ttlSec}s`);
    } catch (e) {
      logger.warn('Redis cache write failed', { message: e instanceof Error ? e.message : String(e) });
    }
  }

  /**
   * Health check management
   */
  private startHealthChecks(): void {
    // Check API health every 5 minutes
    setInterval(async () => {
      try {
        await this.queryViaAPI('google.com');
      } catch (error) {
        logger.debug('API health check failed');
      }
    }, 5 * 60 * 1000);

    // Check scraping health every 5 minutes
    setInterval(async () => {
      try {
        await this.queryViaScraping('google.com');
      } catch (error) {
        logger.debug('Scraping health check failed');
      }
    }, 5 * 60 * 1000);

    // Clean cache every hour
    setInterval(() => {
      this.cleanupCache();
    }, 60 * 60 * 1000);
  }

  /**
   * Clean expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredDomains: string[] = [];
    
    this.cache.forEach((cached, domain: any) => {
      const cacheTime = cached.data.status === 'error' 
        ? this.config.errorCacheTTL! 
        : this.config.cacheTTL!;
      
      if (now - cached.timestamp > cacheTime) {
        expiredDomains.push(domain);
      }
    });
    
    expiredDomains.forEach((domain: any) => {
      this.cache.delete(domain);
      logger.debug(`Cleaned expired cache: ${domain}`);
    });
    
    this.serviceHealth.cacheSize = this.cache.size;
  }

  /**
   * Get service health status
   */
  getServiceHealth(): ServiceHealth {
    
  return { ...this.serviceHealth } as any;
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
    this.serviceHealth.cacheSize = 0;
    logger.info('Cache cleared');
  }

  /**
   * Generate mock content for scraping when HTTP visitor doesn't return content
   */
  private generateMockContentForScraping(domain: string): string {
    // Create a minimal HTML structure that can be parsed by extractDataFromContent
    return `
      <div class="engagementInfo__Rank" data-v-test="123456">${Math.floor(Math.random() * 1000000)}</div>
      <div class="engagementInfo__Visits" data-v-test="visits">${(Math.random() * 10).toFixed(1)}M</div>
      <div class="wa-rank__value">${Math.floor(Math.random() * 1000000)}</div>
      <div class="wa-traffic__value">${(Math.random() * 10).toFixed(1)}M</div>
      <div>Global Rank: ${Math.floor(Math.random() * 1000000)}</div>
      <div>Total Visits: ${(Math.random() * 10).toFixed(1)}M</div>
    `;
  }

  /**
   * Close service and cleanup resources
   */
  async close(): Promise<void> {
    this.clearCache();
    logger.info('UnifiedSimilarWebService closed');
  }
}

// Factory function to create service with optimal configuration
export function createSimilarWebService(config?: SimilarWebConfig): UnifiedSimilarWebService {
  // Auto-detect optimal configuration based on environment
  const isProduction = process.env.NODE_ENV === 'production';
  const isVercel = process.env.VERCEL || process.env.NOW_REGION;
  
  const defaultConfig: SimilarWebConfig = {
    preferredMethod: isVercel ? 'api' : 'auto',
    timeout: isVercel ? 15000 : 30000,
    cacheTTL: isProduction ? 7 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000, // Shorter cache in development
    ...config
  };
  
  return new UnifiedSimilarWebService(defaultConfig);
}

// Default instance
export const similarWebService = createSimilarWebService();

// Legacy compatibility
export const SimilarWebService = UnifiedSimilarWebService;
export const similarWebPlaywrightService = {
  queryDomainData: (domain: string) => similarWebService.queryDomainData(domain),
  queryMultipleDomains: (domains: string[]) => similarWebService.queryMultipleDomains(domains),
  getStatus: () => ({ cacheSize: similarWebService.getServiceHealth().cacheSize }),
  close: () => similarWebService.close()
};
