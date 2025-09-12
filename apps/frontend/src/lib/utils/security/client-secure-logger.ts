/**
 * Client-side logger wrapper
 * Provides a safe interface for client-side components without importing Node.js modules
 */

/**
 * 日志级别
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

/**
 * 日志条目接口
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown> | string | number | boolean | null;
  context?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

// Client-side logger that doesn't use Node.js modules
export class ClientSecureLogger {
  private context: string;
  private currentLevel: LogLevel;

  constructor(context: string = 'Client', level: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.currentLevel = level;
  }

  /**
   * Create log entry
   */
  private createLogEntry(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data ? this.sanitizeData(data) as any : undefined,
      context: this.context
    };
  }

  /**
   * Simple data sanitization for client-side
   */
  private sanitizeData(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      // Basic sensitive data filtering
      const sensitivePatterns = [
        /password["\s]*[:=]["\s]*[^"\s,}]+/gi,
        /token["\s]*[:=]["\s]*[^"\s,}]+/gi,
        /secret["\s]*[:=]["\s]*[^"\s,}]+/gi,
        /key["\s]*[:=]["\s]*[^"\s,}]+/gi,
        /authorization["\s]*[:=]["\s]*[^"\s,}]+/gi,
        /email["\s]*[:=]["\s]*[^@\s]+@[^@\s,}]+/gi,
        /[?&](password|token|secret|key|auth|credentials|username|email|phone)=[^&\s]*/gi
      ];

      let sanitized = data;
      sensitivePatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '[REDACTED]');
      });
      return sanitized;
    }

    if (typeof data === 'object') {
      if (Array.isArray(data)) {
        return data?.filter(Boolean)?.map(item => this.sanitizeData(item));
      }

      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeData(value);
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Output log to console
   */
  private output(entry: LogEntry): void {
    if (entry.level > this.currentLevel) {
      return;
    }

    const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    const levelName = levelNames[entry.level];
    const logMessage = `[${entry.timestamp}] ${levelName} [${entry.context}] ${entry.message}`;

    switch (entry.level) {
      case 0: // ERROR
        console.error(logMessage, entry.data || '');
        break;
      case 1: // WARN
        console.warn(logMessage, entry.data || '');
        break;
      case 2: // INFO
        console.info(logMessage, entry.data || '');
        break;
      case 3: // DEBUG
        if (process.env.NODE_ENV === 'development') {
          console.debug(logMessage, entry.data || '');
        }
        break;
    }
  }

  error(message: string, error?: Error | { message: string; stack?: string; data?: any }, meta?: Record<string, any>): void {
    const combinedData = {
      error: error?.message,
      stack: error?.stack,
      ...(error && 'data' in error ? { data: (error as { data: any }).data } : {}),
      ...meta
    };
    this.output(this.createLogEntry(0, message, combinedData));
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.output(this.createLogEntry(1, message, meta));
  }

  info(message: string, meta?: Record<string, any>): void {
    this.output(this.createLogEntry(2, message, meta));
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.output(this.createLogEntry(3, message, meta));
  }

  security(event: string, severity: 'low' | 'medium' | 'high' | 'critical', message: string, data?: unknown): void {
    const securityEntry = this.createLogEntry(1, `SECURITY [${severity.toUpperCase()}] ${event}: ${message}`, data);
    this.output(securityEntry);
  }

  sensitiveDataAccess(resource: string, action: 'read' | 'write' | 'delete', userId?: string, data?: unknown): void {
    const entry = this.createLogEntry(2, `SENSITIVE_DATA [${action.toUpperCase()}] ${resource}`, {
      action,
      resource,
      userId: userId || '[ANONYMOUS]',
      timestamp: new Date().toISOString(),
      ...(data as Record<string, unknown> || {})
    });
    this.output(entry);
  }

  performance(operation: string, duration: number, data?: unknown): void {
    const perfData = {
      operation,
      duration,
      ...(data as Record<string, unknown> || {})
    };
    this.info(`Performance: ${operation} completed in ${duration}ms`, perfData);
  }

  audit(action: string, userId: string, resource: string, data?: unknown): void {
    const auditData = {
      action,
      userId,
      resource,
      timestamp: new Date().toISOString(),
      ...(data as Record<string, unknown> || {})
    };
    this.info(`Audit: ${action} on ${resource} by user ${userId}`, auditData);
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  child(context: string): ClientSecureLogger {
    return new ClientSecureLogger(`${this.context}:${context}`, this.currentLevel);
  }
}


/**
 * Create a client-side logger
 */
export function createClientLogger(context: string): ClientSecureLogger {
  let level: LogLevel = 2; // INFO

  if (process.env.NODE_ENV === 'development') {
    level = 3; // DEBUG
  }

  return new ClientSecureLogger(context, level);
}

/**
 * Default client logger instance
 */
export const defaultClientLogger = createClientLogger('ClientApp');