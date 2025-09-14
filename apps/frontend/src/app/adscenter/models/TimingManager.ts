/**
 * 时间管理器 - 负责执行时间计算和性能监控
 */

export interface TimingInfo {
  startTime: Date;
  endTime?: Date;
  duration: number;
  isRunning: boolean;
}

export interface PerformanceMetrics {
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  count: number;
  lastUpdate: Date;
}

export class TimingManager {
  private timers: Map<string, TimingInfo> = new Map();
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();

  /**
   * 开始计时
   */
  startTimer(timerId: string): void {
    const timingInfo: TimingInfo = {
      startTime: new Date(),
      duration: 0,
      isRunning: true
    };
    
    this.timers.set(timerId, timingInfo);
  }

  /**
   * 停止计时
   */
  stopTimer(timerId: string): number {
    const timingInfo = this.timers.get(timerId);
    if (!timingInfo || !timingInfo.isRunning) {
      throw new Error(`Timer ${timerId} is not running`);
    }

    const endTime = new Date();
    const duration = endTime.getTime() - timingInfo.startTime.getTime();
    
    timingInfo.endTime = endTime;
    timingInfo.duration = duration;
    timingInfo.isRunning = false;

    // 更新性能指标
    this.updatePerformanceMetrics(timerId, duration);

    return duration;
  }

  /**
   * 获取计时器信息
   */
  getTimerInfo(timerId: string): TimingInfo | null {
    return this.timers.get(timerId) || null;
  }

  /**
   * 计算两个时间点之间的持续时间
   */
  calculateDuration(startTime: Date, endTime: Date): number {
    return endTime.getTime() - startTime.getTime();
  }

  /**
   * 格式化持续时间
   */
  formatDuration(duration: number): string {
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else if (seconds > 0) {
      return `${seconds}s ${duration % 1000}ms`;
    } else {
      return `${duration}ms`;
    }
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(timerId: string): PerformanceMetrics | null {
    return this.performanceMetrics.get(timerId) || null;
  }

  /**
   * 获取所有性能指标
   */
  getAllPerformanceMetrics(): Record<string, PerformanceMetrics> {
    const result: Record<string, PerformanceMetrics> = {};
    for (const [timerId, metrics] of this.performanceMetrics) {
      result[timerId] = metrics;
    }
    return result;
  }

  /**
   * 重置性能指标
   */
  resetPerformanceMetrics(timerId?: string): void {
    if (timerId) {
      this.performanceMetrics.delete(timerId);
    } else {
      this.performanceMetrics.clear();
    }
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(timerId: string, duration: number): void {
    const existing = this.performanceMetrics.get(timerId);
    
    if (existing) {
      existing.totalTime += duration;
      existing.count += 1;
      existing.averageTime = existing.totalTime / existing.count;
      existing.minTime = Math.min(existing.minTime, duration);
      existing.maxTime = Math.max(existing.maxTime, duration);
      existing.lastUpdate = new Date();
    } else {
      const newMetrics: PerformanceMetrics = {
        totalTime: duration,
        averageTime: duration,
        minTime: duration,
        maxTime: duration,
        count: 1,
        lastUpdate: new Date()
      };
      this.performanceMetrics.set(timerId, newMetrics);
    }
  }

  /**
   * 检查是否超时
   */
  isTimeout(startTime: Date, timeoutMs: number): boolean {
    const currentTime = new Date();
    const elapsed = currentTime.getTime() - startTime.getTime();
    return elapsed > timeoutMs;
  }

  /**
   * 获取剩余时间
   */
  getRemainingTime(startTime: Date, timeoutMs: number): number {
    const currentTime = new Date();
    const elapsed = currentTime.getTime() - startTime.getTime();
    return Math.max(0, timeoutMs - elapsed);
  }

  /**
   * 清理过期的计时器
   */
  cleanupExpiredTimers(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoffTime = new Date(Date.now() - maxAgeMs);
    let cleanedCount = 0;

    for (const [timerId, timingInfo] of this.timers) {
      if (timingInfo.startTime < cutoffTime) {
        this.timers.delete(timerId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * 获取所有活跃的计时器
   */
  getActiveTimers(): string[] {
    const activeTimers: string[] = [];
    for (const [timerId, timingInfo] of this.timers) {
      if (timingInfo.isRunning) {
        activeTimers.push(timerId);
      }
    }
    return activeTimers;
  }

  /**
   * 获取计时器统计信息
   */
  getTimerStats(): {
    total: number;
    active: number;
    completed: number;
    averageDuration: number;
  } {
    let total = 0;
    let active = 0;
    let completed = 0;
    let totalDuration = 0;

    for (const timingInfo of this.timers.values()) {
      total++;
      if (timingInfo.isRunning) {
        active++;
      } else {
        completed++;
        totalDuration += timingInfo.duration;
      }
    }

    return {
      total,
      active,
      completed,
      averageDuration: completed > 0 ? totalDuration / completed : 0
    };
  }
}