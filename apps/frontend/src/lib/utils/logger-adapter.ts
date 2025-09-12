/**
 * Logger Adapter
 * 日志适配器，将SecureLogger适配到ILogger接口
 */

import { ILogger } from '../core/types';
import { createLogger } from './security/secure-logger';

type SecureLogger = ReturnType<typeof createLogger>;

export class LoggerAdapter implements ILogger {
  constructor(private secureLogger: SecureLogger) {}

  debug(message: string, meta?: Record<string, any>): void {
    this.secureLogger.debug(message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.secureLogger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.secureLogger.warn(message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, any>): void {
    // 将Error对象转换为meta格式
    const enhancedMeta = {
      ...meta,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      })
    };
    
    // SecureLogger 的 error 方法只接受 message 和 meta
    this.secureLogger.error(message, enhancedMeta);
  }
}

/**
 * 创建适配后的ILogger实例
 */
export function createLoggerAdapter(context: string): ILogger {
  // eslint-disable-next-line
  const { createLogger } = require('./security/secure-logger');
  const secureLogger = createLogger(context);
  return new LoggerAdapter(secureLogger);
}