import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('GoogleAdsUrlUpdater');

export interface UrlUpdateRequest {
  adId: string;
  finalUrl?: string;
  finalUrlSuffix?: string;
  trackingUrlTemplate?: string;
}

export interface UrlUpdateResult {
  adId: string;
  success: boolean;
  error?: string;
  oldFinalUrl?: string;
  newFinalUrl?: string;
  oldFinalUrlSuffix?: string;
  newFinalUrlSuffix?: string;
  processingTime: number;
  retryCount: number;
  warnings?: string[];
}

export interface BatchUpdateOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
  maxConcurrentRequests?: number;
  maxRetries?: number;
  retryDelay?: number;
  validateOnly?: boolean;
  dryRun?: boolean;
}

export interface BatchUpdateSummary {
  totalRequests: number;
  successfulUpdates: number;
  failedUpdates: number;
  skippedUpdates: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  errors: string[];
  warnings: string[];
  results: UrlUpdateResult[];
}

export interface UrlValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

export class GoogleAdsUrlUpdater {
  private rateLimiter: Map<string, { lastRequest: Date; requestCount: number }> = new Map();
  private updateHistory: UrlUpdateResult[] = [];

  constructor() {
    // Initialize rate limiter
  }

  /**
   * Update a single ad's final URL and/or suffix
   */
  async updateAdUrls(
    accountId: string,
    adId: string,
    updates: UrlUpdateRequest
  ): Promise<UrlUpdateResult> {
    const startTime = Date.now();
    let retryCount = 0;
    const maxRetries = 3;

    try {
      // Check rate limit
      await this.checkRateLimit(accountId);

      // Validate the update request
      const validation = this.validateUpdateRequest(updates);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Get current ad data
      const currentAd = await this.getAdData(accountId, adId);
      
      // Apply URL transformations
      const transformedUpdates = this.transformUrls(updates, currentAd);

      // If dry run, return simulated result
      if (updates.finalUrl?.includes('dry-run')) {
        return {
          adId,
          success: true,
          oldFinalUrl: currentAd.finalUrls?.[0],
          newFinalUrl: transformedUpdates.finalUrl,
          oldFinalUrlSuffix: currentAd.finalUrlSuffix,
          newFinalUrlSuffix: transformedUpdates.finalUrlSuffix,
          processingTime: Date.now() - startTime,
          retryCount,
          warnings: validation.warnings,
        };
      }

      // Update the ad
      const result = await this.performAdUpdate(accountId, adId, transformedUpdates);

      logger.info('Ad URL updated successfully', {
        accountId,
        adId,
        oldUrl: currentAd.finalUrls?.[0],
        newUrl: transformedUpdates.finalUrl,
        processingTime: Date.now() - startTime,
      });

      return {
        adId,
        success: true,
        oldFinalUrl: currentAd.finalUrls?.[0],
        newFinalUrl: result.finalUrl,
        oldFinalUrlSuffix: currentAd.finalUrlSuffix,
        newFinalUrlSuffix: result.finalUrlSuffix,
        processingTime: Date.now() - startTime,
        retryCount,
        warnings: validation.warnings,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error" as any;
      
      logger.error('Failed to update ad URLs', new EnhancedError('Failed to update ad URLs', { 
        accountId,
        adId,
        error: errorMsg,
        retryCount,
       }));

      // Retry logic
      if (await this.shouldRetry(error) && retryCount < maxRetries) {
        retryCount++;
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff
        
        logger.info('Retrying update', { accountId, adId, retryCount, delay });
        await this.delay(delay);
        
        return this.updateAdUrls(accountId, adId, updates);
      }

      return {
        adId,
        success: false,
        error: errorMsg,
        processingTime: Date.now() - startTime,
        retryCount,
      };
    }
  }

  /**
   * Batch update multiple ads
   */
  async batchUpdateAds(
    accountId: string,
    updates: UrlUpdateRequest[],
    options: BatchUpdateOptions = {}
  ): Promise<BatchUpdateSummary> {
    const startTime = Date.now();
    const {
      batchSize = 50,
      delayBetweenBatches = 1000,
      maxConcurrentRequests = 5,
      maxRetries = 3,
      retryDelay = 1000,
      validateOnly = false,
      dryRun = false,
    } = options;

    const results: UrlUpdateResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let successfulUpdates = 0;
    let failedUpdates = 0;
    let skippedUpdates = 0;

    try {
      // Validate all requests first
      if (validateOnly) {
        for (const update of updates) {
          const validation = this.validateUpdateRequest(update);
          if (!validation.isValid) {
            errors.push(`Ad ${update.adId}: ${validation.errors.join(', ')}`);
          }
          warnings.push(...validation.warnings?.filter(Boolean)?.map(w => `Ad ${update.adId}: ${w}`));
        }

        if (errors.length > 0) {
          throw new Error(`Validation failed for ${errors.length} updates`);
        }
      }

      // Process updates in batches
      const batches = this.chunkArray(updates, batchSize);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        logger.info(`Processing batch ${batchIndex + 1}/${batches.length}`, {
          accountId,
          batchSize: batch.length,
        });

        // Process batch with concurrency control
        const batchResults = await this.processBatchWithConcurrency(
          accountId,
          batch,
          maxConcurrentRequests,
          dryRun
        );

        results.push(...batchResults);

        // Update counters
        batchResults.forEach(result => {
          if (result.success) {
            successfulUpdates++;
          } else if (result.error?.includes('skipped')) {
            skippedUpdates++;
          } else {
            failedUpdates++;
            errors.push(`Ad ${result.adId}: ${result.error}`);
          }

          if (result.warnings) {
            warnings.push(...result.warnings?.filter(Boolean)?.map(w => `Ad ${result.adId}: ${w}`));
          }
        });

        // Delay between batches
        if (batchIndex < batches.length - 1 && delayBetweenBatches > 0) {
          await this.delay(delayBetweenBatches);
        }
      }

      const processingTime = Date.now() - startTime;
      const averageProcessingTime = results.length > 0 
        ? results.reduce((sum, r) => sum + r.processingTime, 0) / results.length 
        : 0;

      const summary: BatchUpdateSummary = {
        totalRequests: updates.length,
        successfulUpdates,
        failedUpdates,
        skippedUpdates,
        totalProcessingTime: processingTime,
        averageProcessingTime,
        errors,
        warnings,
        results,
      };

      logger.info('Batch update completed', {
        accountId,
        ...summary,
      });

      // Store in history
      this.updateHistory.push(...results);

      return summary;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error" as any;
      logger.error('Batch update failed', new EnhancedError('Batch update failed', {  accountId, error: errorMsg  }));
      throw error;
    }
  }

  /**
   * Update ads based on URL pattern matching
   */
  async updateAdsByPattern(
    accountId: string,
    pattern: string,
    replacement: {
      finalUrl?: string;
      finalUrlSuffix?: string;
      trackingParameters?: Record<string, string>;
    },
    options: {
      caseSensitive?: boolean;
      regex?: boolean;
      validateOnly?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<BatchUpdateSummary> {
    try {
      // Find ads matching the pattern
      const matchingAds = await this.findAdsByPattern(accountId, pattern, options);
      
      if (matchingAds.length === 0) {
        logger.info('No ads found matching pattern', { accountId, pattern });
        return {
          totalRequests: 0,
          successfulUpdates: 0,
          failedUpdates: 0,
          skippedUpdates: 0,
          totalProcessingTime: 0,
          averageProcessingTime: 0,
          errors: [],
          warnings: [],
          results: [],
        };
      }

      // Build update requests
      const updates: UrlUpdateRequest[] = matchingAds?.filter(Boolean)?.map(ad => ({
        adId: ad.id,
        finalUrl: replacement.finalUrl,
        finalUrlSuffix: replacement.finalUrlSuffix,
        trackingUrlTemplate: this.buildTrackingUrlTemplate(replacement.trackingParameters),
      }));

      logger.info('Found ads matching pattern', {
        accountId,
        pattern,
        matchingAdsCount: matchingAds.length,
      });

      return this.batchUpdateAds(accountId, updates, {
        validateOnly: options.validateOnly,
        dryRun: options.dryRun,
      });
    } catch (error) {
      logger.error('Failed to update ads by pattern', new EnhancedError('Failed to update ads by pattern', { accountId, pattern, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Bulk update URL suffixes
   */
  async bulkUpdateUrlSuffixes(
    accountId: string,
    suffixUpdates: Array<{
      campaignId?: string;
      adGroupId?: string;
      adIds?: string[];
      newSuffix: string;
      append?: boolean;
      removeExisting?: boolean;
    }>,
    options: BatchUpdateOptions = {}
  ): Promise<BatchUpdateSummary> {
    try {
      const allUpdates: UrlUpdateRequest[] = [];

      for (const suffixUpdate of suffixUpdates) {
        let adsToUpdate: any[] = [];

        if (suffixUpdate.adIds) {
          adsToUpdate = await Promise.all(
            suffixUpdate.adIds?.filter(Boolean)?.map(adId => this.getAdData(accountId, adId))
          );
        } else if (suffixUpdate.adGroupId) {
          adsToUpdate = await this.getAdsByAdGroup(accountId, suffixUpdate.adGroupId);
        } else if (suffixUpdate.campaignId) {
          adsToUpdate = await this.getAdsByCampaign(accountId, suffixUpdate.campaignId);
        }

        const updates = adsToUpdate?.filter(Boolean)?.map(ad => ({
          adId: ad.id,
          finalUrlSuffix: this.buildNewSuffix(ad.finalUrlSuffix, suffixUpdate),
        }));

        allUpdates.push(...updates);
      }

      return this.batchUpdateAds(accountId, allUpdates, options);
    } catch (error) {
      logger.error('Failed to bulk update URL suffixes', new EnhancedError('Failed to bulk update URL suffixes', { accountId, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Validate URL before update
   */
  async validateUrlUpdate(
    accountId: string,
    adId: string,
    updates: UrlUpdateRequest
  ): Promise<UrlValidationResult> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];
      const suggestions: string[] = [];

      // Get current ad data
      const currentAd = await this.getAdData(accountId, adId);

      // Validate final URL
      if (updates.finalUrl) {
        const urlValidation = this.validateUrl(updates.finalUrl);
        errors.push(...urlValidation.errors);
        warnings.push(...urlValidation.warnings);
        suggestions.push(...urlValidation.suggestions || []);

        // Check if URL format changed significantly
        if (currentAd.finalUrls?.[0]) {
          const oldDomain = new URL(currentAd.finalUrls[0]).hostname;
          const newDomain = new URL(updates.finalUrl).hostname;
          
          if (oldDomain !== newDomain) {
            warnings.push('Domain change detected - this may affect ad performance');
          }
        }
      }

      // Validate URL suffix
      if (updates.finalUrlSuffix) {
        const suffixValidation = this.validateUrlSuffix(updates.finalUrlSuffix);
        errors.push(...suffixValidation.errors);
        warnings.push(...suffixValidation.warnings);
      }

      // Check for potential issues
      if (updates.finalUrl && updates.finalUrlSuffix) {
        const combinedUrl = updates.finalUrl + (updates.finalUrlSuffix.startsWith('?') ? '' : '?') + updates.finalUrlSuffix;
        const lengthCheck = this.validateUrlLength(combinedUrl);
        
        if (!lengthCheck.isValid) {
          errors.push(...lengthCheck.errors);
        }
        
        if (lengthCheck.warnings) {
          warnings.push(...lengthCheck.warnings);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : "Unknown error" as any],
        warnings: [],
        suggestions: [],
      };
    }
  }

  /**
   * Get update history
   */
  getUpdateHistory(filters: {
    accountId?: string;
    adId?: string;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
  } = {}): UrlUpdateResult[] {
    let filtered = [...this.updateHistory];

    if (filters.accountId) {
      filtered = filtered.filter(r => r.adId.startsWith(filters.accountId!));
    }

    if (filters.adId) {
      filtered = filtered.filter(r => r.adId === filters.adId);
    }

    if (filters.startDate) {
      filtered = filtered.filter(r => {
        const updateTime = new Date(Date.now() - r.processingTime);
        return updateTime >= filters.startDate!;
      });
    }

    if (filters.endDate) {
      filtered = filtered.filter(r => {
        const updateTime = new Date(Date.now() - r.processingTime);
        return updateTime <= filters.endDate!;
      });
    }

    if (filters.success !== undefined) {
      filtered = filtered.filter(r => r.success === filters.success);
    }

    return filtered.sort((a, b) => b.processingTime - a.processingTime);
  }

  /**
   * Get update statistics
   */
  getUpdateStats(accountId?: string): {
    totalUpdates: number;
    successfulUpdates: number;
    failedUpdates: number;
    averageProcessingTime: number;
    totalProcessingTime: number;
    recentErrors: string[];
    successRate: number;
  } {
    const history = accountId 
      ? this.updateHistory.filter(r => r.adId.startsWith(accountId))
      : this.updateHistory;

    const totalUpdates = history.length;
    const successfulUpdates = history.filter(r => r.success).length;
    const failedUpdates = history.filter(r => !r.success).length;
    const totalProcessingTime = history.reduce((sum, r) => sum + r.processingTime, 0);
    const averageProcessingTime = totalUpdates > 0 ? totalProcessingTime / totalUpdates : 0;
    const successRate = totalUpdates > 0 ? (successfulUpdates / totalUpdates) * 100 : 0;

    const recentErrors = history
      .filter(r => !r.success && r.error)
      .slice(-10)
      ?.filter(Boolean)?.map(r => r.error!);

    return {
      totalUpdates,
      successfulUpdates,
      failedUpdates,
      averageProcessingTime,
      totalProcessingTime,
      recentErrors,
      successRate,
    };
  }

  // Private helper methods

  private validateUpdateRequest(request: UrlUpdateRequest): UrlValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (!request.adId) {
      errors.push('Ad ID is required');
    }

    if (request.finalUrl) {
      const urlValidation = this.validateUrl(request.finalUrl);
      errors.push(...urlValidation.errors);
      warnings.push(...urlValidation.warnings);
      suggestions.push(...urlValidation.suggestions || []);
    }

    if (request.finalUrlSuffix) {
      const suffixValidation = this.validateUrlSuffix(request.finalUrlSuffix);
      errors.push(...suffixValidation.errors);
      warnings.push(...suffixValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  private validateUrl(url: string): UrlValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      new URL(url);
    } catch {
      errors.push('Invalid URL format');
      return { isValid: false, errors, warnings, suggestions };
    }

    if (url.length > 2048) {
      warnings.push('URL is very long and may be truncated');
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      warnings.push('URL should use HTTPS for better security');
    }

    // Check for common tracking parameters
    const trackingParams = ['utm_', 'gclid', 'fbclid', 'msclkid'];
    const urlObj = new URL(url);
    const hasTrackingParams = trackingParams.some(param => 
      Array.from(urlObj.searchParams.keys()).some(key => key.includes(param))
    );

    if (!hasTrackingParams) {
      suggestions.push('Consider adding tracking parameters for better analytics');
    }

    return { isValid: true, errors, warnings, suggestions };
  }

  private validateUrlSuffix(suffix: string): UrlValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (suffix.length > 1024) {
      errors.push('URL suffix is too long (max 1024 characters)');
    }

    if (suffix.includes(' ')) {
      errors.push('URL suffix cannot contain spaces');
    }

    if (suffix.includes('?') && !suffix.startsWith('?')) {
      warnings.push('URL suffix should start with ? when it contains parameters');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateUrlLength(url: string): UrlValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (url.length > 2048) {
      errors.push('URL exceeds maximum length of 2048 characters');
    } else if (url.length > 1500) {
      warnings.push('URL is approaching maximum length');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private transformUrls(updates: UrlUpdateRequest, currentAd: any): UrlUpdateRequest {
    const transformed = { ...updates };

    // Apply URL transformations if needed
    if (updates.finalUrl) {
      // Add tracking parameters if needed
      const url = new URL(updates.finalUrl);
      
      // Ensure URL has proper tracking parameters
      if (!url.searchParams.has('utm_source')) {
        url.searchParams.append('utm_source', 'google');
      }
      if (!url.searchParams.has('utm_medium')) {
        url.searchParams.append('utm_medium', 'cpc');
      }

      transformed.finalUrl = url.toString();
    }

    // Normalize URL suffix
    if (updates.finalUrlSuffix) {
      let suffix = updates.finalUrlSuffix.trim();
      
      // Ensure suffix starts with ? if it contains parameters
      if (suffix.includes('=') && !suffix.startsWith('?')) {
        suffix = '?' + suffix;
      }

      // Remove duplicate ? if it already exists at the start
      if (suffix.startsWith('??')) {
        suffix = suffix.substring(1);
      }

      transformed.finalUrlSuffix = suffix;
    }

    return transformed;
  }

  private buildTrackingUrlTemplate(parameters?: Record<string, string>): string {
    if (!parameters || Object.keys(parameters).length === 0) {
      return '';
    }

    const params = Object.entries(parameters)
      .map(([key, value]) => `${key}={${key}}`)
      .join('&');

    return params ? `{lpurl}?${params}` : '';
  }

  private buildNewSuffix(currentSuffix: string, update: {
    newSuffix: string;
    append?: boolean;
    removeExisting?: boolean;
  }): string {
    if (update.removeExisting) {
      return update.newSuffix;
    }

    if (update.append && currentSuffix) {
      // Merge parameters intelligently
      const currentParams = new URLSearchParams(currentSuffix.replace(/^\?/, ''));
      const newParams = new URLSearchParams(update.newSuffix.replace(/^\?/, ''));
      
      // New parameters take precedence
      for (const [key, value] of newParams) {
        currentParams.set(key, value);
      }

      return currentParams.toString();
    }

    return update.newSuffix;
  }

  private async checkRateLimit(accountId: string): Promise<void> {
    const now = new Date();
    const limit = this.rateLimiter.get(accountId) || { lastRequest: new Date(0), requestCount: 0 };

    // Reset counter if more than a minute has passed
    if (now.getTime() - limit.lastRequest.getTime() > 60000) {
      limit.requestCount = 0;
      limit.lastRequest = now;
    }

    // Check if we've exceeded the rate limit (60 requests per minute)
    if (limit.requestCount >= 60) {
      const waitTime = 60000 - (now.getTime() - limit.lastRequest.getTime());
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }

    limit.requestCount++;
    this.rateLimiter.set(accountId, limit);
  }

  private shouldRetry(error: any): Promise<boolean> {
    const retryableErrors = [
      'RATE_LIMIT_EXCEEDED',
      'QUOTA_EXCEEDED',
      'INTERNAL_ERROR',
      'UNAVAILABLE',
      'DEADLINE_EXCEEDED',
      'TIMEOUT',
      'NETWORK_ERROR',
    ];

    return Promise.resolve(retryableErrors.some(code => 
      error.message?.includes(code) || 
      error.code === code ||
      error.status === 429 ||
      error.status >= 500
    ));
  }

  private async processBatchWithConcurrency(
    accountId: string,
    batch: UrlUpdateRequest[],
    maxConcurrent: number,
    dryRun: boolean
  ): Promise<UrlUpdateResult[]> {
    const results: UrlUpdateResult[] = [];
    const chunks = this.chunkArray(batch, maxConcurrent);

    for (const chunk of chunks) {
      const promises = chunk?.filter(Boolean)?.map(update => 
        this.updateAdUrls(accountId, update.adId, {
          ...update,
          finalUrl: dryRun ? update.finalUrl + '?dry-run=true' : update.finalUrl,
        })
      );

      const chunkResults = await Promise.allSettled(promises);
      
      chunkResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error('Batch update failed', new EnhancedError('Batch update failed', { error: result.reason  }));
          results.push({
            adId: 'unknown',
            success: false,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
            processingTime: 0,
            retryCount: 0,
          });
        }
      });
    }

    return results;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Placeholder methods for Google Ads API integration
  private async getAdData(accountId: string, adId: string): Promise<any> {
    // This would call the Google Ads API to get ad data
    // Placeholder implementation
    return {
      id: adId,
      finalUrls: ['https://example.com'],
      finalUrlSuffix: '',
      trackingUrlTemplate: '',
    };
  }

  private async findAdsByPattern(accountId: string, pattern: string, options: any): Promise<any[]> {
    // This would call the Google Ads API to find ads matching the pattern
    // Placeholder implementation
    return [];
  }

  private async getAdsByAdGroup(accountId: string, adGroupId: string): Promise<any[]> {
    // This would call the Google Ads API to get ads by ad group
    // Placeholder implementation
    return [];
  }

  private async getAdsByCampaign(accountId: string, campaignId: string): Promise<any[]> {
    // This would call the Google Ads API to get ads by campaign
    // Placeholder implementation
    return [];
  }

  private async performAdUpdate(accountId: string, adId: string, updates: UrlUpdateRequest): Promise<any> {
    // This would call the Google Ads API to update the ad
    // Placeholder implementation
    return {
      finalUrl: updates.finalUrl,
      finalUrlSuffix: updates.finalUrlSuffix,
    };
  }
}