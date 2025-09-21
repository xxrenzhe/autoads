/**
 * 自动化执行引擎 - 统一的执行编排器
 * 负责协调整个自动化工作流程，合并了原有的三个执行引擎
 * 
 * 核心功能：
 * 1. 执行完整的链接更新自动化流程
 * 2. 协调AdsPower、URL提取、Google Ads更新的完整流程
 * 3. 提供简化的工作流编排和监控
 */

import { 
  TrackingConfiguration, 
  ExecutionResult, 
  LinkResult, 
  ExecutionStatus,
  GoogleAdsAccount,
  LinkAccountAssociation
} from '../types';
import { ConfigurationManager } from './ConfigurationManager';
import { UrlExtractionService } from './UrlExtractionService';
import { GoogleAdsApiClient } from './GoogleAdsApiClient';
import { AdsPowerApiClient } from './AdsPowerApiClient';
import { ExecutionRepository } from './ExecutionRepository';
import { NotificationService } from './NotificationService';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('AutomationExecutionEngine');

export interface ExecutionContext {
  id: string;
  configurationId: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  totalSteps: number;
  currentStep: string;
  startTime: Date;
  endTime?: Date;
  results: ExecutionStepResult[];
  errors: ExecutionError[];
  metadata: {
    totalLinks: number;
    processedLinks: number;
    successfulUpdates: number;
    failedUpdates: number;
  };
}

export interface ExecutionStepResult {
  step: string;
  status: 'success' | 'failed' | 'skipped';
  startTime: Date;
  endTime: Date;
  duration: number;
  data?: unknown;
  error?: string;
}

export interface ExecutionError {
  step: string;
  error: string;
  timestamp: Date;
  recoverable: boolean;
  retryCount: number;
}

export interface LinkProcessingResult {
  originalUrl: string;
  extractionResults: any[];
  googleAdsUpdates: Array<{
    adId: string;
    accountId: string;
    success: boolean;
    error?: string;
    finalUrl?: string;
    finalUrlSuffix?: string;
  }>;
  executionNumber: number;
  processingTime: number;
}

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

export interface WorkflowResult {
  executionId: string;
  configurationId: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  phases: any[];
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

export class AutomationExecutionEngine {
  private configManager: ConfigurationManager;
  private adsPowerClient: AdsPowerApiClient;
  private urlExtractionService: UrlExtractionService;
  private googleAdsClient: GoogleAdsApiClient;
  private executionRepo: ExecutionRepository;
  private notificationService: NotificationService;
  
  private activeExecutions = new Map<string, ExecutionContext>();
  private executionQueue: string[] = [];
  private options: Required<WorkflowOptions>;

  constructor(
    configManager: ConfigurationManager,
    adsPowerClient: AdsPowerApiClient,
    urlExtractionService: UrlExtractionService,
    googleAdsClient: GoogleAdsApiClient,
    executionRepo: ExecutionRepository,
    notificationService: NotificationService,
    options: WorkflowOptions = {}
  ) {
    this.configManager = configManager;
    this.adsPowerClient = adsPowerClient;
    this.urlExtractionService = urlExtractionService;
    this.googleAdsClient = googleAdsClient;
    this.executionRepo = executionRepo;
    this.notificationService = notificationService;
    
    this.options = {
      enableNotifications: true,
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableLogging: true,
      dryRun: false,
      timeout: 300000,
      parallelExecution: false,
      maxConcurrentExecutions: 1,
      ...options
    };
    
    logger.info('自动化执行引擎初始化完成');
  }

  /**
   * 启动执行流程
   */
  async startExecution(configurationId: string, userId: string): Promise<string> {
    const executionId = this.generateExecutionId();
    
    try {
      // 1. 获取配置
      const config = await this.configManager.getConfiguration(configurationId);
      if (!config) {
        throw new Error(`配置不存在: ${configurationId}`);
      }

      if (config.status !== 'active') {
        throw new Error(`配置状态异常: ${config.status}`);
      }

      // 2. 创建执行上下文
      const context: ExecutionContext = {
        id: executionId,
        configurationId,
        userId,
        status: 'pending',
        progress: 0,
        totalSteps: this.calculateTotalSteps(config),
        currentStep: '准备执行',
        startTime: new Date(),
        results: [],
        errors: [],
        metadata: {
          totalLinks: config.originalLinks.length,
          processedLinks: 0,
          successfulUpdates: 0,
          failedUpdates: 0
        }
      };

      this.activeExecutions.set(executionId, context);

      // 3. 在数据库中创建执行记录
      await this.executionRepo.create({ 
        configuration_id: configurationId,
        user_id: userId,
        total_items: context.metadata.totalLinks
      });

      // 4. 异步执行主流程
      this.executeMainFlow(executionId, config).catch(error => {
        logger.error('执行流程异常: ${executionId}', new EnhancedError('执行流程异常: ${executionId}', { error: error instanceof Error ? error.message : String(error)  }));
        this.handleExecutionError(executionId, 'main_flow', error);
      });

      logger.info(`执行流程已启动: ${executionId}`);
      return executionId;

    } catch (error) {
      logger.error('启动执行流程失败: ${configurationId}', new EnhancedError('启动执行流程失败: ${configurationId}', { error: error instanceof Error ? error.message : String(error)  }));
      throw error;
    }
  }

  /**
   * 主执行流程
   */
  private async executeMainFlow(executionId: string, config: TrackingConfiguration): Promise<void> {
    const context = this.activeExecutions.get(executionId);
    if (!context) return;

    try {
      context.status = 'running';
      await this.updateExecutionInDB(context);

      // 步骤1: 验证AdsPower环境
      await this.executeStep(context, 'validate_adspower', async () => {
        const validation = await this.adsPowerClient.validateEnvironment(config.environmentId!);
        if (!validation.valid) {
          throw new Error(`AdsPower环境验证失败: ${validation.error}`);
        }
        return validation;
      });

      // 步骤2: 验证Google Ads账户
      await this.executeStep(context, 'validate_google_ads', async () => {
        const authResults: Array<{ accountId: string | undefined; success: boolean; error: string | undefined }> = [];
        for (const account of config.googleAdsAccounts) {
          const auth = await this.googleAdsClient.authenticate();
          authResults.push({ accountId: account.accountId, success: auth.success, error: auth.error });
        }
        return authResults;
      });

      // 步骤3: 处理每个链接
      const linkResults: LinkProcessingResult[] = [];
      for (let i = 0; i < config.originalLinks.length; i++) {
        const originalUrl = config.originalLinks[i];
        
        context.currentStep = `处理链接 ${i + 1}/${config.originalLinks.length}`;
        await this.updateExecutionInDB(context);

        const linkResult = await this.processLink(context, config, originalUrl, i);
        linkResults.push(linkResult);
        
        context.metadata.processedLinks++;
        context.progress = Math.round((context.metadata.processedLinks / context.metadata.totalLinks) * 100);
      }

      // 步骤4: 生成执行报告
      await this.executeStep(context, 'generate_report', async () => {
        const report = this.generateExecutionReport(context, linkResults);
        
        // 发送通知
        if (config.notificationEmail) {
          await this.notificationService.sendExecutionReport(
            config.notificationEmail,
            config.name,
            report
          );
        }
        
        return report;
      });

      // 完成执行
      context.status = 'completed';
      context.endTime = new Date();
      context.currentStep = '执行完成';
      context.progress = 100;

      await this.updateExecutionInDB(context);
      await this.configManager.updateLastExecutionTime(config.id);

      logger.info(`执行流程完成: ${executionId}`);

    } catch (error) {
      await this.handleExecutionError(executionId, 'main_flow', error);
    }
  }

  /**
   * 处理单个链接
   */
  private async processLink(
    context: ExecutionContext,
    config: TrackingConfiguration,
    originalUrl: string,
    linkIndex: number
  ): Promise<LinkProcessingResult> {
    const result: LinkProcessingResult = {
      originalUrl,
      extractionResults: [],
      googleAdsUpdates: [],
      executionNumber: 0,
      processingTime: 0
    };

    const startTime = Date.now();

    try {
      // 1. 根据配置的重复次数提取URL
      for (let execution = 1; execution <= (config.repeatCount || 1); execution++) {
        context.currentStep = `链接 ${linkIndex + 1} - 第 ${execution}/${config.repeatCount || 1} 次提取`;
        
        // 智能延时：35秒 + 1-5秒随机延时
        if (execution > 1) {
          const baseDelay = 35000; // 35秒
          const randomDelay = Math.random() * 4000 + 1000; // 1-5秒
          const totalDelay = baseDelay + randomDelay;
          
          logger.info(`执行延时: ${totalDelay}ms`);
          await this.delay(totalDelay);
        }

        // 提取URL
        const extractionResult = await this.urlExtractionService.extractFinalUrl({ 
          environmentId: config.environmentId!,
          originalUrl,
          timeout: 60000,
          headless: true,
          waitForNavigation: true
        });
        result.extractionResults.push(extractionResult);

        if (extractionResult.success) {
          // 2. 更新对应的Google Ads
          const adMappingConfig = config.adMappingConfig.find(
            mapping => mapping.originalUrl === originalUrl
          );

          if (adMappingConfig) {
            const adsToUpdate = adMappingConfig.adMappings.filter(
              mapping => mapping.executionNumber === execution
            );

            for (const adMapping of adsToUpdate) {
              try {
                // 找到对应的Google Ads账户
                const account = config.googleAdsAccounts.find(
                  acc => acc.accountId === adMapping.campaignId?.split('_')[0] // 假设campaignId包含accountId
                );

                if (account) {
                  // 更新广告的Final URL和Final URL suffix
                  await this.googleAdsClient.updateAd(account.accountId!, adMapping.adId, {
                    finalUrl: extractionResult.finalUrlBase,
                    finalUrlSuffix: extractionResult.finalUrlSuffix
                  });
                  result.googleAdsUpdates.push({ 
                    adId: adMapping.adId,
                    accountId: account.accountId!,
                    success: true,
                    finalUrl: extractionResult.finalUrlBase,
                    finalUrlSuffix: extractionResult.finalUrlSuffix
                  });
                  context.metadata.successfulUpdates++;
                } else {
                  throw new Error(`未找到对应的Google Ads账户`);
                }
              } catch (error) {
                result.googleAdsUpdates.push({
                  adId: adMapping.adId,
                  accountId: adMapping.campaignId || '',
                  success: false,
                  error: error instanceof Error ? error.message : String(error)
                });
                context.metadata.failedUpdates++;
              }
            }
          }
        }
      }

      result.processingTime = Date.now() - startTime;
      return result;

    } catch (error) {
      result.processingTime = Date.now() - startTime;
      logger.error('处理链接失败: ${originalUrl}', new EnhancedError('处理链接失败: ${originalUrl}', { error: error instanceof Error ? error.message : String(error)  }));
      throw error;
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep<T>(
    context: ExecutionContext,
    stepName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const stepResult: ExecutionStepResult = {
      step: stepName,
      status: 'success',
      startTime: new Date(),
      endTime: new Date(),
      duration: 0
    };

    try {
      context.currentStep = stepName;
      const result = await operation();
      
      stepResult.endTime = new Date();
      stepResult.duration = stepResult.endTime.getTime() - stepResult.startTime.getTime();
      stepResult.data = result;
      
      context.results.push(stepResult);
      return result;

    } catch (error) {
      stepResult.status = 'failed';
      stepResult.endTime = new Date();
      stepResult.duration = stepResult.endTime.getTime() - stepResult.startTime.getTime();
      stepResult.error = error instanceof Error ? error.message : String(error);
      
      context.results.push(stepResult);
      throw error;
    }
  }

  /**
   * 处理执行错误
   */
  private async handleExecutionError(executionId: string, step: string, error: unknown): Promise<void> {
    const context = this.activeExecutions.get(executionId);
    if (!context) return;

    const executionError: ExecutionError = {
      step,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date(),
      recoverable: this.isRecoverableError(error),
      retryCount: 0
    };

    context.errors.push(executionError);
    context.status = 'failed';
    context.endTime = new Date();

    await this.updateExecutionInDB(context);

    logger.error('执行错误: ${executionId} - ${step}', new EnhancedError('执行错误: ${executionId} - ${step}', { error: error instanceof Error ? error.message : String(error)  }));
  }

  /**
   * 生成执行报告
   */
  private generateExecutionReport(context: ExecutionContext, linkResults: LinkProcessingResult[]): any {
    const totalExtractions = linkResults.reduce((sum, result: any) => sum + result.extractionResults.length, 0);
    const successfulExtractions = linkResults.reduce(
      (sum, result) => sum + result.extractionResults.filter((r: any) => r.success).length, 0
    );

    return {
      executionId: context.id,
      configurationId: context.configurationId,
      status: context.status === 'pending' || context.status === 'running' ? 'completed' : context.status,
      duration: context.endTime ? context.endTime.getTime() - context.startTime.getTime() : 0,
      summary: {
        totalLinks: context.metadata.totalLinks,
        totalExtractions,
        successfulExtractions,
        failedExtractions: totalExtractions - successfulExtractions,
        successfulUpdates: context.metadata.successfulUpdates,
        failedUpdates: context.metadata.failedUpdates
      },
      errors: context.errors?.filter(Boolean)?.map((err: any) => ({
        step: err.step || 'unknown',
        error: err.error,
        timestamp: err.timestamp || new Date()
      }))
    };
  }

  /**
   * 获取执行状态
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionContext | null> {
    const context = this.activeExecutions.get(executionId);
    if (context) {
      return { ...context };
    }

    // 如果内存中没有，尝试从数据库获取
    const dbExecution = await this.executionRepo.findById(executionId);
    if (dbExecution) {
      return {
        id: dbExecution.id,
        configurationId: dbExecution.configuration_id,
        userId: dbExecution.user_id,
        status: dbExecution.status as any,
        progress: dbExecution.progress,
        totalSteps: 0,
        currentStep: '已完成',
        startTime: dbExecution.started_at,
        endTime: dbExecution.completed_at,
        results: [],
        errors: [],
        metadata: {
          totalLinks: dbExecution.total_items,
          processedLinks: dbExecution.processed_items,
          successfulUpdates: 0,
          failedUpdates: 0
        }
      };
    }

    return null as any;
  }

  /**
   * 取消执行
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const context = this.activeExecutions.get(executionId);
    if (!context) return Promise.resolve(false);

    if (context.status === 'running') {
      context.status = 'cancelled';
      context.endTime = new Date();
      await this.updateExecutionInDB(context);
      
      logger.info(`执行已取消: ${executionId}`);
      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }

  /**
   * 获取活跃执行列表
   */
  getActiveExecutions(): ExecutionContext[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * 工具方法
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateTotalSteps(config: TrackingConfiguration): number {
    return 4 + config.originalLinks.length * (config.repeatCount || 1);
  }

  private async updateExecutionInDB(context: ExecutionContext): Promise<void> {
    try {
      await this.executionRepo.update(context.id, {
        status: context.status,
        progress: context.progress,
        processed_items: context.metadata.processedLinks,
        results: context.results,
        error_log: context.errors,
        completed_at: context.endTime
      });
    } catch (error) {
      logger.warn('更新数据库执行记录失败');
    }
  }

  private isRecoverableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('timeout') || 
             message.includes('network') || 
             message.includes('connection');
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清理已完成的执行
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时

    for (const [id, context] of this.activeExecutions.entries()) {
      if (context.status === 'completed' || context.status === 'failed' || context.status === 'cancelled') {
        const age = now - context.startTime.getTime();
        if (age > maxAge) {
          this.activeExecutions.delete(id);
        }
      }
    }
  }
}

// 创建全局自动化执行引擎实例
export const globalAutomationEngine = new AutomationExecutionEngine(
  new ConfigurationManager(),
  new AdsPowerApiClient(),
  new UrlExtractionService(new AdsPowerApiClient()),
  new GoogleAdsApiClient(),
  new ExecutionRepository(),
  new NotificationService({})
);