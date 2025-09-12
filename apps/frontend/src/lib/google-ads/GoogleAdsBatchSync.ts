import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('GoogleAdsBatchSync');

export interface BatchSyncConfig {
  id: string;
  name: string;
  accountIds: string[];
  enabled: boolean;
  syncMode: 'parallel' | 'sequential' | 'adaptive';
  maxConcurrentAccounts: number;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  rateLimitDelay: number;
  conditions: {
    minConfidence?: number;
    maxUpdatesPerAccount?: number;
    totalMaxUpdates?: number;
    dryRun?: boolean;
    validateOnly?: boolean;
    includePaused?: boolean;
    skipOnError?: boolean;
  };
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  updatedAt: Date;
  lastSync?: Date;
  nextSync?: Date;
  syncHistory: BatchSyncResult[];
}

export interface BatchSyncResult {
  id: string;
  batchConfigId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'partial';
  totalAccounts: number;
  processedAccounts: number;
  successfulAccounts: number;
  failedAccounts: number;
  skippedAccounts: number;
  totalAds: number;
  updatedAds: number;
  failedAds: number;
  skippedAds: number;
  processingTime: number;
  accountResults: AccountSyncResult[];
  errors: string[];
  warnings: string[];
  summary: {
    averageConfidence: number;
    accountsPerMinute: number;
    adsPerMinute: number;
    successRate: number;
    topErrors: Array<{
      error: string;
      count: number;
      accounts: string[];
    }>;
  };
}

export interface AccountSyncResult {
  accountId: string;
  accountName: string;
  status: 'completed' | 'failed' | 'skipped';
  startTime: Date;
  endTime?: Date;
  totalAds: number;
  updatedAds: number;
  failedAds: number;
  skippedAds: number;
  processingTime: number;
  errors: string[];
  warnings: string[];
  retryCount: number;
  confidence: number;
  topCampaigns: Array<{
    campaignId: string;
    campaignName: string;
    updateCount: number;
  }>;
}

export interface SyncProgress {
  batchConfigId: string;
  status: BatchSyncResult['status'];
  progress: number; // 0-100
  currentAccount?: string;
  currentAccountProgress?: number;
  processedAccounts: number;
  totalAccounts: number;
  estimatedTimeRemaining?: number;
  startTime: Date;
}

export class GoogleAdsBatchSync {
  private configs: Map<string, BatchSyncConfig> = new Map();
  private runningSyncs: Map<string, BatchSyncResult> = new Map();
  private progress: Map<string, SyncProgress> = new Map();
  private syncQueue: Array<{ configId: string; priority: number; timestamp: Date }> = [];
  private isProcessingQueue = false;

  constructor() {
    this.initializeSyncManager();
  }

  /**
   * Create a new batch sync configuration
   */
  async createBatchSync(config: Omit<BatchSyncConfig, 'id' | 'createdAt' | 'updatedAt' | 'syncHistory'>): Promise<BatchSyncConfig> {
    try {
      const batchConfig: BatchSyncConfig = {
        ...config,
        id: Math.random().toString(36).substring(7),
        createdAt: new Date(),
        updatedAt: new Date(),
        syncHistory: [],
      };

      this.configs.set(batchConfig.id, batchConfig);
      await this.saveBatchConfig(batchConfig);

      logger.info('Batch sync configuration created', {
        configId: batchConfig.id,
        name: batchConfig.name,
        accountCount: batchConfig.accountIds.length,
      });

      return batchConfig;
    } catch (error) {
      logger.error('Failed to create batch sync configuration', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update batch sync configuration
   */
  async updateBatchSync(configId: string, updates: Partial<BatchSyncConfig>): Promise<BatchSyncConfig> {
    try {
      const config = this.configs.get(configId);
      if (!config) {
        throw new Error(`Batch sync configuration ${configId} not found`);
      }

      const updatedConfig: BatchSyncConfig = {
        ...config,
        ...updates,
        updatedAt: new Date(),
      };

      this.configs.set(configId, updatedConfig);
      await this.saveBatchConfig(updatedConfig);

      logger.info('Batch sync configuration updated', {
        configId,
        name: updatedConfig.name,
      });

      return updatedConfig;
    } catch (error) {
      logger.error('Failed to update batch sync configuration', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete batch sync configuration
   */
  async deleteBatchSync(configId: string): Promise<void> {
    try {
      const config = this.configs.get(configId);
      if (!config) {
        throw new Error(`Batch sync configuration ${configId} not found`);
      }

      // Cancel any running sync
      if (this.runningSyncs.has(configId)) {
        await this.cancelRunningSync(configId);
      }

      this.configs.delete(configId);
      this.progress.delete(configId);
      
      // Remove from queue
      this.syncQueue = this.syncQueue.filter(item => item.configId !== configId);

      await this.deleteBatchConfigFromStorage(configId);

      logger.info('Batch sync configuration deleted', { configId });
    } catch (error) {
      logger.error('Failed to delete batch sync configuration', new EnhancedError('Failed to delete batch sync configuration', { configId, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Execute batch sync immediately
   */
  async executeBatchSync(configId: string, options: {
    force?: boolean;
    dryRun?: boolean;
    accountIds?: string[];
  } = {}): Promise<BatchSyncResult> {
    try {
      const config = this.configs.get(configId);
      if (!config) {
        throw new Error(`Batch sync configuration ${configId} not found`);
      }

      if (!config.enabled && !options.force) {
        throw new Error('Batch sync is disabled');
      }

      // Check if already running
      if (this.runningSyncs.has(configId)) {
        throw new Error('Batch sync is already running');
      }

      logger.info('Starting batch sync execution', {
        configId,
        name: config.name,
        accountCount: options.accountIds?.length || config.accountIds.length,
      });

      const syncId = Math.random().toString(36).substring(7);
      const startTime = new Date();

      const syncResult: BatchSyncResult = {
        id: syncId,
        batchConfigId: configId,
        startTime,
        status: 'running',
        totalAccounts: options.accountIds?.length || config.accountIds.length,
        processedAccounts: 0,
        successfulAccounts: 0,
        failedAccounts: 0,
        skippedAccounts: 0,
        totalAds: 0,
        updatedAds: 0,
        failedAds: 0,
        skippedAds: 0,
        processingTime: 0,
        accountResults: [],
        errors: [],
        warnings: [],
        summary: {
          averageConfidence: 0,
          accountsPerMinute: 0,
          adsPerMinute: 0,
          successRate: 0,
          topErrors: [],
        },
      };

      this.runningSyncs.set(configId, syncResult);

      // Initialize progress tracking
      this.progress.set(configId, {
        batchConfigId: configId,
        status: 'running',
        progress: 0,
        processedAccounts: 0,
        totalAccounts: syncResult.totalAccounts,
        startTime,
      });

      try {
        // Execute the batch sync
        const finalResult = await this.performBatchSync(config, options, syncResult);

        const endTime = new Date();
        const processingTime = endTime.getTime() - startTime.getTime();

        const completedResult: BatchSyncResult = {
          ...finalResult,
          endTime,
          processingTime,
          summary: {
            ...finalResult.summary,
            accountsPerMinute: (finalResult.processedAccounts / (processingTime / 60000)),
            adsPerMinute: (finalResult.totalAds / (processingTime / 60000)),
            successRate: finalResult.processedAccounts > 0 
              ? (finalResult.successfulAccounts / finalResult.processedAccounts) * 100 
              : 0,
          },
        };

        this.runningSyncs.delete(configId);
        this.progress.delete(configId);

        // Update config with sync history
        config.lastSync = endTime;
        config.syncHistory.push(completedResult);
        
        // Keep only last 50 sync results
        if (config.syncHistory.length > 50) {
          config.syncHistory = config.syncHistory.slice(-50);
        }

        await this.saveBatchConfig(config);

        logger.info('Batch sync completed successfully', {
          configId,
          processedAccounts: completedResult.processedAccounts,
          successfulAccounts: completedResult.successfulAccounts,
          updatedAds: completedResult.updatedAds,
          processingTime,
        });

        return completedResult;
      } catch (error) {
        const endTime = new Date();
        const processingTime = endTime.getTime() - startTime.getTime();

        const failedResult: BatchSyncResult = {
          ...syncResult,
          endTime,
          status: 'failed',
          processingTime,
          errors: [error instanceof Error ? error.message : "Unknown error" as any],
        };

        this.runningSyncs.delete(configId);
        this.progress.delete(configId);

        // Update config with failed sync
        config.lastSync = endTime;
        config.syncHistory.push(failedResult);
        await this.saveBatchConfig(config);

        logger.error('Batch sync failed', new EnhancedError('Batch sync failed', { 
          configId,
          error: error instanceof Error ? error.message : "Unknown error" as any,
         }));

        throw error;
      }
    } catch (error) {
      logger.error('Failed to execute batch sync', new EnhancedError('Failed to execute batch sync', { configId, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Queue batch sync for later execution
   */
  async queueBatchSync(configId: string, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    try {
      const config = this.configs.get(configId);
      if (!config) {
        throw new Error(`Batch sync configuration ${configId} not found`);
      }

      if (!config.enabled) {
        throw new Error('Batch sync is disabled');
      }

      // Check if already in queue
      const existingIndex = this.syncQueue.findIndex(item => item.configId === configId);
      if (existingIndex >= 0) {
        this.syncQueue[existingIndex].priority = this.getPriorityValue(priority);
        this.syncQueue[existingIndex].timestamp = new Date();
        return;
      }

      this.syncQueue.push({
        configId,
        priority: this.getPriorityValue(priority),
        timestamp: new Date(),
      });

      // Sort queue by priority and timestamp
      this.syncQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp.getTime() - b.timestamp.getTime();
      });

      logger.info('Batch sync queued', {
        configId,
        name: config.name,
        priority,
        queuePosition: this.syncQueue.findIndex(item => item.configId === configId) + 1,
      });

      // Start processing queue if not already running
      if (!this.isProcessingQueue) {
        this.processSyncQueue();
      }
    } catch (error) {
      logger.error('Failed to queue batch sync', new EnhancedError('Failed to queue batch sync', { configId, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Cancel running sync
   */
  async cancelRunningSync(configId: string): Promise<void> {
    try {
      const sync = this.runningSyncs.get(configId);
      if (!sync) {
        throw new Error(`No running sync found for configuration ${configId}`);
      }

      sync.status = 'cancelled';
      sync.endTime = new Date();

      this.runningSyncs.delete(configId);
      this.progress.delete(configId);

      logger.info('Batch sync cancelled', { configId });

      // Update config with cancelled sync
      const config = this.configs.get(configId);
      if (config) {
        config.lastSync = sync.endTime;
        config.syncHistory.push(sync);
        await this.saveBatchConfig(config);
      }
    } catch (error) {
      logger.error('Failed to cancel running sync', new EnhancedError('Failed to cancel running sync', { configId, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Get sync progress
   */
  getSyncProgress(configId: string): SyncProgress | null {
    return this.progress.get(configId) || null;
  }

  /**
   * Get all sync progress
   */
  getAllSyncProgress(): SyncProgress[] {
    return Array.from(this.progress.values());
  }

  /**
   * Get batch sync configurations
   */
  getBatchSyncConfigs(): BatchSyncConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get batch sync configuration by ID
   */
  getBatchSyncConfig(configId: string): BatchSyncConfig | null {
    return this.configs.get(configId) || null;
  }

  /**
   * Get running syncs
   */
  getRunningSyncs(): BatchSyncResult[] {
    return Array.from(this.runningSyncs.values());
  }

  /**
   * Get sync queue
   */
  getSyncQueue(): Array<{ configId: string; config: BatchSyncConfig; position: number }> {
    return this.syncQueue.map((item, index) => ({
      configId: item.configId,
      config: this.configs.get(item.configId)!,
      position: index + 1,
    }));
  }

  /**
   * Get batch sync statistics
   */
  getBatchSyncStats(): {
    totalConfigs: number;
    enabledConfigs: number;
    runningSyncs: number;
    queuedSyncs: number;
    todaySyncs: number;
    successRate: number;
    averageProcessingTime: number;
    totalAccountsSynced: number;
    totalAdsUpdated: number;
  } {
    const configs = Array.from(this.configs.values());
    const enabledConfigs = configs.filter(c => c.enabled).length;
    const runningSyncs = this.runningSyncs.size;
    const queuedSyncs = this.syncQueue.length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySyncs = configs.reduce((count, config) => {
      return count + config.syncHistory.filter(sync => {
        const syncDate = new Date(sync.startTime);
        syncDate.setHours(0, 0, 0, 0);
        return syncDate.getTime() === today.getTime();
      }).length;
    }, 0);

    const allSyncs = configs.flatMap(c => c.syncHistory);
    const successfulSyncs = allSyncs.filter(s => s.status === 'completed').length;
    const successRate = allSyncs.length > 0 ? (successfulSyncs / allSyncs.length) * 100 : 0;

    const averageProcessingTime = allSyncs.length > 0 
      ? allSyncs.reduce((sum, s) => sum + s.processingTime, 0) / allSyncs.length 
      : 0;

    const totalAccountsSynced = allSyncs.reduce((sum, s) => sum + s.processedAccounts, 0);
    const totalAdsUpdated = allSyncs.reduce((sum, s) => sum + s.updatedAds, 0);

    return {
      totalConfigs: configs.length,
      enabledConfigs,
      runningSyncs,
      queuedSyncs,
      todaySyncs,
      successRate,
      averageProcessingTime,
      totalAccountsSynced,
      totalAdsUpdated,
    };
  }

  // Private methods

  private initializeSyncManager(): void {
    logger.info('Google Ads Batch Sync Manager initialized');
    
    // Load existing configurations
    this.loadBatchConfigs();

    // Start queue processor
    this.processSyncQueue();

    // Start cleanup timer
    this.startCleanupTimer();
  }

  private async performBatchSync(
    config: BatchSyncConfig,
    options: { force?: boolean; dryRun?: boolean; accountIds?: string[] },
    syncResult: BatchSyncResult
  ): Promise<BatchSyncResult> {
    const accountsToSync = options.accountIds || config.accountIds;
    
    if (config.syncMode === 'sequential') {
      return this.syncSequential(config, accountsToSync, options, syncResult);
    } else if (config.syncMode === 'parallel') {
      return this.syncParallel(config, accountsToSync, options, syncResult);
    } else {
      return this.syncAdaptive(config, accountsToSync, options, syncResult);
    }
  }

  private async syncSequential(
    config: BatchSyncConfig,
    accountIds: string[],
    options: { force?: boolean; dryRun?: boolean },
    syncResult: BatchSyncResult
  ): Promise<BatchSyncResult> {
    const accountResults: AccountSyncResult[] = [];
    let totalAds = 0;
    let updatedAds = 0;
    let failedAds = 0;
    let skippedAds = 0;

    for (let i = 0; i < accountIds.length; i++) {
      const accountId = accountIds[i];
      
      try {
        // Update progress
        this.updateProgress(config.id, {
          currentAccount: accountId,
          currentAccountProgress: 0,
          processedAccounts: i,
        });

        const accountResult = await this.syncAccount(config, accountId, options);
        accountResults.push(accountResult);

        totalAds += accountResult.totalAds;
        updatedAds += accountResult.updatedAds;
        failedAds += accountResult.failedAds;
        skippedAds += accountResult.skippedAds;

        // Update progress
        this.updateProgress(config.id, {
          currentAccountProgress: 100,
          processedAccounts: i + 1,
        });

        // Rate limiting delay
        if (i < accountIds.length - 1 && config.rateLimitDelay > 0) {
          await this.delay(config.rateLimitDelay);
        }
      } catch (error) {
        logger.error('Failed to sync account', new EnhancedError('Failed to sync account', { accountId, error: error instanceof Error ? error.message : String(error) }));
        
        accountResults.push({
          accountId,
          accountName: accountId,
          status: 'failed',
          startTime: new Date(),
          endTime: new Date(),
          totalAds: 0,
          updatedAds: 0,
          failedAds: 0,
          skippedAds: 0,
          processingTime: 0,
          errors: [error instanceof Error ? error.message : "Unknown error" as any],
          warnings: [],
          retryCount: 0,
          confidence: 0,
          topCampaigns: [],
        });
      }
    }

    return {
      ...syncResult,
      status: this.determineSyncStatus(accountResults),
      processedAccounts: accountResults.length,
      successfulAccounts: accountResults.filter(r => r.status === 'completed').length,
      failedAccounts: accountResults.filter(r => r.status === 'failed').length,
      skippedAccounts: accountResults.filter(r => r.status === 'skipped').length,
      totalAds,
      updatedAds,
      failedAds,
      skippedAds,
      accountResults,
      summary: {
        averageConfidence: this.calculateAverageConfidence(accountResults),
        accountsPerMinute: 0,
        adsPerMinute: 0,
        successRate: this.calculateSuccessRate(accountResults),
        topErrors: this.getTopErrors(accountResults),
      },
    };
  }

  private async syncParallel(
    config: BatchSyncConfig,
    accountIds: string[],
    options: { force?: boolean; dryRun?: boolean },
    syncResult: BatchSyncResult
  ): Promise<BatchSyncResult> {
    const chunks = this.chunkArray(accountIds, config.maxConcurrentAccounts);
    const accountResults: AccountSyncResult[] = [];
    let totalAds = 0;
    let updatedAds = 0;
    let failedAds = 0;
    let skippedAds = 0;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      
      try {
        // Update progress
        this.updateProgress(config.id, {
          processedAccounts: chunkIndex * config.maxConcurrentAccounts,
        });

        const chunkPromises = chunk?.filter(Boolean)?.map(accountId => 
          this.syncAccount(config, accountId, options)
        );

        const chunkResults = await Promise.allSettled(chunkPromises);
        
        for (const result of chunkResults) {
          if (result.status === 'fulfilled') {
            accountResults.push(result.value);
            totalAds += result.value.totalAds;
            updatedAds += result.value.updatedAds;
            failedAds += result.value.failedAds;
            skippedAds += result.value.skippedAds;
          } else {
            logger.error('Account sync failed', new EnhancedError('Account sync failed', { error: result.reason  }));
          }
        }

        // Update progress
        this.updateProgress(config.id, {
          processedAccounts: Math.min((chunkIndex + 1) * config.maxConcurrentAccounts, accountIds.length),
        });

        // Rate limiting delay between chunks
        if (chunkIndex < chunks.length - 1 && config.rateLimitDelay > 0) {
          await this.delay(config.rateLimitDelay);
        }
      } catch (error) {
        logger.error('Chunk sync failed', new EnhancedError('Chunk sync failed', { chunkIndex, error: error instanceof Error ? error.message : String(error) }));
      }
    }

    return {
      ...syncResult,
      status: this.determineSyncStatus(accountResults),
      processedAccounts: accountResults.length,
      successfulAccounts: accountResults.filter(r => r.status === 'completed').length,
      failedAccounts: accountResults.filter(r => r.status === 'failed').length,
      skippedAccounts: accountResults.filter(r => r.status === 'skipped').length,
      totalAds,
      updatedAds,
      failedAds,
      skippedAds,
      accountResults,
      summary: {
        averageConfidence: this.calculateAverageConfidence(accountResults),
        accountsPerMinute: 0,
        adsPerMinute: 0,
        successRate: this.calculateSuccessRate(accountResults),
        topErrors: this.getTopErrors(accountResults),
      },
    };
  }

  private async syncAdaptive(
    config: BatchSyncConfig,
    accountIds: string[],
    options: { force?: boolean; dryRun?: boolean },
    syncResult: BatchSyncResult
  ): Promise<BatchSyncResult> {
    // Start with sequential, adapt based on performance
    let currentMode: 'sequential' | 'parallel' = 'sequential';
    let batchSize = 1;
    const maxBatchSize = config.maxConcurrentAccounts;
    const accountResults: AccountSyncResult[] = [];
    let totalAds = 0;
    let updatedAds = 0;
    let failedAds = 0;
    let skippedAds = 0;

    for (let i = 0; i < accountIds.length; i += batchSize) {
      const chunk = accountIds.slice(i, i + batchSize);
      
      try {
        // Update progress
        this.updateProgress(config.id, {
          processedAccounts: i,
        });

        const chunkStartTime = Date.now();
        
        if (currentMode === 'parallel') {
          const chunkPromises = chunk?.filter(Boolean)?.map(accountId => 
            this.syncAccount(config, accountId, options)
          );
          const chunkResults = await Promise.allSettled(chunkPromises);
          
          for (const result of chunkResults) {
            if (result.status === 'fulfilled') {
              accountResults.push(result.value);
              totalAds += result.value.totalAds;
              updatedAds += result.value.updatedAds;
              failedAds += result.value.failedAds;
              skippedAds += result.value.skippedAds;
            }
          }
        } else {
          for (const accountId of chunk) {
            const result = await this.syncAccount(config, accountId, options);
            accountResults.push(result);
            totalAds += result.totalAds;
            updatedAds += result.updatedAds;
            failedAds += result.failedAds;
            skippedAds += result.skippedAds;
          }
        }

        const chunkProcessingTime = Date.now() - chunkStartTime;
        const accountsPerMinute = (chunk.length / chunkProcessingTime) * 60000;

        // Adapt batch size based on performance
        if (accountsPerMinute > 30 && batchSize < maxBatchSize) {
          batchSize = Math.min(batchSize * 2, maxBatchSize);
          currentMode = batchSize > 1 ? 'parallel' : 'sequential';
        } else if (accountsPerMinute < 10 && batchSize > 1) {
          batchSize = Math.max(batchSize / 2, 1);
          currentMode = batchSize > 1 ? 'parallel' : 'sequential';
        }

        // Update progress
        this.updateProgress(config.id, {
          processedAccounts: Math.min(i + chunk.length, accountIds.length),
        });

        // Rate limiting delay
        if (i + chunk.length < accountIds.length && config.rateLimitDelay > 0) {
          await this.delay(config.rateLimitDelay);
        }
      } catch (error) {
        logger.error('Adaptive sync chunk failed', new EnhancedError('Adaptive sync chunk failed', { startIndex: i, batchSize, error: error instanceof Error ? error.message : String(error) }));
      }
    }

    return {
      ...syncResult,
      status: this.determineSyncStatus(accountResults),
      processedAccounts: accountResults.length,
      successfulAccounts: accountResults.filter(r => r.status === 'completed').length,
      failedAccounts: accountResults.filter(r => r.status === 'failed').length,
      skippedAccounts: accountResults.filter(r => r.status === 'skipped').length,
      totalAds,
      updatedAds,
      failedAds,
      skippedAds,
      accountResults,
      summary: {
        averageConfidence: this.calculateAverageConfidence(accountResults),
        accountsPerMinute: 0,
        adsPerMinute: 0,
        successRate: this.calculateSuccessRate(accountResults),
        topErrors: this.getTopErrors(accountResults),
      },
    };
  }

  private async syncAccount(
    config: BatchSyncConfig,
    accountId: string,
    options: { force?: boolean; dryRun?: boolean }
  ): Promise<AccountSyncResult> {
    const startTime = Date.now();
    let retryCount = 0;

    while (retryCount <= config.maxRetries) {
      try {
        // This would integrate with your existing account sync logic
        // Placeholder implementation
        const result = await this.performAccountSync(config, accountId, options);

        const processingTime = Date.now() - startTime;

        return {
          accountId,
          accountName: `Account ${accountId}`,
          status: 'completed',
          startTime: new Date(startTime),
          endTime: new Date(),
          totalAds: result.totalAds,
          updatedAds: result.updatedAds,
          failedAds: result.failedAds,
          skippedAds: result.skippedAds,
          processingTime,
          errors: result.errors,
          warnings: result.warnings,
          retryCount,
          confidence: result.confidence,
          topCampaigns: result.topCampaigns,
        };
      } catch (error) {
        retryCount++;
        
        if (retryCount > config.maxRetries) {
          const processingTime = Date.now() - startTime;
          
          return {
            accountId,
            accountName: `Account ${accountId}`,
            status: 'failed',
            startTime: new Date(startTime),
            endTime: new Date(),
            totalAds: 0,
            updatedAds: 0,
            failedAds: 0,
            skippedAds: 0,
            processingTime,
            errors: [error instanceof Error ? error.message : "Unknown error" as any],
            warnings: [],
            retryCount,
            confidence: 0,
            topCampaigns: [],
          };
        }

        // Wait before retry
        await this.delay(config.retryDelay * retryCount);
      }
    }

    // This should never be reached, but TypeScript requires a return
    throw new Error('Unexpected error in syncAccount');
  }

  private async performAccountSync(
    config: BatchSyncConfig,
    accountId: string,
    options: { force?: boolean; dryRun?: boolean }
  ): Promise<{
    totalAds: number;
    updatedAds: number;
    failedAds: number;
    skippedAds: number;
    errors: string[];
    warnings: string[];
    confidence: number;
    topCampaigns: Array<{
      campaignId: string;
      campaignName: string;
      updateCount: number;
    }>;
  }> {
    // Placeholder for actual account sync implementation
    // This would integrate with your GoogleAdsLinkAssociation and GoogleAdsUrlUpdater
    
    logger.info('Syncing account', { accountId, configId: config.id });

    return {
      totalAds: 150,
      updatedAds: 120,
      failedAds: 5,
      skippedAds: 25,
      errors: [],
      warnings: ['Some ads were skipped due to low confidence'],
      confidence: 0.85,
      topCampaigns: [
        { campaignId: 'camp1', campaignName: 'Search Campaign', updateCount: 45 },
        { campaignId: 'camp2', campaignName: 'Display Campaign', updateCount: 32 },
      ],
    };
  }

  private async processSyncQueue(): Promise<void> {
    if (this.isProcessingQueue || this.syncQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.syncQueue.length > 0) {
        const nextItem = this.syncQueue[0];
        const config = this.configs.get(nextItem.configId);

        if (!config || !config.enabled) {
          this.syncQueue.shift();
          continue;
        }

        // Check if we can run this sync (not already running)
        if (!this.runningSyncs.has(config.id)) {
          this.syncQueue.shift();
          
          try {
            await this.executeBatchSync(config.id);
          } catch (error) {
            logger.error('Failed to execute queued sync', error instanceof Error ? error : new Error(String(error)));
          }
        } else {
          // Skip this sync for now, try next one
          this.syncQueue.shift();
        }

        // Small delay between processing queue items
        await this.delay(1000);
      }
    } catch (error) {
      logger.error('Error processing sync queue', error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private updateProgress(configId: string, updates: Partial<SyncProgress>): void {
    const progress = this.progress.get(configId);
    if (progress) {
      const updatedProgress = { ...progress, ...updates };
      updatedProgress.progress = Math.round((updatedProgress.processedAccounts / updatedProgress.totalAccounts) * 100);
      
      // Calculate estimated time remaining
      if (updatedProgress.processedAccounts > 0) {
        const elapsed = Date.now() - updatedProgress.startTime.getTime();
        const avgTimePerAccount = elapsed / updatedProgress.processedAccounts;
        const remainingAccounts = updatedProgress.totalAccounts - updatedProgress.processedAccounts;
        updatedProgress.estimatedTimeRemaining = remainingAccounts * avgTimePerAccount;
      }

      this.progress.set(configId, updatedProgress);
    }
  }

  private determineSyncStatus(results: AccountSyncResult[]): BatchSyncResult['status'] {
    if (results.length === 0) return 'completed';
    if (results.every(r => r.status === 'completed')) return 'completed';
    if (results.some(r => r.status === 'completed')) return 'partial';
    return 'failed';
  }

  private calculateAverageConfidence(results: AccountSyncResult[]): number {
    if (results.length === 0) return 0;
    const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);
    return totalConfidence / results.length;
  }

  private calculateSuccessRate(results: AccountSyncResult[]): number {
    if (results.length === 0) return 0;
    const successful = results.filter(r => r.status === 'completed').length;
    return (successful / results.length) * 100;
  }

  private getTopErrors(results: AccountSyncResult[]): Array<{ error: string; count: number; accounts: string[] }> {
    const errorMap = new Map<string, { count: number; accounts: string[] }>();

    results.forEach(result => {
      result.errors.forEach(error => {
        const existing = errorMap.get(error) || { count: 0, accounts: [] };
        existing.count++;
        existing.accounts.push(result.accountId);
        errorMap.set(error, existing);
      });
    });

    return Array.from(errorMap.entries())
      .map(([error, data]) => ({ error, count: data.count, accounts: data.accounts }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private getPriorityValue(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 2;
    }
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

  private startCleanupTimer(): void {
    // Clean up old progress data every hour
    setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      for (const [configId, progress] of this.progress) {
        if (progress.startTime < oneHourAgo) {
          this.progress.delete(configId);
        }
      }
    }, 60 * 60 * 1000);
  }

  private async saveBatchConfig(config: BatchSyncConfig): Promise<void> {
    // Placeholder for persistent storage
    logger.info('Saving batch sync configuration', { configId: config.id });
  }

  private async deleteBatchConfigFromStorage(configId: string): Promise<void> {
    // Placeholder for persistent storage removal
    logger.info('Deleting batch sync configuration from storage', { configId });
  }

  private loadBatchConfigs(): void {
    // Placeholder for loading configurations from persistent storage
    logger.info('Loading batch sync configurations from storage');
  }
}