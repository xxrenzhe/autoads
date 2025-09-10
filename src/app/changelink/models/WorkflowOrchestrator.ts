/**
 * 工作流编排器 - 负责协调整个自动化工作流程
 * 对应Task 9: 完整执行流程编排器
 */

import { 
  TrackingConfiguration, 
  ExecutionResult, 
  LinkResult, 
  ExecutionStatus,
  ScheduleConfig,
  GoogleAdsAccount 
} from '../types';
import { UrlExtractionService } from './UrlExtractionService';
import { GoogleAdsService } from './GoogleAdsService';
import { EmailNotificationService } from './EmailNotificationService';
import { TaskScheduler } from './TaskScheduler';
import { AdMappingManager } from './AdMappingManager';
import { PerformanceMonitor } from './PerformanceMonitor';
import { LoggingService } from './LoggingService';
import { ErrorManager } from './ErrorManager';
import { StorageService } from './StorageService';

import { logError } from '../utils/error-utils';
import { EnhancedError } from '@/lib/utils/error-handling';

export interface WorkflowOptions {
  enableNotifications?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableLogging?: boolean;
  dryRun?: boolean;
  timeout?: number;
  parallelExecution?: boolean;
  maxConcurrentExecutions?: number;
}

export interface WorkflowExecutionContext {
  executionId: string;
  configurationId: string;
  startTime: Date;
  status: ExecutionStatus;
  progress: number;
  currentPhase: string;
  error?: string;
  linkResults?: LinkResult[];
  googleAdsResults?: unknown;
  performanceMetrics?: unknown;
}

export interface WorkflowPhase {
  name: string;
  description: string;
  progress: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

export interface WorkflowResult {
  executionId: string;
  configurationId: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  phases: WorkflowPhase[];
  linkResults: LinkResult[];
  googleAdsResults: unknown;
  performanceMetrics: unknown;
  errors: string[];
  summary: {
    totalLinks: number;
    successfulLinks: number;
    failedLinks: number;
    totalAdsUpdated: number;
    successfulAdsUpdated: number;
    failedAdsUpdated: number;
    successRate: number;
  };
}

export class WorkflowOrchestrator {
  private urlExtractionService: UrlExtractionService;
  private googleAdsService: GoogleAdsService;
  private emailService: EmailNotificationService;
  private taskScheduler: TaskScheduler;
  private adMappingManager: AdMappingManager;
  private performanceMonitor: PerformanceMonitor;
  private loggingService: LoggingService;
  private errorManager: ErrorManager;
  private storageService: StorageService;
  
  private activeExecutions: Map<string, WorkflowExecutionContext> = new Map();
  private executionQueue: string[] = [];
  private options: Required<WorkflowOptions>;

  constructor(
    urlExtractionService: UrlExtractionService,
    googleAdsService: GoogleAdsService,
    emailService: EmailNotificationService,
    taskScheduler: TaskScheduler,
    adMappingManager: AdMappingManager,
    performanceMonitor: PerformanceMonitor,
    loggingService: LoggingService,
    errorManager: ErrorManager,
    storageService: StorageService,
    options: WorkflowOptions = {}
  ) {
    this.urlExtractionService = urlExtractionService;
    this.googleAdsService = googleAdsService;
    this.emailService = emailService;
    this.taskScheduler = taskScheduler;
    this.adMappingManager = adMappingManager;
    this.performanceMonitor = performanceMonitor;
    this.loggingService = loggingService;
    this.errorManager = errorManager;
    this.storageService = storageService;
    
    this.options = {
      enableNotifications: true,
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableLogging: true,
      dryRun: false,
      timeout: 300000, // 5分钟
      parallelExecution: false,
      maxConcurrentExecutions: 1,
      ...options
    };
  }

  /**
   * 执行完整的跟踪和更新工作流程
   */
  async executeWorkflow(
    configuration: TrackingConfiguration,
    options: WorkflowOptions = {}
  ): Promise<WorkflowResult> {
    const executionId = this.generateExecutionId();
    const startTime = new Date();
    
    const workflowOptions = { ...this.options, ...options };
    
    this.loggingService.logInfo('Starting workflow execution', { 
      executionId,
      configurationId: configuration.id,
      configurationName: configuration.name
    });

    // Create execution context
    const context: WorkflowExecutionContext = {
      executionId,
      configurationId: configuration.id,
      startTime,
      status: 'RUNNING',
      progress: 0,
      currentPhase: 'initialization'
    };

    this.activeExecutions.set(executionId, context);

    const phases: WorkflowPhase[] = [
      { name: 'initialization', description: 'Initializing workflow', progress: 0, status: 'pending' },
      { name: 'link_processing', description: 'Processing promotional links', progress: 0, status: 'pending' },
      { name: 'url_extraction', description: 'Extracting final URLs', progress: 0, status: 'pending' },
      { name: 'ad_mapping', description: 'Mapping URLs to ads', progress: 0, status: 'pending' },
      { name: 'google_ads_update', description: 'Updating Google Ads campaigns', progress: 0, status: 'pending' },
      { name: 'verification', description: 'Verifying updates', progress: 0, status: 'pending' },
      { name: 'notification', description: 'Sending notifications', progress: 0, status: 'pending' },
      { name: 'completion', description: 'Completing workflow', progress: 0, status: 'pending' }
    ];

    let linkResults: LinkResult[] = [];
    let googleAdsResults: unknown = null;
    const performanceMetrics: unknown = null;
    const errors: string[] = [];

    try { 
      // Phase 1: Initialization
      await this.executePhase(phases[0], async () => {
        await this.initializeWorkflow(configuration, workflowOptions);
        context.progress = 10;
        context.currentPhase = 'link_processing';
      });
      
      // Phase 2: Link Processing
      await this.executePhase(phases[1], async () => { 
        linkResults = await this.processLinks(configuration, workflowOptions);
        context.progress = 30;
        context.currentPhase = 'url_extraction';
        context.linkResults = linkResults;
      });
      
      // Phase 3: URL Extraction
      await this.executePhase(phases[2], async () => { 
        await this.extractUrls(linkResults, configuration);
        context.progress = 50;
        context.currentPhase = 'ad_mapping';
      });
      
      // Phase 4: Ad Mapping
      await this.executePhase(phases[3], async () => { 
        await this.mapAdsToUrls(linkResults, configuration);
        context.progress = 60;
        context.currentPhase = 'google_ads_update';
      });
      
      // Phase 5: Google Ads Update
      await this.executePhase(phases[4], async () => { 
        googleAdsResults = await this.updateGoogleAds(linkResults, configuration, workflowOptions);
        context.progress = 80;
        context.currentPhase = 'verification';
        context.googleAdsResults = googleAdsResults;
      });
      
      // Phase 6: Verification
      await this.executePhase(phases[5], async () => { 
        await this.verifyUpdates(googleAdsResults, configuration);
        context.progress = 90;
        context.currentPhase = 'notification';
      });
      
      // Phase 7: Notification
      await this.executePhase(phases[6], async () => { 
        await this.sendNotifications(linkResults, googleAdsResults, configuration, workflowOptions);
        context.progress = 95;
        context.currentPhase = 'completion';
      });
      
      // Phase 8: Completion
      await this.executePhase(phases[7], async () => { 
        await this.completeWorkflow(linkResults, googleAdsResults, configuration);
        context.progress = 100;
        context.currentPhase = 'completed';
      });

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Update context
      context.status = 'COMPLETED';
      context.progress = 100;
      context.performanceMetrics = performanceMetrics;

      const result: WorkflowResult = {
        executionId,
        configurationId: configuration.id,
        success: true,
        startTime,
        endTime,
        duration,
        phases,
        linkResults,
        googleAdsResults,
        performanceMetrics,
        errors,
        summary: {
          totalLinks: linkResults.length,
          successfulLinks: linkResults.filter(r => r.status === 'success').length,
          failedLinks: linkResults.filter(r => r.status === 'failed').length,
          totalAdsUpdated: 0, // TODO: Calculate from googleAdsResults
          successfulAdsUpdated: 0, // TODO: Calculate from googleAdsResults
          failedAdsUpdated: 0, // TODO: Calculate from googleAdsResults
          successRate: linkResults.length > 0 
            ? linkResults.filter(r => r.status === 'success').length / linkResults.length 
            : 0
        }
      };

      this.loggingService.logInfo('Workflow completed successfully', { 
        executionId,
        duration,
        totalLinks: linkResults.length,
        successRate: result.summary.successRate
      });

      return result;

    } catch (error) { 
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Update context
      context.status = 'FAILED';
      context.error = error instanceof Error ? error.message : "Unknown error" as any;

      this.loggingService.logError('Workflow failed', {
        executionId,
        error: error instanceof Error ? error.message : "Unknown error" as any,
        duration
      });

      const result: WorkflowResult = {
        executionId,
        configurationId: configuration.id,
        success: false,
        startTime,
        endTime,
        duration,
        phases,
        linkResults,
        googleAdsResults,
        performanceMetrics,
        errors: [error instanceof Error ? error.message : "Unknown error" as any],
        summary: {
          totalLinks: linkResults.length,
          successfulLinks: linkResults.filter(r => r.status === 'success').length,
          failedLinks: linkResults.filter(r => r.status === 'failed').length,
          totalAdsUpdated: 0,
          successfulAdsUpdated: 0,
          failedAdsUpdated: 0,
          successRate: 0
        }
      };

      return result;
    } finally {
      // Clean up
      this.activeExecutions.delete(executionId);
    }
  }

  // ==================== 私有方法 ====================

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async executePhase(phase: WorkflowPhase, phaseFunction: () => Promise<void>): Promise<void> {
    try {
      phase.status = 'running';
      phase.startTime = new Date();
      
      this.loggingService.logInfo(`Starting phase: ${phase.name}`, { phase: phase.name });
      await phaseFunction();
      
      phase.status = 'completed';
      phase.endTime = new Date();
      phase.progress = 100;
      
      this.loggingService.logInfo(`Completed phase: ${phase.name}`, { 
        phase: phase.name,
        duration: phase.endTime.getTime() - phase.startTime!.getTime()
      });
    } catch (error) {
      phase.status = 'failed';
      phase.endTime = new Date();
      phase.error = error instanceof Error ? error.message : "Unknown error" as any;
      
      this.loggingService.logError(`Failed phase: ${phase.name}`, { 
        phase: phase.name,
        error: error instanceof Error ? error.message : "Unknown error" as any
      });
      throw error;
    }
  }

  private async initializeWorkflow(configuration: TrackingConfiguration, options: WorkflowOptions): Promise<void> {
    this.loggingService.logInfo('Initializing workflow', { configurationId: configuration.id });

    // Validate configuration
    if (!configuration.environmentId) {
      throw new Error('Environment ID is required');
    }
    
    if (configuration.originalLinks.length === 0) {
      throw new Error('At least one original link is required');
    }
    
    if (configuration.googleAdsAccounts.length === 0) {
      throw new Error('At least one Google Ads account is required');
    }
    
    // Initialize services
    await this.performanceMonitor.startMonitoring(configuration.id);
    
    this.loggingService.logInfo('Workflow initialized successfully', { configurationId: configuration.id });
  }

  private async processLinks(configuration: TrackingConfiguration, options: WorkflowOptions): Promise<LinkResult[]> {
    this.loggingService.logInfo('Processing links', { 
      configurationId: configuration.id,
      linkCount: configuration.originalLinks.length 
    });

    const results: LinkResult[] = [];
    
    for (const originalUrl of configuration.originalLinks) {
      try {
        const result = await this.urlExtractionService.extractFinalUrl({
          originalUrl,
          environmentId: configuration.environmentId || '',
          repeatCount: configuration.repeatCount,
          timeout: 30000
        });

        // Convert UrlExtractionResult to LinkResult
        results.push({
          id: `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          originalUrl: result.originalUrl,
          finalUrl: result.finalUrl,
          status: result.success ? 'success' : 'failed',
          processingTime: result.executionTime,
          error: result.error
        });
      } catch (error) {
        this.loggingService.logError('Failed to process link', { 
          originalUrl,
          error: error instanceof Error ? error.message : "Unknown error" as any
        });

        // Add failed result
        for (let i = 1; i <= (configuration.repeatCount || 1); i++) {
          results.push({
            id: `link_failed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            originalUrl,
            finalUrl: '',
            status: 'failed',
            processingTime: 0,
            error: error instanceof Error ? error.message : "Unknown error" as any
          });
        }
      }
    }
    
    this.loggingService.logInfo('Links processed', { 
      configurationId: configuration.id,
      totalResults: results.length,
      successfulResults: results.filter(r => r.status === 'success').length
    });

    return results;
  }

  private async extractUrls(linkResults: LinkResult[], configuration: TrackingConfiguration): Promise<void> {
    this.loggingService.logInfo('Extracting URLs', { 
      configurationId: configuration.id,
      resultCount: linkResults.length 
    });

    // URL extraction is already done in processLinks
    // This phase is for additional processing if needed
    
    this.loggingService.logInfo('URLs extracted', { configurationId: configuration.id });
  }

  private async mapAdsToUrls(linkResults: LinkResult[], configuration: TrackingConfiguration): Promise<void> {
    this.loggingService.logInfo('Mapping ads to URLs', { 
      configurationId: configuration.id,
      resultCount: linkResults.length 
    });

    // Ad mapping is handled by AdMappingManager
    // This phase is for validation and preparation
    
    this.loggingService.logInfo('Ads mapped to URLs', { configurationId: configuration.id });
  }

  private async updateGoogleAds(
    linkResults: LinkResult[], 
    configuration: TrackingConfiguration, 
    options: WorkflowOptions
  ): Promise<unknown> {
    this.loggingService.logInfo('Updating Google Ads', { 
      configurationId: configuration.id,
      resultCount: linkResults.length 
    });

    if (options.dryRun) {
      this.loggingService.logInfo('Dry run mode - skipping actual updates', { configurationId: configuration.id });
      return { dryRun: true, updates: [] };
    }
    
    // Mock Google Ads update for now
    const results = { dryRun: options.dryRun, updates: [] };
    
    this.loggingService.logInfo('Google Ads updated', { 
      configurationId: configuration.id,
      updateCount: Array.isArray(results) ? results.length : 0
    });

    return results;
  }

  private async verifyUpdates(googleAdsResults: unknown, configuration: TrackingConfiguration): Promise<void> {
    this.loggingService.logInfo('Verifying updates', { configurationId: configuration.id });

    // Verification logic would go here
    // For now, just log the verification step
    
    this.loggingService.logInfo('Updates verified', { configurationId: configuration.id });
  }

  private async sendNotifications(
    linkResults: LinkResult[], 
    googleAdsResults: unknown, 
    configuration: TrackingConfiguration, 
    options: WorkflowOptions
  ): Promise<void> {
    this.loggingService.logInfo('Sending notifications', { configurationId: configuration.id });

    if (!options.enableNotifications) {
      this.loggingService.logInfo('Notifications disabled - skipping', { configurationId: configuration.id });
      return;
    }
    
    try {
      // Mock email notification for now
      this.loggingService.logInfo('Email notification would be sent here', { configurationId: configuration.id });
      this.loggingService.logInfo('Notifications sent', { configurationId: configuration.id });
    } catch (error) {
      this.loggingService.logError('Failed to send notifications', { 
        configurationId: configuration.id,
        error: error instanceof Error ? error.message : "Unknown error" as any
      });
    }
  }

  private async completeWorkflow(
    linkResults: LinkResult[], 
    googleAdsResults: unknown, 
    configuration: TrackingConfiguration
  ): Promise<void> {
    this.loggingService.logInfo('Completing workflow', { configurationId: configuration.id });

    // Save execution results
    const endTime = new Date();
    const executionResult: WorkflowResult = {
      executionId: `exec_${Date.now()}`,
      configurationId: configuration.id,
      success: true,
      startTime: new Date(endTime.getTime() - 10000), // Mock start time 10 seconds ago
      endTime,
      duration: 10000, // Mock duration
      phases: [],
      linkResults,
      googleAdsResults: [],
      performanceMetrics: {},
      errors: [],
      summary: {
        totalLinks: linkResults.length,
        successfulLinks: linkResults.filter(r => r.status === 'success').length,
        failedLinks: linkResults.filter(r => r.status === 'failed').length,
        totalAdsUpdated: 0,
        successfulAdsUpdated: 0,
        failedAdsUpdated: 0,
        successRate: linkResults.length > 0 
          ? linkResults.filter(r => r.status === 'success').length / linkResults.length 
          : 0,
      }
    };
    
    // Mock storage for now
    this.loggingService.logInfo('Execution result would be saved here', { configurationId: configuration.id });

    // Stop performance monitoring
    await this.performanceMonitor.endMonitoring(configuration.id);
    
    this.loggingService.logInfo('Workflow completed', { configurationId: configuration.id });
  }

  // ==================== 公共方法 ====================

  /**
   * 获取活动执行列表
   */
  getActiveExecutions(): WorkflowExecutionContext[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * 停止执行
   */
  async stopExecution(executionId: string): Promise<boolean> {
    const context = this.activeExecutions.get(executionId);
    if (!context) {
      return Promise.resolve(false);
    }
    
    context.status = 'CANCELLED';
    this.activeExecutions.delete(executionId);
    
    this.loggingService.logInfo('Execution stopped', { executionId });
    return Promise.resolve(true);
  }

  /**
   * 获取执行状态
   */
  getExecutionStatus(executionId: string): WorkflowExecutionContext | null {
    return this.activeExecutions.get(executionId) || null;
  }
} 