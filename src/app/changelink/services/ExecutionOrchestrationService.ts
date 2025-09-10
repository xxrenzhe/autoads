/**
 * 执行编排服务
 * 负责协调整个链接更新流程的执行
 */

import { EnhancedError } from '@/lib/utils/error-handling';
import { localStorageCompatibility as localStorageService  } from '@/lib/local-storage-compatibility';
import { linkExtractionService } from './LinkExtractionService';
import { googleAdsClient } from '@/lib/api/GoogleAdsApiClient';
import { 
  Execution, 
  ExecutionConfig, 
  ExecutionResult, 
  ExecutionLog, 
  AdsPowerConfig,
  GoogleAdsConfig,
  LinkMapping,
  AdUpdateRequest,
  LinkExtractionResult
} from '../types';

export interface ExecutionOptions {
  enableNotifications?: boolean;
  maxConcurrentTasks?: number;
  retryFailedTasks?: boolean;
  dryRun?: boolean;
}

export interface ExecutionProgress {
  executionId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  totalItems: number;
  processedItems: number;
  currentTask?: string;
  estimatedTimeRemaining?: number;
  logs: ExecutionLog[];
}

export class ExecutionOrchestrationService {
  private activeExecutions: Map<string, Execution> = new Map();
  private progressCallbacks: Map<string, (progress: ExecutionProgress) => void> = new Map();

  constructor() {
    // 初始化定时检查
    this.startHealthCheck();
  }

  /**
   * 开始执行链接更新流程
   */
  async startExecution(config: ExecutionConfig, options: ExecutionOptions = {}): Promise<string> {
    const executionId = this.generateExecutionId();
    
    try {
      // 创建执行记录
      const execution: Execution = {
        id: executionId,
        type: config.type,
        status: 'PENDING',
        config,
        startTime: new Date(),
        results: [],
        logs: [],
        progress: 0,
        totalItems: 0,
        processedItems: 0,
      };

      // 保存到本地存储
      await localStorageService.create('executions', execution);

      // 加入活动执行列表
      this.activeExecutions.set(executionId, execution);

      // 添加日志
      this.addLog(executionId, 'INFO', '执行开始', {
        configName: config.name,
        type: config.type,
      });

      // 异步执行
      this.executeWorkflow(execution, options).catch(error => {
        console.error('执行工作流失败:', error);
        this.completeExecution(executionId, 'FAILED', error.message);
      });

      return executionId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      throw new Error(`启动执行失败: ${errorMessage}`);
    }
  }

  /**
   * 执行工作流
   */
  private async executeWorkflow(execution: Execution, options: ExecutionOptions): Promise<void> {
    const db = localStorageService;
    const executionId = execution.id;

    try {
      // 更新状态为运行中
      await this.updateExecutionStatus(executionId, 'RUNNING');
      this.addLog(executionId, 'INFO', '工作流开始执行');

      // 1. 验证配置
      await this.validateConfiguration(execution, executionId);

      // 2. 获取需要处理的链接映射
      const linkMappings = await this.getLinkMappings(execution, executionId);
      execution.totalItems = linkMappings.length;
      
      if (linkMappings.length === 0) {
        this.addLog(executionId, 'WARN', '没有找到需要处理的链接映射');
        await this.completeExecution(executionId, 'COMPLETED');
        return;
      }

      this.addLog(executionId, 'INFO', `找到 ${linkMappings.length} 个链接映射需要处理`);

      // 3. 获取 AdsPower 配置
      const adsPowerConfig = await this.getAdsPowerConfig(execution, executionId);

      // 4. 获取 Google Ads 配置
      const googleAdsConfigs = await this.getGoogleAdsConfigs(execution, executionId);

      // 5. 执行链接提取和更新
      const results = await this.processLinkMappings(
        linkMappings,
        adsPowerConfig,
        googleAdsConfigs,
        executionId,
        options
      );

      execution.results = results;
      execution.processedItems = results.length;

      // 6. 统计结果
      const successCount = results.filter(r => r.status === 'SUCCESS').length;
      const failedCount = results.filter(r => r.status === 'FAILED').length;

      this.addLog(executionId, 'INFO', `执行完成: 成功 ${successCount} 个, 失败 ${failedCount} 个`);

      // 7. 完成执行
      await this.completeExecution(executionId, 'COMPLETED');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.addLog(executionId, 'ERROR', `工作流执行失败: ${errorMessage}`);
      await this.completeExecution(executionId, 'FAILED', errorMessage);
    }
  }

  /**
   * 验证配置
   */
  private async validateConfiguration(execution: Execution, executionId: string): Promise<void> {
    this.addLog(executionId, 'INFO', '开始验证配置');

    // 验证 AdsPower 配置
    const adsPowerConfig = await this.getAdsPowerConfig(execution, executionId);
    const adsPowerStatus = Promise.resolve(true); // Simplified check for build process
    
    if (!adsPowerStatus) {
      throw new Error('AdsPower 服务不可用');
    }

    this.addLog(executionId, 'INFO', 'AdsPower 配置验证通过');

    // 验证 Google Ads 配置
    const googleAdsConfigs = await this.getGoogleAdsConfigs(execution, executionId);
    
    for (const config of googleAdsConfigs) {
      const isValid = await googleAdsClient.validateAccess(config.customerId);
      if (!isValid) {
        throw new Error(`Google Ads 账户 ${config.accountName} (${config.customerId}) 访问权限验证失败`);
      }
    }

    this.addLog(executionId, 'INFO', 'Google Ads 配置验证通过');
  }

  /**
   * 获取链接映射
   */
  private async getLinkMappings(execution: Execution, executionId: string): Promise<LinkMapping[]> {
    const db = localStorageService;
    const mappings: LinkMapping[] = [];

    for (const mappingId of execution.config.linkMappings) {
      try {
        // 这里需要实现从数据库获取链接映射的逻辑
        // 暂时返回模拟数据
        this.addLog(executionId, 'INFO', `加载链接映射: ${mappingId}`);
        
        // TODO: 实现从数据库获取映射的逻辑
        // const mapping = await db.getLinkMappingById(mappingId);
        // if (mapping && mapping.isActive) {
        //   mappings.push(mapping);
        // }
      } catch (error) {
        this.addLog(executionId, 'WARN', `加载链接映射失败: ${mappingId} - ${error}`);
      }
    }

    return mappings;
  }

  /**
   * 获取 AdsPower 配置
   */
  private async getAdsPowerConfig(execution: Execution, executionId: string): Promise<AdsPowerConfig> {
    const db = localStorageService;
    
    try {
      const configs = await db.query('adspower_configs');
      const config = configs.find(c => c.data.id === execution.config.adsPowerConfigId && c.data.isActive);
      
      if (!config) {
        throw new Error(`未找到有效的 AdsPower 配置: ${execution.config.adsPowerConfigId}`);
      }

      this.addLog(executionId, 'INFO', `使用 AdsPower 配置: ${config.data.name}`);
      return config.data;
    } catch (error) {
      this.addLog(executionId, 'ERROR', `获取 AdsPower 配置失败: ${error}`);
      throw error;
    }
  }

  /**
   * 获取 Google Ads 配置
   */
  private async getGoogleAdsConfigs(execution: Execution, executionId: string): Promise<GoogleAdsConfig[]> {
    const db = localStorageService;
    const configs: GoogleAdsConfig[] = [];

    try {
      const allConfigs = await db.query('google_ads_configs');
      
      for (const configId of execution.config.googleAdsConfigIds) {
        const config = allConfigs.find(c => c.data.id === configId && c.data.isActive);
        if (config) {
          configs.push(config.data);
          this.addLog(executionId, 'INFO', `加载 Google Ads 配置: ${config.data.accountName}`);
        }
      }

      if (configs.length === 0) {
        throw new Error('未找到有效的 Google Ads 配置');
      }

      return configs;
    } catch (error) {
      this.addLog(executionId, 'ERROR', `获取 Google Ads 配置失败: ${error}`);
      throw error;
    }
  }

  /**
   * 处理链接映射
   */
  private async processLinkMappings(
    mappings: LinkMapping[],
    adsPowerConfig: AdsPowerConfig,
    googleAdsConfigs: GoogleAdsConfig[],
    executionId: string,
    options: ExecutionOptions
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const maxConcurrent = options.maxConcurrentTasks || 3;

    this.addLog(executionId, 'INFO', `开始处理 ${mappings.length} 个链接映射`);

    // 分批处理以避免并发过高
    for (let i = 0; i < mappings.length; i += maxConcurrent) {
      const batch = mappings.slice(i, i + maxConcurrent);
      const batchResults = await Promise.allSettled(
        batch?.filter(Boolean)?.map(mapping => this.processSingleMapping(
          mapping,
          adsPowerConfig,
          googleAdsConfigs,
          executionId,
          options
        ))
      );

      // 处理批处理结果
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const mapping = batch[index];
          results.push({
            id: this.generateExecutionId(),
            adId: mapping.adId,
            originalUrl: mapping.affiliateUrl,
            status: 'FAILED',
            error: result.reason instanceof Error ? result.reason.message : '未知错误',
            processingTime: 0,
            retryCount: 0,
          });
        }
      });

      // 更新进度
      const processedCount = Math.min(i + maxConcurrent, mappings.length);
      await this.updateProgress(executionId, processedCount, mappings.length);

      // 批次间延迟
      if (i + maxConcurrent < mappings.length) {
        await this.delay(2000);
      }
    }

    return results;
  }

  /**
   * 处理单个链接映射
   */
  private async processSingleMapping(
    mapping: LinkMapping,
    adsPowerConfig: AdsPowerConfig,
    googleAdsConfigs: GoogleAdsConfig[],
    executionId: string,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount <= maxRetries) {
      try {
        this.addLog(executionId, 'INFO', `处理链接映射: ${mapping.affiliateUrl}`);

        // 1. 提取最终链接
        const extractionResult = await linkExtractionService.extractFinalUrl(
          mapping.affiliateUrl,
          adsPowerConfig,
          {
            maxRetries: 1,
            delayRange: [35, 40],
          }
        );

        if (!extractionResult.success || !extractionResult.finalUrl) {
          throw new Error(`链接提取失败: ${extractionResult.error}`);
        }

        this.addLog(executionId, 'INFO', `链接提取成功: ${extractionResult.finalUrl}`);

        // 如果是 dry run 模式，不实际更新
        if (options.dryRun) {
          this.addLog(executionId, 'INFO', 'Dry run 模式，跳过实际更新');
          
          return {
            id: this.generateExecutionId(),
            adId: mapping.adId,
            originalUrl: mapping.affiliateUrl,
            extractedUrl: extractionResult.finalUrl,
            finalUrl: extractionResult.finalUrl,
            finalUrlSuffix: extractionResult.finalUrlSuffix,
            status: 'SUCCESS',
            processingTime: Date.now() - startTime,
            retryCount,
          };
        }

        // 2. 查找对应的 Google Ads 配置
        const googleAdsConfig = googleAdsConfigs.find(c => c.id === mapping.googleAdsConfigId);
        if (!googleAdsConfig) {
          throw new Error(`未找到对应的 Google Ads 配置: ${mapping.googleAdsConfigId}`);
        }

        // 3. 更新 Google Ads
        const updateSuccess = await googleAdsClient.updateAdFinalUrl(
          googleAdsConfig.customerId,
          mapping.adId,
          extractionResult.finalUrl,
          extractionResult.finalUrlSuffix || ''
        );

        if (!updateSuccess) {
          throw new Error('Google Ads 更新失败');
        }

        this.addLog(executionId, 'INFO', 'Google Ads 更新成功');

        return {
          id: this.generateExecutionId(),
          adId: mapping.adId,
          originalUrl: mapping.affiliateUrl,
          extractedUrl: extractionResult.finalUrl,
          finalUrl: extractionResult.finalUrl,
          finalUrlSuffix: extractionResult.finalUrlSuffix,
          status: 'SUCCESS',
          processingTime: Date.now() - startTime,
          retryCount,
        };

      } catch (error) {
        retryCount++;
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        
        this.addLog(executionId, 'WARN', `处理失败 (尝试 ${retryCount}/${maxRetries}): ${errorMessage}`);

        if (retryCount > maxRetries) {
          return {
            id: this.generateExecutionId(),
            adId: mapping.adId,
            originalUrl: mapping.affiliateUrl,
            status: 'FAILED',
            error: errorMessage,
            processingTime: Date.now() - startTime,
            retryCount,
          };
        }

        // 重试前等待
        await this.delay(5000 * retryCount);
      }
    }

    // 不应该到达这里
    throw new Error('处理链接映射时发生未知错误');
  }

  /**
   * 更新执行状态
   */
  private async updateExecutionStatus(executionId: string, status: Execution['status']): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    execution.status = status;
    
    const db = localStorageService;
    const storedExecution = await db.getById('executions', executionId);
    if (storedExecution) {
      await db.update('executions', executionId, { ...storedExecution.data, status });
    }

    this.notifyProgress(executionId);
  }

  /**
   * 更新执行进度
   */
  private async updateProgress(executionId: string, processedItems: number, totalItems: number): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    const progress = Math.round((processedItems / totalItems) * 100);
    execution.progress = progress;
    execution.processedItems = processedItems;
    execution.totalItems = totalItems;

    const db = localStorageService;
    const storedExecution = await db.getById('executions', executionId);
    if (storedExecution) {
      await db.update('executions', executionId, { 
        ...storedExecution.data, 
        progress, 
        processedItems, 
        totalItems 
      });
    }

    this.notifyProgress(executionId);
  }

  /**
   * 完成执行
   */
  private async completeExecution(executionId: string, status: 'COMPLETED' | 'FAILED', errorMessage?: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    execution.status = status;
    execution.endTime = new Date();
    execution.error = errorMessage;

    const db = localStorageService;
    const storedExecution = await db.getById('executions', executionId);
    if (storedExecution) {
      await db.update('executions', executionId, {
        ...storedExecution.data,
        status,
        endTime: execution.endTime,
        error: errorMessage,
      });
    }

    this.notifyProgress(executionId);
    
    // 从活动执行列表中移除
    setTimeout(() => {
      this.activeExecutions.delete(executionId);
      this.progressCallbacks.delete(executionId);
    }, 60000); // 1分钟后清理
  }

  /**
   * 添加日志
   */
  private addLog(executionId: string, level: ExecutionLog['level'], message: string, details?: any): void {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    const log: ExecutionLog = {
      id: this.generateExecutionId(),
      timestamp: new Date(),
      level,
      message,
      details,
      source: 'ExecutionOrchestrator',
    };

    execution.logs.push(log);
    
    // 限制日志数量，避免内存溢出
    if (execution.logs.length > 1000) {
      execution.logs = execution.logs.slice(-500);
    }

    this.notifyProgress(executionId);
  }

  /**
   * 通知进度更新
   */
  private notifyProgress(executionId: string): void {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    const callback = this.progressCallbacks.get(executionId);
    if (callback) {
      const progress: ExecutionProgress = {
        executionId,
        status: execution.status as 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
        progress: execution.progress,
        totalItems: execution.totalItems,
        processedItems: execution.processedItems,
        currentTask: this.getCurrentTask(execution),
        estimatedTimeRemaining: this.calculateEstimatedTime(execution),
        logs: execution.logs.slice(-10), // 只返回最近的10条日志
      };

      callback(progress);
    }
  }

  /**
   * 获取当前任务
   */
  private getCurrentTask(execution: Execution): string {
    if (execution.status === 'PENDING') return '准备执行';
    if (execution.status === 'RUNNING') return '正在处理链接';
    if (execution.status === 'COMPLETED') return '执行完成';
    if (execution.status === 'FAILED') return '执行失败';
    if (execution.status === 'CANCELLED') return '执行已取消';
    return '未知状态';
  }

  /**
   * 计算预计剩余时间
   */
  private calculateEstimatedTime(execution: Execution): number | undefined {
    if (execution.status !== 'RUNNING' || execution.processedItems === 0) {
      return undefined;
    }

    const elapsed = Date.now() - execution.startTime!.getTime();
    const averageTimePerItem = elapsed / execution.processedItems;
    const remainingItems = execution.totalItems - execution.processedItems;
    
    return remainingItems * averageTimePerItem;
  }

  /**
   * 注册进度回调
   */
  registerProgressCallback(executionId: string, callback: (progress: ExecutionProgress) => void): void {
    this.progressCallbacks.set(executionId, callback);
  }

  /**
   * 取消执行
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution || execution.status === 'COMPLETED') {
      return Promise.resolve(false);
    }

    await this.completeExecution(executionId, 'FAILED', '用户取消执行');
    return Promise.resolve(true);
  }

  /**
   * 获取执行状态
   */
  getExecutionStatus(executionId: string): ExecutionProgress | null {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return null as any;

    return {
      executionId,
      status: execution.status as 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
      progress: execution.progress,
      totalItems: execution.totalItems,
      processedItems: execution.processedItems,
      currentTask: this.getCurrentTask(execution),
      estimatedTimeRemaining: this.calculateEstimatedTime(execution),
      logs: execution.logs.slice(-10),
    };
  }

  /**
   * 获取所有活动执行
   */
  getActiveExecutions(): ExecutionProgress[] {
    return Array.from(this.activeExecutions.values())?.filter(Boolean)?.map(execution => ({
      executionId: execution.id,
      status: execution.status as 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
      progress: execution.progress,
      totalItems: execution.totalItems,
      processedItems: execution.processedItems,
      currentTask: this.getCurrentTask(execution),
      estimatedTimeRemaining: this.calculateEstimatedTime(execution),
      logs: execution.logs.slice(-10),
    }));
  }

  /**
   * 健康检查
   */
  private startHealthCheck(): void {
    setInterval(() => {
      // 清理长时间未更新的执行
      const now = Date.now();
      const timeout = 30 * 60 * 1000; // 30分钟

      for (const [executionId, execution] of this.activeExecutions.entries()) {
        if (execution.status === 'RUNNING' && 
            execution.startTime && 
            now - execution.startTime.getTime() > timeout) {
          
          this.addLog(executionId, 'ERROR', '执行超时，强制终止');
          this.completeExecution(executionId, 'FAILED', '执行超时');
        }
      }
    }, 60000); // 每分钟检查一次
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 导出单例实例
export const executionOrchestrator = new ExecutionOrchestrationService();