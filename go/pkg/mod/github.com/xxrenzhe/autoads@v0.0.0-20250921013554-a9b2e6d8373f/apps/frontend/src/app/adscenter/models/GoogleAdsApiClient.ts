/**
 * Google Ads API客户端
 * 负责OAuth认证、账户管理和广告信息获取
 */

import { google } from 'googleapis';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('GoogleAdsApiClient');


// Google Ads API Types
export interface GoogleAdsAccount {
  id: string;
  name: string;
  currencyCode: string;
  timeZone: string;
  status: string;
}

export interface GoogleAdsAd {
  id: string;
  name: string;
  campaignId: string;
  accountId: string;
  finalUrl: string;
  finalUrlSuffix: string;
  status: string;
}

export interface GoogleAdsAdGroup {
  id: string;
  name: string;
  status: string;
  ads: GoogleAdsAd[];
}

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: string;
  budgetAmount?: number;
  budgetType?: string;
  startDate?: string;
  endDate?: string;
  targetCpa?: number;
  targetRoas?: number;
  adGroups?: GoogleAdsAdGroup[];
}

export interface GoogleAdsAd {
  id: string;
  name: string;
  adGroupId: string;
  status: string;
  type: string;
  finalUrl: string;
  headlines: string[];
  descriptions: string[];
}

export interface GoogleAdsKeyword {
  id: string;
  text: string;
  adGroupId: string;
  status: string;
  matchType: string;
  cpcBid?: number;
  qualityScore?: number;
}

export interface GoogleAdsReport {
  rows: unknown[];
  totalRowCount: number;
  fieldMask: string;
}

export interface GoogleAdsPerformanceData {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

export class GoogleAdsApiClient { private oauth2Client: any;
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private developerToken: string;
  private loginCustomerId: string;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_ADS_CLIENT_ID,
      process.env.GOOGLE_ADS_CLIENT_SECRET,
      process.env.GOOGLE_ADS_REDIRECT_URI
    );

    this.developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
    this.loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '';

    // Set refresh token if available
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
    if (refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });
    }
  }

  // Authentication Methods
  async authenticate(): Promise<{ success: boolean; error?: string }> {
    try {
      const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
      if (!refreshToken) {
        return {
          success: false,
          error: 'No refresh token configured. Please set up Google Ads OAuth2 credentials.'
        };
      }

      this.oauth2Client.setCredentials({ refresh_token: refreshToken
      });
      await this.ensureValidToken();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  private async ensureValidToken(): Promise<string> {
    try {
      if (!this.accessToken || (this.tokenExpiry && Date.now() >= this.tokenExpiry)) {
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        this.accessToken = credentials.access_token;
        this.tokenExpiry = credentials.expiry_date;
      }
      return this.accessToken!;
    } catch (error) {
      // Return demo token for development
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Using demo mode for Google Ads API');
        return 'demo_token';
      }
      throw error;
    }
  }

  private async makeApiRequest(endpoint: string, method: string = 'GET', data?: unknown): Promise<unknown> {
    try {
      const token = await this.ensureValidToken();
      
      // Demo mode for development
      if (token === 'demo_token') {
        return this.getDemoData(endpoint);
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'developer-token': this.developerToken,
        'login-customer-id': this.loginCustomerId,
        'Content-Type': 'application/json'
      };

      const response = await fetch(`https://googleads.googleapis.com/v14/${endpoint}`, { method,
        headers,
        body: data ? JSON.stringify(data) : undefined
      });
      if (!(response as any).ok) {
        throw new Error(`API request failed: ${(response as any).status} ${(response as any).statusText}`);
      }

      try {


      return await (response as any).json();


      } catch (error) {


        console.error(error);


        return false;


      }
    } catch (error) { 
      logger.error('API request error:', new EnhancedError('API request error:', { error: error instanceof Error ? (error as Error).message : String(error)  }));
      throw error;
    }
  }

  // Demo Data for Development
  private getDemoData(endpoint: string): Record<string, unknown> {
    const demoData: Record<string, unknown> = {
      'customers': {
        results: [
          {
            id: '123456789',
            name: 'Demo Account',
            currencyCode: 'USD',
            timeZone: 'America/New_York',
            status: 'ENABLED'
          }
        ]
      },
      'campaigns': {
        results: [
          {
            id: '111111111',
            name: 'Summer Sale Campaign',
            status: 'ENABLED',
            budgetAmount: 1000,
            budgetType: 'STANDARD',
            startDate: '2024-06-01',
            endDate: '2024-08-31',
            targetCpa: 25
          },
          {
            id: '222222222',
            name: 'Brand Awareness Campaign',
            status: 'ENABLED',
            budgetAmount: 2000,
            budgetType: 'STANDARD',
            startDate: '2024-01-01',
            targetRoas: 4.5
          },
          {
            id: '333333333',
            name: 'Product Launch Campaign',
            status: 'PAUSED',
            budgetAmount: 1500,
            budgetType: 'STANDARD',
            startDate: '2024-05-01'
          }
        ]
      },
      'adGroups': {
        results: [
          {
            id: '444444444',
            name: 'General Keywords',
            campaignId: '111111111',
            status: 'ENABLED',
            type: 'SEARCH_STANDARD',
            cpcBid: 1.50
          },
          {
            id: '555555555',
            name: 'Brand Keywords',
            campaignId: '111111111',
            status: 'ENABLED',
            type: 'SEARCH_STANDARD',
            cpcBid: 2.00
          }
        ]
      },
      'ads': {
        results: [
          {
            id: '666666666',
            name: 'Responsive Search Ad 1',
            adGroupId: '444444444',
            status: 'ENABLED',
            type: 'RESPONSIVE_SEARCH_AD',
            finalUrl: 'https://example.com/product1',
            headlines: ['Amazing Product', 'Best Quality', 'Limited Time Offer'],
            descriptions: ['Get the best deals today!', 'Free shipping available']
          }
        ]
      },
      'keywords': {
        results: [
          {
            id: '777777777',
            text: 'best product',
            adGroupId: '444444444',
            status: 'ENABLED',
            matchType: 'BROAD',
            cpcBid: 1.50,
            qualityScore: 8
          },
          {
            id: '888888888',
            text: 'quality items',
            adGroupId: '444444444',
            status: 'ENABLED',
            matchType: 'PHRASE',
            cpcBid: 1.75,
            qualityScore: 7
          }
        ]
      },
      'reports': {
        results: [
          {
            campaignId: '111111111',
            campaignName: 'Summer Sale Campaign',
            impressions: 15000,
            clicks: 750,
            cost: 1125.50,
            conversions: 45,
            conversionValue: 2250.00,
            ctr: 5.0,
            cpc: 1.50,
            cpa: 25.01,
            roas: 2.0
          },
          {
            campaignId: '222222222',
            campaignName: 'Brand Awareness Campaign',
            impressions: 25000,
            clicks: 1200,
            cost: 1800.00,
            conversions: 60,
            conversionValue: 3000.00,
            ctr: 4.8,
            cpc: 1.50,
            cpa: 30.00,
            roas: 1.67
          }
        ]
      }
    };

    // Extract the resource type from endpoint
    const resourceType = endpoint.split('/')[0] || 'campaigns';
    return (demoData as any)[resourceType] || { results: [] };
  }

  // Account Management
  async listAccounts() {
    try {
        const response = await this.makeApiRequest('customers');
        return (response as any).results || [];
    } catch (error) {
      console.error('Error in listAccounts:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  // Campaign Management
  async listCampaigns(customerId?: string) {
    try {
        const endpoint = customerId ? `customers/${customerId}/googleAds:searchStream` : 'campaigns';
        const response = await this.makeApiRequest(endpoint);
        return (response as any).results || [];
    } catch (error) {
      console.error('Error in listCampaigns:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  async createCampaign(customerId: string, campaignData: any) {
    try {
        const response = await this.makeApiRequest(`customers/${customerId}/campaigns`, 'POST', campaignData);
        return response as any;
    } catch (error) {
      console.error('Error in createCampaign:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  async updateCampaign(customerId: string, campaignId: string, updates: any) {
    try {
        await this.makeApiRequest(`customers/${customerId}/campaigns/${campaignId}`, 'PATCH', updates);
    } catch (error) {
      console.error('Error in updateCampaign:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  async pauseCampaign(customerId: string, campaignId: string) { 
    try {
        await this.updateCampaign(customerId, campaignId, { status: 'PAUSED' });
    } catch (error) {
      console.error('Error in pauseCampaign:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  async resumeCampaign(customerId: string, campaignId: string) { 
    try {
        await this.updateCampaign(customerId, campaignId, { status: 'ENABLED' });
    } catch (error) {
      console.error('Error in resumeCampaign:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  // Ad Group Management
  async listAdGroups(customerId: string, campaignId?: string) {
    try {
        const endpoint = campaignId 
          ? `customers/${customerId}/googleAds:searchStream?query=SELECT id,name,campaign.id,status,type,cpc_bid_micros FROM ad_group WHERE campaign.id=${campaignId}`
          : `customers/${customerId}/adGroups`;
        const response = await this.makeApiRequest(endpoint);
        return (response as any).results || [];
    } catch (error) {
      console.error('Error in listAdGroups:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  async createAdGroup(customerId: string, adGroupData: any) {
    try {
        const response = await this.makeApiRequest(`customers/${customerId}/adGroups`, 'POST', adGroupData);
        return response as any;
    } catch (error) {
      console.error('Error in createAdGroup:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  // Ad Management
  async listAds(customerId: string, adGroupId?: string) {
    try {
        const endpoint = adGroupId 
          ? `customers/${customerId}/googleAds:searchStream?query=SELECT id,name,ad_group.id,status,type,final_urls,headlines,descriptions FROM ad WHERE ad_group.id=${adGroupId}`
          : `customers/${customerId}/ads`;
        const response = await this.makeApiRequest(endpoint);
        return (response as any).results || [];
    } catch (error) {
      console.error('Error in listAds:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  async createAd(customerId: string, adData: any) {
    try {
        const response = await this.makeApiRequest(`customers/${customerId}/ads`, 'POST', { ...adData,
          type: 'RESPONSIVE_SEARCH_AD'
        });
        return response as any;
    } catch (error) {
      console.error('Error in createAd:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  // Keyword Management
  async listKeywords(customerId: string, adGroupId?: string) {
    try {
        const endpoint = adGroupId 
          ? `customers/${customerId}/googleAds:searchStream?query=SELECT id,text,ad_group.id,status,match_type,cpc_bid_micros,quality_score FROM ad_group_criterion WHERE ad_group.id=${adGroupId}`
          : `customers/${customerId}/adGroupCriteria`;
        const response = await this.makeApiRequest(endpoint);
        return (response as any).results || [];
    } catch (error) {
      console.error('Error in listKeywords:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  async addKeyword(customerId: string, keywordData: any) {
    try {
        const response = await this.makeApiRequest(`customers/${customerId}/adGroupCriteria`, 'POST', keywordData);
        return response as any;
    } catch (error) {
      console.error('Error in addKeyword:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  // Reporting
  async getReport(customerId: string, query: string) {
    try {
        const response = await this.makeApiRequest(`customers/${customerId}/googleAds:searchStream?query=${encodeURIComponent(query)}`);
        return response as any;
    } catch (error) {
      console.error('Error in getReport:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  async getCampaignPerformanceReport(customerId: string, dateRange: { startDate: string; endDate: string }) {
    try {
        const query = `
          SELECT 
            campaign.id,
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_per_conversion,
            metrics.value_per_conversion
          FROM campaign 
          WHERE segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'
          ORDER BY metrics.impressions DESC
        `;
    
             const response = await this.getReport(customerId, query);
         return ((response as any).rows || []).map((row: any) => ({
          campaignId: row.campaign.id,
          campaignName: row.campaign.name,
          impressions: parseInt(row.metrics.impressions) || 0,
          clicks: parseInt(row.metrics.clicks) || 0,
          cost: parseFloat(row.metrics.cost_micros) / 1000000 || 0,
          conversions: parseFloat(row.metrics.conversions) || 0,
          conversionValue: parseFloat(row.metrics.conversions_value) || 0,
          ctr: parseFloat(row.metrics.ctr) || 0,
          cpc: parseFloat(row.metrics.average_cpc) / 1000000 || 0,
          cpa: parseFloat(row.metrics.cost_per_conversion) / 1000000 || 0,
          roas: parseFloat(row.metrics.value_per_conversion) || 0
        }));
    } catch (error) {
      console.error('Error in getCampaignPerformanceReport:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  async getCampaignPerformanceReport2(customerId: string, dateRange: { startDate: string; endDate: string }) {
    try {
        const query = `
      SELECT 
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion,
        metrics.value_per_conversion
      FROM campaign 
      WHERE segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'
      ORDER BY metrics.impressions DESC
    `;

        const response = await this.getReport(customerId, query);
        return ((response as any).rows || []).map((row: any) => ({
          campaignId: row.campaign.id,
          campaignName: row.campaign.name,
          impressions: parseInt(row.metrics.impressions) || 0,
          clicks: parseInt(row.metrics.clicks) || 0,
          cost: parseFloat(row.metrics.cost_micros) / 1000000 || 0,
          conversions: parseFloat(row.metrics.conversions) || 0,
          conversionValue: parseFloat(row.metrics.conversions_value) || 0,
          ctr: parseFloat(row.metrics.ctr) || 0,
          cpc: parseFloat(row.metrics.average_cpc) / 1000000 || 0,
          cpa: parseFloat(row.metrics.cost_per_conversion) / 1000000 || 0,
          roas: parseFloat(row.metrics.value_per_conversion) || 0
        }));
    } catch (error) {
      console.error('Error in getCampaignPerformanceReport2:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  // Batch Operations
  async batchUpdateCampaigns(customerId: string, updates: Array<{ id: string; updates: any }>) {
    try {
        const operations = updates.map(({ id, updates }: any) => ({
          update: {
            resourceName: `customers/${customerId}/campaigns/${id}`,
            ...updates
          },
          updateMask: Object.keys(updates).join(',')
        }));
    
        await this.makeApiRequest(`customers/${customerId}/campaigns:batchUpdate`, 'POST', { operations
        });
    } catch (error) {
      console.error('Error in batchUpdateCampaigns:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  // Utility Methods
  async getAccountInfo(customerId: string) {
    try {
        try {

        return await this.makeApiRequest(`customers/${customerId}`);

        } catch (error) {

          console.error(error);

          return false;

        }
    } catch (error) {
      console.error('Error in getAccountInfo:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  async getBillingSetup(customerId: string) {
    try {
        try {

        return await this.makeApiRequest(`customers/${customerId}/billingSetups`);

        } catch (error) {

          console.error(error);

          return false;

        }
    } catch (error) {
      console.error('Error in getBillingSetup:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  // Ad Update (stub for compatibility)
  async updateAdFinalUrl(customerId: string, adId: string, newUrl: string) {
    try {
        // Stub: In real implementation, call Google Ads API to update ad final URL
        return;
    } catch (error) {
      console.error('Error in updateAdFinalUrl:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  async getAdInfo(customerId: string, adId: string) {
    try {
        // Stub: In real implementation, fetch ad info from Google Ads API
        return { finalUrl: '', finalUrlSuffix: '' };
    } catch (error) {
      console.error('Error in getAdInfo:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  // 兼容GoogleAdsCampaignUpdater类型依赖
  async getCampaigns(customerId: string) {
    try {
        // Stub: 返回mock campaign结构
        return [
          { id: '111', name: 'Mock Campaign', status: 'ENABLED', adGroups: [
            { id: '222', name: 'Mock AdGroup', status: 'ENABLED', ads: [
              { id: '333', name: 'Mock Ad', campaignId: '111', accountId: customerId, finalUrl: 'https://example.com', finalUrlSuffix: '', status: 'ENABLED' }
            ] }
          ] }
        ];
    } catch (error) {
      console.error('Error in getCampaigns:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  async getAds(customerId: string, accountId: string) {
    try {
        // Stub: 返回mock ads结构
        return [
          { id: '333', name: 'Mock Ad', campaignId: '111', accountId: accountId, finalUrl: 'https://example.com', finalUrlSuffix: '', status: 'ENABLED' }
        ];
    } catch (error) {
      console.error('Error in getAds:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  async getAd(customerId: string, adId: string, accountId: string) {
    try {
        // Stub: 返回mock ad结构
        return { id: adId, accountId, finalUrl: 'https://example.com', finalUrlSuffix: '', status: 'ENABLED' };
    } catch (error) {
      console.error('Error in getAd:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  async updateAd(customerId: string, adId: string, updates: any) {
    try {
        // Stub: 实际应调用Google Ads API
        return;
    } catch (error) {
      console.error('Error in updateAd:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  // Error Handling
  private handleApiError(error: unknown): never {
    const err = error as any;
    if (err.code === 401) {
      throw new Error('Authentication failed. Please check your credentials.');
    } else if (err.code === 403) {
      throw new Error('Access denied. Please check your permissions.');
    } else if (err.code === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    } else {
      throw new Error(`API Error: ${err.message || 'Unknown error occurred'}`);
    }
  }
}