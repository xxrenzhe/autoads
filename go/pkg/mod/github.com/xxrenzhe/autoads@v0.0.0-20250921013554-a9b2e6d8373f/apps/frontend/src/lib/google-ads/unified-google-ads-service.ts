/**
 * Unified Google Ads Service - Consolidates EnhancedGoogleAdsApiClient and GoogleAdsApiClient
 * Provides comprehensive Google Ads API functionality with advanced features
 */

import { GoogleAdsRateLimiter, QuotaInfo } from './RateLimiter';
import { createLogger } from "@/lib/utils/security/secure-logger";
import { performanceMonitor } from '@/lib/utils/dynamic-imports';
import { GoogleAdsApi, enums } from 'google-ads-api';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('UnifiedGoogleAdsService');

// Core configuration interfaces
export interface GoogleAdsConfig {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  loginCustomerId?: string;
}

export interface CustomerCredentials {
  customerId: string;
  accessToken: string;
  refreshToken: string;
}

// Enhanced data interfaces
export interface AccountInfo {
  id: string;
  descriptive_name: string;
  currency_code: string;
  time_zone: string;
  auto_tagging_enabled: boolean;
  test_account: boolean;
  manager: boolean;
  optimization_score?: number;
  conversion_tracking_id?: string;
}

export interface CampaignInfo {
  id: string;
  name: string;
  status: enums.CampaignStatus;
  advertisingChannelType: enums.AdvertisingChannelType;
  budget: {
    id: string;
    name: string;
    amountMicros: number;
    deliveryMethod: enums.BudgetDeliveryMethod;
  };
  biddingStrategy: {
    type: string;
    targetCpa?: number;
    targetRoas?: number;
  };
  targeting: {
    geoTargets: Array<{
      id: string;
      name: string;
      targetType: string;
    }>;
    languages: Array<{
      id: string;
      name: string;
    }>;
    demographics: {
      ageRanges?: string[];
      genders?: string[];
    };
  };
  schedule?: {
    startDate: string;
    endDate?: string;
    adSchedule?: Array<{
      dayOfWeek: string;
      startHour: number;
      endHour: number;
    }>;
  };
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
    ctr: number;
    cpc: number;
    conversionRate: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AdGroupInfo {
  id: string;
  campaignId: string;
  name: string;
  status: enums.AdGroupStatus;
  type: enums.AdGroupType;
  cpcBidMicros?: number;
  cpmBidMicros?: number;
  targetCpaMicros?: number;
  percentCpcBidMicros?: number;
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AdInfo {
  id: string;
  adGroupId: string;
  campaignId: string;
  type: enums.AdType;
  status: enums.AdGroupAdStatus;
  finalUrls: string[];
  finalMobileUrls?: string[];
  finalUrlSuffix?: string;
  trackingUrlTemplate?: string;
  urlCustomParameters?: Array<{
    key: string;
    value: string;
  }>;
  content: {
    headlines?: Array<{
      text: string;
      pinnedField?: string;
    }>;
    descriptions?: Array<{
      text: string;
      pinnedField?: string;
    }>;
    images?: Array<{
      asset: string;
      pinnedField?: string;
    }>;
    videos?: Array<{
      asset: string;
    }>;
  };
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface KeywordInfo {
  id: string;
  adGroupId: string;
  campaignId: string;
  text: string;
  matchType: enums.KeywordMatchType;
  status: enums.AdGroupCriterionStatus;
  cpcBidMicros?: number;
  qualityScore?: {
    score: number;
    landingPageExperience: string;
    adRelevance: string;
    expectedCtr: string;
  };
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
    averagePosition: number;
  };
  createdAt: string;
  updatedAt: string;
}

// Operation interfaces
export interface BatchOperation<T> {
  operation: 'CREATE' | 'UPDATE' | 'REMOVE';
  resource: T;
  resourceName?: string;
}

export interface BatchOperationResult<T> {
  successful: Array<{
    operation: BatchOperation<T>;
    result: T;
    resourceName: string;
  }>;
  failed: Array<{
    operation: BatchOperation<T>;
    error: string;
    errorCode?: string;
  }>;
  summary: {
    total: number;
    successCount: number;
    failureCount: number;
    executionTime: number;
  };
}

// Query builder interface
export interface QueryBuilder {
  select(fields: string[]): QueryBuilder;
  from(resource: string): QueryBuilder;
  where(condition: string): QueryBuilder;
  orderBy(field: string, direction?: 'ASC' | 'DESC'): QueryBuilder;
  limit(count: number): QueryBuilder;
  build(): string;
}

// Performance monitoring
export interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  quotaUsage: {
    queries: number;
    mutations: number;
    remainingQueries: number;
    remainingMutations: number;
  };
  errorBreakdown: Record<string, number>;
  lastRequestTime: number;
}

/**
 * Unified Google Ads Service with comprehensive functionality
 */
export class UnifiedGoogleAdsService {
  private client: any;
  private customer: any;
  private customerId: string;
  private rateLimiter: GoogleAdsRateLimiter;
  private config: GoogleAdsConfig;
  private credentials: CustomerCredentials;
  private apiLoaded: boolean = false;
  
  // Caching mechanism
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private defaultCacheTTL = 300000; // 5 minutes
  
  // Performance monitoring
  private metrics: PerformanceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    quotaUsage: {
      queries: 0,
      mutations: 0,
      remainingQueries: 0,
      remainingMutations: 0
    },
    errorBreakdown: {},
    lastRequestTime: 0
  };

  constructor(
    config: GoogleAdsConfig,
    credentials: CustomerCredentials,
    rateLimiterConfig?: any
  ) {
    this.config = config;
    this.credentials = credentials;
    this.customerId = credentials.customerId;
    this.rateLimiter = new GoogleAdsRateLimiter(rateLimiterConfig);
    
    // Start cache cleanup
    setInterval(() => this.cleanupCache(), 60000);
    
    logger.info('UnifiedGoogleAdsService initialized', {
      customerId: this.customerId,
      hasLoginCustomerId: !!config.loginCustomerId
    });
  }

  /**
   * Lazy load Google Ads API
   */
  private async loadApi(): Promise<void> {
    if (this.apiLoaded) return;

    try {
      // Use the already imported GoogleAdsApi
      const ApiClass = GoogleAdsApi;

      this.client = new GoogleAdsApi({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        developer_token: this.config.developerToken,
      });

      this.customer = this.client.Customer({ 
        customer_id: this.credentials.customerId,
        refresh_token: this.credentials.refreshToken
      });

      this.apiLoaded = true;
      logger.info('Google Ads API loaded successfully');
    } catch (error) {
      logger.error('Failed to load Google Ads API', error instanceof Error ? error : new Error(String(error)));
      throw new Error('Failed to initialize Google Ads API');
    }
  }

  // ==================== Cache Management ==================== //

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null as any;
  }

  private setCache(key: string, data: any, ttl: number = this.defaultCacheTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp >= cached.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // ==================== Query Builder ==================== //

  createQueryBuilder(): QueryBuilder {
    const builder = {
      selectFields: [] as string[],
      fromResource: '',
      whereConditions: [] as string[],
      orderByClause: '',
      limitClause: '',

      select(fields: string[]): QueryBuilder {
        this.selectFields = fields;
        return this;
      },

      from(resource: string): QueryBuilder {
        this.fromResource = resource;
        return this;
      },

      where(condition: string): QueryBuilder {
        this.whereConditions.push(condition);
        return this;
      },

      orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder {
        this.orderByClause = `ORDER BY ${field} ${direction}`;
        return this;
      },

      limit(count: number): QueryBuilder {
        this.limitClause = `LIMIT ${count}`;
        return this;
      },

      build(): string {
        let query = `SELECT ${this.selectFields.join(', ')} FROM ${this.fromResource}`;
        
        if (this.whereConditions.length > 0) {
          query += ` WHERE ${this.whereConditions.join(' AND ')}`;
        }
        
        if (this.orderByClause) {
          query += ` ${this.orderByClause}`;
        }
        
        if (this.limitClause) {
          query += ` ${this.limitClause}`;
        }
        
        return query;
      }
    };

    return builder;
  }

  // ==================== Core API Methods ==================== //

  private async executeQuery<T>(
    query: string, 
    useCache: boolean = true,
    cacheTTL?: number
  ): Promise<T[]> {
    // Ensure API is loaded
    if (!this.apiLoaded) {
      await this.loadApi();
    }

    if (!this.customer) {
      throw new Error('Customer not initialized');
    }

    const cacheKey = `query_${Buffer.from(query).toString('base64')}`;
    
    // Check cache
    if (useCache) {
      const cached = this.getFromCache<T[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Wait for rate limit
    await this.rateLimiter.waitForSlot('query');

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const response = await this.customer.query(query);
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      this.updateMetrics(responseTime, true);
      this.rateLimiter.recordRequest('query');

      // Cache result
      if (useCache) {
        this.setCache(cacheKey, response, cacheTTL);
      }

      return response as T[];
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, false);
      this.recordError(error);
      throw error;
    }
  }

  private async executeMutation<T>(
    serviceName: string,
    operations: any[]
  ): Promise<T> {
    // Ensure API is loaded
    if (!this.apiLoaded) {
      await this.loadApi();
    }

    if (!this.customer) {
      throw new Error('Customer not initialized');
    }

    // Wait for rate limit
    await this.rateLimiter.waitForSlot('mutation');

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const service = (this.customer as any)[serviceName];
      if (!service || !service.mutate) {
        throw new Error(`Service ${serviceName} not found or does not support mutations`);
      }

      const response = await service.mutate(operations);
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      this.updateMetrics(responseTime, true);
      this.rateLimiter.recordRequest('mutation');

      // Clear related cache
      this.clearCache(serviceName);

      return response as T;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, false);
      this.recordError(error);
      throw error;
    }
  }

  // ==================== Account Management ==================== //

  async getAccountInfo(): Promise<AccountInfo> {
    const query = this.createQueryBuilder()
      .select([
        'customer.id',
        'customer.descriptive_name',
        'customer.currency_code',
        'customer.time_zone',
        'customer.auto_tagging_enabled',
        'customer.test_account',
        'customer.manager',
        'customer.optimization_score',
        'customer.conversion_tracking_setting.conversion_tracking_id'
      ])
      .from('customer')
      .limit(1)
      .build();

    const results = await this.executeQuery<any>(query);
    
    if (results.length === 0) {
      throw new Error('No account information found');
    }

    const row = results[0];
    return {
      id: row.customer.id,
      descriptive_name: row.customer.descriptive_name,
      currency_code: row.customer.currencyCode,
      time_zone: row.customer.timeZone,
      auto_tagging_enabled: row.customer.autoTaggingEnabled,
      test_account: row.customer.testAccount,
      manager: row.customer.manager,
      optimization_score: row.customer.optimizationScore,
      conversion_tracking_id: row.customer.conversionTrackingSetting?.conversionTrackingId
    };
  }

  // ==================== Campaign Management ==================== //

  async getCampaigns(options: {
    campaignIds?: string[];
    status?: enums.CampaignStatus[];
    includePerformance?: boolean;
    dateRange?: {
      startDate: string;
      endDate: string;
    };
    useCache?: boolean;
  } = {}): Promise<CampaignInfo[]> {
    const {
      campaignIds,
      status,
      includePerformance = true,
      dateRange,
      useCache = true
    } = options;

    const queryBuilder = this.createQueryBuilder();
    
    const selectFields = [
      'campaign.id',
      'campaign.name',
      'campaign.status',
      'campaign.advertising_channel_type',
      'campaign.start_date',
      'campaign.end_date',
      'campaign_budget.id',
      'campaign_budget.name',
      'campaign_budget.amount_micros',
      'campaign_budget.delivery_method',
      'campaign.bidding_strategy_type',
      'campaign.target_cpa.target_cpa_micros',
      'campaign.target_roas.target_roas'
    ];

    if (includePerformance) {
      selectFields.push(
        'metrics.impressions',
        'metrics.clicks',
        'metrics.conversions',
        'metrics.cost_micros',
        'metrics.ctr',
        'metrics.average_cpc',
        'metrics.conversions_from_interactions_rate'
      );
    }

    queryBuilder
      .select(selectFields)
      .from('campaign');

    const whereConditions: string[] = [];

    if (campaignIds && campaignIds.length > 0) {
      whereConditions.push(`campaign.id IN (${campaignIds.join(',')})`);
    }

    if (status && status.length > 0) {
      const statusValues = status?.filter(Boolean)?.map((s: any) => `'${s}'`).join(',');
      whereConditions.push(`campaign.status IN (${statusValues})`);
    }

    if (dateRange) {
      whereConditions.push(`segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'`);
    }

    whereConditions.forEach((condition: any) => queryBuilder.where(condition));
    queryBuilder.orderBy('campaign.name');

    const query = queryBuilder.build();
    const results = await this.executeQuery<any>(query, useCache);

    return results?.filter(Boolean)?.map((row: any) => this.mapToCampaignInfo(row));
  }

  async createCampaign(campaignData: {
    name: string;
    advertisingChannelType: enums.AdvertisingChannelType;
    status?: enums.CampaignStatus;
    budgetId: string;
    biddingStrategy: {
      type: string;
      targetCpaMicros?: number;
      targetRoas?: number;
    };
    startDate?: string;
    endDate?: string;
  }): Promise<{ resourceName: string; campaignId: string }> {
    const operations = [{
      create: {
        name: campaignData.name,
        advertisingChannelType: campaignData.advertisingChannelType,
        status: campaignData.status || enums.CampaignStatus.PAUSED,
        campaignBudget: `customers/${this.customerId}/campaignBudgets/${campaignData.budgetId}`,
        biddingStrategyType: campaignData.biddingStrategy.type,
        startDate: campaignData.startDate,
        endDate: campaignData.endDate,
        ...(campaignData.biddingStrategy.targetCpaMicros && {
          targetCpa: { targetCpaMicros: campaignData.biddingStrategy.targetCpaMicros }
        }),
        ...(campaignData.biddingStrategy.targetRoas && {
          targetRoas: { targetRoas: campaignData.biddingStrategy.targetRoas }
        })
      }
    }];

    const response = await this.executeMutation<any>('campaigns', operations);
    
    if (response.results && response.results.length > 0) {
      const result = response.results[0];
      const campaignId = result.resourceName.split('/').pop();
      
      return {
        resourceName: result.resourceName,
        campaignId
      };
    }

    throw new Error('Failed to create campaign');
  }

  // ==================== Ad Group Management ==================== //

  async getAdGroups(options: {
    campaignIds?: string[];
    adGroupIds?: string[];
    status?: enums.AdGroupStatus[];
    includePerformance?: boolean;
    useCache?: boolean;
  } = {}): Promise<AdGroupInfo[]> {
    const {
      campaignIds,
      adGroupIds,
      status,
      includePerformance = true,
      useCache = true
    } = options;

    const queryBuilder = this.createQueryBuilder();
    
    const selectFields = [
      'ad_group.id',
      'ad_group.campaign',
      'ad_group.name',
      'ad_group.status',
      'ad_group.type',
      'ad_group.cpc_bid_micros',
      'ad_group.cpm_bid_micros',
      'ad_group.target_cpa_micros',
      'ad_group.percent_cpc_bid_micros'
    ];

    if (includePerformance) {
      selectFields.push(
        'metrics.impressions',
        'metrics.clicks',
        'metrics.conversions',
        'metrics.cost_micros'
      );
    }

    queryBuilder
      .select(selectFields)
      .from('ad_group');

    const whereConditions: string[] = [];

    if (campaignIds && campaignIds.length > 0) {
      const campaignResourceNames = campaignIds?.filter(Boolean)?.map((id: any) => 
        `'customers/${this.customerId}/campaigns/${id}'`
      ).join(',');
      whereConditions.push(`ad_group.campaign IN (${campaignResourceNames})`);
    }

    if (adGroupIds && adGroupIds.length > 0) {
      whereConditions.push(`ad_group.id IN (${adGroupIds.join(',')})`);
    }

    if (status && status.length > 0) {
      const statusValues = status?.filter(Boolean)?.map((s: any) => `'${s}'`).join(',');
      whereConditions.push(`ad_group.status IN (${statusValues})`);
    }

    whereConditions.forEach((condition: any) => queryBuilder.where(condition));
    queryBuilder.orderBy('ad_group.name');

    const query = queryBuilder.build();
    const results = await this.executeQuery<any>(query, useCache);

    return results?.filter(Boolean)?.map((row: any) => this.mapToAdGroupInfo(row));
  }

  // ==================== Ad Management ==================== //

  async getAds(options: {
    campaignIds?: string[];
    adGroupIds?: string[];
    adIds?: string[];
    status?: enums.AdGroupAdStatus[];
    includePerformance?: boolean;
    useCache?: boolean;
  } = {}): Promise<AdInfo[]> {
    const {
      campaignIds,
      adGroupIds,
      adIds,
      status,
      includePerformance = true,
      useCache = true
    } = options;

    const queryBuilder = this.createQueryBuilder();
    
    const selectFields = [
      'ad_group_ad.ad.id',
      'ad_group_ad.ad_group',
      'ad_group_ad.status',
      'ad_group_ad.ad.type',
      'ad_group_ad.ad.final_urls',
      'ad_group_ad.ad.final_mobile_urls',
      'ad_group_ad.ad.final_url_suffix',
      'ad_group_ad.ad.tracking_url_template',
      'ad_group_ad.ad.url_custom_parameters'
    ];

    if (includePerformance) {
      selectFields.push(
        'metrics.impressions',
        'metrics.clicks',
        'metrics.conversions',
        'metrics.cost_micros'
      );
    }

    queryBuilder
      .select(selectFields)
      .from('ad_group_ad');

    const whereConditions: string[] = [];

    if (campaignIds && campaignIds.length > 0) {
      whereConditions.push(`campaign.id IN (${campaignIds.join(',')})`);
    }

    if (adGroupIds && adGroupIds.length > 0) {
      whereConditions.push(`ad_group.id IN (${adGroupIds.join(',')})`);
    }

    if (adIds && adIds.length > 0) {
      whereConditions.push(`ad_group_ad.ad.id IN (${adIds.join(',')})`);
    }

    if (status && status.length > 0) {
      const statusValues = status?.filter(Boolean)?.map((s: any) => `'${s}'`).join(',');
      whereConditions.push(`ad_group_ad.status IN (${statusValues})`);
    }

    whereConditions.forEach((condition: any) => queryBuilder.where(condition));
    queryBuilder.orderBy('ad_group_ad.ad.id');

    const query = queryBuilder.build();
    const results = await this.executeQuery<any>(query, useCache);

    return results?.filter(Boolean)?.map((row: any) => this.mapToAdInfo(row));
  }

  async updateAdFinalUrl(adId: string, finalUrl: string, finalUrlSuffix?: string): Promise<{ success: boolean; adId: string; error?: string }> {
    const operations = [{
      update: {
        resourceName: `customers/${this.customerId}/adGroupAds/${adId}`,
        finalUrls: [finalUrl],
        ...(finalUrlSuffix && { finalUrlSuffix }),
        updateMask: { paths: ['final_urls', ...(finalUrlSuffix ? ['final_url_suffix'] : [])] }
      }
    }];

    try {
      const response = await this.executeMutation<any>('adGroupAds', operations);
      
      if (response.results && response.results.length > 0) {
        return { success: true, adId };
      }
      
      return { success: false, adId, error: 'No result returned from API' };
    } catch (error) {
      return { 
        success: false, 
        adId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async batchUpdateAds(updates: Array<{ adId: string; finalUrl: string; finalUrlSuffix?: string }>): Promise<{
    successCount: number;
    failureCount: number;
    results: Array<{ success: boolean; adId: string; error?: string }>;
  }> {
    const operations = updates?.filter(Boolean)?.map((update: any) => ({
      update: {
        resourceName: `customers/${this.customerId}/adGroupAds/${update.adId}`,
        finalUrls: [update.finalUrl],
        ...(update.finalUrlSuffix && { finalUrlSuffix: update.finalUrlSuffix }),
        updateMask: { paths: ['final_urls', ...(update.finalUrlSuffix ? ['final_url_suffix'] : [])] }
      }
    }));

    const batchResult = await this.executeBatchOperations('adGroupAds', operations);
    
    return {
      successCount: batchResult.summary.successCount,
      failureCount: batchResult.summary.failureCount,
      results: [
        ...batchResult.successful?.filter(Boolean)?.map((s: any) => ({ success: true as const, adId: s.resourceName?.split('/')?.pop() || '' })),
        ...batchResult.failed?.filter(Boolean)?.map((f: any) => ({ 
          success: false as const, 
          adId: f.operation.resourceName?.split('/')?.pop() || '', 
          error: f.error 
        }))
      ]
    };
  }

  // ==================== Batch Operations ==================== //

  private async executeBatchOperations<T>(
    serviceName: string,
    operations: any[],
    batchSize: number = 100
  ): Promise<BatchOperationResult<T>> {
    const startTime = Date.now();
    const successful: Array<{
      operation: any;
      result: T;
      resourceName: string;
    }> = [];
    const failed: Array<{
      operation: any;
      error: string;
      errorCode?: string;
    }> = [];

    // Process in batches
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      
      try {
        const response = await this.executeMutation<any>(serviceName, batch);
        
        if (response.results) {
          response.results.forEach((result: any, index) => {
            successful.push({
              operation: batch[index],
              result: result as T,
              resourceName: result.resourceName
            });
          });
        }

        // Add delay to avoid rate limiting
        if (i + batchSize < operations.length) {
          await this.delay(1000);
        }
      } catch (error) {
        batch.forEach((operation: any) => {
          failed.push({
            operation,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorCode: (error as any)?.code
          });
        });
      }
    }

    const executionTime = Date.now() - startTime;

    return {
      successful,
      failed,
      summary: {
        total: operations.length,
        successCount: successful.length,
        failureCount: failed.length,
        executionTime
      }
    };
  }

  // ==================== Helper Methods ==================== //

  private mapToCampaignInfo(row: any): CampaignInfo {
    return {
      id: row.campaign.id,
      name: row.campaign.name,
      status: row.campaign.status,
      advertisingChannelType: row.campaign.advertisingChannelType,
      budget: {
        id: row.campaignBudget?.id || '',
        name: row.campaignBudget?.name || '',
        amountMicros: row.campaignBudget?.amountMicros || 0,
        deliveryMethod: row.campaignBudget?.deliveryMethod || enums.BudgetDeliveryMethod.STANDARD
      },
      biddingStrategy: {
        type: row.campaign.biddingStrategyType,
        targetCpa: row.campaign.targetCpa?.targetCpaMicros,
        targetRoas: row.campaign.targetRoas?.targetRoas
      },
      targeting: {
        geoTargets: [],
        languages: [],
        demographics: {}
      },
      schedule: {
        startDate: row.campaign.startDate,
        endDate: row.campaign.endDate
      },
      performance: {
        impressions: row.metrics?.impressions || 0,
        clicks: row.metrics?.clicks || 0,
        conversions: row.metrics?.conversions || 0,
        cost: row.metrics?.costMicros || 0,
        ctr: row.metrics?.ctr || 0,
        cpc: row.metrics?.averageCpc || 0,
        conversionRate: row.metrics?.conversionsFromInteractionsRate || 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private mapToAdGroupInfo(row: any): AdGroupInfo {
    return {
      id: row.adGroup.id,
      campaignId: row.adGroup.campaign.split('/').pop(),
      name: row.adGroup.name,
      status: row.adGroup.status,
      type: row.adGroup.type,
      cpcBidMicros: row.adGroup.cpcBidMicros,
      cpmBidMicros: row.adGroup.cpmBidMicros,
      targetCpaMicros: row.adGroup.targetCpaMicros,
      percentCpcBidMicros: row.adGroup.percentCpcBidMicros,
      performance: {
        impressions: row.metrics?.impressions || 0,
        clicks: row.metrics?.clicks || 0,
        conversions: row.metrics?.conversions || 0,
        cost: row.metrics?.costMicros || 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private mapToAdInfo(row: any): AdInfo {
    return {
      id: row.adGroupAd.ad.id,
      adGroupId: row.adGroupAd.adGroup.split('/').pop(),
      campaignId: row.campaign?.id || '',
      type: row.adGroupAd.ad.type,
      status: row.adGroupAd.status,
      finalUrls: row.adGroupAd.ad.finalUrls || [],
      finalMobileUrls: row.adGroupAd.ad.finalMobileUrls,
      finalUrlSuffix: row.adGroupAd.ad.finalUrlSuffix,
      trackingUrlTemplate: row.adGroupAd.ad.trackingUrlTemplate,
      urlCustomParameters: row.adGroupAd.ad.urlCustomParameters,
      content: {
        headlines: [],
        descriptions: []
      },
      performance: {
        impressions: row.metrics?.impressions || 0,
        clicks: row.metrics?.clicks || 0,
        conversions: row.metrics?.conversions || 0,
        cost: row.metrics?.costMicros || 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private updateMetrics(responseTime: number, success: boolean): void {
    this.metrics.lastRequestTime = Date.now();
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    // Calculate average response time
    const totalRequests = this.metrics.totalRequests;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
  }

  private recordError(error: any): void {
    const errorType = error?.code || error?.name || 'UNKNOWN_ERROR';
    this.metrics.errorBreakdown[errorType] = (this.metrics.errorBreakdown[errorType] || 0) + 1;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // ==================== Public API Methods ==================== //

  async getQuotaInfo(): Promise<QuotaInfo> {
    return this.rateLimiter.getRemainingQuota();
  }

  getPerformanceMetrics(): PerformanceMetrics {
    const quota = this.rateLimiter.getRemainingQuota();
    return {
      ...this.metrics,
      quotaUsage: {
        queries: this.metrics.quotaUsage.queries,
        mutations: this.metrics.quotaUsage.mutations,
        remainingQueries: quota.remainingQueries,
        remainingMutations: quota.remainingMutations
      }
    };
  }

  resetPerformanceMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      quotaUsage: {
        queries: 0,
        mutations: 0,
        remainingQueries: 0,
        remainingMutations: 0
      },
      errorBreakdown: {},
      lastRequestTime: 0
    };
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      connection: boolean;
      quotaAvailable: boolean;
      responseTime: number;
      errorRate: number;
    };
  }> {
    try {
      const startTime = Date.now();
      
      // Test connection
      const testQuery = this.createQueryBuilder()
        .select(['customer.id'])
        .from('customer')
        .limit(1)
        .build();
      
      await this.executeQuery(testQuery, false);
      
      const responseTime = Date.now() - startTime;
      const quota = await this.getQuotaInfo();
      const metrics = this.getPerformanceMetrics();
      
      const errorRate = metrics.totalRequests > 0 
        ? metrics.failedRequests / metrics.totalRequests 
        : 0;
      
      const quotaAvailable = quota.remainingQueries > 10 && quota.remainingMutations > 5;
      const connectionOk = responseTime < 5000;
      const lowErrorRate = errorRate < 0.1;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      
      if (connectionOk && quotaAvailable && lowErrorRate) {
        status = 'healthy';
      } else if (connectionOk && (quotaAvailable || lowErrorRate)) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }
      
      return {
        status,
        details: {
          connection: connectionOk,
          quotaAvailable,
          responseTime,
          errorRate
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connection: false,
          quotaAvailable: false,
          responseTime: -1,
          errorRate: 1
        }
      };
    }
  }

  getCustomerId(): string {
    return this.customerId;
  }

  async cleanup(): Promise<void> {
    this.clearCache();
    this.rateLimiter.resetAllCounters();
  }
}

// Factory function to create unified Google Ads service
export function createGoogleAdsService(
  config: GoogleAdsConfig,
  credentials: CustomerCredentials,
  rateLimiterConfig?: any
): UnifiedGoogleAdsService {
  return new UnifiedGoogleAdsService(config, credentials, rateLimiterConfig);
}

// Legacy compatibility
export { UnifiedGoogleAdsService as GoogleAdsApiClient };

// Default export for backward compatibility
export default UnifiedGoogleAdsService;
