/**
 * 进展状态一致性验证服务
 * 确保前后端进展状态的一致性和完整性
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { silentBatchTaskManager } from '@/lib/silent-batch-task-manager';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('ProgressConsistencyService');

// 进展状态验证结果
export interface ConsistencyCheckResult {
  taskId: string;
  isConsistent: boolean;
  frontendState?: ProgressState;
  backendState?: ProgressState;
  inconsistencies: Inconsistency[];
  timestamp: number;
  recommendations: string[];
}

// 进展状态
export interface ProgressState {
  progress: number;
  successCount: number;
  failCount: number;
  total: number;
  status: string;
  message: string;
  lastUpdate: number;
}

// 不一致类型
export interface Inconsistency {
  type: 'progress_mismatch' | 'count_mismatch' | 'status_mismatch' | 'stale_data' | 'corrupted_data';
  severity: 'low' | 'medium' | 'high' | 'critical';
  field: string;
  frontendValue?: any;
  backendValue?: any;
  description: string;
  recommendation: string;
}

// 验证配置
export interface ConsistencyValidationConfig {
  enabled: boolean;
  checkInterval: number;
  staleDataThreshold: number; // 毫秒
  autoRepair: boolean;
  maxInconsistencies: number;
}

// 默认配置
const defaultConfig: ConsistencyValidationConfig = {
  enabled: true,
  checkInterval: 30000, // 30秒
  staleDataThreshold: 60000, // 1分钟
  autoRepair: true,
  maxInconsistencies: 5
};

export class ProgressConsistencyService {
  private static instance: ProgressConsistencyService;
  private config: ConsistencyValidationConfig;
  private validationTimers: Map<string, NodeJS.Timeout> = new Map();
  private consistencyHistory: Map<string, ConsistencyCheckResult[]> = new Map();

  constructor(config: Partial<ConsistencyValidationConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  static getInstance(config?: Partial<ConsistencyValidationConfig>): ProgressConsistencyService {
    if (!ProgressConsistencyService.instance) {
      ProgressConsistencyService.instance = new ProgressConsistencyService(config);
    }
    return ProgressConsistencyService.instance;
  }

  /**
   * 验证前后端进展状态一致性
   */
  async validateConsistency(
    taskId: string,
    frontendState: ProgressState
  ): Promise<ConsistencyCheckResult> {
    const startTime = Date.now();
    
    try {
      // 获取后端状态
      const backendTask = silentBatchTaskManager.getTask(taskId);
      const backendState = backendTask ? this.transformTaskToState(backendTask) : null;

      const inconsistencies: Inconsistency[] = [];
      const recommendations: string[] = [];

      // 基本存在性检查
      if (!backendState) {
        const inconsistency: Inconsistency = {
          type: 'corrupted_data',
          severity: 'critical',
          field: 'task_existence',
          description: 'Backend task not found',
          recommendation: 'Task may have been cleaned up or lost. Consider restarting the task.'
        };
        inconsistencies.push(inconsistency);
        recommendations.push('检查任务是否存在，可能需要重新启动任务');
        
        return {
          taskId,
          isConsistent: false,
          frontendState,
          backendState: undefined,
          inconsistencies,
          timestamp: Date.now(),
          recommendations
        };
      }

      // 进度一致性检查
      if (Math.abs(frontendState.progress - backendState.progress) > 2) {
        const inconsistency: Inconsistency = {
          type: 'progress_mismatch',
          severity: 'medium',
          field: 'progress',
          frontendValue: frontendState.progress,
          backendValue: backendState.progress,
          description: `Progress mismatch: frontend=${frontendState.progress}%, backend=${backendState.progress}%`,
          recommendation: 'Use the latest progress value from backend'
        };
        inconsistencies.push(inconsistency);
        recommendations.push('进度不一致，建议使用后端的最新进度');
      }

      // 计数一致性检查
      if (frontendState.successCount !== backendState.successCount || 
          frontendState.failCount !== backendState.failCount) {
        const inconsistency: Inconsistency = {
          type: 'count_mismatch',
          severity: 'medium',
          field: 'counts',
          frontendValue: { success: frontendState.successCount, fail: frontendState.failCount },
          backendValue: { success: backendState.successCount, fail: backendState.failCount },
          description: 'Success/fail count mismatch between frontend and backend',
          recommendation: 'Sync counts with backend values'
        };
        inconsistencies.push(inconsistency);
        recommendations.push('成功/失败计数不一致，建议同步后端数据');
      }

      // 状态一致性检查
      if (frontendState.status !== backendState.status) {
        const inconsistency: Inconsistency = {
          type: 'status_mismatch',
          severity: 'high',
          field: 'status',
          frontendValue: frontendState.status,
          backendValue: backendState.status,
          description: `Status mismatch: frontend=${frontendState.status}, backend=${backendState.status}`,
          recommendation: 'Update frontend status to match backend'
        };
        inconsistencies.push(inconsistency);
        recommendations.push('任务状态不一致，建议更新前端状态');
      }

      // 数据新鲜度检查
      const now = Date.now();
      const frontendAge = now - frontendState.lastUpdate;
      const backendAge = now - backendState.lastUpdate;

      if (frontendAge > this.config.staleDataThreshold) {
        const inconsistency: Inconsistency = {
          type: 'stale_data',
          severity: 'medium',
          field: 'frontend_last_update',
          frontendValue: frontendState.lastUpdate,
          description: `Frontend data is stale: ${frontendAge}ms old`,
          recommendation: 'Refresh frontend data from backend'
        };
        inconsistencies.push(inconsistency);
        recommendations.push('前端数据过期，建议从后端刷新');
      }

      if (backendAge > this.config.staleDataThreshold) {
        const inconsistency: Inconsistency = {
          type: 'stale_data',
          severity: 'high',
          field: 'backend_last_update',
          backendValue: backendState.lastUpdate,
          description: `Backend data is stale: ${backendAge}ms old`,
          recommendation: 'Check if backend task is still running'
        };
        inconsistencies.push(inconsistency);
        recommendations.push('后端数据过期，建议检查任务是否仍在运行');
      }

      // 逻辑一致性检查
      const frontendTotal = frontendState.successCount + frontendState.failCount;
      const backendTotal = backendState.successCount + backendState.failCount;

      if (frontendTotal > frontendState.total) {
        const inconsistency: Inconsistency = {
          type: 'corrupted_data',
          severity: 'high',
          field: 'frontend_total_logic',
          frontendValue: { total: frontendState.total, actual: frontendTotal },
          description: 'Frontend total count inconsistent with success/fail sum',
          recommendation: 'Recalculate frontend progress data'
        };
        inconsistencies.push(inconsistency);
        recommendations.push('前端总数逻辑错误，建议重新计算进度数据');
      }

      if (backendTotal > backendState.total) {
        const inconsistency: Inconsistency = {
          type: 'corrupted_data',
          severity: 'critical',
          field: 'backend_total_logic',
          backendValue: { total: backendState.total, actual: backendTotal },
          description: 'Backend total count inconsistent with success/fail sum',
          recommendation: 'Recalculate backend progress data'
        };
        inconsistencies.push(inconsistency);
        recommendations.push('后端总数逻辑错误，建议重新计算进度数据');
      }

      const isConsistent = inconsistencies.length === 0;
      
      // 记录验证历史
      const result: ConsistencyCheckResult = {
        taskId,
        isConsistent,
        frontendState,
        backendState,
        inconsistencies,
        timestamp: Date.now(),
        recommendations
      };

      this.recordValidationResult(taskId, result);

      // 自动修复（如果启用）
      if (this.config.autoRepair && !isConsistent) {
        await this.attemptAutoRepair(taskId, result);
      }

      const duration = Date.now() - startTime;
      logger.info('Consistency validation completed', {
        taskId,
        isConsistent,
        inconsistencyCount: inconsistencies.length,
        duration,
        hasRecommendations: recommendations.length > 0
      });

      return result;

    } catch (error) {
      logger.error('Consistency validation failed', new EnhancedError('Consistency validation failed', { 
        taskId,
        error: error instanceof Error ? error.message : String(error)
       }));

      return {
        taskId,
        isConsistent: false,
        frontendState,
        inconsistencies: [{
          type: 'corrupted_data',
          severity: 'critical',
          field: 'validation_error',
          description: 'Validation failed due to error',
          recommendation: 'Retry validation or check system health'
        }],
        timestamp: Date.now(),
        recommendations: ['验证失败，请重试或检查系统状态']
      };
    }
  }

  /**
   * 启动定期一致性检查
   */
  startPeriodicValidation(
    taskId: string,
    getFrontendState: () => ProgressState
  ): void {
    if (!this.config.enabled) return;

    // 清理现有定时器
    this.stopPeriodicValidation(taskId);

    logger.info('Starting periodic consistency validation', { taskId });

    const timer = setInterval(async () => {
      try {
        const frontendState = getFrontendState();
        const result = await this.validateConsistency(taskId, frontendState);

        // 如果发现严重不一致，记录警告
        const criticalIssues = result.inconsistencies.filter((i: any) => i.severity === 'critical');
        if (criticalIssues.length > 0) {
          logger.warn('Critical consistency issues detected', {
            taskId,
            issues: criticalIssues,
            recommendations: result.recommendations
          });
        }

        // 如果不一致问题过多，停止验证
        if (result.inconsistencies.length > this.config.maxInconsistencies) {
          const errorObj = new Error('Too many inconsistencies detected, stopping validation');
          Object.assign(errorObj, {
            taskId,
            inconsistencyCount: result.inconsistencies.length,
            maxAllowed: this.config.maxInconsistencies
          });
          logger.error('Too many inconsistencies detected, stopping validation', errorObj);
          this.stopPeriodicValidation(taskId);
        }

      } catch (error) {
        logger.error('Periodic consistency validation failed', new EnhancedError('Periodic consistency validation failed', { 
          taskId,
          error: error instanceof Error ? error.message : String(error)
         }));
      }
    }, this.config.checkInterval);

    this.validationTimers.set(taskId, timer);
  }

  /**
   * 停止定期一致性检查
   */
  stopPeriodicValidation(taskId: string): void {
    const timer = this.validationTimers.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.validationTimers.delete(taskId);
      logger.info('Stopped periodic consistency validation', { taskId });
    }
  }

  /**
   * 记录验证结果
   */
  private recordValidationResult(taskId: string, result: ConsistencyCheckResult): void {
    if (!this.consistencyHistory.has(taskId)) {
      this.consistencyHistory.set(taskId, []);
    }

    const history = this.consistencyHistory.get(taskId)!;
    history.push(result);

    // 只保留最近50条记录
    if (history.length > 50) {
      history.shift();
    }
  }

  /**
   * 尝试自动修复
   */
  private async attemptAutoRepair(
    taskId: string,
    result: ConsistencyCheckResult
  ): Promise<void> {
    logger.info('Attempting auto-repair', { taskId, inconsistencies: result.inconsistencies.length });

    // 这里可以添加自动修复逻辑
    // 例如：发送事件通知前端更新状态，或者直接修复后端数据

    // 目前主要是记录日志，为后续扩展做准备
    const repairableIssues = result.inconsistencies.filter((i: any) => 
      i.type === 'progress_mismatch' || i.type === 'count_mismatch'
    );

    if (repairableIssues.length > 0) {
      logger.info('Found repairable issues', {
        taskId,
        repairableCount: repairableIssues.length,
        issues: repairableIssues
      });
    }
  }

  /**
   * 转换任务状态为统一格式
   */
  private transformTaskToState(task: any): ProgressState {
    return {
      progress: Math.max(1, task.progress || 0),
      successCount: task.successCount || 0,
      failCount: task.failCount || 0,
      total: task.total || 0,
      status: task.status || 'unknown',
      message: task.message || '',
      lastUpdate: task.lastProgressUpdate || task.updatedAt || Date.now()
    };
  }

  /**
   * 获取验证历史
   */
  getValidationHistory(taskId: string): ConsistencyCheckResult[] {
    return this.consistencyHistory.get(taskId) || [];
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const activeValidations = this.validationTimers.size;
    const totalHistory = Array.from(this.consistencyHistory.values())
      .reduce((sum, history: any) => sum + history.length, 0);

    return {
      enabled: this.config.enabled,
      activeValidations,
      totalHistoryRecords: totalHistory,
      config: this.config
    };
  }

  /**
   * 健康检查
   */
  isHealthy(): boolean {
    return this.config.enabled;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 停止所有定时器
    for (const [taskId, timer] of this.validationTimers.entries()) {
      clearInterval(timer);
    }
    this.validationTimers.clear();

    // 清理历史记录
    this.consistencyHistory.clear();

    logger.info('Progress consistency service cleaned up');
  }
}

// 导出单例实例
export const progressConsistencyService = ProgressConsistencyService.getInstance();