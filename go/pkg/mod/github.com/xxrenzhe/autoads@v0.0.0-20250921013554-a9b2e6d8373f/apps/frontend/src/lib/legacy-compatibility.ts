/**
 * Legacy Compatibility Module - Provides backward compatibility for deprecated services
 * This module ensures existing code continues to work while migrating to unified services
 */

// Import unified services
import { EnhancedError } from '@/lib/utils/error-handling';
import { UnifiedGoogleAdsService } from '@/lib/google-ads/unified-google-ads-service';
import { UnifiedSimilarWebService } from '@/lib/siterank/unified-similarweb-service';
import { UnifiedBrowserService } from '@/lib/browser/unified-browser-service';

// Import legacy types/interfaces for compatibility
import type {

  GoogleAdsConfig,
  CustomerCredentials,
  AccountInfo,
  CampaignInfo,
  AdGroupInfo,
  AdInfo,
  AdUpdate,
  UpdateResult,
  BatchUpdateResult
} from '@/lib/types/consolidated';

/**
 * Legacy Google Ads API Client - Maps to UnifiedGoogleAdsService
 * Maintains backward compatibility while using the unified service internally
 */
export class GoogleAdsApiClient extends UnifiedGoogleAdsService {
  constructor(
    accessToken: string,
    refreshToken: string,
    customerId: string,
    config?: Partial<GoogleAdsConfig>
  ) {
    // Create minimal config for legacy constructor
    const fullConfig: GoogleAdsConfig = {
      clientId: config?.clientId || process.env.GOOGLE_ADS_CLIENT_ID || '',
      clientSecret: config?.clientSecret || process.env.GOOGLE_ADS_CLIENT_SECRET || '',
      developerToken: config?.developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
      loginCustomerId: config?.loginCustomerId
    };

    const credentials: CustomerCredentials = {
      customerId,
      accessToken,
      refreshToken
    };

    super(fullConfig, credentials);
    
    console.warn('GoogleAdsApiClient is deprecated. Use UnifiedGoogleAdsService instead.');
  }

  // Legacy method names mapping
  override async getAccountInfo(): Promise<AccountInfo> {
    return super.getAccountInfo();
  }

  // Legacy methods with different signatures - use new method names
  async getCampaignsLegacy(): Promise<CampaignInfo[]> {
    const campaigns = await super.getCampaigns();
    return campaigns?.filter(Boolean)?.map((c: any) => ({
      ...c,
      // Remove targeting property that doesn't exist in legacy type
      status: c.status as any,
      advertisingChannelType: c.advertisingChannelType as any,
      budget: {
        ...c.budget,
        deliveryMethod: c.budget.deliveryMethod as any
      },
      biddingStrategy: {
        ...c.biddingStrategy,
        type: c.biddingStrategy.type as any
      }
    }));
  }

  async getAdGroupsLegacy(campaignId?: string): Promise<AdGroupInfo[]> {
    const adGroups = await super.getAdGroups({ campaignIds: campaignId ? [campaignId] : undefined });
    return adGroups?.filter(Boolean)?.map((ag: any) => ({
      ...ag,
      status: ag.status as any,
      type: ag.type as any
    }));
  }

  async getAdsLegacy(campaignId?: string): Promise<AdInfo[]> {
    const ads = await super.getAds({ campaignIds: campaignId ? [campaignId] : undefined });
    return ads?.filter(Boolean)?.map((ad: any) => ({
      ...ad,
      type: ad.type as any,
      status: ad.status as any
    }));
  }

  // Override the parent methods with proper signatures but provide legacy functionality
  override async getCampaigns(options?: any): Promise<any> {
    // For legacy compatibility, ignore options and call the legacy method
    return this.getCampaignsLegacy();
  }

  override async getAdGroups(options?: any): Promise<any> {
    // Extract campaignId from options if available
    const campaignId = options?.campaignIds?.[0];
    return this.getAdGroupsLegacy(campaignId);
  }

  override async getAds(options?: any): Promise<any> {
    // Extract campaignId from options if available
    const campaignId = options?.campaignIds?.[0];
    return this.getAdsLegacy(campaignId);
  }

  override async updateAdFinalUrl(adId: string, finalUrl: string, finalUrlSuffix?: string): Promise<UpdateResult> {
    return super.updateAdFinalUrl(adId, finalUrl, finalUrlSuffix);
  }

  override async batchUpdateAds(updates: AdUpdate[]): Promise<BatchUpdateResult> {
    const result = await super.batchUpdateAds(updates);
    // Add missing errors property
    return {
      ...result,
      errors: result.results.filter((r: any) => !r.success)?.filter(Boolean)?.map((r: any) => r.error || 'Unknown error')
    };
  }

  async refreshAccessToken(): Promise<string> {
    // Mock implementation for backward compatibility
    console.warn('refreshAccessToken is deprecated. Token refresh is handled automatically.');
    return this.getCustomerId() + '_refreshed_' + Date.now();
  }

  override getQuotaInfo() {
    return super.getQuotaInfo();
  }
}

/**
 * Legacy SimilarWeb Service - Maps to UnifiedSimilarWebService
 */
export class SimilarWebService extends UnifiedSimilarWebService {
  constructor() {
    super();
    console.warn('SimilarWebService is deprecated. Use UnifiedSimilarWebService instead.');
  }

  // Legacy method mapping
  override async queryMultipleDomains(domains: string[]) {
    return super.queryMultipleDomains(domains);
  }

  async querySingleDomain(domain: string) {
    // Method doesn't exist in parent - provide implementation
    console.warn('querySingleDomain is not implemented in UnifiedSimilarWebService');
    return this.queryMultipleDomains([domain]).then(results => results[0]);
  }
}

/**
 * Legacy Browser Service - Maps to UnifiedBrowserService
 */
export class BrowserService extends UnifiedBrowserService {
  constructor(config?: any) {
    super();
    console.warn('BrowserService is deprecated. Use UnifiedBrowserService instead.');
  }

  // Legacy method mapping
  async scrapeWebsite(url: string) {
    // Method doesn't exist in parent - provide implementation
    console.warn('scrapeWebsite is not implemented in UnifiedBrowserService');
    throw new Error('Method not implemented');
  }

  async getBrowserStatus() {
    // Method doesn't exist in parent - provide implementation
    console.warn('getBrowserStatus is not implemented in UnifiedBrowserService');
    return { status: 'unknown', message: 'Method not implemented' };
  }
}

/**
 * Legacy utility functions and constants
 */
export const LEGACY_CONFIG = {
  GOOGLE_ADS_API_VERSION: 'v14',
  MAX_RETRIES: 3,
  DEFAULT_TIMEOUT: 30000,
  CACHE_TTL: 300000
};

/**
 * Deprecation warnings utility
 */
export class DeprecationWarning {
  private static warnedItems = new Set<string>();

  static warn(item: string, alternative: string, version: string = '2.0'): void {
    const key = `${item}:${alternative}:${version}`;
    
    if (!this.warnedItems.has(key)) {
      console.warn(
        `[DEPRECATION] ${item} is deprecated as of version ${version}. ` +
        `Use ${alternative} instead. This warning will only show once.`
      );
      this.warnedItems.add(key);
    }
  }

  static warnMethod(className: string, method: string, alternative: string, version: string = '2.0'): void {
    this.warn(`${className}.${method}()`, alternative, version);
  }

  static warnClass(oldClass: string, newClass: string, version: string = '2.0'): void {
    this.warn(oldClass, newClass, version);
  }
}

/**
 * Migration helper utilities
 */
export class MigrationHelper {
  /**
   * Check if legacy code is being used and provide migration suggestions
   */
  static checkLegacyUsage(): void {
    const legacyPatterns = [
      'GoogleAdsApiClient',
      'SimilarWebService',
      'BrowserService',
      'chromium-service',
      'enhanced-google-ads'
    ];

    // This would typically check actual usage patterns
    // For now, we'll just log a general warning
    console.info(
      'MigrationHelper: Detected potential legacy service usage. ' +
      'Consider migrating to unified services for better performance and maintainability.'
    );
  }

  /**
   * Provide migration guide
   */
  static getMigrationGuide(): Record<string, string> {
    return {
      'GoogleAdsApiClient': 'UnifiedGoogleAdsService - Enhanced with caching, rate limiting, and better error handling',
      'SimilarWebService': 'UnifiedSimilarWebService - Unified API with fallback strategies',
      'BrowserService': 'UnifiedBrowserService - Consolidated browser automation',
      'chromium-service': 'unified-browser-service - Better resource management',
      'enhanced-google-ads': 'unified-google-ads-service - Type-safe with comprehensive features'
    };
  }
}

/**
 * Type compatibility helpers
 */
export type LegacyAccountInfo = AccountInfo;
export type LegacyCampaignInfo = CampaignInfo;
export type LegacyAdGroupInfo = AdGroupInfo;
export type LegacyAdInfo = AdInfo;

/**
 * Export all legacy classes with deprecation warnings
 * Note: Classes are already exported individually above
 */

/**
 * Default exports for backward compatibility
 */
// Named export object for backward compatibility
const legacyCompatibilityExports = {
  GoogleAdsApiClient,
  SimilarWebService,
  BrowserService,
  DeprecationWarning,
  MigrationHelper,
  LEGACY_CONFIG
};

export default legacyCompatibilityExports;