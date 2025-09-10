/**
 * Logging Configuration
 * 日志记录配置
 */

import type { LogLevel } from "@/app/adscenter/models/LoggingService";

/**
 * 日志配置接口
 */
export interface LoggingConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFileLogging: boolean;
  enableRemoteLogging: boolean;
  logDirectory?: string;
  logFilePath?: string;
  remoteEndpoint?: string;
  maxFileSize?: number;
  maxFiles?: number;
  retentionDays?: number;
}

/**
 * 获取当前环境的日志配置
 */
export function getLoggingConfig(): LoggingConfig {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';
  const isProduction = process.env.NODE_ENV === 'production';
  const isDebugMode = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
  
  return {
    level: (isDevelopment || (isProduction && isDebugMode)) ? 'debug' : 'info',
    enableConsole: true, // 始终启用控制台输出
    enableFileLogging: !isTest, // 除测试环境外始终启用文件日志
    enableRemoteLogging: isProduction && !isDebugMode, // 调试模式下不发送到远程日志服务
    logDirectory: process.env.LOG_DIRECTORY || './logs',
    logFilePath: process.env.LOG_FILE_PATH || './logs/app.log',
    remoteEndpoint: process.env.LOG_REMOTE_ENDPOINT,
    maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760'), // 10MB
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '50'),
    retentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '7')
  };
}

/**
 * 日志格式化选项
 */
export interface LogFormatOptions {
  includeTimestamp: boolean;
  includeLevel: boolean;
  includeContext: boolean;
  colorize: boolean;
  prettyPrint: boolean;
}

/**
 * 获取日志格式化选项
 */
export function getLogFormatOptions(): LogFormatOptions {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    includeTimestamp: true,
    includeLevel: true,
    includeContext: true,
    colorize: isDevelopment,
    prettyPrint: isDevelopment
  };
}

/**
 * 敏感数据过滤配置
 */
export const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'auth',
  'credential',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'sessionId',
  'session_id',
  'cookie',
  'cookies'
];

/**
 * 检查字段是否应该从日志中过滤
 */
export function shouldFilterFromLogs(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some(sensitiveField => 
    lowerFieldName.includes(sensitiveField.toLowerCase())
  );
}