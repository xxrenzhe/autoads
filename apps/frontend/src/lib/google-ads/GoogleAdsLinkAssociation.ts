import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('GoogleAdsLinkAssociation');

export interface AffiliateLinkConfig {
  id: string;
  name: string;
  originalUrl: string;
  affiliateUrl: string;
  trackingParameters: Record<string, string>;
  urlSuffix: string;
  status: string;
  priority: number;
  conditions: {
    urlPatterns?: string[];
    campaignIds?: string[];
    adGroupIds?: string[];
    adTypes?: string[];
    keywords?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface GoogleAdsAd {
  id: string;
  name: string;
  type: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  finalUrls: string[];
  finalUrlSuffix: string;
  trackingUrlTemplate: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  resourceName: string;
}

export interface LinkAssociationResult {
  adId: string;
  adName: string;
  matchedLink: AffiliateLinkConfig;
  confidence: number;
  matchReason: string[];
  suggestedFinalUrl: string;
  suggestedUrlSuffix: string;
}

export interface AssociationConfig {
  accountId: string;
  affiliateLinks: AffiliateLinkConfig[];
  matchingStrategy: 'exact' | 'pattern' | 'semantic' | 'hybrid';
  confidenceThreshold: number;
  autoUpdate: boolean;
  updateSchedule: {
    enabled: boolean;
    frequency: 'hourly' | 'daily' | 'weekly';
    time: string;
    timezone: string;
  };
}

export class GoogleAdsLinkAssociation {
  private configs: Map<string, AssociationConfig> = new Map();
  private adCache: Map<string, GoogleAdsAd[]> = new Map();
  private lastSync: Map<string, Date> = new Map();

  constructor() {
    // Initialize with default matching strategy
  }

  /**
   * Add or update affiliate link configuration
   */
  async saveAffiliateLink(accountId: string, linkConfig: Omit<AffiliateLinkConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<AffiliateLinkConfig> {
    try {
      const config = this.configs.get(accountId);
      if (!config) {
        throw new Error(`No configuration found for account ${accountId}`);
      }

      const existingLinkIndex = config.affiliateLinks.findIndex(link => link.name === linkConfig.name);
      const now = new Date();

      const affiliateLink: AffiliateLinkConfig = {
        id: existingLinkIndex >= 0 ? config.affiliateLinks[existingLinkIndex].id : Math.random().toString(36).substring(7),
        ...linkConfig,
        createdAt: existingLinkIndex >= 0 ? config.affiliateLinks[existingLinkIndex].createdAt : now,
        updatedAt: now,
      };

      if (existingLinkIndex >= 0) {
        config.affiliateLinks[existingLinkIndex] = affiliateLink;
      } else {
        config.affiliateLinks.push(affiliateLink);
      }

      await this.saveConfig(config);
      
      logger.info('Affiliate link configuration saved', {
        accountId,
        linkId: affiliateLink.id,
        linkName: affiliateLink.name,
      });

      return affiliateLink;
    } catch (error) {
      logger.error('Failed to save affiliate link configuration', new EnhancedError('Failed to save affiliate link configuration', { accountId, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Remove affiliate link configuration
   */
  async removeAffiliateLink(accountId: string, linkId: string): Promise<void> {
    try {
      const config = this.configs.get(accountId);
      if (!config) {
        throw new Error(`No configuration found for account ${accountId}`);
      }

      config.affiliateLinks = config.affiliateLinks.filter(link => link.id !== linkId);
      await this.saveConfig(config);

      logger.info('Affiliate link configuration removed', { accountId, linkId });
    } catch (error) {
      logger.error('Failed to remove affiliate link configuration', new EnhancedError('Failed to remove affiliate link configuration', { accountId, linkId, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Find matching affiliate links for ads
   */
  async findMatchingLinks(accountId: string, ads: GoogleAdsAd[]): Promise<LinkAssociationResult[]> {
    try {
      const config = this.configs.get(accountId);
      if (!config || config.affiliateLinks.length === 0) {
        return [];
      }

      const results: LinkAssociationResult[] = [];
      const activeLinks = config.affiliateLinks.filter(link => link.status === 'ACTIVE');

      for (const ad of ads) {
        const matches = await this.findMatchesForAd(ad, activeLinks, config.matchingStrategy);
        
        for (const match of matches) {
          if (match.confidence >= config.confidenceThreshold) {
            const suggestedUrl = this.buildSuggestedUrl(ad, match.link, config);
            results.push({
              adId: ad.id,
              adName: ad.name,
              matchedLink: match.link,
              confidence: match.confidence,
              matchReason: match.reasons,
              suggestedFinalUrl: suggestedUrl.finalUrl,
              suggestedUrlSuffix: suggestedUrl.urlSuffix,
            });
          }
        }
      }

      // Sort by confidence and priority
      results.sort((a, b) => {
        if (a.confidence !== b.confidence) {
          return b.confidence - a.confidence;
        }
        return b.matchedLink.priority - a.matchedLink.priority;
      });

      logger.info('Found matching links', {
        accountId,
        totalAds: ads.length,
        matchedAds: results.length,
        averageConfidence: results.length > 0 ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length : 0,
      });

      return results;
    } catch (error) {
      logger.error('Failed to find matching links', new EnhancedError('Failed to find matching links', { accountId, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Auto-associate links with ads
   */
  async autoAssociateLinks(accountId: string, options: {
    dryRun?: boolean;
    batchSize?: number;
    maxUpdates?: number;
  } = {}): Promise<{
    totalAds: number;
    matchedAds: number;
    updatedAds: number;
    skippedAds: number;
    errors: string[];
  }> {
    try {
      const { dryRun = false, batchSize = 50, maxUpdates = 1000 } = options;
      
      const config = this.configs.get(accountId);
      if (!config || !config.autoUpdate) {
        throw new Error('Auto-association is not enabled for this account');
      }

      // Get all ads from the account
      const ads = await this.getAccountAds(accountId);
      const results: LinkAssociationResult[] = [];
      const errors: string[] = [];
      let updatedCount = 0;

      // Process ads in batches
      for (let i = 0; i < ads.length; i += batchSize) {
        const batch = ads.slice(i, i + batchSize);
        
        try {
          const batchResults = await this.findMatchingLinks(accountId, batch);
          results.push(...batchResults);

          // Apply updates if not dry run
          if (!dryRun && updatedCount < maxUpdates) {
            const updatesToApply = batchResults.slice(0, maxUpdates - updatedCount);
            for (const result of updatesToApply) {
              try {
                await this.updateAdWithLink(accountId, result.adId, result);
                updatedCount++;
              } catch (error) {
                errors.push(`Failed to update ad ${result.adId}: ${error instanceof Error ? error.message : "Unknown error" as any}`);
              }
            }
          }

          // Small delay between batches to respect rate limits
          if (i + batchSize < ads.length) {
            await this.delay(1000);
          }
        } catch (error) {
          errors.push(`Batch processing error: ${error instanceof Error ? error.message : "Unknown error" as any}`);
        }
      }

      const summary = {
        totalAds: ads.length,
        matchedAds: results.length,
        updatedAds: dryRun ? 0 : updatedCount,
        skippedAds: ads.length - results.length,
        errors,
      };

      logger.info('Auto-association completed', { accountId, ...summary });

      return summary;
    } catch (error) {
      logger.error('Failed to auto-associate links', new EnhancedError('Failed to auto-associate links', { accountId, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Get association statistics
   */
  async getAssociationStats(accountId: string): Promise<{
    totalAds: number;
    matchedAds: number;
    unassignedAds: number;
    topLinks: Array<{
      link: AffiliateLinkConfig;
      matchCount: number;
      averageConfidence: number;
    }>;
    matchConfidenceDistribution: {
      high: number; // > 0.8
      medium: number; // 0.5 - 0.8
      low: number; // < 0.5
    };
  }> {
    try {
      const config = this.configs.get(accountId);
      if (!config) {
        throw new Error(`No configuration found for account ${accountId}`);
      }

      const ads = await this.getAccountAds(accountId);
      const matches = await this.findMatchingLinks(accountId, ads);

      const linkStats = new Map<string, { matchCount: number; totalConfidence: number }>();
      
      // Calculate link statistics
      matches.forEach(match => {
        const linkId = match.matchedLink.id;
        const existing = linkStats.get(linkId) || { matchCount: 0, totalConfidence: 0 };
        linkStats.set(linkId, {
          matchCount: existing.matchCount + 1,
          totalConfidence: existing.totalConfidence + match.confidence,
        });
      });

      const topLinks = Array.from(linkStats.entries())
        .map(([linkId, stats]) => {
          const link = config.affiliateLinks.find(l => l.id === linkId)!;
          return {
            link,
            matchCount: stats.matchCount,
            averageConfidence: stats.totalConfidence / stats.matchCount,
          };
        })
        .sort((a, b) => b.matchCount - a.matchCount)
        .slice(0, 10);

      // Calculate confidence distribution
      const confidenceDistribution = {
        high: matches.filter(m => m.confidence > 0.8).length,
        medium: matches.filter(m => m.confidence >= 0.5 && m.confidence <= 0.8).length,
        low: matches.filter(m => m.confidence < 0.5).length,
      };

      return {
        totalAds: ads.length,
        matchedAds: matches.length,
        unassignedAds: ads.length - matches.length,
        topLinks,
        matchConfidenceDistribution: confidenceDistribution,
      };
    } catch (error) {
      logger.error('Failed to get association statistics', new EnhancedError('Failed to get association statistics', { accountId, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Bulk import affiliate links
   */
  async bulkImportLinks(accountId: string, links: Array<{
    name: string;
    originalUrl: string;
    affiliateUrl: string;
    trackingParameters?: Record<string, string>;
    urlSuffix?: string;
    priority?: number;
    conditions?: AffiliateLinkConfig['conditions'];
  }>): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    try {
      const config = this.configs.get(accountId);
      if (!config) {
        throw new Error(`No configuration found for account ${accountId}`);
      }

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const linkData of links) {
        try {
          // Check for duplicates
          const exists = config.affiliateLinks.some(link => 
            link.name === linkData.name || link.originalUrl === linkData.originalUrl
          );

          if (exists) {
            skipped++;
            continue;
          }

          await this.saveAffiliateLink(accountId, {
            name: linkData.name,
            originalUrl: linkData.originalUrl,
            affiliateUrl: linkData.affiliateUrl,
            trackingParameters: linkData.trackingParameters || {},
            urlSuffix: linkData.urlSuffix || '',
            status: 'ACTIVE',
            priority: linkData.priority || 1,
            conditions: linkData.conditions || {},
          });

          imported++;
        } catch (error) {
          errors.push(`Failed to import link "${linkData.name}": ${error instanceof Error ? error.message : "Unknown error" as any}`);
        }
      }

      logger.info('Bulk import completed', { accountId, imported, skipped, errors: errors.length });

      return { imported, skipped, errors };
    } catch (error) {
      logger.error('Failed to bulk import links', new EnhancedError('Failed to bulk import links', { accountId, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Find matches for a specific ad
   */
  private async findMatchesForAd(
    ad: GoogleAdsAd, 
    links: AffiliateLinkConfig[], 
    strategy: AssociationConfig['matchingStrategy']
  ): Promise<Array<{ link: AffiliateLinkConfig; confidence: number; reasons: string[] }>> {
    const matches: Array<{ link: AffiliateLinkConfig; confidence: number; reasons: string[] }> = [];

    for (const link of links) {
      const confidence = await this.calculateMatchConfidence(ad, link, strategy);
      const reasons = this.getMatchReasons(ad, link, confidence);

      if (confidence > 0) {
        matches.push({ link, confidence, reasons });
      }
    }

    return matches;
  }

  /**
   * Calculate match confidence between ad and affiliate link
   */
  private async calculateMatchConfidence(
    ad: GoogleAdsAd, 
    link: AffiliateLinkConfig, 
    strategy: AssociationConfig['matchingStrategy']
  ): Promise<number> {
    let confidence = 0;
    let factors = 0;

    // URL pattern matching
    if (link.conditions.urlPatterns && link.conditions.urlPatterns.length > 0) {
      const finalUrl = ad.finalUrls[0] || '';
      const patternMatches = link.conditions.urlPatterns.some(pattern => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(finalUrl);
        } catch {
          // Fallback to simple string matching
          return finalUrl.toLowerCase().includes(pattern.toLowerCase());
        }
      });

      if (patternMatches) {
        confidence += 0.4;
      }
      factors++;
    }

    // Campaign ID matching
    if (link.conditions.campaignIds && link.conditions.campaignIds.length > 0) {
      if (link.conditions.campaignIds.includes(ad.campaignId)) {
        confidence += 0.3;
      }
      factors++;
    }

    // Ad group ID matching
    if (link.conditions.adGroupIds && link.conditions.adGroupIds.length > 0) {
      if (link.conditions.adGroupIds.includes(ad.adGroupId)) {
        confidence += 0.2;
      }
      factors++;
    }

    // Ad type matching
    if (link.conditions.adTypes && link.conditions.adTypes.length > 0) {
      if (link.conditions.adTypes.includes(ad.type)) {
        confidence += 0.1;
      }
      factors++;
    }

    // Keyword matching in ad name
    if (link.conditions.keywords && link.conditions.keywords.length > 0) {
      const adNameLower = ad.name.toLowerCase();
      const keywordMatches = link.conditions.keywords.some(keyword => 
        adNameLower.includes(keyword.toLowerCase())
      );

      if (keywordMatches) {
        confidence += 0.2;
      }
      factors++;
    }

    // Semantic matching (if enabled)
    if (strategy === 'semantic' || strategy === 'hybrid') {
      const semanticScore = await this.calculateSemanticScore(ad, link);
      confidence += semanticScore * 0.3;
      factors++;
    }

    // Priority bonus
    confidence += (link.priority / 10) * 0.1;

    // Normalize confidence
    return factors > 0 ? Math.min(confidence, 1) : 0;
  }

  /**
   * Calculate semantic similarity score
   */
  private async calculateSemanticScore(ad: GoogleAdsAd, link: AffiliateLinkConfig): Promise<number> {
    // This is a simplified implementation
    // In a real-world scenario, you might use NLP services or embeddings
    
    const adText = `${ad.name} ${ad.campaignName} ${ad.adGroupName}`.toLowerCase();
    const linkText = `${link.name} ${link.originalUrl} ${link.affiliateUrl}`.toLowerCase();

    // Simple word overlap scoring
    const adWords = adText.split(/\s+/);
    const linkWords = linkText.split(/\s+/);
    
    const intersection = adWords.filter(word => linkWords.includes(word));
    const union = [...new Set([...adWords, ...linkWords])];
    
    return intersection.length / union.length;
  }

  /**
   * Get match reasons for debugging
   */
  private getMatchReasons(ad: GoogleAdsAd, link: AffiliateLinkConfig, confidence: number): string[] {
    const reasons: string[] = [];

    if (confidence > 0.8) {
      reasons.push('High confidence match');
    } else if (confidence > 0.5) {
      reasons.push('Medium confidence match');
    } else {
      reasons.push('Low confidence match');
    }

    if (link.conditions.urlPatterns && link.conditions.urlPatterns.length > 0) {
      const finalUrl = ad.finalUrls[0] || '';
      if (link.conditions.urlPatterns.some(pattern => finalUrl.includes(pattern))) {
        reasons.push('URL pattern match');
      }
    }

    if (link.conditions.campaignIds && link.conditions.campaignIds.includes(ad.campaignId)) {
      reasons.push('Campaign ID match');
    }

    if (link.conditions.adGroupIds && link.conditions.adGroupIds.includes(ad.adGroupId)) {
      reasons.push('Ad group ID match');
    }

    if (link.conditions.adTypes && link.conditions.adTypes.includes(ad.type)) {
      reasons.push('Ad type match');
    }

    if (link.priority > 5) {
      reasons.push('High priority link');
    }

    return reasons;
  }

  /**
   * Build suggested URL with tracking parameters
   */
  private buildSuggestedUrl(
    ad: GoogleAdsAd, 
    link: AffiliateLinkConfig, 
    config: AssociationConfig
  ): { finalUrl: string; urlSuffix: string } {
    // Start with affiliate URL
    let finalUrl = link.affiliateUrl;

    // Add tracking parameters from link
    const url = new URL(finalUrl);
    Object.entries(link.trackingParameters).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    // Add global tracking parameters from config
    // Note: You would need to parse globalTrackingParams from the config string
    // This is a simplified implementation

    finalUrl = url.toString();

    // Build URL suffix
    let urlSuffix = link.urlSuffix || config.affiliateLinks[0]?.urlSuffix || '';
    
    // Add existing URL suffix if any
    if (ad.finalUrlSuffix && !urlSuffix.includes(ad.finalUrlSuffix)) {
      urlSuffix += (urlSuffix ? '&' : '') + ad.finalUrlSuffix;
    }

    return { finalUrl, urlSuffix };
  }

  /**
   * Update ad with matched link
   */
  private async updateAdWithLink(
    accountId: string, 
    adId: string, 
    result: LinkAssociationResult
  ): Promise<void> {
    // This would call the Google Ads API to update the ad
    // Implementation depends on your Google Ads API client
    
    logger.info('Updating ad with affiliate link', {
      accountId,
      adId,
      linkId: result.matchedLink.id,
      confidence: result.confidence,
    });

    // Placeholder for actual API call
    // await googleAdsClient.updateAdFinalUrl(accountId, adId, result.suggestedFinalUrl, result.suggestedUrlSuffix);
  }

  /**
   * Get account ads with caching
   */
  private async getAccountAds(accountId: string): Promise<GoogleAdsAd[]> {
    const now = new Date();
    const cache = this.adCache.get(accountId);
    const lastSync = this.lastSync.get(accountId);

    // Use cache if it's less than 1 hour old
    if (cache && lastSync && (now.getTime() - lastSync.getTime()) < 3600000) {
      return cache;
    }

    // This would fetch ads from Google Ads API
    // Placeholder implementation
    const ads: GoogleAdsAd[] = [];
    
    this.adCache.set(accountId, ads);
    this.lastSync.set(accountId, now);

    return ads;
  }

  /**
   * Save configuration to persistent storage
   */
  private async saveConfig(config: AssociationConfig): Promise<void> {
    this.configs.set(config.accountId, config);
    
    // Here you would save to your database
    // This is a placeholder for database persistence
  }

  /**
   * Load configuration from persistent storage
   */
  async loadConfig(accountId: string): Promise<AssociationConfig | null> {
    const config = this.configs.get(accountId);
    if (config) {
      return config;
    }

    // Here you would load from your database
    // This is a placeholder for database loading
    return null as any;
  }

  /**
   * Initialize configuration for account
   */
  async initializeConfig(accountId: string, options: Partial<AssociationConfig> = {}): Promise<AssociationConfig> {
    const config: AssociationConfig = {
      accountId,
      affiliateLinks: [],
      matchingStrategy: 'hybrid',
      confidenceThreshold: 0.5,
      autoUpdate: false,
      updateSchedule: {
        enabled: false,
        frequency: 'daily',
        time: '09:00',
        timezone: 'America/New_York',
      },
      ...options,
    };

    await this.saveConfig(config);
    return config;
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}