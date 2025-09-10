/**
 * HTTP Request Logging Middleware
 * 记录所有HTTP请求到日志文件
 */

import { createLogFileManager } from '@/lib/logging/LogFileManager';
import { createDefaultLoggingService } from '@/lib/logging/createDefaultLoggingService';
import type { IncomingMessage, ServerResponse } from 'http';

const logManager = createLogFileManager();
const logger = createDefaultLoggingService();

export interface RequestLogEntry {
  method: string;
  url: string;
  statusCode: number;
  userAgent?: string;
  ip?: string;
  responseTime: number;
  timestamp: Date;
  referrer?: string;
}

/**
 * HTTP请求日志中间件
 */
export function httpRequestLogger(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const startTime = Date.now();
  
  // 捕获响应结束事件
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const responseTime = Date.now() - startTime;
    
    // 创建日志条目
    const logEntry: RequestLogEntry = {
      method: req.method || 'UNKNOWN',
      url: req.url || '/',
      statusCode: res.statusCode,
      userAgent: req.headers['user-agent'],
      ip: getClientIp(req),
      responseTime,
      timestamp: new Date(),
      referrer: req.headers.referer || req.headers.referer
    };
    
    // 记录请求日志
    logRequest(logEntry);
    
    // 调用原始的end方法
    return originalEnd.call(res, chunk, encoding);
  } as any;
  
  next();
}

/**
 * 记录单个请求日志
 */
function logRequest(entry: RequestLogEntry): void {
  // 跳过健康检查和静态资源日志
  if (shouldSkipLogging(entry)) {
    return;
  }
  
  const logLevel = getLogLevel(entry.statusCode);
  const message = formatLogMessage(entry);
  
  switch (logLevel) {
    case 'error':
      logger.error(`${message} - Method: ${entry.method}, URL: ${entry.url}, Status: ${entry.statusCode}, Response Time: ${entry.responseTime}ms, IP: ${entry.ip}, User-Agent: ${entry.userAgent}`);
      break;
    case 'warn':
      logger.warn(`${message} - Method: ${entry.method}, URL: ${entry.url}, Status: ${entry.statusCode}, Response Time: ${entry.responseTime}ms`);
      break;
    default:
      logger.info(`${message} - Method: ${entry.method}, URL: ${entry.url}, Status: ${entry.statusCode}, Response Time: ${entry.responseTime}ms`);
  }
}

/**
 * 判断是否应该跳过日志记录
 */
function shouldSkipLogging(entry: RequestLogEntry): boolean {
  // 跳过健康检查
  if (entry.url === '/api/health' || entry.url === '/health') {
    return true;
  }
  
    
  // 跳过静态资源（根据扩展名）
  const staticFileExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.woff', '.woff2', '.ttf', '.eot', '.map', '.json'
  ];
  
  if (staticFileExtensions.some(ext => entry.url.toLowerCase().endsWith(ext))) {
    return true;
  }
  
  // 跳过Next.js内部路由
  if (entry.url.startsWith('/_next/') || entry.url.startsWith('__nextjs')) {
    return true;
  }
  
  return false;
}

/**
 * 根据状态码获取日志级别
 */
function getLogLevel(statusCode: number): string {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  if (statusCode >= 300) return 'info';
  return 'info';
}

/**
 * 格式化日志消息
 */
function formatLogMessage(entry: RequestLogEntry): string {
  return `HTTP ${entry.method} ${entry.url} ${entry.statusCode} ${entry.responseTime}ms`;
}

/**
 * 获取客户端IP地址
 */
function getClientIp(req: IncomingMessage): string {
  // 检查各种可能的IP头部
  const ipHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip', // Cloudflare
    'true-client-ip', // Akamai
    'x-cluster-client-ip',
    'x-forwarded',
    'forwarded-for',
    'forwarded'
  ];
  
  for (const header of ipHeaders) {
    const value = req.headers[header];
    if (typeof value === 'string') {
      // x-forwarded-for可能包含多个IP，取第一个
      const ips = value.split(',')?.filter(Boolean)?.map(ip => ip.trim());
      if (ips.length > 0 && ips[0]) {
        return ips[0];
      }
    }
  }
  
  // 如果没有代理头部，使用直接连接的IP
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }
  
  return 'unknown';
}

/**
 * 创建HTTP请求日志中间件（兼容Express风格）
 */
export function createHttpLogger() {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    httpRequestLogger(req, res, next);
  };
}