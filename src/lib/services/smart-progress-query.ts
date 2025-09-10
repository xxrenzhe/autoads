/**
 * 智能进度查询服务
 * 
 * 功能：
 * 1. 动态调整查询频率 - 基于任务状态和进度变化
 * 2. 客户端节流 - 避免过度频繁的查询
 * 3. 服务端优化 - 减少日志冗余
 * 4. 智能重连 - 连接失败时的指数退避
 */

interface ProgressQueryOptions {
  taskId: string;
  baseInterval: number; // 基础查询间隔（毫秒）
  maxInterval: number; // 最大查询间隔（毫秒）
  minInterval: number; // 最小查询间隔（毫秒）
  enableAdaptive: boolean; // 是否启用自适应调整
  timeout?: number; // 查询超时时间
}

interface ProgressQueryState {
  taskId: string;
  lastQueryTime: number;
  lastProgress: number;
  lastStatus: string;
  currentInterval: number;
  consecutiveSameProgress: number;
  queryCount: number;
  errorCount: number;
  isActive: boolean;
}

interface ProgressQueryResult {
  success: boolean;
  status: string;
  progress: number;
  successCount: number;
  failCount: number;
  message: string;
  timestamp: number;
  serverTime?: string;
}

const DEFAULT_OPTIONS: ProgressQueryOptions = {
  taskId: '',
  baseInterval: 3000, // 基础间隔3秒（减少频率）
  maxInterval: 30000, // 最大间隔30秒
  minInterval: 1000, // 最小间隔1秒
  enableAdaptive: true,
  timeout: 10000
};

class SmartProgressQueryService {
  private options: ProgressQueryOptions;
  private state: ProgressQueryState;
  private queryTimer: NodeJS.Timeout | null = null;
  private abortController: AbortController | null = null;
  private callbacks: Set<(result: ProgressQueryResult) => void> = new Set();
  
  constructor(options: Partial<ProgressQueryOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    
    if (!this.options.taskId) {
      throw new Error('taskId is required');
    }
    
    this.state = {
      taskId: this.options.taskId,
      lastQueryTime: 0,
      lastProgress: 0,
      lastStatus: '',
      currentInterval: this.options.baseInterval,
      consecutiveSameProgress: 0,
      queryCount: 0,
      errorCount: 0,
      isActive: false
    };
  }
  
  /**
   * 添加进度更新回调
   */
  onProgressUpdate(callback: (result: ProgressQueryResult) => void): () => void {
    this.callbacks.add(callback);
    
    // 返回取消函数
    return () => {
      this.callbacks.delete(callback);
    };
  }
  
  /**
   * 开始智能进度查询
   */
  start(): void {
    if (this.state.isActive) {
      console.warn('Progress query already active');
      return;
    }
    
    this.state.isActive = true;
    this.abortController = new AbortController();
    
    console.log(`🚀 开始智能进度查询`, {
      taskId: this.state.taskId,
      baseInterval: this.options.baseInterval,
      enableAdaptive: this.options.enableAdaptive
    });
    
    // 立即执行第一次查询
    this.executeQuery();
    
    // 启动定时查询
    this.scheduleNextQuery();
  }
  
  /**
   * 停止进度查询
   */
  stop(): void {
    if (!this.state.isActive) {
      return;
    }
    
    this.state.isActive = false;
    
    // 清理定时器
    if (this.queryTimer) {
      clearTimeout(this.queryTimer);
      this.queryTimer = null;
    }
    
    // 取消进行中的请求
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    console.log(`⏹️ 停止智能进度查询`, {
      taskId: this.state.taskId,
      totalQueries: this.state.queryCount,
      finalInterval: this.state.currentInterval
    });
  }
  
  /**
   * 调度下一次查询
   */
  private scheduleNextQuery(): void {
    if (!this.state.isActive) {
      return;
    }
    
    this.queryTimer = setTimeout(() => {
      this.executeQuery();
    }, this.state.currentInterval);
  }
  
  /**
   * 执行进度查询
   */
  private async executeQuery(): Promise<void> {
    if (!this.state.isActive) {
      return;
    }
    
    const startTime = Date.now();
    this.state.lastQueryTime = startTime;
    this.state.queryCount++;
    
    try {
      // 构建查询URL
      const url = new URL('/api/batchopen/silent-progress', window.location.origin);
      url.searchParams.append('taskId', this.state.taskId);
      
      // 添加时间戳防止缓存
      url.searchParams.append('_t', startTime.toString());
      
      // 设置超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Progress query timeout')), this.options.timeout);
      });
      
      // 执行查询
      const response = await Promise.race([
        fetch(url, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          signal: this.abortController?.signal
        }),
        timeoutPromise
      ]);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // 验证响应格式
      if (!this.validateProgressResult(result)) {
        throw new Error('Invalid progress response format');
      }
      
      // 更新状态
      this.updateQueryState(result);
      
      // 通知回调
      this.notifyCallbacks(result);
      
      // 调整查询间隔
      if (this.options.enableAdaptive) {
        this.adjustQueryInterval(result);
      }
      
      // 调度下一次查询
      this.scheduleNextQuery();
      
    } catch (error) {
      this.state.errorCount++;
      
      console.warn('Progress query failed:', {
        taskId: this.state.taskId,
        error: error instanceof Error ? error.message : String(error),
        queryCount: this.state.queryCount,
        errorCount: this.state.errorCount
      });
      
      // 错误处理：增加查询间隔（指数退避）
      this.handleQueryError(error instanceof Error ? error : new Error(String(error)));
      
      // 如果错误次数过多，停止查询
      if (this.state.errorCount >= 5) {
        console.error('Too many consecutive errors, stopping progress query', {
          taskId: this.state.taskId,
          errorCount: this.state.errorCount
        });
        this.stop();
        return;
      }
      
      // 继续调度下一次查询
      this.scheduleNextQuery();
    }
  }
  
  /**
   * 验证进度响应格式
   */
  private validateProgressResult(result: any): result is ProgressQueryResult {
    return (
      typeof result === 'object' &&
      typeof result.success === 'boolean' &&
      typeof result.status === 'string' &&
      typeof result.progress === 'number' &&
      typeof result.successCount === 'number' &&
      typeof result.failCount === 'number' &&
      typeof result.message === 'string' &&
      typeof result.timestamp === 'number'
    );
  }
  
  /**
   * 更新查询状态
   */
  private updateQueryState(result: ProgressQueryResult): void {
    const progressChanged = result.progress !== this.state.lastProgress;
    const statusChanged = result.status !== this.state.lastStatus;
    
    this.state.lastProgress = result.progress;
    this.state.lastStatus = result.status;
    
    // 重置错误计数
    if (this.state.errorCount > 0) {
      this.state.errorCount = Math.max(0, this.state.errorCount - 1);
    }
    
    // 更新连续相同进度计数
    if (progressChanged) {
      this.state.consecutiveSameProgress = 0;
    } else {
      this.state.consecutiveSameProgress++;
    }
    
    // 调试日志（减少频率）
    if (this.state.queryCount % 10 === 0 || progressChanged || statusChanged) {
      console.log(`📊 进度更新`, {
        taskId: this.state.taskId,
        progress: result.progress,
        status: result.status,
        queryCount: this.state.queryCount,
        interval: this.state.currentInterval,
        consecutiveSameProgress: this.state.consecutiveSameProgress
      });
    }
  }
  
  /**
   * 调整查询间隔 - 智能算法
   */
  private adjustQueryInterval(result: ProgressQueryResult): void {
    let newInterval = this.state.currentInterval;
    
    // 基于任务状态调整
    switch (result.status) {
      case 'completed':
      case 'failed':
      case 'terminated':
        // 任务已完成，停止查询
        console.log(`任务已完成或终止，停止查询`, {
          taskId: this.state.taskId,
          status: result.status
        });
        this.stop();
        return;
        
      case 'running':
        // 任务运行中，基于进度变化调整
        if (this.state.consecutiveSameProgress === 0) {
          // 进度有变化，使用较快间隔
          newInterval = Math.max(this.options.minInterval, this.options.baseInterval * 0.8);
        } else if (this.state.consecutiveSameProgress < 5) {
          // 短时间内无进度变化，保持当前间隔
          newInterval = this.state.currentInterval;
        } else if (this.state.consecutiveSameProgress < 10) {
          // 中等时间无进度变化，适当增加间隔
          newInterval = Math.min(this.options.maxInterval, this.state.currentInterval * 1.2);
        } else {
          // 长时间无进度变化，显著增加间隔
          newInterval = Math.min(this.options.maxInterval, this.state.currentInterval * 1.5);
        }
        break;
        
      case 'pending':
      case 'idle':
        // 任务等待中，使用较慢间隔
        newInterval = Math.min(this.options.maxInterval, this.options.baseInterval * 2);
        break;
        
      default:
        // 未知状态，使用默认间隔
        newInterval = this.options.baseInterval;
    }
    
    // 基于进度值调整（接近完成时更频繁查询）
    if (result.progress > 80 && result.status === 'running') {
      newInterval = Math.max(this.options.minInterval, newInterval * 0.7);
    }
    
    // 平滑间隔变化，避免剧烈跳动
    const maxChange = this.state.currentInterval * 0.3;
    newInterval = Math.max(
      this.state.currentInterval - maxChange,
      Math.min(this.state.currentInterval + maxChange, newInterval)
    );
    
    // 应用新间隔
    if (Math.abs(newInterval - this.state.currentInterval) > 100) {
      this.state.currentInterval = Math.round(newInterval);
      
      console.log(`📈 调整查询间隔`, {
        taskId: this.state.taskId,
        oldInterval: Math.round(this.state.currentInterval),
        newInterval: this.state.currentInterval,
        reason: `status=${result.status}, consecutiveSameProgress=${this.state.consecutiveSameProgress}`
      });
    }
  }
  
  /**
   * 处理查询错误
   */
  private handleQueryError(error: Error): void {
    // 指数退避
    const backoffFactor = Math.min(this.state.errorCount, 5);
    const newInterval = Math.min(
      this.options.maxInterval,
      this.state.currentInterval * Math.pow(1.5, backoffFactor)
    );
    
    this.state.currentInterval = Math.round(newInterval);
    
    console.warn(`⚠️ 查询错误，增加间隔`, {
      taskId: this.state.taskId,
      errorCount: this.state.errorCount,
      newInterval: this.state.currentInterval,
      error: error.message
    });
  }
  
  /**
   * 通知所有回调
   */
  private notifyCallbacks(result: ProgressQueryResult): void {
    this.callbacks.forEach(callback => {
      try {
        callback(result);
      } catch (callbackError) {
        console.error('Progress callback error:', callbackError);
      }
    });
  }
  
  /**
   * 获取当前状态
   */
  getState(): ProgressQueryState {
    return { ...this.state };
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    queryCount: number;
    errorCount: number;
    currentInterval: number;
    averageInterval: number;
    uptime: number;
  } {
    const uptime = this.state.isActive ? Date.now() - this.state.lastQueryTime : 0;
    const averageInterval = this.state.queryCount > 0 ? uptime / this.state.queryCount : 0;
    
    return {
      queryCount: this.state.queryCount,
      errorCount: this.state.errorCount,
      currentInterval: this.state.currentInterval,
      averageInterval: Math.round(averageInterval),
      uptime
    };
  }
}

// 导出单例工厂函数
export function createSmartProgressQuery(options: Partial<ProgressQueryOptions>): SmartProgressQueryService {
  return new SmartProgressQueryService(options);
}

// 导出类型供外部使用
export type { ProgressQueryOptions, ProgressQueryResult, ProgressQueryState };