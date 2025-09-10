import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { logError } from '../utils/error-utils';
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('LoggingService');

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  category: string;
  userId?: string;
  sessionId?: string;
  jobId?: string;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
  correlationId?: string;
}

export interface AuditEntry {
  timestamp: Date;
  action: string;
  resource: string;
  userId?: string;
  sessionId?: string;
  jobId?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export interface PerformanceEntry {
  timestamp: Date;
  operation: string;
  duration: number;
  resourceUsage: {
    memory: number;
    cpu: number;
    networkLatency?: number;
  };
  success: boolean;
  metadata?: Record<string, unknown>;
}

export interface LoggingConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  maxFileSize: number;
  maxFiles: number;
  retentionDays: number;
  enableAuditTrail: boolean;
  enablePerformanceLogging: boolean;
  sensitiveFields: string[];
}

export class LoggingService {
  private config: LoggingConfig;
  private logs: LogEntry[] = [];
  private auditTrail: AuditEntry[] = [];
  private performanceLogs: PerformanceEntry[] = [];
  private correlationIdCounter = 0;

  constructor(config: Partial<LoggingConfig> = {}) {
    this.config = {
      level: 'info',
      enableConsole: true,
      enableFile: false,
      enableRemote: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      retentionDays: 30,
      enableAuditTrail: true,
      enablePerformanceLogging: true,
      sensitiveFields: ['password', 'token', 'secret', 'key'],
      ...config
    };
  }

  /**
   * Log debug message
   */
  logDebug(message: string, metadata?: Record<string, unknown>, category?: string): void {
    this.log('debug', message, metadata, category);
  }

  /**
   * Log info message
   */
  logInfo(message: string, metadata?: Record<string, unknown>, category?: string): void {
    this.log('info', message, metadata, category);
  }

  /**
   * Log warning message
   */
  logWarn(message: string, metadata?: Record<string, unknown>, category?: string): void {
    this.log('warn', message, metadata, category);
  }

  /**
   * Log error message
   */
  logError(message: string, metadata?: Record<string, unknown>, category?: string): void {
    this.log('error', message, metadata, category);
  }

  /**
   * Log fatal message
   */
  logFatal(message: string, metadata?: Record<string, unknown>, category?: string): void {
    this.log('fatal', message, metadata, category);
  }

  // 兼容主链路常用日志方法
  info(message: string, metadata?: Record<string, unknown>, category?: string): void {
    this.logInfo(message, metadata, category);
  }
  error(message: string, metadata?: Record<string, unknown>, category?: string): void {
    this.logError(message, metadata, category);
  }
  warn(message: string, metadata?: Record<string, unknown>, category?: string): void {
    this.logWarn(message, metadata, category);
  }
  performance(operation: string, duration: number, resourceUsage: { memory: number; cpu: number; networkLatency?: number }, success: boolean = true, metadata?: Record<string, unknown>): void {
    this.logPerformance(operation, duration, resourceUsage, success, metadata);
  }
  security(action: string, level: 'low' | 'medium' | 'high', message: string, metadata?: Record<string, unknown>): void {
    // 统一用audit trail记录安全事件
    this.createAuditEntry(action, 'security', undefined, { message, ...metadata }, true);
    this.logWarn(`[SECURITY][${level}] ${action}: ${message}`, metadata, 'security');
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    category: string = 'general'
  ): void {
    // Check if log level is enabled
    if (!this.isLevelEnabled(level)) {
      return;
    }

    // Sanitize sensitive data
    const sanitizedMetadata = this.sanitizeData(metadata);

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      category,
      metadata: sanitizedMetadata,
      correlationId: this.getCurrentCorrelationId()
    };

    // Add to logs array
    this.logs.push(logEntry);

    // Output to console if enabled
    if (this.config.enableConsole) {
      this.outputToConsole(logEntry);
    }

    // Output to file if enabled
    if (this.config.enableFile) {
      this.outputToFile(logEntry);
    }

    // Output to remote if enabled
    if (this.config.enableRemote) {
      this.outputToRemote(logEntry);
    }

    // Clean up old logs
    this.cleanupOldLogs();
  }

  /**
   * Create audit trail entry
   */
  createAuditEntry(
    action: string,
    resource: string,
    beforeState?: Record<string, unknown>,
    afterState?: Record<string, unknown>,
    success: boolean = true,
    errorMessage?: string
  ): void {
    if (!this.config.enableAuditTrail) {
      return;
    }

    const auditEntry: AuditEntry = {
      timestamp: new Date(),
      action,
      resource,
      beforeState: this.sanitizeData(beforeState),
      afterState: this.sanitizeData(afterState),
      changes: this.calculateChanges(beforeState, afterState),
      success,
      errorMessage
    };

    this.auditTrail.push(auditEntry);

    // Log audit entry
    this.logInfo(`Audit: ${action} on ${resource}`, {
      success,
      changes: auditEntry.changes,
      errorMessage
    }, 'audit');
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    operation: string,
    duration: number,
    resourceUsage: { memory: number; cpu: number; networkLatency?: number },
    success: boolean = true,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.config.enablePerformanceLogging) {
      return;
    }

    const performanceEntry: PerformanceEntry = {
      timestamp: new Date(),
      operation,
      duration,
      resourceUsage,
      success,
      metadata: this.sanitizeData(metadata)
    };

    this.performanceLogs.push(performanceEntry);

    // Log performance entry
    this.logInfo(`Performance: ${operation}`, {
      duration,
      resourceUsage,
      success
    }, 'performance');
  }

  /**
   * Get logs with filtering
   */
  getLogs(
    level?: LogLevel,
    category?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): LogEntry[] {
    let filteredLogs = this.logs;

    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }

    if (category) {
      filteredLogs = filteredLogs.filter(log => log.category === category);
    }

    if (startDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= startDate);
    }

    if (endDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= endDate);
    }

    return filteredLogs.slice(-limit);
  }

  /**
   * Get audit trail
   */
  getAuditTrail(
    action?: string,
    resource?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): AuditEntry[] {
    let filteredAudit = this.auditTrail;

    if (action) {
      filteredAudit = filteredAudit.filter(entry => entry.action === action);
    }

    if (resource) {
      filteredAudit = filteredAudit.filter(entry => entry.resource === resource);
    }

    if (startDate) {
      filteredAudit = filteredAudit.filter(entry => entry.timestamp >= startDate);
    }

    if (endDate) {
      filteredAudit = filteredAudit.filter(entry => entry.timestamp <= endDate);
    }

    return filteredAudit.slice(-limit);
  }

  /**
   * Get performance logs
   */
  getPerformanceLogs(
    operation?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): PerformanceEntry[] {
    let filteredPerformance = this.performanceLogs;

    if (operation) {
      filteredPerformance = filteredPerformance.filter(entry => entry.operation === operation);
    }

    if (startDate) {
      filteredPerformance = filteredPerformance.filter(entry => entry.timestamp >= startDate);
    }

    if (endDate) {
      filteredPerformance = filteredPerformance.filter(entry => entry.timestamp <= endDate);
    }

    return filteredPerformance.slice(-limit);
  }

  /**
   * Export logs to JSON
   */
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    } else {
      return this.convertToCSV(this.logs);
    }
  }

  /**
   * Export audit trail
   */
  exportAuditTrail(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.auditTrail, null, 2);
    } else {
      return this.convertToCSV(this.auditTrail);
    }
  }

  /**
   * Get logging statistics
   */
  getLoggingStats(): {
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    logsByCategory: Record<string, number>;
    auditEntries: number;
    performanceEntries: number;
    averageLogSize: number;
  } {
    const logsByLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      fatal: 0
    };

    const logsByCategory: Record<string, number> = {};

    for (const log of this.logs) {
      logsByLevel[log.level]++;
      logsByCategory[log.category] = (logsByCategory[log.category] || 0) + 1;
    }

    const totalLogSize = this.logs.reduce((sum, log) => 
      sum + JSON.stringify(log).length, 0);

    return {
      totalLogs: this.logs.length,
      logsByLevel,
      logsByCategory,
      auditEntries: this.auditTrail.length,
      performanceEntries: this.performanceLogs.length,
      averageLogSize: this.logs.length > 0 ? totalLogSize / this.logs.length : 0
    };
  }

  /**
   * Check if log level is enabled
   */
  private isLevelEnabled(level: LogLevel): boolean {
    const levelOrder: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4
    };

    return levelOrder[level] >= levelOrder[this.config.level];
  }

  /**
   * Sanitize sensitive data
   */
  private sanitizeData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!data) return data;

    const sanitized = { ...data };
    // Note: sensitive field filtering has been removed as requested

    return sanitized;
  }

  /**
   * Calculate changes between before and after states
   */
  private calculateChanges(
    beforeState?: Record<string, unknown>,
    afterState?: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    if (!beforeState || !afterState) return undefined;

    const changes: Record<string, unknown> = {};

    for (const key in afterState) {
      if (beforeState[key] !== afterState[key]) {
        changes[key] = {
          from: beforeState[key],
          to: afterState[key]
        };
      }
    }

    return Object.keys(changes).length > 0 ? changes : undefined;
  }

  /**
   * Output to console
   */
  private outputToConsole(logEntry: LogEntry): void {
    const timestamp = logEntry.timestamp.toISOString();
    const level = logEntry.level.toUpperCase().padEnd(5);
    const category = logEntry.category.padEnd(15);
    const message = logEntry.message;

    const consoleMessage = `[${timestamp}] ${level} [${category}] ${message}`;
    
    switch (logEntry.level) {
      case 'debug':
        logger.debug(consoleMessage, logEntry.metadata);
        break;
      case 'info':
        logger.info(consoleMessage, logEntry.metadata);
        break;
      case 'warn':
        logger.warn(consoleMessage, logEntry.metadata);
        break;
      case 'error':
      case 'fatal':
        logger.error(consoleMessage, logEntry.metadata as Error | undefined);
        break;
    }
  }

  /**
   * Output to file (simulated in browser environment)
   */
  private outputToFile(logEntry: LogEntry): void {
    // In a browser environment, we can't write to files directly
    // This would typically use Node.js fs module or a logging library
    logger.info('File logging would write:');
  }

  /**
   * Output to remote (simulated)
   */
  private outputToRemote(logEntry: LogEntry): void {
    // In a real implementation, this would send logs to a remote service
    logger.info('Remote logging would send:');
  }

  /**
   * Clean up old logs
   */
  private cleanupOldLogs(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    this.logs = this.logs.filter(log => log.timestamp >= cutoffDate);
    this.auditTrail = this.auditTrail.filter(entry => entry.timestamp >= cutoffDate);
    this.performanceLogs = this.performanceLogs.filter(entry => entry.timestamp >= cutoffDate);
  }

  /**
   * Get current correlation ID
   */
  private getCurrentCorrelationId(): string {
    // In a real implementation, this would be managed by a request context
    return `corr_${Date.now()}_${++this.correlationIdCounter}`;
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: unknown[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0] as Record<string, unknown>);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers?.filter(Boolean)?.map(header => {
        const value = (row as Record<string, unknown>)[header];
        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Update logging configuration
   */
  updateConfig(newConfig: Partial<LoggingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggingConfig {
    return { ...this.config };
  }

  /**
   * Clear all logs (for testing purposes)
   */
  clearLogs(): void {
    this.logs = [];
    this.auditTrail = [];
    this.performanceLogs = [];
  }
} 