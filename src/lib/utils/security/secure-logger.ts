/**
 * 安全日志记录器
 * 提供安全的日志记录功能，避免敏感信息泄露
 */

interface LogLevel {
  ERROR: 'error';
  WARN: 'warn';
  INFO: 'info';
  DEBUG: 'debug';
}

interface SecureLogger {
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  info: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
  security: (message: string, level: string, meta?: any) => void;
}

const LOG_LEVELS: LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

/**
 * 清理敏感信息
 */
function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveKeys = [
    'password', 'token', 'secret', 'key', 'auth', 'credential',
    'cookie', 'session', 'authorization', 'bearer'
  ];

  const sanitized = { ...data };
  
  for (const key in sanitized) {
    if (sensitiveKeys.some(sensitive => 
      key.toLowerCase().includes(sensitive.toLowerCase())
    )) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * 创建安全日志记录器
 */
export function createLogger(context: string = 'App'): SecureLogger {
  const log = (level: string, message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    const sanitizedMeta = meta ? sanitizeLogData(meta) : undefined;
    
    const logEntry = {
      timestamp,
      level,
      context,
      message,
      ...(sanitizedMeta && { meta: sanitizedMeta })
    };

    // 始终输出到控制台，无论是开发还是生产环境
    console.log(`[${timestamp}] ${level.toUpperCase()} [${context}] ${message}`, 
      sanitizedMeta ? sanitizedMeta : '');

    // 在生产环境中可以集成其他日志系统
    // 例如：Winston, Pino, 或云日志服务
  };

  return {
    error: (message: string, meta?: any) => log(LOG_LEVELS.ERROR, message, meta),
    warn: (message: string, meta?: any) => log(LOG_LEVELS.WARN, message, meta),
    info: (message: string, meta?: any) => log(LOG_LEVELS.INFO, message, meta),
    debug: (message: string, meta?: any) => log(LOG_LEVELS.DEBUG, message, meta),
    security: (message: string, level: string, meta?: any) => {
      // 安全相关日志，使用特殊标记
      log(`SECURITY-${level.toUpperCase()}`, `[SECURITY] ${message}`, meta);
    }
  };
}

// 默认导出
export default createLogger;