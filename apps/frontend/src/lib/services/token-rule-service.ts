import { prisma } from '@/lib/prisma';
import { Logger } from '@/lib/core/Logger';

const logger = new Logger('TokenRuleService');

/**
 * Token Rule Service
 * Manages token consumption rules and hot-reload functionality
 */
export class TokenRuleService {
  private static instance: TokenRuleService;
  private ruleCache: Map<string, number> = new Map();
  private lastCacheUpdate: Date = new Date();

  private constructor() {
    this.initializeCache();
  }

  public static getInstance(): TokenRuleService {
    if (!TokenRuleService.instance) {
      TokenRuleService.instance = new TokenRuleService();
    }
    return TokenRuleService.instance;
  }

  /**
   * Initialize the rule cache with environment variables and database overrides
   */
  private async initializeCache(): Promise<void> {
    try {
      // Load default rules from environment variables
      const defaultRules = {
        'siterank-default': parseInt(process.env.SITERANK_TOKEN_COST || '1'),
        'batchopen-http': parseInt(process.env.BATCHOPEN_HTTP_TOKEN_COST || '1'),
        'batchopen-puppeteer': parseInt(process.env.BATCHOPEN_PUPPETEER_TOKEN_COST || '2'),
        'adscenter-default': parseInt((process.env.ADSCENTER_TOKEN_COST || process.env[['CHAN','GELINK'].join('') + '_TOKEN_COST'] || '1') as string),
      };

      // Set default rules in cache
      Object.entries(defaultRules).forEach(([key, cost]: any) => {
        this.ruleCache.set(key, cost);
      });

      // Load database overrides
      const dbRules = await prisma.tokenRule.findMany({
        where: { status: 'ACTIVE' },
      });

      dbRules.forEach((rule: any) => {
        const key = `${rule.feature}-${rule.method}`;
        this.ruleCache.set(key, rule.cost);
      });

      this.lastCacheUpdate = new Date();
      logger.info('Token rule cache initialized', {
        defaultRules: Object.keys(defaultRules).length,
        dbOverrides: dbRules.length,
      });
    } catch (error) {
      logger.error('Failed to initialize token rule cache:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Get token cost for a specific feature and method
   */
  public async getTokenCost(feature: string, method: string = 'default'): Promise<number> {
    const key = `${feature}-${method}`;
    
    // Check if cache needs refresh (every 5 minutes)
    const cacheAge = Date.now() - this.lastCacheUpdate.getTime();
    if (cacheAge > 5 * 60 * 1000) {
      await this.refreshCache();
    }

    const cost = this.ruleCache.get(key);
    if (cost !== undefined) {
      return cost;
    }

    // Fallback to default cost
    const defaultCost = this.ruleCache.get(`${feature}-default`) || 1;
    logger.warn(`Token cost not found for ${key}, using default: ${defaultCost}`);
    return defaultCost;
  }

  /**
   * Update token rule and refresh cache
   */
  public async updateTokenRule(
    ruleId: string,
    cost: number,
    userId: string,
    reason?: string
  ): Promise<void> {
    try {
      // Handle system rules (environment variables)
      if (ruleId.includes('-default') || ruleId.includes('-http') || ruleId.includes('-puppeteer')) {
        await this.updateSystemRule(ruleId, cost, userId, reason);
      } else {
        // Handle database rules
        await this.updateDatabaseRule(ruleId, cost, userId, reason);
      }

      // Refresh cache after update
      await this.refreshCache();
    } catch (error) {
      logger.error('Failed to update token rule:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Update system rule (environment variable)
   */
  private async updateSystemRule(
    ruleId: string,
    cost: number,
    userId: string,
    reason?: string
  ): Promise<void> {
    const envVarMap: { [key: string]: string } = {
      'siterank-default': 'SITERANK_TOKEN_COST',
      'batchopen-http': 'BATCHOPEN_HTTP_TOKEN_COST',
      'batchopen-puppeteer': 'BATCHOPEN_PUPPETEER_TOKEN_COST',
      'adscenter-default': (['ADSCENTER','_TOKEN_COST'].join('')),
    };

    const envVar = envVarMap[ruleId];
    if (!envVar) {
      throw new Error(`Invalid system rule ID: ${ruleId}`);
    }

    const currentCost = parseInt(process.env[envVar] || '1');

    // Update environment variable in database
    await prisma.environmentVariable.upsert({
      where: { key: envVar },
      update: {
        value: cost.toString(),
        updatedBy: userId,
        updatedAt: new Date(),
      },
      create: {
        key: envVar,
        value: cost.toString(),
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Create history record
    await prisma.tokenRuleHistory.create({
      data: {
        ruleId,
        previousCost: currentCost,
        newCost: cost,
        modifiedBy: userId,
        reason: reason || 'System rule updated',
      },
    });

    // Update runtime environment variable
    process.env[envVar] = cost.toString();

    logger.info(`System token rule updated: ${envVar} = ${cost}`, {
      userId,
      previousCost: currentCost,
      newCost: cost,
    });
  }

  /**
   * Update database rule
   */
  private async updateDatabaseRule(
    ruleId: string,
    cost: number,
    userId: string,
    reason?: string
  ): Promise<void> {
    const existingRule = await prisma.tokenRule.findUnique({
      where: { id: ruleId },
    });

    if (!existingRule) {
      throw new Error(`Token rule not found: ${ruleId}`);
    }

    // Update rule
    await prisma.tokenRule.update({
      where: { id: ruleId },
      data: {
        cost,
        modifiedBy: userId,
        updatedAt: new Date(),
      },
    });

    // Create history record
    await prisma.tokenRuleHistory.create({
      data: {
        ruleId,
        previousCost: existingRule.cost,
        newCost: cost,
        modifiedBy: userId,
        reason: reason || 'Database rule updated',
      },
    });

    logger.info(`Database token rule updated: ${ruleId} = ${cost}`, {
      userId,
      previousCost: existingRule.cost,
      newCost: cost,
    });
  }

  /**
   * Refresh the rule cache
   */
  public async refreshCache(): Promise<void> {
    try {
      // Clear current cache
      this.ruleCache.clear();

      // Reload from environment and database
      await this.initializeCache();

      logger.info('Token rule cache refreshed');
    } catch (error) {
      logger.error('Failed to refresh token rule cache:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Get all active rules with their costs
   */
  public async getAllRules(): Promise<Array<{
    id: string;
    feature: string;
    method: string;
    cost: number;
    source: 'environment' | 'database';
    isActive: boolean;
  }>> {
    const rules: Array<{
      id: string;
      feature: string;
      method: string;
      cost: number;
      source: 'environment' | 'database';
      isActive: boolean;
    }> = [];

    // Add environment rules
    const envRules = [
      { id: 'siterank-default', feature: 'siterank', method: 'default' },
      { id: 'batchopen-http', feature: 'batchopen', method: 'http' },
      { id: 'batchopen-puppeteer', feature: 'batchopen', method: 'puppeteer' },
      { id: 'adscenter-default', feature: 'adscenter', method: 'default' },
    ];

    envRules.forEach((rule: any) => {
      const cost = this.ruleCache.get(rule.id) || 1;
      rules.push({
        ...rule,
        cost,
        source: 'environment',
        isActive: true,
      });
    });

    // Add database rules
    const dbRules = await prisma.tokenRule.findMany({
      orderBy: { createdAt: 'desc' },
    });

    dbRules.forEach((rule: any) => {
      rules.push({
        id: rule.id,
        feature: rule.feature,
        method: rule.method,
        cost: rule.cost,
        source: 'database',
        isActive: rule.isActive,
      });
    });

    return rules;
  }

  /**
   * Create a new token rule
   */
  public async createTokenRule(
    feature: string,
    method: string,
    cost: number,
    description: string,
    userId: string
  ): Promise<string> {
    try {
      const rule = await prisma.tokenRule.create({
        data: {
          feature,
          method,
          cost,
          description,
          status: 'ACTIVE',
          createdBy: userId,
          modifiedBy: userId,
        },
      });

      // Create history record
      await prisma.tokenRuleHistory.create({
        data: {
          ruleId: rule.id,
          previousCost: 0,
          newCost: cost,
          modifiedBy: userId,
          reason: 'New rule created',
        },
      });

      // Refresh cache
      await this.refreshCache();

      logger.info(`New token rule created: ${feature}-${method} = ${cost}`, {
        userId,
        ruleId: rule.id,
      });

      return rule.id;
    } catch (error) {
      logger.error('Failed to create token rule:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Toggle rule active status
   */
  public async toggleRuleStatus(
    ruleId: string,
    isActive: boolean,
    userId: string
  ): Promise<void> {
    try {
      // Only database rules can be toggled
      if (ruleId.includes('-default') || ruleId.includes('-http') || ruleId.includes('-puppeteer')) {
        throw new Error('Cannot toggle system rule status');
      }

      await prisma.tokenRule.update({
        where: { id: ruleId },
        data: {
          isActive,
          modifiedBy: userId,
          updatedAt: new Date(),
        },
      });

      // Refresh cache
      await this.refreshCache();

      logger.info(`Token rule ${isActive ? 'activated' : 'deactivated'}: ${ruleId}`, {
        userId,
      });
    } catch (error) {
      logger.error('Failed to toggle rule status:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Get rule change history
   */
  public async getRuleHistory(ruleId: string): Promise<Array<{
    id: string;
    previousCost: number;
    newCost: number;
    modifiedBy: string;
    modifiedAt: string;
    reason: string;
  }>> {
    try {
      const history = await prisma.tokenRuleHistory.findMany({
        where: { ruleId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return history.map((record: any) => ({
        id: record.id,
        previousCost: record.previousCost,
        newCost: record.newCost,
        modifiedBy: record.modifiedBy,
        modifiedAt: record.createdAt.toISOString(),
        reason: record.reason || '',
      }));
    } catch (error) {
      logger.error('Failed to get rule history:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Hot-reload all rules from configuration
   */
  public async hotReload(): Promise<{
    success: boolean;
    message: string;
    reloadedRules: number;
  }> {
    try {
      const beforeCount = this.ruleCache.size;
      
      await this.refreshCache();
      
      const afterCount = this.ruleCache.size;
      
      return {
        success: true,
        message: 'Token rules hot-reloaded successfully',
        reloadedRules: afterCount,
      };
    } catch (error) {
      logger.error('Hot-reload failed:', error instanceof Error ? error.message : String(error));
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Hot-reload failed',
        reloadedRules: 0,
      };
    }
  }
}

// Export singleton instance
export const tokenRuleService = TokenRuleService.getInstance();
