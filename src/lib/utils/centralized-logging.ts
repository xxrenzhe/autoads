/**
 * Centralized Logging System
 * Integrates with unified error handling for consistent logging across the application
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import type { ILogger } from '@/lib/core/types';
import { BaseAppError, ErrorUtils } from './unified-error-handling';

// Log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

// Log entry structure
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  error?: BaseAppError;
  duration?: number;
  metadata?: Record<string, any>;
}

// Logger configuration
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableStructured: boolean;
  enablePerformanceTracking: boolean;
  maxLogEntries: number;
  logRetentionDays: number;
}

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  enableConsole: true,
  enableFile: true,
  enableStructured: true,
  enablePerformanceTracking: true,
  maxLogEntries: 10000,
  logRetentionDays: 30
};

export class CentralizedLogger {
  private static instance: CentralizedLogger;
  private config: LoggerConfig;
  private logEntries: LogEntry[] = [];
  private loggers: Map<string, ILogger> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize cleanup interval
    if (this.config.enableFile) {
      setInterval(() => this.cleanupOldLogs(), 24 * 60 * 60 * 1000); // Daily cleanup
    }
  }

  static getInstance(config?: Partial<LoggerConfig>): CentralizedLogger {
    if (!CentralizedLogger.instance) {
      CentralizedLogger.instance = new CentralizedLogger(config);
    }
    return CentralizedLogger.instance;
  }

  /**
   * Create or get a logger for a specific category
   */
  getLogger(category: string): ILogger {
    if (!this.loggers.has(category)) {
      const logger = createLogger(category);
      this.loggers.set(category, logger);
    }
    return this.loggers.get(category)!;
  }

  /**
   * Log an error with full context
   */
  error(
    message: string,
    error?: Error | BaseAppError | unknown,
    context?: {
      category?: string;
      userId?: string;
      sessionId?: string;
      requestId?: string;
      data?: any;
      metadata?: Record<string, any>;
    }
  ): void {
    const category = context?.category || 'Application';
    const logger = this.getLogger(category);

    // Convert error to BaseAppError if needed
    let appError: BaseAppError | undefined;
    if (error instanceof BaseAppError) {
      appError = error;
    } else if (error instanceof Error) {
      appError = ErrorUtils.fromUnknown(error, category);
    } else if (error) {
      appError = ErrorUtils.fromUnknown(error, category);
    }

    // Create log entry
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      category,
      message,
      error: appError,
      userId: context?.userId,
      sessionId: context?.sessionId,
      requestId: context?.requestId,
      data: context?.data,
      metadata: context?.metadata
    };

    this.addLogEntry(entry);

    // Log using secure logger
    if (appError) {
      logger.error(message, error instanceof Error ? error : new Error(String(error)), {
        ...context?.data,
        ...context?.metadata,
        code: appError.code,
        statusCode: appError.statusCode
      });
    } else {
      logger.error(message, undefined, {
        ...context?.data,
        ...context?.metadata
      });
    }
  }

  /**
   * Log a warning
   */
  warn(
    message: string,
    context?: {
      category?: string;
      userId?: string;
      data?: any;
      metadata?: Record<string, any>;
    }
  ): void {
    const category = context?.category || 'Application';
    const logger = this.getLogger(category);

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      category,
      message,
      userId: context?.userId,
      data: context?.data,
      metadata: context?.metadata
    };

    this.addLogEntry(entry);
    logger.warn(message, { ...context?.data, ...context?.metadata });
  }

  /**
   * Log an info message
   */
  info(
    message: string,
    context?: {
      category?: string;
      userId?: string;
      data?: any;
      metadata?: Record<string, any>;
    }
  ): void {
    const category = context?.category || 'Application';
    const logger = this.getLogger(category);

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      category,
      message,
      userId: context?.userId,
      data: context?.data,
      metadata: context?.metadata
    };

    this.addLogEntry(entry);
    logger.info(message, { ...context?.data, ...context?.metadata });
  }

  /**
   * Log a debug message
   */
  debug(
    message: string,
    context?: {
      category?: string;
      userId?: string;
      data?: any;
      metadata?: Record<string, any>;
    }
  ): void {
    if (this.config.level < LogLevel.DEBUG) return;

    const category = context?.category || 'Application';
    const logger = this.getLogger(category);

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      category,
      message,
      userId: context?.userId,
      data: context?.data,
      metadata: context?.metadata
    };

    this.addLogEntry(entry);
    logger.debug(message, { ...context?.data, ...context?.metadata });
  }

  /**
   * Log a trace message
   */
  trace(
    message: string,
    context?: {
      category?: string;
      userId?: string;
      data?: any;
      metadata?: Record<string, any>;
    }
  ): void {
    if (this.config.level < LogLevel.TRACE) return;

    const category = context?.category || 'Application';
    const logger = this.getLogger(category);

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.TRACE,
      category,
      message,
      userId: context?.userId,
      data: context?.data,
      metadata: context?.metadata
    };

    this.addLogEntry(entry);
    logger.debug(`[TRACE] ${message}`, { ...context?.data, ...context?.metadata });
  }

  /**
   * Log performance metrics
   */
  performance(
    operation: string,
    duration: number,
    context?: {
      category?: string;
      userId?: string;
      success?: boolean;
      data?: any;
    }
  ): void {
    if (!this.config.enablePerformanceTracking) return;

    const category = context?.category || 'Performance';
    const logger = this.getLogger(category);

    // Store metric for aggregation
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    const metrics = this.performanceMetrics.get(operation)!;
    metrics.push(duration);

    // Keep only recent metrics (last 1000)
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      category,
      message: `Performance: ${operation}`,
      duration,
      userId: context?.userId,
      data: {
        operation,
        duration,
        success: context?.success !== false,
        ...context?.data
      }
    };

    this.addLogEntry(entry);
    logger.info(`Performance: ${operation} took ${duration}ms`, {
      operation,
      duration,
      success: context?.success,
      ...context?.data
    });
  }

  /**
   * Log security events
   */
  security(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    context?: {
      category?: string;
      userId?: string;
      sessionId?: string;
      requestId?: string;
      data?: any;
    }
  ): void {
    const category = context?.category || 'Security';
    const logger = this.getLogger(category);

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      category,
      message: `SECURITY [${severity.toUpperCase()}] ${event}: ${message}`,
      userId: context?.userId,
      sessionId: context?.sessionId,
      requestId: context?.requestId,
      data: {
        event,
        severity,
        ...context?.data
      }
    };

    this.addLogEntry(entry);
    logger.warn(`Security: ${event} - ${message}`, {
      event,
      severity,
      ...context?.data
    });
  }

  /**
   * Get aggregated performance metrics
   */
  getPerformanceMetrics(operation?: string): Record<string, any> {
    const result: Record<string, any> = {};

    const operations = operation ? [operation] : Array.from(this.performanceMetrics.keys());

    for (const op of operations) {
      const metrics = this.performanceMetrics.get(op) || [];
      if (metrics.length === 0) continue;

      const sorted = [...metrics].sort((a, b) => a - b);
      const sum = metrics.reduce((a, b) => a + b, 0);
      
      result[op] = {
        count: metrics.length,
        avg: sum / metrics.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)]
      };
    }

    return result;
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(level?: LogLevel, category?: string, limit: number = 100): LogEntry[] {
    let filtered = this.logEntries;

    if (level !== undefined) {
      filtered = filtered.filter(entry => entry.level <= level);
    }

    if (category) {
      filtered = filtered.filter(entry => entry.category === category);
    }

    return filtered.slice(-limit);
  }

  /**
   * Search logs
   */
  searchLogs(query: {
    level?: LogLevel;
    category?: string;
    message?: string;
    userId?: string;
    requestId?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): LogEntry[] {
    let filtered = this.logEntries;

    if (query.level !== undefined) {
      filtered = filtered.filter(entry => entry.level <= query.level!);
    }

    if (query.category) {
      filtered = filtered.filter(entry => entry.category === query.category);
    }

    if (query.message) {
      filtered = filtered.filter(entry => 
        entry.message.toLowerCase().includes(query.message!.toLowerCase())
      );
    }

    if (query.userId) {
      filtered = filtered.filter(entry => entry.userId === query.userId);
    }

    if (query.requestId) {
      filtered = filtered.filter(entry => entry.requestId === query.requestId);
    }

    if (query.startTime) {
      filtered = filtered.filter(entry => 
        new Date(entry.timestamp) >= query.startTime!
      );
    }

    if (query.endTime) {
      filtered = filtered.filter(entry => 
        new Date(entry.timestamp) <= query.endTime!
      );
    }

    const limit = query.limit || 100;
    return filtered.slice(-limit);
  }

  /**
   * Export logs
   */
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    const logs = this.logEntries;

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    if (format === 'csv') {
      const headers = [
        'timestamp', 'level', 'category', 'message', 'userId', 
        'sessionId', 'requestId', 'duration', 'data'
      ];
      
      const rows = logs.map(log => [
        log.timestamp,
        LogLevel[log.level],
        log.category,
        `"${log.message.replace(/"/g, '""')}"`,
        log.userId || '',
        log.sessionId || '',
        log.requestId || '',
        log.duration || '',
        log.data ? `"${JSON.stringify(log.data).replace(/"/g, '""')}"` : ''
      ]);

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Add log entry with size limit
   */
  private addLogEntry(entry: LogEntry): void {
    this.logEntries.push(entry);

    // Maintain size limit
    if (this.logEntries.length > this.config.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-this.config.maxLogEntries);
    }
  }

  /**
   * Clean up old log entries
   */
  private cleanupOldLogs(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.logRetentionDays);

    this.logEntries = this.logEntries.filter(entry => 
      new Date(entry.timestamp) > cutoffDate
    );

    // Clean up old performance metrics
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const [operation, metrics] of this.performanceMetrics.entries()) {
      const recentMetrics = metrics.filter(timestamp => timestamp > oneWeekAgo);
      if (recentMetrics.length !== metrics.length) {
        this.performanceMetrics.set(operation, recentMetrics);
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const centralizedLogger = CentralizedLogger.getInstance();

// Convenience functions
export const log = {
  error: (message: string, error?: Error | unknown, context?: any) =>
    centralizedLogger.error(message, error, context),
  
  warn: (message: string, context?: any) =>
    centralizedLogger.warn(message, context),
  
  info: (message: string, context?: any) =>
    centralizedLogger.info(message, context),
  
  debug: (message: string, context?: any) =>
    centralizedLogger.debug(message, context),
  
  trace: (message: string, context?: any) =>
    centralizedLogger.trace(message, context),
  
  performance: (operation: string, duration: number, context?: any) =>
    centralizedLogger.performance(operation, duration, context),
  
  security: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', message: string, context?: any) =>
    centralizedLogger.security(event, severity, message, context)
};

// Create category-specific loggers
export function createCategoryLogger(category: string) {
  return {
    error: (message: string, error?: Error | unknown, context?: Omit<any, 'category'>) =>
      centralizedLogger.error(message, error, { ...context, category }),
    
    warn: (message: string, context?: Omit<any, 'category'>) =>
      centralizedLogger.warn(message, { ...context, category }),
    
    info: (message: string, context?: Omit<any, 'category'>) =>
      centralizedLogger.info(message, { ...context, category }),
    
    debug: (message: string, context?: Omit<any, 'category'>) =>
      centralizedLogger.debug(message, { ...context, category }),
    
    trace: (message: string, context?: Omit<any, 'category'>) =>
      centralizedLogger.trace(message, { ...context, category }),
    
    performance: (operation: string, duration: number, context?: Omit<any, 'category'>) =>
      centralizedLogger.performance(operation, duration, { ...context, category }),
    
    security: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', message: string, context?: Omit<any, 'category'>) =>
      centralizedLogger.security(event, severity, message, { ...context, category })
  };
}