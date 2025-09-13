/**
 * 统一日志管理器
 * 减少重复的 logger 创建，提供统一的日志管理
 */

import { createLogger } from '@/lib/utils/security/secure-logger';

type LoggerContext = string;
type LoggerInstance = ReturnType<typeof createLogger>;

class LoggerManager {
  private static instance: LoggerManager;
  private loggers: Map<LoggerContext, LoggerInstance> = new Map();
  
  private constructor() {}
  
  public static getInstance(): LoggerManager {
    if (!LoggerManager.instance) {
      LoggerManager.instance = new LoggerManager();
    }
    return LoggerManager.instance;
  }
  
  /**
   * 获取日志记录器实例
   */
  public getLogger(context: LoggerContext): LoggerInstance {
    if (!this.loggers.has(context)) {
      const logger = createLogger(context);
      this.loggers.set(context, logger);
    }
    return this.loggers.get(context)!;
  }
  
  /**
   * 预创建常用日志记录器
   */
  public preloadCommonLoggers(): void {
    const commonContexts = [
      'TaskExecutionService',
      'ProxyService',
      'PlaywrightService',
      'SilentBatchTaskManager',
      'OptimizedBatchVisitor',
      'API',
      'HealthCheck',
      'CacheService',
      'PerformanceMonitor'
    ];
    
    commonContexts.forEach((context: any) => {
      this.getLogger(context);
    });
  }
  
  /**
   * 清理所有日志记录器
   */
  public clear(): void {
    this.loggers.clear();
  }
  
  /**
   * 获取统计信息
   */
  public getStats(): { totalLoggers: number; contexts: string[] } {
    return {
      totalLoggers: this.loggers.size,
      contexts: Array.from(this.loggers.keys())
    };
  }
}

// 导出单例实例
export const loggerManager = LoggerManager.getInstance();

// 导出便捷函数
export function getLogger(context: string): LoggerInstance {
  return loggerManager.getLogger(context);
}

// 预加载常用日志记录器
if (typeof window === 'undefined') {
  loggerManager.preloadCommonLoggers();
}