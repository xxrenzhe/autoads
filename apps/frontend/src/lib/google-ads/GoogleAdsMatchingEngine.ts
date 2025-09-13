import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('GoogleAdsMatchingEngine');

export interface AdCandidate {
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
  labels: string[];
  createdAt: Date;
  lastModified: Date;
}

export interface UrlPair {
  id: string;
  finalUrl: string;
  finalUrlSuffix: string;
  trackingParameters: Record<string, string>;
  priority: number;
  conditions: MatchingCondition[];
  metadata: {
    source: string;
    category: string;
    confidence: number;
    lastUsed?: Date;
    usageCount: number;
  };
}

export interface MatchingCondition {
  type: 'url_pattern' | 'campaign_id' | 'ad_group_id' | 'ad_type' | 'label' | 'keyword' | 'domain' | 'path';
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'fuzzy';
  value: string;
  weight: number; // 0-1, higher means more important
  required: boolean;
}

export interface MatchResult {
  adId: string;
  urlPairId: string;
  confidence: number;
  score: number;
  maxScore: number;
  matchReasons: MatchReason[];
  suggestedFinalUrl: string;
  suggestedUrlSuffix: string;
  validation: ValidationResult;
}

export interface MatchReason {
  conditionType: string;
  conditionValue: string;
  matchedValue: string;
  score: number;
  weight: number;
  description: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface MatchingConfig {
  strategy: 'exact' | 'fuzzy' | 'semantic' | 'hybrid';
  confidenceThreshold: number;
  maxResultsPerAd: number;
  prioritizeBy: 'confidence' | 'priority' | 'recency';
  enableValidation: boolean;
  enableLearning: boolean;
  customWeights: Record<string, number>;
}

export interface MatchingStats {
  totalAds: number;
  totalUrlPairs: number;
  averageMatchesPerAd: number;
  averageConfidence: number;
  topConditionTypes: Array<{
    type: string;
    usageCount: number;
    successRate: number;
  }>;
  performanceMetrics: {
    precision: number;
    recall: number;
    f1Score: number;
  };
}

export class GoogleAdsMatchingEngine {
  private urlPairs: Map<string, UrlPair> = new Map();
  private adCache: Map<string, AdCandidate[]> = new Map();
  private matchHistory: Map<string, MatchResult> = new Map();
  private config: MatchingConfig;
  private stats: MatchingStats;

  constructor(config: Partial<MatchingConfig> = {}) {
    this.config = {
      strategy: 'hybrid',
      confidenceThreshold: 0.5,
      maxResultsPerAd: 3,
      prioritizeBy: 'confidence',
      enableValidation: true,
      enableLearning: true,
      customWeights: {},
      ...config,
    };

    this.stats = this.initializeStats();
    
    // Load existing data
    this.loadData();
    
    // Start periodic cleanup
    this.startCleanupTimer();
  }

  /**
   * Add or update URL pair
   */
  async addUrlPair(urlPair: Omit<UrlPair, 'id'>): Promise<UrlPair> {
    try {
      const id = Math.random().toString(36).substring(7);
      const pair: UrlPair = {
        ...urlPair,
        id,
      };

      this.urlPairs.set(id, pair);
      await this.saveUrlPair(pair);

      logger.info('URL pair added', {
        pairId: id,
        finalUrl: pair.finalUrl,
        priority: pair.priority,
      });

      return pair;
    } catch (error) {
      logger.error('Failed to add URL pair', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Remove URL pair
   */
  async removeUrlPair(pairId: string): Promise<void> {
    try {
      this.urlPairs.delete(pairId);
      await this.deleteUrlPair(pairId);

      logger.info('URL pair removed', { pairId });
    } catch (error) {
      logger.error('Failed to remove URL pair', new EnhancedError('Failed to remove URL pair', { pairId, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Find matches for ads
   */
  async findMatches(ads: AdCandidate[], options: {
    urlPairIds?: string[];
    minConfidence?: number;
    maxResults?: number;
    includeValidation?: boolean;
  } = {}): Promise<Map<string, MatchResult[]>> {
    try {
      const {
        urlPairIds,
        minConfidence = this.config.confidenceThreshold,
        maxResults = this.config.maxResultsPerAd,
        includeValidation = this.config.enableValidation,
      } = options;

      const pairsToMatch = urlPairIds 
        ? urlPairIds?.filter(Boolean)?.map((id: any) => this.urlPairs.get(id)).filter(Boolean) as UrlPair[]
        : Array.from(this.urlPairs.values());

      const results = new Map<string, MatchResult[]>();

      for (const ad of ads) {
        const adMatches = await this.findMatchesForAd(ad, pairsToMatch, {
          minConfidence,
          maxResults,
          includeValidation,
        });

        if (adMatches.length > 0) {
          results.set(ad.id, adMatches);
        }
      }

      // Update statistics
      this.updateMatchStats(results);

      logger.info('Matching completed', {
        totalAds: ads.length,
        matchedAds: results.size,
        totalMatches: Array.from(results.values()).flat().length,
        averageConfidence: this.calculateAverageConfidence(results),
      });

      return results;
    } catch (error) {
      logger.error('Failed to find matches', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get best match for a single ad
   */
  async getBestMatch(ad: AdCandidate, options: {
    urlPairIds?: string[];
    minConfidence?: number;
    includeValidation?: boolean;
  } = {}): Promise<MatchResult | null> {
    try {
      const matches = await this.findMatches([ad], options);
      const adMatches = matches.get(ad.id) || [];

      if (adMatches.length === 0) {
        return null;
      }

      // Sort by confidence and return the best match
      adMatches.sort((a, b) => {
        if (a.confidence !== b.confidence) {
          return b.confidence - a.confidence;
        }
        return b.score - a.score;
      });

      return adMatches[0];
    } catch (error) {
      logger.error('Failed to get best match', new EnhancedError('Failed to get best match', { adId: ad.id, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Bulk import URL pairs
   */
  async bulkImportUrlPairs(pairs: Array<Omit<UrlPair, 'id'>>): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    try {
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const pairData of pairs) {
        try {
          // Check for duplicates
          const exists = Array.from(this.urlPairs.values()).some(p => 
            p.finalUrl === pairData.finalUrl && p.finalUrlSuffix === pairData.finalUrlSuffix
          );

          if (exists) {
            skipped++;
            continue;
          }

          await this.addUrlPair(pairData);
          imported++;
        } catch (error) {
          errors.push(`Failed to import URL pair: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }

      logger.info('Bulk import completed', { imported, skipped, errors: errors.length });

      return { imported, skipped, errors };
    } catch (error) {
      logger.error('Failed to bulk import URL pairs', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get matching statistics
   */
  getMatchingStats(): MatchingStats {
    return { ...this.stats };
  }

  /**
   * Get match history for analysis
   */
  getMatchHistory(filters: {
    adId?: string;
    urlPairId?: string;
    minConfidence?: number;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  } = {}): MatchResult[] {
    let history = Array.from(this.matchHistory.values());

    if (filters.adId) {
      history = history.filter((match: any) => match.adId === filters.adId);
    }

    if (filters.urlPairId) {
      history = history.filter((match: any) => match.urlPairId === filters.urlPairId);
    }

    if (filters.minConfidence !== undefined) {
      history = history.filter((match: any) => match.confidence >= filters.minConfidence!);
    }

    if (filters.startTime) {
      history = history.filter((match: any) => {
        // This would require adding timestamp to MatchResult
        return true; // Placeholder
      });
    }

    if (filters.limit) {
      history = history.slice(-filters.limit);
    }

    return history.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Learn from match results
   */
  async learnFromResults(results: Map<string, MatchResult[]>, feedback?: Map<string, boolean>): Promise<void> {
    if (!this.config.enableLearning) {
      return;
    }

    try {
      for (const [adId, matches] of results) {
        const adFeedback = feedback?.get(adId);
        
        for (const match of matches) {
          // Update URL pair metadata based on usage
          const urlPair = this.urlPairs.get(match.urlPairId);
          if (urlPair) {
            urlPair.metadata.usageCount++;
            urlPair.metadata.lastUsed = new Date();
            
            // Adjust confidence based on feedback
            if (adFeedback !== undefined) {
              const adjustment = adFeedback ? 0.05 : -0.05;
              urlPair.metadata.confidence = Math.max(0, Math.min(1, urlPair.metadata.confidence + adjustment));
            }
            
            await this.saveUrlPair(urlPair);
          }

          // Update condition weights based on match success
          this.updateConditionWeights(match, adFeedback);
        }
      }

      logger.info('Learning completed', {
        totalResults: results.size,
        feedbackProvided: feedback?.size || 0,
      });
    } catch (error) {
      logger.error('Failed to learn from results', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Suggest improvements for URL pairs
   */
  async suggestImprovements(): Promise<Array<{
    type: 'add_condition' | 'remove_condition' | 'adjust_weight' | 'merge_pairs';
    pairId: string;
    description: string;
    expectedImpact: string;
    confidence: number;
  }>> {
    try {
      const suggestions: Array<{
        type: 'add_condition' | 'remove_condition' | 'adjust_weight' | 'merge_pairs';
        pairId: string;
        description: string;
        expectedImpact: string;
        confidence: number;
      }> = [];

      // Analyze match history for patterns
      const history = this.getMatchHistory({ minConfidence: 0.3 });
      
      // Find frequently matched but low confidence pairs
      const lowConfidencePairs = new Map<string, number>();
      history.forEach((match: any) => {
        if (match.confidence < 0.5) {
          lowConfidencePairs.set(match.urlPairId, (lowConfidencePairs.get(match.urlPairId) || 0) + 1);
        }
      });

      // Suggest adding conditions for low confidence pairs
      for (const [pairId, count] of lowConfidencePairs) {
        if (count > 5) {
          suggestions.push({
            type: 'add_condition',
            pairId,
            description: `Add more specific conditions to improve matching confidence`,
            expectedImpact: 'Increase average confidence by 15-25%',
            confidence: 0.7,
          });
        }
      }

      // Find unused conditions
      const allPairs = Array.from(this.urlPairs.values());
      for (const pair of allPairs) {
        if (pair.conditions.length === 0) {
          suggestions.push({
            type: 'add_condition',
            pairId: pair.id,
            description: 'Add at least one matching condition',
            expectedImpact: 'Enable basic matching functionality',
            confidence: 0.9,
          });
        }
      }

      return suggestions;
    } catch (error) {
      logger.error('Failed to generate suggestions', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Private methods

  private async findMatchesForAd(
    ad: AdCandidate,
    urlPairs: UrlPair[],
    options: {
      minConfidence: number;
      maxResults: number;
      includeValidation: boolean;
    }
  ): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];

    for (const urlPair of urlPairs) {
      const match = await this.calculateMatch(ad, urlPair, options.includeValidation);
      
      if (match.confidence >= options.minConfidence) {
        matches.push(match);
      }
    }

    // Sort and limit results
    matches.sort((a, b) => {
      switch (this.config.prioritizeBy) {
        case 'confidence':
          return b.confidence - a.confidence;
        case 'priority':
          const pairA = this.urlPairs.get(a.urlPairId);
          const pairB = this.urlPairs.get(b.urlPairId);
          return (pairB?.priority || 0) - (pairA?.priority || 0);
        case 'recency':
          const metadataA = this.urlPairs.get(a.urlPairId)?.metadata;
          const metadataB = this.urlPairs.get(b.urlPairId)?.metadata;
          return (metadataB?.lastUsed?.getTime() || 0) - (metadataA?.lastUsed?.getTime() || 0);
        default:
          return b.confidence - a.confidence;
      }
    });

    return matches.slice(0, options.maxResults);
  }

  private async calculateMatch(ad: AdCandidate, urlPair: UrlPair, includeValidation: boolean): Promise<MatchResult> {
    const reasons: MatchReason[] = [];
    let totalScore = 0;
    let maxScore = 0;

    // Evaluate each condition
    for (const condition of urlPair.conditions) {
      const result = this.evaluateCondition(ad, condition);
      
      if (result.matched) {
        reasons.push({
          conditionType: condition.type,
          conditionValue: condition.value,
          matchedValue: result.matchedValue,
          score: result.score,
          weight: condition.weight,
          description: result.description,
        });
        
        totalScore += result.score * condition.weight;
      }
      
      maxScore += condition.weight;
    }

    // Add bonus matches based on strategy
    const bonusMatches = this.calculateBonusMatches(ad, urlPair);
    reasons.push(...bonusMatches);
    totalScore += bonusMatches.reduce((sum, r: any) => sum + r.score * r.weight, 0);
    maxScore += bonusMatches.reduce((sum, r: any) => sum + r.weight, 0);

    // Calculate confidence
    const confidence = maxScore > 0 ? Math.min(totalScore / maxScore, 1) : 0;

    // Build suggested URLs
    const suggestedUrls = this.buildSuggestedUrls(ad, urlPair);

    // Validate if enabled
    let validation: ValidationResult = { isValid: true, errors: [], warnings: [], suggestions: [] };
    if (includeValidation) {
      validation = await this.validateMatch(ad, urlPair, suggestedUrls);
    }

    const matchResult: MatchResult = {
      adId: ad.id,
      urlPairId: urlPair.id,
      confidence,
      score: totalScore,
      maxScore,
      matchReasons: reasons,
      suggestedFinalUrl: suggestedUrls.finalUrl,
      suggestedUrlSuffix: suggestedUrls.urlSuffix,
      validation,
    };

    // Store in history
    this.matchHistory.set(`${ad.id}_${urlPair.id}`, matchResult);

    return matchResult;
  }

  private evaluateCondition(ad: AdCandidate, condition: MatchingCondition): {
    matched: boolean;
    matchedValue: string;
    score: number;
    description: string;
  } {
    let matched = false;
    let matchedValue = '';
    let score = 0;

    switch (condition.type) {
      case 'url_pattern':
        matched = this.evaluateUrlPattern(ad.finalUrls[0] || '', condition);
        matchedValue = ad.finalUrls[0] || '';
        score = matched ? 1 : 0;
        break;

      case 'campaign_id':
        matched = this.evaluateStringMatch(ad.campaignId, condition);
        matchedValue = ad.campaignId;
        score = matched ? 1 : 0;
        break;

      case 'ad_group_id':
        matched = this.evaluateStringMatch(ad.adGroupId, condition);
        matchedValue = ad.adGroupId;
        score = matched ? 1 : 0;
        break;

      case 'ad_type':
        matched = this.evaluateStringMatch(ad.type, condition);
        matchedValue = ad.type;
        score = matched ? 0.5 : 0;
        break;

      case 'label':
        matched = ad.labels.some(label => this.evaluateStringMatch(label, condition));
        matchedValue = ad.labels.find((label: any) => this.evaluateStringMatch(label, condition)) || '';
        score = matched ? 0.8 : 0;
        break;

      case 'keyword':
        matched = this.evaluateKeywordMatch(ad.name, condition);
        matchedValue = ad.name;
        score = matched ? 0.6 : 0;
        break;

      case 'domain':
        matched = this.evaluateDomainMatch(ad.finalUrls[0] || '', condition);
        matchedValue = new URL(ad.finalUrls[0] || '').hostname;
        score = matched ? 0.7 : 0;
        break;

      case 'path':
        matched = this.evaluatePathMatch(ad.finalUrls[0] || '', condition);
        matchedValue = new URL(ad.finalUrls[0] || '').pathname;
        score = matched ? 0.6 : 0;
        break;
    }

    return {
      matched,
      matchedValue,
      score,
      description: this.getConditionDescription(condition, matched, matchedValue),
    };
  }

  private evaluateUrlPattern(url: string, condition: MatchingCondition): boolean {
    switch (condition.operator) {
      case 'equals':
        return url === condition.value;
      case 'contains':
        return url.includes(condition.value);
      case 'starts_with':
        return url.startsWith(condition.value);
      case 'ends_with':
        return url.endsWith(condition.value);
      case 'regex':
        try {
          const regex = new RegExp(condition.value, 'i');
          return regex.test(url);
        } catch {
          return false;
        }
      case 'fuzzy':
        return this.calculateFuzzyScore(url, condition.value) > 0.8;
      default:
        return false;
    }
  }

  private evaluateStringMatch(value: string, condition: MatchingCondition): boolean {
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return value.toLowerCase().includes(condition.value.toLowerCase());
      case 'starts_with':
        return value.toLowerCase().startsWith(condition.value.toLowerCase());
      case 'ends_with':
        return value.toLowerCase().endsWith(condition.value.toLowerCase());
      case 'regex':
        try {
          const regex = new RegExp(condition.value, 'i');
          return regex.test(value);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  private evaluateKeywordMatch(text: string, condition: MatchingCondition): boolean {
    const keywords = condition.value.toLowerCase().split(/\s+/);
    const textLower = text.toLowerCase();
    
    return keywords.some(keyword => textLower.includes(keyword));
  }

  private evaluateDomainMatch(url: string, condition: MatchingCondition): boolean {
    try {
      const domain = new URL(url).hostname;
      return this.evaluateStringMatch(domain, condition);
    } catch {
      return false;
    }
  }

  private evaluatePathMatch(url: string, condition: MatchingCondition): boolean {
    try {
      const path = new URL(url).pathname;
      return this.evaluateStringMatch(path, condition);
    } catch {
      return false;
    }
  }

  private calculateFuzzyScore(str1: string, str2: string): number {
    // Simple Levenshtein distance-based fuzzy matching
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str2.length; i++) {
      matrix[i][0] = i;
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        const indicator = str1[j - 1] === str2[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
          matrix[i - 1][j - 1] + indicator
        );
      }
    }

    const distance = matrix[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    
    return maxLength > 0 ? 1 - (distance / maxLength) : 1;
  }

  private calculateBonusMatches(ad: AdCandidate, urlPair: UrlPair): MatchReason[] {
    const reasons: MatchReason[] = [];

    // Priority bonus
    if (urlPair.priority > 5) {
      reasons.push({
        conditionType: 'priority',
        conditionValue: urlPair.priority.toString(),
        matchedValue: urlPair.priority.toString(),
        score: 0.2,
        weight: 1,
        description: `High priority URL pair (${urlPair.priority})`,
      });
    }

    // Usage bonus
    if (urlPair.metadata.usageCount > 10) {
      reasons.push({
        conditionType: 'usage',
        conditionValue: urlPair.metadata.usageCount.toString(),
        matchedValue: urlPair.metadata.usageCount.toString(),
        score: 0.1,
        weight: 1,
        description: `Frequently used URL pair (${urlPair.metadata.usageCount} times)`,
      });
    }

    // Recency bonus
    if (urlPair.metadata.lastUsed) {
      const daysSinceLastUse = (Date.now() - urlPair.metadata.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastUse < 7) {
        reasons.push({
          conditionType: 'recency',
          conditionValue: daysSinceLastUse.toFixed(1),
          matchedValue: daysSinceLastUse.toFixed(1),
          score: 0.15,
          weight: 1,
          description: `Recently used URL pair (${daysSinceLastUse.toFixed(1)} days ago)`,
        });
      }
    }

    return reasons;
  }

  private buildSuggestedUrls(ad: AdCandidate, urlPair: UrlPair): {
    finalUrl: string;
    urlSuffix: string;
  } {
    // Start with URL pair final URL
    let finalUrl = urlPair.finalUrl;
    let urlSuffix = urlPair.finalUrlSuffix;

    // Add tracking parameters
    const url = new URL(finalUrl);
    Object.entries(urlPair.trackingParameters).forEach(([key, value]: any) => {
      url.searchParams.set(key, value);
    });
    finalUrl = url.toString();

    // Merge with existing URL suffix
    if (ad.finalUrlSuffix) {
      const existingParams = new URLSearchParams(ad.finalUrlSuffix.replace(/^\?/, ''));
      const newParams = new URLSearchParams(urlSuffix.replace(/^\?/, ''));
      
      // New parameters take precedence
      for (const [key, value] of newParams) {
        existingParams.set(key, value);
      }
      
      urlSuffix = existingParams.toString();
    }

    return { finalUrl, urlSuffix };
  }

  private async validateMatch(ad: AdCandidate, urlPair: UrlPair, suggestedUrls: {
    finalUrl: string;
    urlSuffix: string;
  }): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate URL length
    if (suggestedUrls.finalUrl.length > 2048) {
      errors.push('Final URL exceeds maximum length of 2048 characters');
    } else if (suggestedUrls.finalUrl.length > 1500) {
      warnings.push('Final URL is approaching maximum length');
    }

    // Validate URL format
    try {
      new URL(suggestedUrls.finalUrl);
    } catch {
      errors.push('Final URL has invalid format');
    }

    // Validate URL suffix
    if (suggestedUrls.urlSuffix.length > 1024) {
      errors.push('URL suffix exceeds maximum length of 1024 characters');
    }

    // Check for tracking parameters
    const hasTrackingParams = suggestedUrls.finalUrl.includes('utm_') || 
                               suggestedUrls.finalUrl.includes('gclid') ||
                               suggestedUrls.urlSuffix.includes('utm_');
    
    if (!hasTrackingParams) {
      suggestions.push('Consider adding tracking parameters for better analytics');
    }

    // Check domain consistency
    try {
      const oldDomain = new URL(ad.finalUrls[0] || '').hostname;
      const newDomain = new URL(suggestedUrls.finalUrl).hostname;
      
      if (oldDomain && newDomain && oldDomain !== newDomain) {
        warnings.push('Domain change detected - this may affect ad performance');
      }
    } catch {
      // URL parsing failed, skip domain check
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  private getConditionDescription(condition: MatchingCondition, matched: boolean, matchedValue: string): string {
    const operator = condition.operator.replace('_', ' ');
    return `${condition.type} ${operator} "${condition.value}" - ${matched ? 'Matched' : 'Not matched'} (${matchedValue})`;
  }

  private updateConditionWeights(match: MatchResult, feedback?: boolean): void {
    // Update weights based on match success and feedback
    // This is a simplified implementation
    for (const reason of match.matchReasons) {
      const currentWeight = this.config.customWeights[reason.conditionType] || 1;
      
      if (feedback === true && match.confidence < 0.8) {
        // Positive feedback but low confidence, increase weight
        this.config.customWeights[reason.conditionType] = Math.min(currentWeight * 1.1, 2);
      } else if (feedback === false && match.confidence > 0.5) {
        // Negative feedback but high confidence, decrease weight
        this.config.customWeights[reason.conditionType] = Math.max(currentWeight * 0.9, 0.1);
      }
    }
  }

  private updateMatchStats(results: Map<string, MatchResult[]>): void {
    const allMatches = Array.from(results.values()).flat();
    
    this.stats.totalAds = results.size;
    this.stats.totalUrlPairs = this.urlPairs.size;
    this.stats.averageMatchesPerAd = results.size > 0 ? allMatches.length / results.size : 0;
    this.stats.averageConfidence = this.calculateAverageConfidence(results);

    // Update condition type statistics
    const conditionTypes = new Map<string, { usage: number; success: number }>();
    
    allMatches.forEach((match: any) => {
      match.matchReasons.forEach((reason: any) => {
        const existing = conditionTypes.get(reason.conditionType) || { usage: 0, success: 0 };
        existing.usage++;
        if (match.confidence > 0.5) {
          existing.success++;
        }
        conditionTypes.set(reason.conditionType, existing);
      });
    });

    this.stats.topConditionTypes = Array.from(conditionTypes.entries())
      .map(([type, stats]: any) => ({
        type,
        usageCount: stats.usage,
        successRate: stats.usage > 0 ? stats.success / stats.usage : 0,
      }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);
  }

  private calculateAverageConfidence(results: Map<string, MatchResult[]>): number {
    const allMatches = Array.from(results.values()).flat();
    if (allMatches.length === 0) return 0;
    
    const totalConfidence = allMatches.reduce((sum, match: any) => sum + match.confidence, 0);
    return totalConfidence / allMatches.length;
  }

  private initializeStats(): MatchingStats {
    return {
      totalAds: 0,
      totalUrlPairs: 0,
      averageMatchesPerAd: 0,
      averageConfidence: 0,
      topConditionTypes: [],
      performanceMetrics: {
        precision: 0,
        recall: 0,
        f1Score: 0,
      },
    };
  }

  private async saveUrlPair(pair: UrlPair): Promise<void> {
    // Placeholder for persistent storage
    logger.debug('Saving URL pair', { pairId: pair.id });
  }

  private async deleteUrlPair(pairId: string): Promise<void> {
    // Placeholder for persistent storage removal
    logger.debug('Deleting URL pair', { pairId });
  }

  private loadData(): void {
    // Placeholder for loading data from persistent storage
    logger.debug('Loading matching engine data');
  }

  private startCleanupTimer(): void {
    // Clean up old match history every hour
    setInterval(() => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // This would require adding timestamp to MatchResult
      // For now, just limit the history size
      if (this.matchHistory.size > 10000) {
        const entries = Array.from(this.matchHistory.entries());
        this.matchHistory = new Map(entries.slice(-5000));
      }

      logger.debug('Matching engine cleanup completed', {
        historySize: this.matchHistory.size,
        urlPairsSize: this.urlPairs.size,
      });
    }, 60 * 60 * 1000); // 1 hour
  }
}
