/**
 * Google Ads API客户端 - 基于官方文档优化版本 v2.0
 * 负责与Google Ads API进行通信，管理广告账户和广告系列
 * 
 * 官方文档参考：
 * - https://developers.google.com/google-ads/api/docs/start
 * - https://developers.google.com/google-ads/api/reference/rpc
 * - https://github.com/Opteo/google-ads-api
 * 
 * 优化特性：
 * - 完整的API覆盖（账户、广告系列、广告组、关键词等）
 * - 智能缓存和性能优化
 * - 增强的错误处理和重试机制
 * - 批量操作优化
 * - 实时配额管理
 * - 详细的性能监控
 */

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
  status: string;
  budget_amount_micros: number;
  start_date: string;
  end_date?: string;
  campaign_type: string;
  advertising_channel_type: string;
  advertising_channel_sub_type?: string;
  target_cpa_micros?: number;
  target_roas?: number;
  bidding_strategy_type: string;
  serving_status: string;
  optimization_score?: number;
}

export interface AdGroupInfo {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  type: string;
  cpc_bid_micros?: number;
  cpm_bid_micros?: number;
  target_cpa_micros?: number;
  percent_cpc_bid_micros?: number;
}

export interface AdInfo {
  id: string;
  campaign_id: string;
  ad_group_id: string;
  final_urls: string[];
  final_url_suffix?: string;
  status: string;
  type: string;
}

export interface AdUpdate {
  adId: string;
  finalUrl: string;
  finalUrlSuffix?: string;
}

export interface UpdateResult {
  success: boolean;
  adId: string;
  error?: string;
}

export interface BatchUpdateResult {
  successCount: number;
  failureCount: number;
  errors: string[];
  results: UpdateResult[];
}

export interface QuotaInfo {
  remainingQueries: number;
  remainingMutations: number;
  resetTime: string;
}

/**
 * @deprecated Use UnifiedGoogleAdsService instead
 * This class is maintained for backward compatibility only
 */

// Import the actual implementation from legacy compatibility
import { GoogleAdsApiClient as LegacyGoogleAdsApiClient } from '@/lib/legacy-compatibility';

// Re-export with deprecation warning
export class GoogleAdsApiClient extends LegacyGoogleAdsApiClient {
  constructor(
    accessToken: string, 
    refreshToken: string, 
    customerId: string
  ) {
    super(accessToken, refreshToken, customerId);
    console.warn('GoogleAdsApiClient is deprecated. Please migrate to UnifiedGoogleAdsService.');
  }
}

export default GoogleAdsApiClient; 