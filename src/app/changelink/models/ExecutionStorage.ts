// 执行结果存储服务 - 专门处理执行结果数据的存储

import { ExecutionResult } from '../types';
import { StorageManager, StorageOptions } from './StorageManager';
import { deepClone } from '../utils';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('ExecutionStorage');


export interface ExecutionStorageOptions {
  encrypt?: boolean;
  maxExecutions?: number;
  retentionDays?: number;
  compress?: boolean;
}

export class ExecutionStorage {
  private static readonly STORAGE_KEY = 'executions';
  private static readonly INDEX_KEY = 'execution_index';
  private static readonly NAMESPACE = 'google_ads_automation_exec';
  
  private storageManager: StorageManager;
  private options: Required<ExecutionStorageOptions>;

  constructor(options: ExecutionStorageOptions = {}) {
    this.storageManager = new StorageManager(ExecutionStorage.NAMESPACE);
    this.options = {
      encrypt: options.encrypt ?? false,
      maxExecutions: options.maxExecutions ?? 1000,
      retentionDays: options.retentionDays ?? 30,
      compress: options.compress ?? true
    };
  }

  /**
   * 保存执行结果
   */
  async saveExecution(execution: ExecutionResult): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // 获取当前执行列表
      const executions = await this.loadExecutions();
      
      // 查找是否已存在
      const existingIndex = executions.findIndex(e => e.executionId === execution.executionId);
      
      if (existingIndex >= 0) {
        executions[existingIndex] = execution;
      } else {
        executions.unshift(execution); // 新执行记录放在最前面
      }

      // 限制执行记录数量
      if (executions.length > this.options.maxExecutions) {
        executions.splice(this.options.maxExecutions);
      }

      // 保存执行列表
      const result = await this.saveExecutions(executions);
      if (!result.success) {
        return result;
      }

      // 更新索引
      await this.updateExecutionIndex(execution);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存执行结果失败'
      };
    }
  }

  /**
   * 加载所有执行结果
   */
  async loadExecutions(): Promise<ExecutionResult[]> { 
    try {
      const executions = await this.storageManager.getItem<ExecutionResult[]>(
        ExecutionStorage.STORAGE_KEY,
        [],
        { namespace: ExecutionStorage.NAMESPACE });
      if (!executions) {
        return [];
      }

      // 转换日期字符串为Date对象
      return executions?.filter(Boolean)?.map(execution => ({
        ...execution,
        startTime: execution.startTime ? new Date(execution.startTime) : new Date(),
        endTime: execution.endTime ? new Date(execution.endTime) : undefined,
        errors: execution.errors?.filter(Boolean)?.map(error => ({
          ...error,
          timestamp: new Date(error.timestamp)
        })) || [],
        adUpdateResults: execution.adUpdateResults?.filter(Boolean)?.map(result => ({
          ...result,
          timestamp: new Date(result.timestamp)
        })) || [],
        googleAdsUpdates: execution.googleAdsUpdates?.filter(Boolean)?.map(update => ({
          ...update,
          timestamp: new Date(update.timestamp)
        })) || [],
        stepResults: execution.stepResults?.filter(Boolean)?.map(step => ({
          ...step,
          startTime: new Date(step.startTime),
          endTime: new Date(step.endTime)
        })) || []
      }));
    } catch (error) { 
      logger.error('加载执行结果失败:', new EnhancedError('加载执行结果失败:', { error: error instanceof Error ? error.message : String(error)  }));
      return [];
    }
  }

  /**
   * 保存执行列表
   */
  private async saveExecutions(executions: ExecutionResult[]): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const storageOptions: StorageOptions = {
        encrypt: this.options.encrypt,
        compress: this.options.compress,
        namespace: ExecutionStorage.NAMESPACE
      };

      return await this.storageManager.setItem(
        ExecutionStorage.STORAGE_KEY,
        executions,
        storageOptions
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存执行列表失败'
      };
    }
  }

  /**
   * 获取单个执行结果
   */
  async getExecution(executionId: string): Promise<ExecutionResult | null> {
    try {
      const executions = await this.loadExecutions();
      const execution = executions.find(e => e.executionId === executionId);
      return execution ? deepClone(execution) : null;
    } catch (error) { 
      logger.error('获取执行结果失败:', new EnhancedError('获取执行结果失败:', { error: error instanceof Error ? error.message : String(error)  }));
      return null as any;
    }
  }

  /**
   * 根据配置ID获取执行结果
   */
  async getExecutionsByConfiguration(
    configurationId: string,
    limit: number = 50
  ): Promise<ExecutionResult[]> {
    try {
      const executions = await this.loadExecutions();
      return executions
        .filter(e => e.configurationId === configurationId)
        .slice(0, limit)
        ?.filter(Boolean)?.map(e => deepClone(e));
    } catch (error) { 
      logger.error('根据配置ID获取执行结果失败:', new EnhancedError('根据配置ID获取执行结果失败:', { error: error instanceof Error ? error.message : String(error)  }));
      return [];
    }
  }

  /**
   * 获取最近的执行结果
   */
  async getRecentExecutions(limit: number = 20): Promise<ExecutionResult[]> {
    try {
      const executions = await this.loadExecutions();
      return executions
        .slice(0, limit)
        ?.filter(Boolean)?.map(e => deepClone(e));
    } catch (error) { 
      logger.error('获取最近执行结果失败:', new EnhancedError('获取最近执行结果失败:', { error: error instanceof Error ? error.message : String(error)  }));
      return [];
    }
  }

  /**
   * 获取正在运行的执行结果
   */
  async getRunningExecutions(): Promise<ExecutionResult[]> {
    try {
      const executions = await this.loadExecutions();
      return executions
        .filter(e => e.status === 'running')
        ?.filter(Boolean)?.map(e => deepClone(e));
    } catch (error) { 
      logger.error('获取运行中执行结果失败:', new EnhancedError('获取运行中执行结果失败:', { error: error instanceof Error ? error.message : String(error)  }));
      return [];
    }
  }

  /**
   * 删除执行结果
   */
  async deleteExecution(executionId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const executions = await this.loadExecutions();
      const filteredExecutions = executions.filter(e => e.executionId !== executionId);

      if (filteredExecutions.length === executions.length) {
        return {
          success: false,
          error: '执行结果不存在'
        };
      }

      const result = await this.saveExecutions(filteredExecutions);
      if (!result.success) {
        return result;
      }

      // 更新索引
      await this.removeFromExecutionIndex(executionId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除执行结果失败'
      };
    }
  }

  /**
   * 批量删除执行结果
   */
  async deleteExecutions(executionIds: string[]): Promise<{
    success: boolean;
    deletedCount: number;
    error?: string;
  }> {
    try {
      const executions = await this.loadExecutions();
      const idsToDelete = new Set(executionIds);
      const filteredExecutions = executions.filter(e => !idsToDelete.has(e.executionId!));

      const deletedCount = executions.length - filteredExecutions.length;

      if (deletedCount === 0) {
        return {
          success: true,
          deletedCount: 0
        };
      }

      const result = await this.saveExecutions(filteredExecutions);
      if (!result.success) {
        return {
          success: false,
          deletedCount: 0,
          error: result.error
        };
      }

      // 批量更新索引
      for (const executionId of executionIds) {
        await this.removeFromExecutionIndex(executionId);
      }

      return {
        success: true,
        deletedCount
      };
    } catch (error) {
      return {
        success: false,
        deletedCount: 0,
        error: error instanceof Error ? error.message : '批量删除执行结果失败'
      };
    }
  }

  /**
   * 清理过期的执行结果
   */
  async cleanupExpiredExecutions(): Promise<{
    success: boolean;
    deletedCount: number;
    freedBytes: number;
    error?: string;
  }> { 
    try {
      const executions = await this.loadExecutions();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.options.retentionDays);

      const validExecutions = executions.filter(execution => {
        // 保留正在运行的执行记录
        if (execution.status === 'running') return Promise.resolve(true);
        
        // 保留最近的执行记录
        return execution.startTime ? execution.startTime >= cutoffDate : false;
      });
      // 如果记录数量仍然超过限制，保留最新的记录
      if (validExecutions.length > this.options.maxExecutions) {
        validExecutions.splice(this.options.maxExecutions);
      }

      const deletedCount = executions.length - validExecutions.length;

      if (deletedCount === 0) {
        return {
          success: true,
          deletedCount: 0,
          freedBytes: 0
        };
      }

      // 估算释放的字节数
      const deletedExecutions = executions.slice(validExecutions.length);
      const freedBytes = JSON.stringify(deletedExecutions).length;

      const result = await this.saveExecutions(validExecutions);
      if (!result.success) {
        return {
          success: false,
          deletedCount: 0,
          freedBytes: 0,
          error: result.error
        };
      }

      return {
        success: true,
        deletedCount,
        freedBytes
      };
    } catch (error) {
      return {
        success: false,
        deletedCount: 0,
        freedBytes: 0,
        error: error instanceof Error ? error.message : '清理过期执行结果失败'
      };
    }
  }

  /**
   * 获取执行统计信息
   */
  async getExecutionStatistics(configurationId?: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    running: number;
    pending: number;
    successRate: number;
    avgExecutionTime: number;
    totalProcessedLinks: number;
    totalSuccessfulLinks: number;
    linkSuccessRate: number;
  }> {
    try {
      const executions = await this.loadExecutions();
      const filteredExecutions = configurationId 
        ? executions.filter(e => e.configurationId === configurationId)
        : executions;

      const total = filteredExecutions.length;
      const completed = filteredExecutions.filter(e => e.status === 'completed' || e.status === 'SUCCESS').length;
      const failed = filteredExecutions.filter(e => e.status === 'FAILED').length;
      const running = filteredExecutions.filter(e => e.status === 'running').length;
      const pending = filteredExecutions.filter(e => e.status === 'pending').length;

      // 计算成功率
      const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      // 计算平均执行时间
      const completedExecutions = filteredExecutions.filter(e => 
        (e.status === 'completed' || e.status === 'SUCCESS') && e.metrics?.totalExecutionTime && e.metrics.totalExecutionTime > 0
      );
      const avgExecutionTime = completedExecutions.length > 0
        ? Math.round(completedExecutions.reduce((sum, e) => sum + (e.metrics?.totalExecutionTime || 0), 0) / completedExecutions.length)
        : 0;

      // 计算总处理链接数
      const totalProcessedLinks = filteredExecutions.reduce((sum, e) => sum + (e.metrics?.totalLinks || 0), 0);
      const totalSuccessfulLinks = filteredExecutions.reduce((sum, e) => 
        sum + (e.metrics?.successfulLinks || 0), 0);

      return {
        total,
        completed,
        failed,
        running,
        pending,
        successRate,
        avgExecutionTime,
        totalProcessedLinks,
        totalSuccessfulLinks,
        linkSuccessRate: totalProcessedLinks > 0 
          ? Math.round((totalSuccessfulLinks / totalProcessedLinks) * 100) 
          : 0
      };
    } catch (error) { 
      logger.error('获取执行统计信息失败:', new EnhancedError('获取执行统计信息失败:', { error: error instanceof Error ? error.message : String(error)  }));
      return {
        total: 0,
        completed: 0,
        failed: 0,
        running: 0,
        pending: 0,
        successRate: 0,
        avgExecutionTime: 0,
        totalProcessedLinks: 0,
        totalSuccessfulLinks: 0,
        linkSuccessRate: 0
      };
    }
  }

  /**
   * 导出执行结果
   */
  async exportExecutions(
    configurationId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    success: boolean;
    data?: {
      executions: ExecutionResult[];
      metadata: {
        exportTime: string;
        configurationId?: string;
        dateRange?: {
          start: string;
          end: string;
        };
        count: number;
      };
    };
    error?: string;
  }> {
    try {
      let executions = await this.loadExecutions();

      // 按配置ID筛选
      if (configurationId) {
        executions = executions.filter(e => e.configurationId === configurationId);
      }

      // 按日期范围筛选
      if (startDate) {
        executions = executions.filter(e => e.startTime && e.startTime >= startDate);
      }
      if (endDate) {
        executions = executions.filter(e => e.startTime && e.startTime <= endDate);
      }

      const metadata: Record<string, unknown> = {
        exportTime: new Date().toISOString(),
        count: executions.length
      };

      if (configurationId) {
        metadata.configurationId = configurationId;
      }

      if (startDate || endDate) {
        metadata.dateRange = {
          start: startDate?.toISOString() || '',
          end: endDate?.toISOString() || ''
        };
      }

      return {
        success: true,
        data: {
          executions: executions?.filter(Boolean)?.map(e => deepClone(e)),
          metadata: metadata as { exportTime: string; configurationId?: string; dateRange?: { start: string; end: string; }; count: number; }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '导出执行结果失败'
      };
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<{
    success: boolean;
    stats?: {
      executionCount: number;
      totalSize: number;
      averageSize: number;
      oldestExecution?: Date;
      newestExecution?: Date;
      storageQuota: {
        used: number;
        available: number;
        percentage: number;
      };
    };
    error?: string;
  }> {
    try {
      const [executions, quota, storageStats] = await Promise.all([
        this.loadExecutions(),
        (this.storageManager as any).getStorageQuota(),
        (this.storageManager as any).getStorageStats(ExecutionStorage.NAMESPACE)
      ]);
      let oldestExecution: Date | undefined;
      if (executions.length > 0 && executions[executions.length - 1].startTime) {
        const startTime = executions[executions.length - 1].startTime;
        oldestExecution = startTime instanceof Date ? startTime : new Date(startTime as string | number | Date);
      }
      
      let newestExecution: Date | undefined;
      if (executions.length > 0 && executions[0].startTime) {
        const startTime = executions[0].startTime;
        newestExecution = startTime instanceof Date ? startTime : new Date(startTime as string | number | Date);
      }

      return {
        success: true,
        stats: {
          executionCount: executions.length,
          totalSize: storageStats.totalSize,
          averageSize: storageStats.averageSize,
          oldestExecution,
          newestExecution,
          storageQuota: {
            used: quota.used,
            available: quota.available,
            percentage: quota.percentage
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取存储统计失败'
      };
    }
  }

  /**
   * 更新执行索引
   */
  private async updateExecutionIndex(execution: ExecutionResult): Promise<void> {
    try {
      const index = await this.storageManager.getItem<Record<string, {
        configurationId: string;
        status: string;
        startTime: string;
      }>>(
        ExecutionStorage.INDEX_KEY,
        {},
        { namespace: ExecutionStorage.NAMESPACE });
      if (index) {
        const key = execution.executionId || execution.id;
        index[key] = {
          configurationId: execution.configurationId || '',
          status: execution.status,
          startTime: execution.startTime ? (execution.startTime instanceof Date ? execution.startTime.toISOString() : execution.startTime) : new Date().toISOString()
        };

        await this.storageManager.setItem(
          ExecutionStorage.INDEX_KEY,
          index,
          { namespace: ExecutionStorage.NAMESPACE });
      }
    } catch (error) {
      logger.warn('更新执行索引失败:');
    }
  }

  /**
   * 从执行索引中移除
   */
  private async removeFromExecutionIndex(executionId: string): Promise<void> {
    try {
      const index = await this.storageManager.getItem<Record<string, unknown>>(
        ExecutionStorage.INDEX_KEY,
        {},
        { namespace: ExecutionStorage.NAMESPACE });
      if (index && index[executionId]) { 
        delete index[executionId];

        await this.storageManager.setItem(
          ExecutionStorage.INDEX_KEY,
          index,
          { namespace: ExecutionStorage.NAMESPACE });
      }
    } catch (error) {
      logger.warn('从执行索引中移除失败:');
    }
  }

  /**
   * 清空所有执行结果（谨慎使用）
   */
  async clearAllExecutions(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await this.saveExecutions([]);
      if (!result.success) {
        return result;
      }

      // 清空索引
      await this.storageManager.setItem(
        ExecutionStorage.INDEX_KEY,
        {},
        { namespace: ExecutionStorage.NAMESPACE });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '清空执行结果失败'
      };
    }
  }
}