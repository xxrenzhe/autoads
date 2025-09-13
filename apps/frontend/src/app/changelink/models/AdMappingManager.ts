/**
 * 广告映射管理器
 * 负责管理广告信息的分层展示和原始链接与广告的映射配置
 * 对应Task 7.2: 广告信息管理和映射配置
 */

import { GoogleAdsAccount, Advertisement, AdMapping } from '../types';
import { EnhancedError } from '@/lib/utils/error-handling';

export interface AdMappingConfig {
  originalUrl: string;
  adGroupId: string;
  adIds: string[];
  executionOrder: 'sequential' | 'random';
  mappingStrategy: 'one-to-one' | 'one-to-many';
  executionCount: number;
  adCount: number;
  validationStatus: 'valid' | 'invalid';
  validationErrors: string[];
  mappingRules: AdMappingRule[];
}

export interface AdMappingRule {
  executionNumber: number;
  adId: string;
  adName: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  currentFinalUrl?: string;
  currentFinalUrlSuffix?: string;
}

export interface AdMappingResult {
  originalUrl: string;
  finalUrls: string[];
  mappedAds: Advertisement[];
  executionCount: number;
  adCount: number;
  validationStatus: 'valid' | 'invalid';
  validationErrors: string[];
  executionOrder: number[];
  mappingDistribution: Map<number, string[]>; // executionNumber -> adIds[]
}

export interface AdGroupHierarchy {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  ads: Advertisement[];
  totalAds: number;
  availableAds: number;
}

export class AdMappingManager {
  private mappings: Map<string, AdMappingConfig> = new Map();
  private results: Map<string, AdMappingResult> = new Map();
  private adGroupHierarchies: Map<string, AdGroupHierarchy> = new Map();

  /**
   * Configure advertisement mapping for a specific URL
   */
  configureAdMapping(config: AdMappingConfig): void {
    // Validate configuration
    const validation = this.validateMappingConfig(config);
    config.validationStatus = validation.isValid ? 'valid' : 'invalid';
    config.validationErrors = validation.errors;
    
    // Store mapping configuration
    this.mappings.set(config.originalUrl, config);
  }

  /**
   * Validate mapping configuration
   */
  private validateMappingConfig(config: AdMappingConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.originalUrl) {
      errors.push('Original URL is required');
    }

    if (!config.adGroupId) {
      errors.push('Ad Group ID is required');
    }

    if (!config.adIds || config.adIds.length === 0) {
      errors.push('At least one ad ID is required');
    }

    if (config.mappingStrategy === 'one-to-many' && config.adIds.length < 2) {
      errors.push('One-to-many mapping requires at least 2 ads');
    }

    // Validate execution count vs ad count
    if (config.executionCount < config.adCount) {
      errors.push(`Execution count (${config.executionCount}) must be >= ad count (${config.adCount})`);
    }

    // Validate one-to-one mapping
    if (config.mappingStrategy === 'one-to-one' && config.executionCount !== config.adCount) {
      errors.push(`One-to-one mapping requires execution count (${config.executionCount}) to equal ad count (${config.adCount})`);
    }

    // Validate mapping rules
    if (config.mappingRules) {
      const executionNumbers = config.mappingRules?.filter(Boolean)?.map((rule: any) => rule.executionNumber);
      const uniqueExecutionNumbers = new Set(executionNumbers);
      
      if (executionNumbers.length !== uniqueExecutionNumbers.size) {
        errors.push('Duplicate execution numbers found in mapping rules');
      }

      if (Math.max(...executionNumbers) > config.executionCount) {
        errors.push('Execution number exceeds configured execution count');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get advertisement information for mapping with hierarchical structure
   */
  async getAdvertisementHierarchy(account: GoogleAdsAccount): Promise<AdGroupHierarchy[]> {
    try {
      const hierarchies: AdGroupHierarchy[] = [];

      for (const campaign of account.campaigns || []) {
        const c = campaign as any;
        for (const adGroup of c.adGroups || []) {
          const hierarchy: AdGroupHierarchy = {
            campaignId: c.id,
            campaignName: c.name,
            adGroupId: adGroup.id,
            adGroupName: adGroup.name,
            ads: adGroup.ads,
            totalAds: adGroup.ads.length,
            availableAds: adGroup.ads.filter((ad: any) => ad.status === 'ENABLED').length
          };

          hierarchies.push(hierarchy);
          this.adGroupHierarchies.set(adGroup.id, hierarchy);
        }
      }

      return hierarchies;
    } catch (error) {
      throw new Error(`Failed to get advertisement hierarchy: ${error}`);
    }
  }

  /**
   * Create mapping rules for execution order
   */
  createMappingRules(
    originalUrl: string,
    adIds: string[],
    executionCount: number,
    mappingStrategy: 'one-to-one' | 'one-to-many'
  ): AdMappingRule[] {
    const rules: AdMappingRule[] = [];
    const hierarchy = this.findHierarchyForAds(adIds);

    if (mappingStrategy === 'one-to-one') {
      // Sequential mapping: 1st execution → 1st ad, 2nd execution → 2nd ad, etc.
      for (let i = 0; i < Math.min(executionCount, adIds.length); i++) {
        const ad = hierarchy.ads.find((a: any) => a.id === adIds[i]);
        if (ad) {
          rules.push({
            executionNumber: i + 1,
            adId: adIds[i],
            adName: ad.name || `Ad ${adIds[i]}`,
            campaignId: hierarchy.campaignId,
            campaignName: hierarchy.campaignName,
            adGroupId: hierarchy.adGroupId,
            adGroupName: hierarchy.adGroupName,
            currentFinalUrl: ad.finalUrl,
            currentFinalUrlSuffix: ad.finalUrlSuffix
          });
        }
      }
    } else if (mappingStrategy === 'one-to-many') {
      // Distribute executions across multiple ads
      const adsPerExecution = Math.ceil(adIds.length / executionCount);
      
      for (let i = 0; i < executionCount; i++) {
        const startAdIndex = i * adsPerExecution;
        const endAdIndex = Math.min(startAdIndex + adsPerExecution, adIds.length);
        
        for (let j = startAdIndex; j < endAdIndex; j++) {
          const ad = hierarchy.ads.find((a: any) => a.id === adIds[j]);
          if (ad) {
            rules.push({
              executionNumber: i + 1,
              adId: adIds[j],
              adName: ad.name || `Ad ${adIds[j]}`,
              campaignId: hierarchy.campaignId,
              campaignName: hierarchy.campaignName,
              adGroupId: hierarchy.adGroupId,
              adGroupName: hierarchy.adGroupName,
              currentFinalUrl: ad.finalUrl,
              currentFinalUrlSuffix: ad.finalUrlSuffix
            });
          }
        }
      }
    }

    return rules;
  }

  /**
   * Validate execution count matches ad count
   */
  validateExecutionCount(originalUrl: string, executionCount: number): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const config = this.mappings.get(originalUrl);
    if (!config) {
      return {
        isValid: false,
        errors: ['No mapping configuration found for URL'],
        warnings: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // For one-to-one mapping, execution count should equal ad count
    if (config.mappingStrategy === 'one-to-one' && executionCount !== config.adCount) {
      errors.push(`One-to-one mapping requires execution count (${executionCount}) to equal ad count (${config.adCount})`);
    }
    
    // For one-to-many mapping, execution count should be >= ad count
    if (config.mappingStrategy === 'one-to-many' && executionCount < config.adCount) {
      errors.push(`One-to-many mapping requires execution count (${executionCount}) to be >= ad count (${config.adCount})`);
    }

    // Check if execution count is reasonable
    if (executionCount > config.adCount * 3) {
      warnings.push(`High execution count (${executionCount}) compared to ad count (${config.adCount}) may cause inefficient mapping`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Map execution results to advertisements with execution order tracking
   */
  mapExecutionResultsToAds(
    originalUrl: string, 
    finalUrls: string[], 
    executionCount: number
  ): AdMappingResult {
    const config = this.mappings.get(originalUrl);
    if (!config) {
      throw new Error(`No mapping configuration found for URL: ${originalUrl}`);
    }

    // Validate execution count
    const validation = this.validateExecutionCount(originalUrl, executionCount);
    if (!validation.isValid) {
      throw new Error(`Execution count validation failed: ${validation.errors.join(', ')}`);
    }

    // Create mapped ads based on strategy and execution order
    const mappedAds: Advertisement[] = [];
    const executionOrder: number[] = [];
    const mappingDistribution = new Map<number, string[]>();
    const hierarchy = this.findHierarchyForAds(config.adIds);

    if (config.mappingStrategy === 'one-to-one') {
      // Sequential mapping: 1st result → 1st ad, 2nd result → 2nd ad, etc.
      for (let i = 0; i < Math.min(finalUrls.length, config.adIds.length); i++) {
        const urlParts = finalUrls[i].split('?');
        const adId = config.adIds[i];
        
        mappedAds.push({
          id: adId,
          name: `Advertisement ${i + 1}`,
          type: 'EXPANDED_TEXT_AD',
          finalUrl: urlParts[0], // Final URL (part before "?")
          finalUrlSuffix: urlParts[1] || '', // Final URL suffix (part after "?")
          status: 'ENABLED',
          adGroupId: config.adGroupId,
          campaignId: hierarchy.campaignId
        });

        executionOrder.push(i + 1);
        mappingDistribution.set(i + 1, [adId]);
      }
    } else if (config.mappingStrategy === 'one-to-many') {
      // Distribute results across multiple ads
      const adsPerResult = Math.ceil(config.adIds.length / finalUrls.length);
      
      for (let i = 0; i < finalUrls.length; i++) {
        const urlParts = finalUrls[i].split('?');
        const startAdIndex = i * adsPerResult;
        const endAdIndex = Math.min(startAdIndex + adsPerResult, config.adIds.length);
        const executionNumber = i + 1;
        const adIdsForExecution: string[] = [];
        
        for (let j = startAdIndex; j < endAdIndex; j++) {
          const adId = config.adIds[j];
          adIdsForExecution.push(adId);
          
          mappedAds.push({
            id: adId,
            name: `Advertisement ${j + 1}`,
            type: 'EXPANDED_TEXT_AD',
            finalUrl: urlParts[0],
            finalUrlSuffix: urlParts[1] || '',
            status: 'ENABLED',
            adGroupId: config.adGroupId,
            campaignId: hierarchy.campaignId
          });
        }

        executionOrder.push(executionNumber);
        mappingDistribution.set(executionNumber, adIdsForExecution);
      }
    }

    const result: AdMappingResult = {
      originalUrl,
      finalUrls,
      mappedAds,
      executionCount,
      adCount: config.adIds.length,
      validationStatus: 'valid',
      validationErrors: [],
      executionOrder,
      mappingDistribution
    };

    // Store result
    this.results.set(originalUrl, result);
    
    return result;
  }

  /**
   * Get mapping result for a URL
   */
  getMappingResult(originalUrl: string): AdMappingResult | undefined {
    return this.results.get(originalUrl);
  }

  /**
   * Get all mapping configurations
   */
  getAllMappings(): AdMappingConfig[] {
    return Array.from(this.mappings.values());
  }

  /**
   * Remove mapping configuration
   */
  removeMapping(originalUrl: string): boolean {
    const configRemoved = this.mappings.delete(originalUrl);
    const resultRemoved = this.results.delete(originalUrl);
    return configRemoved || resultRemoved;
  }

  /**
   * Clear all mappings
   */
  clearAllMappings(): void {
    this.mappings.clear();
    this.results.clear();
  }

  /**
   * Get mapping statistics
   */
  getMappingStatistics(): {
    totalMappings: number;
    validMappings: number;
    invalidMappings: number;
    totalAds: number;
    averageAdsPerMapping: number;
    mappingStrategies: Record<string, number>;
    executionOrders: Record<string, number>;
  } {
    const totalMappings = this.mappings.size;
    let validMappings = 0;
    let invalidMappings = 0;
    let totalAds = 0;
    const mappingStrategies: Record<string, number> = {};
    const executionOrders: Record<string, number> = {};

    for (const config of this.mappings.values()) {
      if (config.validationStatus === 'valid') {
        validMappings++;
        totalAds += config.adCount;
      } else {
        invalidMappings++;
      }

      mappingStrategies[config.mappingStrategy] = (mappingStrategies[config.mappingStrategy] || 0) + 1;
      executionOrders[config.executionOrder] = (executionOrders[config.executionOrder] || 0) + 1;
    }

    return {
      totalMappings,
      validMappings,
      invalidMappings,
      totalAds,
      averageAdsPerMapping: totalMappings > 0 ? totalAds / totalMappings : 0,
      mappingStrategies,
      executionOrders
    };
  }

  /**
   * Find hierarchy for ads
   */
  private findHierarchyForAds(adIds: string[]): AdGroupHierarchy {
    for (const hierarchy of this.adGroupHierarchies.values()) {
      if (adIds.some(adId => hierarchy.ads.some(ad => ad.id === adId))) {
        return hierarchy;
      }
    }
    throw new Error('No hierarchy found for the specified ads');
  }

  /**
   * Export mapping configuration
   */
  exportMappingConfig(originalUrl: string): string {
    const config = this.mappings.get(originalUrl);
    if (!config) {
      throw new Error(`No mapping configuration found for URL: ${originalUrl}`);
    }

    return JSON.stringify(config, null, 2);
  }

  /**
   * Import mapping configuration
   */
  importMappingConfig(configJson: string): void {
    try {
      const config: AdMappingConfig = JSON.parse(configJson);
      this.configureAdMapping(config);
    } catch (error) {
      throw new Error(`Failed to import mapping configuration: ${error}`);
    }
  }
}