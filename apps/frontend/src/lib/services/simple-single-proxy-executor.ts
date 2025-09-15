/**
 * Simple single proxy executor
 * 简单的单代理执行器 - 替代已删除的策略服务
 * @deprecated 执行器逻辑已迁移至后端，仅保留以兼容历史导入。请不要在新代码中使用。
 */
import { createLogger } from '@/lib/utils/security/secure-logger';
import { SimpleConcurrentExecutor } from './simple-concurrent-executor';
import { silentBatchTaskManager } from '@/lib/silent-batch-task-manager';
import { ProxyConfig } from '@/lib/utils/proxy-utils';

const logger = createLogger('SimpleSingleProxyExecutor');

export interface SimpleSingleProxyOptions {
  taskId: string;
  urls: string[];
  cycleCount: number;
  proxyUrl: ProxyConfig;
  visitInterval: number;
  timeout: number;
  totalVisits: number;
  startTime: number;
  referer?: string;
  refererOption?: string;
  selectedSocialMedia?: string;
  customReferer?: string;
  verifyProxyIP?: boolean;
}

export interface SimpleSingleProxyResult {
  success: boolean;
  successCount: number;
  failCount: number;
  errors: string[];
  executionTime: number;
}

export class SimpleSingleProxyExecutor {
  private options: SimpleSingleProxyOptions;

  constructor(options: SimpleSingleProxyOptions) {
    this.options = options;
  }

  async start(): Promise<SimpleSingleProxyResult> {
    const startTime = Date.now();
    
    try {
      logger.info('开始单代理执行', {
        taskId: this.options.taskId,
        urlsCount: this.options.urls.length,
        cycleCount: this.options.cycleCount,
        proxy: `${this.options.proxyUrl.host}:${this.options.proxyUrl.port}`
      });

      // 使用SimpleConcurrentExecutor执行单代理任务
      const executor = new SimpleConcurrentExecutor({
        taskId: this.options.taskId,
        urls: this.options.urls,
        cycleCount: this.options.cycleCount,
        visitInterval: this.options.visitInterval,
        roundInterval: 1000,
        timeout: this.options.timeout,
        proxyPool: [this.options.proxyUrl], // 单代理池
        referer: this.options.referer,
        refererOption: this.options.refererOption as any,
        selectedSocialMedia: this.options.selectedSocialMedia,
        customReferer: this.options.customReferer,
        verifyProxyIP: this.options.verifyProxyIP,
        onProgress: async (progressInfo) => {
          const total = this.options.urls.length * this.options.cycleCount;
          const completed = progressInfo.completed;
          const progress = Math.round((completed / total) * 100);
          
          await silentBatchTaskManager.setTask(this.options.taskId, {
            status: 'running',
            progress: Math.max(1, progress),
            total,
            startTime: this.options.startTime,
            successCount: completed,
            failCount: progressInfo.failed,
            message: `单代理执行中... (${completed}/${total})`
          });
        }
      });
      
      const result = await executor.start();
      
      logger.info('单代理执行完成', {
        taskId: this.options.taskId,
        completed: result.completed,
        failed: result.failed,
        duration: result.executionTime,
        successRate: `${((result.completed / this.options.totalVisits) * 100).toFixed(1)}%`
      });
      
      return {
        success: true,
        successCount: result.completed,
        failCount: result.failed,
        errors: result.errors || [],
        executionTime: result.executionTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('单代理执行失败', new Error(errorMessage));
      
      return {
        success: false,
        successCount: 0,
        failCount: 0,
        errors: [errorMessage],
        executionTime: Date.now() - startTime
      };
    }
  }

  async destroy(): Promise<void> {
    // 清理资源（目前不需要特殊清理）
  }
}
