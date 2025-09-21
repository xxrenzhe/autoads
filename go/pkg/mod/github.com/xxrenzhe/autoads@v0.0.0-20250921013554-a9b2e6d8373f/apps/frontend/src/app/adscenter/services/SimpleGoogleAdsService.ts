/**
 * 简化的 Google Ads 服务
 * 专注于核心功能：更新广告的 Final URL 和 Final URL Suffix
 */

export interface GoogleAdsCredentials {
  customerId: string;
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
}

export interface AdToUpdate {
  adId: string;
  finalUrl: string;
  finalUrlSuffix?: string;
}

export interface GoogleAdsUpdateResult {
  success: boolean;
  updatedAds: number;
  failedAds: number;
  errors: string[];
  executionTime: number;
}

class SimpleGoogleAdsService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  /**
   * 更新广告的 Final URL 和 Final URL Suffix
   */
  async updateAdUrls(
    credentials: GoogleAdsCredentials,
    adsToUpdate: AdToUpdate[]
  ): Promise<GoogleAdsUpdateResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let updatedAds = 0;
    let failedAds = 0;

    try {
      // 1. 获取访问令牌
      const accessToken = await this.getAccessToken(credentials);
      
      // 2. 批量更新广告
      const batchSize = 10; // Google Ads API 限制
      const batches: AdToUpdate[][] = [];
      
      for (let i = 0; i < adsToUpdate.length; i += batchSize) {
        batches.push(adsToUpdate.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        try {
          const result = await this.updateBatch(credentials.customerId, accessToken, batch);
          updatedAds += result.updatedCount;
          failedAds += result.failedCount;
          errors.push(...result.errors);
        } catch (error) {
          failedAds += batch.length;
          errors.push(`批量更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }

      const executionTime = Date.now() - startTime;
      
      return {
        success: failedAds === 0,
        updatedAds,
        failedAds,
        errors,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      return {
        success: false,
        updatedAds: 0,
        failedAds: adsToUpdate.length,
        errors: [errorMessage],
        executionTime
      };
    }
  }

  /**
   * 获取访问令牌
   */
  private async getAccessToken(credentials: GoogleAdsCredentials): Promise<string> {
    // 检查现有令牌是否仍然有效
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          refresh_token: credentials.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const data = await response.json();

      if (data.access_token) {
        this.accessToken = data.access_token;
        // 提前 5 分钟过期
        this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
        return this.accessToken!;
      } else {
        throw new Error(data.error_description || '获取访问令牌失败');
      }
    } catch (error) {
      throw new Error(`OAuth 认证失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 批量更新广告
   */
  private async updateBatch(
    customerId: string,
    accessToken: string,
    ads: AdToUpdate[]
  ): Promise<{ updatedCount: number; failedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let updatedCount = 0;
    let failedCount = 0;

    // 构建批量更新请求
    const operations = ads?.filter(Boolean)?.map((ad: any) => ({
      update_mask: 'final_url,final_url_suffix',
      operation: {
        update: {
          resource_name: `customers/${customerId}/ads/${ad.adId}`,
          final_url: ad.finalUrl,
          final_url_suffix: ad.finalUrlSuffix || ''
        }
      }
    }));

    try {
      const response = await fetch(
        `https://googleads.googleapis.com/v14/customers/${customerId}:mutate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': process.env.NEXT_PUBLIC_GOOGLE_ADS_DEVELOPER_TOKEN || '',
          },
          body: JSON.stringify({
            operations: operations
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        // 处理成功响应
        if (data.results) {
          updatedCount = (data.results as any[]).length;
          failedCount = (ads as any[]).length - updatedCount;
          
          // 检查部分失败
          if (data.partial_failure_error) {
            errors.push(`部分失败: ${data.partial_failure_error.message}`);
          }
        } else {
          failedCount = (ads as any[]).length;
          errors.push('未收到更新结果');
        }
      } else {
        failedCount = (ads as any[]).length;
        const error = data.error || {};
        errors.push(`API 错误: ${error.message || '未知错误'}`);
      }

    } catch (error) {
      failedCount = (ads as any[]).length;
      errors.push(`请求失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return { updatedCount, failedCount, errors };
  }

  /**
   * 获取客户账号下的广告列表
   */
  async getAds(
    credentials: GoogleAdsCredentials,
    campaignId?: string,
    adGroupId?: string
  ): Promise<{ success: boolean; ads?: AdToUpdate[]; error?: string }> {
    try {
      const accessToken = await this.getAccessToken(credentials);
      
      let query = 'SELECT ad.id, ad.final_url, ad.final_url_suffix, ad.status FROM ad';
      const conditions: string[] = [];
      
      if (campaignId) {
        conditions.push(`campaign.id = ${campaignId}`);
      }
      
      if (adGroupId) {
        conditions.push(`ad_group.id = ${adGroupId}`);
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      query += ' LIMIT 1000';

      const response = await fetch(
        `https://googleads.googleapis.com/v14/customers/${credentials.customerId}:search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': process.env.NEXT_PUBLIC_GOOGLE_ADS_DEVELOPER_TOKEN || '',
          },
          body: JSON.stringify({ query }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        const ads: AdToUpdate[] = [];
        
        if (data.results) {
          for (const row of data.results) {
            const ad = row.ad;
            if (ad.id && ad.final_url) {
              ads.push({
                adId: ad.id,
                finalUrl: ad.final_url,
                finalUrlSuffix: ad.final_url_suffix || undefined
              });
            }
          }
        }

        return { success: true, ads };
      } else {
        const error = data.error || {};
        return { 
          success: false, 
          error: `查询失败: ${error.message || '未知错误'}` 
        };
      }

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      };
    }
  }

  /**
   * 测试 API 连接
   */
  async testConnection(credentials: GoogleAdsCredentials): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await this.getAccessToken(credentials);
      
      const response = await fetch(
        `https://googleads.googleapis.com/v14/customers/${credentials.customerId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': process.env.NEXT_PUBLIC_GOOGLE_ADS_DEVELOPER_TOKEN || '',
          },
        }
      );

      return { success: response.ok };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '连接失败' 
      };
    }
  }

  /**
   * 清除缓存的令牌
   */
  clearCache(): void {
    this.accessToken = null;
    this.tokenExpiry = 0;
  }
}

export const simpleGoogleAdsService = new SimpleGoogleAdsService();