/**
 * Simplified Result Service
 * 简化的结果处理服务，整合任务结果管理和存储
 * @deprecated 结果与报表由后端提供；此处仅保留最小缓存兼容。
 */

import { getLogger } from '@/lib/core/logger-manager';
import { silentBatchTaskManager } from '@/lib/silent-batch-task-manager';

const logger = getLogger('ResultService');

export interface TaskResult {
  taskId: string;
  success: boolean;
  completed: number;
  failed: number;
  duration: number;
  errors: string[];
  errorSummary?: ErrorSummary;
  timestamp: number;
}

export interface ErrorSummary {
  totalErrors: number;
  byCategory: Record<string, number>;
  hasErrors: boolean;
  hasSignificantErrors: boolean;
  mostCommonError?: string;
}

export interface ResultQuery {
  taskId?: string;
  limit?: number;
  offset?: number;
  startTime?: number;
  endTime?: number;
  success?: boolean;
}

class ResultService {
  private static instance: ResultService;
  private results: Map<string, TaskResult> = new Map();
  
  private constructor() {}
  
  public static getInstance(): ResultService {
    if (!ResultService.instance) {
      ResultService.instance = new ResultService();
    }
    return ResultService.instance;
  }
  
  /**
   * 保存任务结果
   */
  public async saveResult(result: TaskResult): Promise<void> {
    try {
      this.results.set(result.taskId, result);
      logger.info('任务结果已保存', { 
        taskId: result.taskId,
        success: result.success,
        completed: result.completed,
        failed: result.failed,
        duration: result.duration
      });
      
      // 如果任务还在运行，更新最终状态
      const taskStatus = silentBatchTaskManager.getTask(result.taskId);
      if (taskStatus && taskStatus.status === 'running') {
        await silentBatchTaskManager.setTask(result.taskId, {
          ...taskStatus,
          status: result.success ? 'completed' : 'failed',
          endTime: Date.now(),
          successCount: result.completed,
          failCount: result.failed,
          message: result.success 
            ? `批量访问完成！成功: ${result.completed}, 失败: ${result.failed}`
            : `任务执行失败: ${result.errors[0] || '未知错误'}`
        });
      }
    } catch (error) {
      logger.error('保存任务结果失败', error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * 获取任务结果
   */
  public async getResult(taskId: string): Promise<TaskResult | null> {
    return this.results.get(taskId) || null;
  }
  
  /**
   * 查询任务结果
   */
  public async queryResults(query: ResultQuery): Promise<TaskResult[]> {
    let results = Array.from(this.results.values());
    
    // 按时间范围过滤
    if (query.startTime) {
      results = results.filter((r: any) => r.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      results = results.filter((r: any) => r.timestamp <= query.endTime!);
    }
    
    // 按成功状态过滤
    if (query.success !== undefined) {
      results = results.filter((r: any) => r.success === query.success);
    }
    
    // 按任务ID过滤
    if (query.taskId) {
      results = results.filter((r: any) => r.taskId === query.taskId);
    }
    
    // 按时间倒序排序
    results.sort((a, b) => b.timestamp - a.timestamp);
    
    // 分页
    if (query.offset) {
      results = results.slice(query.offset);
    }
    if (query.limit) {
      results = results.slice(0, query.limit);
    }
    
    return results;
  }
  
  /**
   * 删除任务结果
   */
  public async deleteResult(taskId: string): Promise<boolean> {
    const deleted = this.results.delete(taskId);
    if (deleted) {
      logger.info('任务结果已删除', { taskId });
    }
    return deleted;
  }
  
  /**
   * 清理旧结果
   */
  public async cleanup(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now();
    const cutoff = now - maxAge;
    let cleaned = 0;
    
    for (const [taskId, result] of this.results) {
      if (result.timestamp < cutoff) {
        this.results.delete(taskId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info('清理旧任务结果完成', { 
        cleaned,
        maxAge: `${maxAge / (60 * 60 * 1000)}小时`,
        remaining: this.results.size
      });
    }
    
    return cleaned;
  }
  
  /**
   * 获取统计信息
   */
  public async getStats(startTime?: number, endTime?: number): Promise<{
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    totalVisits: number;
    averageDuration: number;
    successRate: number;
  }> {
    let results = Array.from(this.results.values());
    
    // 按时间范围过滤
    if (startTime) {
      results = results.filter((r: any) => r.timestamp >= startTime);
    }
    if (endTime) {
      results = results.filter((r: any) => r.timestamp <= endTime);
    }
    
    const totalTasks = results.length;
    const successfulTasks = results.filter((r: any) => r.success).length;
    const failedTasks = totalTasks - successfulTasks;
    const totalVisits = results.reduce((sum, r: any) => sum + r.completed + r.failed, 0);
    const totalDuration = results.reduce((sum, r: any) => sum + r.duration, 0);
    const averageDuration = totalTasks > 0 ? totalDuration / totalTasks : 0;
    const successRate = totalTasks > 0 ? successfulTasks / totalTasks : 0;
    
    return {
      totalTasks,
      successfulTasks,
      failedTasks,
      totalVisits,
      averageDuration,
      successRate
    };
  }
  
  /**
   * 生成错误摘要
   */
  public generateErrorSummary(errors: string[]): ErrorSummary {
    const summary: ErrorSummary = {
      totalErrors: errors.length,
      byCategory: {},
      hasErrors: errors.length > 0,
      hasSignificantErrors: false,
      mostCommonError: undefined
    };

    if (errors.length === 0) {
      return summary;
    }

    // 按类别统计错误
    errors.forEach((error: any) => {
      const category = this.categorizeErrorForSummary(error);
      summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;
    });

    // 找出最常见的错误
    const categoryCounts = Object.entries(summary.byCategory);
    if (categoryCounts.length > 0) {
      const [mostCommonCategory, count] = categoryCounts.sort((a, b) => b[1] - a[1])[0];
      summary.mostCommonError = mostCommonCategory;
      
      // 判断是否有显著错误（超过20%的错误属于同一类别）
      const errorRate = count / errors.length;
      summary.hasSignificantErrors = errorRate > 0.2;
    }

    return summary;
  }
  
  /**
   * 为错误摘要分类错误
   */
  private categorizeErrorForSummary(error: string): string {
    const lowerError = error.toLowerCase();
    
    if (lowerError.includes('connection reset') || lowerError.includes('econnreset')) {
      return 'connection_reset';
    } else if (lowerError.includes('proxy') || lowerError.includes('socks')) {
      return 'proxy_related';
    } else if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
      return 'timeout';
    } else if (lowerError.includes('network') || lowerError.includes('fetch')) {
      return 'network_issue';
    } else if (lowerError.includes('script') || lowerError.includes('tiktok') || lowerError.includes('cdn')) {
      return 'third_party_resource';
    } else if (lowerError.includes('verification') || lowerError.includes('actual ip')) {
      return 'proxy_verification';
    } else {
      return 'other';
    }
  }
}

// 导出单例实例
export const resultService = ResultService.getInstance();

// 为了向后兼容，导出常用函数
export async function saveTaskResult(result: TaskResult): Promise<void> {
  return resultService.saveResult(result);
}

export async function getTaskResult(taskId: string): Promise<TaskResult | null> {
  return resultService.getResult(taskId);
}

export async function queryTaskResults(query: ResultQuery): Promise<TaskResult[]> {
  return resultService.queryResults(query);
}
