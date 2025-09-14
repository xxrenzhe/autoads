/**
 * Google Ads API 客户端
 * 基于 Google Ads API 官方文档实现
 * 参考: https://developers.google.com/google-ads/api/docs/start
 */

import { EnhancedError } from '@/lib/utils/error-handling';
import { GoogleAuth, OAuth2Client  } from 'google-auth-library';
import axios, { AxiosInstance } from 'axios';
import {
  GoogleAdsConfig,
  AdUpdateRequest,
  AdUpdateResult,
  AdsPerformance
} from '@/app/adscenter/types';

export interface GoogleAdsAd {
  id: string;
  resource_name: string;
  final_urls: string[];
  final_url_suffix: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  type: string;
  ad_group: string;
  headline: string;
  description: string;
}

export interface GoogleAdsAdGroup {
  id: string;
  resource_name: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  campaign: string;
}

export interface GoogleAdsCampaign {
  id: string;
  resource_name: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  advertising_channel_type: string;
  budget: string;
}

export interface GoogleAdsCustomer {
  id: string;
  resource_name: string;
  descriptive_name: string;
  currency_code: string;
  time_zone: string;
  status: 'ENABLED' | 'CANCELED' | 'SUSPENDED';
}

export interface GoogleAdsMetrics {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  roas?: number;
}

export interface OAuth2Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expiry_date: number;
  scope: string;
}

export class GoogleAdsApiClient {
  private client: AxiosInstance;
  private auth: GoogleAuth;
  private tokens: Map<string, OAuth2Token> = new Map();
  private apiVersion: string;

  constructor() {
    this.apiVersion = process.env.NEXT_PUBLIC_GOOGLE_ADS_API_VERSION || 'v14';
    
    this.client = axios.create({
      baseURL: `https://googleads.googleapis.com/${this.apiVersion}`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
      },
    });

    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/adwords'],
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      async (config) => {
        const customerId = config.headers['customer-id'];
        if (customerId) {
          const token = await this.getAccessToken(customerId);
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        console.log(`Google Ads API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('Google Ads API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        if (error.response?.status === 401) {
          // Token过期，尝试刷新
          const customerId = error.config.headers['customer-id'];
          if (customerId) {
            await this.refreshAccessToken(customerId);
            // 重试请求
            const token = await this.getAccessToken(customerId);
            error.config.headers.Authorization = `Bearer ${token}`;
            return this.client.request(error.config);
          }
        }
        
        console.error('Google Ads API Response Error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * 设置 OAuth2 配置
   */
  async setupOAuth2(config: GoogleAdsConfig, authCode: string): Promise<void> {
    try {
      // 使用授权码获取访问令牌
      const oauth2Client = new OAuth2Client({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        redirectUri: process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!,
      });

      // 使用授权码获取令牌
      const tokenResponse = await oauth2Client.getToken(authCode);
      const { tokens } = tokenResponse;

      // 保存令牌
      this.tokens.set(config.customerId, {
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token!,
        token_type: tokens.token_type!,
        expiry_date: tokens.expiry_date!,
        scope: tokens.scope!,
      });

      console.log(`OAuth2 设置成功，客户ID: ${config.customerId}`);
    } catch (error) {
      console.error('OAuth2 设置失败:', error);
      throw error;
    }
  }

  /**
   * 设置刷新令牌
   */
  async setRefreshToken(customerId: string, refreshToken: string): Promise<void> {
    try {
      const oauth2Client = new OAuth2Client({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      });

      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();

      this.tokens.set(customerId, {
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token!,
        token_type: credentials.token_type!,
        expiry_date: credentials.expiry_date!,
        scope: credentials.scope!,
      });

      console.log(`刷新令牌设置成功，客户ID: ${customerId}`);
    } catch (error) {
      console.error('设置刷新令牌失败:', error);
      throw error;
    }
  }

  /**
   * 获取访问令牌
   */
  private async getAccessToken(customerId: string): Promise<string> {
    const token = this.tokens.get(customerId);
    
    if (!token) {
      throw new Error(`未找到客户 ${customerId} 的访问令牌`);
    }

    // 检查令牌是否过期
    if (Date.now() >= token.expiry_date) {
      await this.refreshAccessToken(customerId);
      return this.getAccessToken(customerId);
    }

    return token.access_token;
  }

  /**
   * 刷新访问令牌
   */
  private async refreshAccessToken(customerId: string): Promise<void> {
    try {
      const token = this.tokens.get(customerId);
      if (!token) {
        throw new Error(`未找到客户 ${customerId} 的刷新令牌`);
      }

      const oauth2Client = new OAuth2Client({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      });

      oauth2Client.setCredentials({
        refresh_token: token.refresh_token,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();

      this.tokens.set(customerId, {
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token!,
        token_type: credentials.token_type!,
        expiry_date: credentials.expiry_date!,
        scope: credentials.scope!,
      });

      console.log(`访问令牌刷新成功，客户ID: ${customerId}`);
    } catch (error) {
      console.error('刷新访问令牌失败:', error);
      throw error;
    }
  }

  /**
   * 获取客户信息
   */
  async getCustomer(customerId: string): Promise<GoogleAdsCustomer> {
    try {
      const response = await this.client.get(`/customers/${customerId}`, {
        headers: { 'customer-id': customerId },
      });

      return {
        id: customerId,
        resource_name: response.data.resourceName,
        descriptive_name: response.data.descriptiveName || '',
        currency_code: response.data.currencyCode || 'USD',
        time_zone: response.data.timeZone || 'America/New_York',
        status: response.data.status || 'ENABLED',
      };
    } catch (error) {
      console.error('获取客户信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取广告列表
   */
  async getAds(customerId: string, options: {
    campaignId?: string;
    adGroupId?: string;
    status?: string[];
    pageSize?: number;
  } = {}): Promise<GoogleAdsAd[]> {
    try {
      const query = this.buildAdsQuery(options);
      
      const response = await this.client.post(`/customers/${customerId}/googleAds:search`, {
        query,
        pageSize: options.pageSize || 100,
      }, {
        headers: { 'customer-id': customerId },
      });

      return response.data.results.map((result: any) => this.mapAdResult(result.ad));
    } catch (error) {
      console.error('获取广告列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取广告组列表
   */
  async getAdGroups(customerId: string, options: {
    campaignId?: string;
    status?: string[];
    pageSize?: number;
  } = {}): Promise<GoogleAdsAdGroup[]> {
    try {
      const query = this.buildAdGroupsQuery(options);
      
      const response = await this.client.post(`/customers/${customerId}/googleAds:search`, {
        query,
        pageSize: options.pageSize || 100,
      }, {
        headers: { 'customer-id': customerId },
      });

      return response.data.results.map((result: any) => this.mapAdGroupResult(result.adGroup));
    } catch (error) {
      console.error('获取广告组列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取广告系列列表
   */
  async getCampaigns(customerId: string, options: {
    status?: string[];
    pageSize?: number;
  } = {}): Promise<GoogleAdsCampaign[]> {
    try {
      const query = this.buildCampaignsQuery(options);
      
      const response = await this.client.post(`/customers/${customerId}/googleAds:search`, {
        query,
        pageSize: options.pageSize || 100,
      }, {
        headers: { 'customer-id': customerId },
      });

      return response.data.results.map((result: any) => this.mapCampaignResult(result.campaign));
    } catch (error) {
      console.error('获取广告系列列表失败:', error);
      throw error;
    }
  }

  /**
   * 更新广告 Final URL
   */
  async updateAdFinalUrl(customerId: string, adId: string, finalUrl: string, finalUrlSuffix: string): Promise<boolean> {
    try {
      const operation = {
        update: {
          resourceName: `customers/${customerId}/ads/${adId}`,
          finalUrls: [finalUrl],
          finalUrlSuffix: finalUrlSuffix,
        },
        updateMask: 'finalUrls,finalUrlSuffix',
      };

      const response = await this.client.post(`/customers/${customerId}/ads:mutate`, {
        operations: [operation],
      }, {
        headers: { 'customer-id': customerId },
      });

      return response.data.results.length > 0;
    } catch (error) {
      console.error('更新广告 Final URL 失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新广告
   */
  async batchUpdateAds(customerId: string, updates: AdUpdateRequest[]): Promise<AdUpdateResult[]> {
    const results: AdUpdateResult[] = [];
    
    for (const update of updates) {
      try {
        const startTime = Date.now();
        const success = await this.updateAdFinalUrl(
          customerId,
          update.adId,
          update.finalUrl,
          update.finalUrlSuffix
        );
        
        results.push({
          adId: update.adId,
          success,
          processingTime: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          adId: update.adId,
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
          processingTime: 0,
        });
      }
    }

    return results;
  }

  /**
   * 获取广告性能数据
   */
  async getAdsPerformance(customerId: string, options: {
    dateRange: {
      startDate: string;
      endDate: string;
    };
    campaignId?: string;
    adGroupId?: string;
    adId?: string;
  }): Promise<AdsPerformance[]> {
    try {
      const query = this.buildPerformanceQuery(options);
      
      const response = await this.client.post(`/customers/${customerId}/googleAds:search`, {
        query,
      }, {
        headers: { 'customer-id': customerId },
      });

      return response.data.results.map((result: any) => this.mapPerformanceResult(result));
    } catch (error) {
      console.error('获取广告性能数据失败:', error);
      throw error;
    }
  }

  /**
   * 构建广告查询语句
   */
  private buildAdsQuery(options: any): string {
    let query = `
      SELECT
        ad.id,
        ad.resource_name,
        ad.final_urls,
        ad.final_url_suffix,
        ad.status,
        ad.type,
        ad.ad_group,
        ad_group.ad_group.name,
        ad_group.campaign.campaign.name
      FROM ad
      WHERE ad.status IN ('ENABLED', 'PAUSED')
    `;

    const conditions: string[] = [];

    if (options.campaignId) {
      conditions.push(`ad_group.campaign = 'customers//*/campaigns/${options.campaignId}'`);
    }

    if (options.adGroupId) {
      conditions.push(`ad_group = 'customers//*/adGroups/${options.adGroupId}'`);
    }

    if (options.status && options.status.length > 0) {
      conditions.push(`ad.status IN (${options.status.map((s: string) => `'${s}'`).join(', ')})`);
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY ad.id DESC';

    return query;
  }

  /**
   * 构建广告组查询语句
   */
  private buildAdGroupsQuery(options: any): string {
    let query = `
      SELECT
        ad_group.id,
        ad_group.resource_name,
        ad_group.name,
        ad_group.status,
        ad_group.campaign
      FROM ad_group
      WHERE ad_group.status IN ('ENABLED', 'PAUSED')
    `;

    const conditions: string[] = [];

    if (options.campaignId) {
      conditions.push(`campaign = 'customers//*/campaigns/${options.campaignId}'`);
    }

    if (options.status && options.status.length > 0) {
      conditions.push(`ad_group.status IN (${options.status.map((s: string) => `'${s}'`).join(', ')})`);
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY ad_group.id DESC';

    return query;
  }

  /**
   * 构建广告系列查询语句
   */
  private buildCampaignsQuery(options: any): string {
    let query = `
      SELECT
        campaign.id,
        campaign.resource_name,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.budget
      FROM campaign
      WHERE campaign.status IN ('ENABLED', 'PAUSED')
    `;

    if (options.status && options.status.length > 0) {
      query += ` AND campaign.status IN (${options.status.map((s: string) => `'${s}'`).join(', ')})`;
    }

    query += ' ORDER BY campaign.id DESC';

    return query;
  }

  /**
   * 构建性能查询语句
   */
  private buildPerformanceQuery(options: any): string {
    let query = `
      SELECT
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        ad.id,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM ad
      WHERE segments.date BETWEEN '${options.dateRange.startDate}' AND '${options.dateRange.endDate}'
    `;

    const conditions: string[] = [];

    if (options.campaignId) {
      conditions.push(`campaign.id = ${options.campaignId}`);
    }

    if (options.adGroupId) {
      conditions.push(`ad_group.id = ${options.adGroupId}`);
    }

    if (options.adId) {
      conditions.push(`ad.id = ${options.adId}`);
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY segments.date DESC, campaign.id, ad_group.id, ad.id';

    return query;
  }

  /**
   * 映射广告结果
   */
  private mapAdResult(result: any): GoogleAdsAd {
    return {
      id: result.id,
      resource_name: result.resourceName,
      final_urls: result.finalUrls || [],
      final_url_suffix: result.finalUrlSuffix || '',
      status: result.status,
      type: result.type,
      ad_group: result.adGroup,
      headline: result.headline || '',
      description: result.description || '',
    };
  }

  /**
   * 映射广告组结果
   */
  private mapAdGroupResult(result: any): GoogleAdsAdGroup {
    return {
      id: result.id,
      resource_name: result.resourceName,
      name: result.name,
      status: result.status,
      campaign: result.campaign,
    };
  }

  /**
   * 映射广告系列结果
   */
  private mapCampaignResult(result: any): GoogleAdsCampaign {
    return {
      id: result.id,
      resource_name: result.resourceName,
      name: result.name,
      status: result.status,
      advertising_channel_type: result.advertisingChannelType,
      budget: result.budget,
    };
  }

  /**
   * 映射性能结果
   */
  private mapPerformanceResult(result: any): AdsPerformance {
    return {
      customerId: result.campaign.id.split('/').pop()!,
      accountName: result.campaign.name,
      date: result.segments.date,
      impressions: result.metrics.impressions || 0,
      clicks: result.metrics.clicks || 0,
      cost: (result.metrics.costMicros || 0) / 1000000, // 转换为美元
      conversions: result.metrics.conversions || 0,
      ctr: (result.metrics.ctr || 0) * 100, // 转换为百分比
      cpc: (result.metrics.averageCpc || 0) / 1000000, // 转换为美元
    };
  }

  /**
   * 获取 OAuth2 授权 URL
   */
  getOAuth2Url(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const redirectUri = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!;
    const scope = 'https://www.googleapis.com/auth/adwords';
    
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&access_type=offline&prompt=consent`;
  }

  /**
   * 验证 API 访问权限
   */
  async validateAccess(customerId: string): Promise<boolean> {
    try {
      await this.getCustomer(customerId);
      return true;
    } catch (error) {
      console.error('API 访问验证失败:', error);
      return false;
    }
  }
}

// 导出单例实例
export const googleAdsClient = new GoogleAdsApiClient();
