/**
 * Simple Concurrent Batch Executor
 * 简单的并发批量执行器 - 支持双层并发：轮次并发和URL并发
 * 
 * 设计原则：
 * 1. 简单易用，最小化复杂度
 * 2. 支持轮次级并发（多个轮次同时执行）
 * 3. 支持URL级并发（单个轮次内多个URL同时访问）
 * 4. 使用Promise.all和简单的并发控制
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { ProxyConfig } from '@/lib/utils/proxy-utils';
import { simpleHttpVisitor } from '@/lib/simple-http-visitor';
import { puppeteerVisitor } from '@/lib/puppeteer-visitor';
import { silentBatchTaskManager } from '@/lib/silent-batch-task-manager';
import { getReferer, getRandomUserAgent } from '@/lib/services/task-execution-service';

const logger = createLogger('SimpleConcurrentExecutor');

export interface SimpleConcurrentOptions {
  taskId: string;
  urls: string[];
  cycleCount: number;
  visitInterval: number; // URL之间的间隔（毫秒）
  roundInterval: number; // 轮次之间的间隔（毫秒）
  timeout: number;
  proxyPool: ProxyConfig[];
  referer?: string; // 保持兼容性，但建议使用 refererOption 和 customReferer
  refererOption?: 'social' | 'custom'; // 新增：referer选项
  selectedSocialMedia?: string; // 新增：选择的特定社交媒体
  customReferer?: string; // 新增：自定义referer
  
  // 并发配置
  enableRoundConcurrency?: boolean; // 是否启用轮次并发，默认false
  maxConcurrentRounds?: number; // 最大并发轮次数，默认3
  enableUrlConcurrency?: boolean; // 是否启用URL并发，默认false
  maxConcurrentUrls?: number; // 单轮次内最大并发URL数，默认5
  
  // IP验证配置
  verifyProxyIP?: boolean; // 是否验证代理IP一致性，默认false
  
  // 访问模式配置
  accessMode?: 'http' | 'puppeteer'; // 访问模式
  
  onProgress?: (progress: ProgressInfo) => void;
}

export interface ProgressInfo {
  completed: number;
  failed: number;
  total: number;
  currentRound: number;
  totalRounds: number;
  message: string;
}

export interface SimpleConcurrentResult {
  success: boolean;
  completed: number;
  failed: number;
  executionTime: number;
  errors: string[];
  performance: {
    totalRounds: number;
    concurrentRounds: boolean;
    concurrentUrls: boolean;
    averageRoundTime: number;
    averageUrlTime: number;
  };
}

/**
 * 简单的并发执行器
 */
export class SimpleConcurrentExecutor {
  private options: SimpleConcurrentOptions;
  private isStopped = false;
  private startTime = 0;
  private completed = 0;
  private failed = 0;
  private errors: string[] = [];
  private roundTimes: number[] = [];

  constructor(options: SimpleConcurrentOptions) {
    this.options = {
      enableRoundConcurrency: false,
      maxConcurrentRounds: 3, // 优化：提高轮次并发数
      enableUrlConcurrency: false,
      maxConcurrentUrls: 5, // 优化：提高URL并发数
      verifyProxyIP: false,
      referer: undefined as string | undefined, // 设置默认值
      refererOption: 'social', // 设置默认值
      customReferer: '', // 设置默认值
      onProgress: () => {},
      ...options
    } as SimpleConcurrentOptions;

    logger.info('简单并发执行器初始化', {
      urlsCount: this.options.urls.length,
      cycleCount: this.options.cycleCount,
      enableRoundConcurrency: this.options.enableRoundConcurrency,
      maxConcurrentRounds: this.options.maxConcurrentRounds,
      enableUrlConcurrency: this.options.enableUrlConcurrency,
      maxConcurrentUrls: this.options.maxConcurrentUrls
    });
  }

  /**
   * 开始执行
   */
  async start(): Promise<SimpleConcurrentResult> {
    this.startTime = Date.now();
    
    try {
      logger.info('开始并发执行', {
        mode: this.getExecutionMode(),
        totalVisits: this.options.urls.length * this.options.cycleCount
      });

      if (this.options.enableRoundConcurrency) {
        // 轮次并发模式
        await this.executeWithRoundConcurrency();
      } else {
        // 串行轮次模式（但轮次内可URL并发）
        await this.executeSerialRounds();
      }

      const executionTime = Date.now() - this.startTime;
      
      return {
        success: !this.isStopped,
        completed: this.completed,
        failed: this.failed,
        executionTime,
        errors: this.errors,
        performance: {
          totalRounds: this.options.cycleCount,
          concurrentRounds: this.options.enableRoundConcurrency ?? false,
          concurrentUrls: this.options.enableUrlConcurrency ?? false,
          averageRoundTime: this.roundTimes.length > 0 ? 
            this.roundTimes.reduce((a, b: any) => a + b, 0) / this.roundTimes.length : 0,
          averageUrlTime: executionTime / (this.completed + this.failed)
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('并发执行失败', error instanceof Error ? error : new Error(errorMessage));
      
      return {
        success: false,
        completed: this.completed,
        failed: this.failed,
        executionTime: Date.now() - this.startTime,
        errors: [...this.errors, errorMessage],
        performance: {
          totalRounds: this.options.cycleCount,
          concurrentRounds: this.options.enableRoundConcurrency ?? false,
          concurrentUrls: this.options.enableUrlConcurrency ?? false,
          averageRoundTime: 0,
          averageUrlTime: 0
        }
      };
    }
  }

  /**
   * 获取执行模式描述
   */
  private getExecutionMode(): string {
    if (this.options.enableRoundConcurrency && this.options.enableUrlConcurrency) {
      return '双层并发（轮次并发 + URL并发）';
    } else if (this.options.enableRoundConcurrency) {
      return '轮次并发';
    } else if (this.options.enableUrlConcurrency) {
      return 'URL并发（串行轮次）';
    } else {
      return '完全串行';
    }
  }

  /**
   * 轮次并发执行
   */
  private async executeWithRoundConcurrency(): Promise<void> {
    const rounds = Array.from({ length: this.options.cycleCount }, (_, i) => i);
    
    // 使用简单的并发控制
    const concurrencyLimit = this.options.maxConcurrentRounds ?? 2;
    const results: Promise<void>[] = [];
    
    for (let i = 0; i < rounds.length; i++) {
      if (this.isStopped) break;
      
      // 启动轮次
      const roundPromise = this.executeRound(rounds[i]);
      results.push(roundPromise);
      
      // 如果达到并发限制，等待一些完成
      if (results.length >= concurrencyLimit) {
        await Promise.race(results);
        // 移除已完成的
        const settled = await Promise.allSettled(results?.filter(Boolean)?.map((p: any) => p.then(() => true, () => false)));
        results.splice(0, settled.findIndex(s => s.status === 'fulfilled' && s.value) + 1);
      }
    }
    
    // 等待所有剩余轮次完成
    await Promise.all(results);
  }

  /**
   * 串行执行轮次
   */
  private async executeSerialRounds(): Promise<void> {
    for (let round = 0; round < this.options.cycleCount; round++) {
      if (this.isStopped) break;
      
      await this.executeRound(round);
      
      // 轮次间隔（除了最后一个）
      if (round < this.options.cycleCount - 1) {
        await new Promise(resolve => setTimeout(resolve, this.options.roundInterval));
      }
    }
  }

  /**
   * 执行单个轮次
   */
  private async executeRound(roundIndex: number): Promise<void> {
    const roundStartTime = Date.now();
    const proxy = this.options.proxyPool.length > 0 ? 
      this.options.proxyPool[roundIndex % this.options.proxyPool.length] : null;
    
    logger.info(`开始第 ${roundIndex + 1} 轮`, {
      proxy: proxy ? `${proxy.host}:${proxy.port}` : 'direct',
      mode: this.options.enableUrlConcurrency ? 'URL并发' : '串行',
      sessionId: proxy?.sessionId || null,
      taskId: this.options.taskId
    });

    if (this.options.enableUrlConcurrency) {
      // URL并发模式
      await this.executeUrlsConcurrently(roundIndex, proxy);
    } else {
      // URL串行模式
      await this.executeUrlsSerially(roundIndex, proxy);
    }

    // 记录轮次时间
    const roundTime = Date.now() - roundStartTime;
    this.roundTimes.push(roundTime);
    
    logger.info(`第 ${roundIndex + 1} 轮完成`, {
      time: `${roundTime}ms`,
      completed: this.completed,
      failed: this.failed
    });
  }

  /**
   * 并发执行URL
   */
  private async executeUrlsConcurrently(roundIndex: number, proxy: ProxyConfig | null): Promise<void> {
    const concurrencyLimit = this.options.maxConcurrentUrls ?? 3;
    const urlBatches: string[][] = [];
    
    // 将URL分批以控制并发
    for (let i = 0; i < this.options.urls.length; i += concurrencyLimit) {
      urlBatches.push(this.options.urls.slice(i, i + concurrencyLimit));
    }

    for (const batch of urlBatches) {
      if (this.isStopped) break;
      
      // 并发访问一批URL
      const promises = batch?.filter(Boolean)?.map((url: any) => this.visitSingleUrl(url, proxy, roundIndex));
      const results = await Promise.allSettled(promises);
      
      // 处理结果
      results.forEach((result: any) => {
        if (result.status === 'fulfilled') {
          if (result.value) {
            this.completed++;
          } else {
            this.failed++;
          }
        } else {
          this.failed++;
          this.errors.push(result.reason);
        }
      });
      
      // 批次间隔
      if (batch !== urlBatches[urlBatches.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, this.options.visitInterval));
      }
    }
  }

  /**
   * 串行执行URL
   */
  private async executeUrlsSerially(roundIndex: number, proxy: ProxyConfig | null): Promise<void> {
    for (let i = 0; i < this.options.urls.length; i++) {
      if (this.isStopped) break;
      
      const url = this.options.urls[i];
      const success = await this.visitSingleUrl(url, proxy, roundIndex);
      
      if (success) {
        this.completed++;
      } else {
        this.failed++;
      }
      
      // URL间隔（除了最后一个）
      if (i < this.options.urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, this.options.visitInterval));
      }
    }
  }

  /**
   * 访问单个URL
   */
  private async visitSingleUrl(url: string, proxy: ProxyConfig | null, roundIndex: number): Promise<boolean> {
    const visitStartTime = Date.now();
    const urlIndex = this.options.urls.indexOf(url);
    
    try {
      // 生成简单的浏览器标识
      const fingerprint = {
        userAgent: getRandomUserAgent(),
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br'
        }
      };
      
      // 动态获取referer（支持社交媒体轮询和特定选择）
      const referer = this.options.refererOption && this.options.refererOption !== 'custom' 
        ? getReferer(this.options.refererOption, this.options.customReferer, this.options.selectedSocialMedia)
        : this.options.referer;
      
      logger.info('🔗 开始访问URL', {
        taskId: this.options.taskId,
        url: url.substring(0, 80) + (url.length > 80 ? '...' : ''),
        urlIndex: urlIndex + 1,
        totalUrls: this.options.urls.length,
        roundIndex: roundIndex + 1,
        totalRounds: this.options.cycleCount,
        proxy: proxy ? `${proxy.host}:${proxy.port}` : 'direct',
        accessMode: this.options.accessMode || 'http',
        referer: referer || 'none',
        userAgent: fingerprint.userAgent.substring(0, 80) + '...'
      });
      
      // 根据访问模式选择访问器
      let result;
      
      if (this.options.accessMode === 'puppeteer') {
        // Puppeteer模式
        result = await puppeteerVisitor.visitUrl({
          url,
          proxy: proxy || undefined,
          referer,
          userAgent: fingerprint.userAgent,
          headers: fingerprint.headers,
          timeout: this.options.timeout || 120000
        });
      } else {
        // HTTP模式（默认）
        result = await simpleHttpVisitor.visitUrl({
          url,
          proxy: proxy || undefined,
          referer,
          userAgent: fingerprint.userAgent,
          timeout: this.options.timeout,
          headers: fingerprint.headers,
          verifyProxyIP: this.options.verifyProxyIP
        });
      }
      
      // 如果访问失败，记录错误
      if (!result.success && result.error) {
        this.errors.push(`轮次${roundIndex + 1}, ${url}: ${result.error}`);
      }
      
      const visitEndTime = Date.now();
      const visitDuration = visitEndTime - visitStartTime;
      
      // 记录访问结果
      logger.info(`✅ URL访问完成`, {
        taskId: this.options.taskId,
        url: url.substring(0, 60) + (url.length > 60 ? '...' : ''),
        success: result.success,
        visitTime: `${visitDuration}ms`,
        loadTime: result.loadTime ? `${result.loadTime}ms` : undefined,
        statusCode: 'statusCode' in result ? result.statusCode : undefined,
        roundIndex: roundIndex + 1,
        proxy: proxy ? `${proxy.host}:${proxy.port}` : 'direct',
        error: result.error ? result.error.substring(0, 100) + (result.error.length > 100 ? '...' : '') : undefined
      });
      
      // 更新进度
      await this.updateProgress(roundIndex + 1);
      
      return result.success;
      
    } catch (error) {
      const visitEndTime = Date.now();
      const visitDuration = visitEndTime - visitStartTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error(`❌ URL访问异常`, {
        taskId: this.options.taskId,
        url: url.substring(0, 60) + (url.length > 60 ? '...' : ''),
        error: errorMessage,
        visitTime: `${visitDuration}ms`,
        roundIndex: roundIndex + 1,
        proxy: proxy ? `${proxy.host}:${proxy.port}` : 'direct',
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        stackTrace: (error as Error).stack?.split('\n').slice(0, 3)
      });
      
      this.errors.push(`轮次${roundIndex + 1}, ${url}: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 更新进度
   */
  private async updateProgress(currentRound: number): Promise<void> {
    const updateStartTime = Date.now();
    const total = this.options.urls.length * this.options.cycleCount;
    const progress = Math.round(((this.completed + this.failed) / total) * 100);
    const successRate = total > 0 ? Math.round((this.completed / (this.completed + this.failed)) * 100) : 0;
    
    // 如果任务已停止，不再更新状态为 running
    if (this.isStopped) {
      logger.info('🛑 任务已停止，跳过进度更新', {
        taskId: this.options.taskId,
        completed: this.completed,
        failed: this.failed,
        total
      });
      return;
    }
    
    logger.info('📊 更新任务进度', {
      taskId: this.options.taskId,
      progress: `${progress}%`,
      completed: this.completed,
      failed: this.failed,
      total,
      successRate: `${successRate}%`,
      currentRound: `${currentRound}/${this.options.cycleCount}`,
      executionMode: this.getExecutionMode(),
      timeElapsed: `${Date.now() - this.startTime}ms`,
      estimatedRemaining: progress > 0 ? 
        Math.round((Date.now() - this.startTime) * (100 - progress) / progress) : 
        undefined
    });
    
    await silentBatchTaskManager.setTask(this.options.taskId, {
      status: 'running',
      progress: Math.max(1, progress),
      total,
      startTime: this.startTime,
      successCount: this.completed,
      failCount: this.failed,
      message: `批量访问中... (${this.completed}/${total}) [第${currentRound}轮]`,
      lastProgressUpdate: Date.now()
    });
    
    const updateEndTime = Date.now();
    
    if (this.options.onProgress) {
      this.options.onProgress({
        completed: this.completed,
        failed: this.failed,
        total,
        currentRound,
        totalRounds: this.options.cycleCount,
        message: `执行中...`
      });
    }
    
    // 记录进度更新耗时
    if (updateEndTime - updateStartTime > 100) {
      logger.warn('⚠️ 进度更新耗时较长', {
        taskId: this.options.taskId,
        updateTime: `${updateEndTime - updateStartTime}ms`,
        progress: `${progress}%`
      });
    }
  }

  /**
   * 停止执行
   */
  async stop(): Promise<void> {
    logger.info('停止并发执行');
    this.isStopped = true;
    
    // 更新任务状态为 terminated
    const total = this.options.urls.length * this.options.cycleCount;
    await silentBatchTaskManager.setTask(this.options.taskId, {
      status: 'terminated',
      progress: Math.round(((this.completed + this.failed) / total) * 100),
      total,
      startTime: this.startTime,
      endTime: Date.now(),
      successCount: this.completed,
      failCount: this.failed,
      message: `任务已终止 (${this.completed}/${total})`
    });
  }
}