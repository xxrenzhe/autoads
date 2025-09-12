/**
 * Docker Environment Configuration
 * Docker 环境配置
 */

import * as fs from 'fs';

/**
 * 检查是否在 Docker 环境中运行
 */
export function isDockerEnvironment(): boolean {
  // 简化检测：只检查明确的Docker标识，避免复杂的文件系统检查
  return (
    process.env.DOCKER_ENV === 'true' ||
    process.env.RUNNING_IN_DOCKER === 'true' ||
    // 检查 Docker 特有的文件（如果存在且可读取）
    (typeof fs !== 'undefined' && fs.existsSync && fs.existsSync('/.dockerenv'))
  );
}

/**
 * 获取 Docker 环境配置
 */
export function getDockerConfig() {
  return {
    isDocker: isDockerEnvironment(),
    logFormat: 'json', // 强制使用 JSON 格式
    logDestination: 'stdout', // 强制输出到 stdout
    enableAccessLogs: true,
    enableApplicationLogs: true,
    enableErrorTracking: true,
    environment: process.env.NODE_ENV || 'production',
    debugMode: process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'
  };
}

/**
 * Docker 环境特定的日志配置
 */
export const DOCKER_LOG_CONFIG = {
  // 访问日志配置
  accessLog: {
    enabled: true,
    format: 'json',
    includeTimestamp: true,
    includeMethod: true,
    includeUrl: true,
    includeStatus: true,
    includeDuration: true,
    includeIp: true,
    includeUserAgent: true
  },
  
  // 应用日志配置
  applicationLog: {
    enabled: true,
    format: 'json',
    includeTimestamp: true,
    includeLevel: true,
    includeContext: true,
    includeStackTrace: true,
    sanitizeSensitiveData: true
  },
  
  // 错误日志配置
  errorLog: {
    enabled: true,
    format: 'json',
    includeFullError: true,
    includeContext: true,
    includeRequestInfo: true
  }
};

/**
 * 在 Docker 环境中自动应用配置
 */
export function applyDockerConfiguration() {
  // 简化配置：在生产环境中总是启用文件日志
  if (process.env.NODE_ENV === 'production') {
    // 启用文件日志（同时输出到 stdout 和文件）
    process.env.LOG_TO_FILE = 'true';
    process.env.LOG_TO_STDOUT = 'true';
    
    // 设置日志级别
    if (process.env.NEXT_PUBLIC_DEBUG_MODE === 'true') {
      process.env.LOG_LEVEL = 'debug';
    } else {
      process.env.LOG_LEVEL = 'info';
    }
    
    return Promise.resolve(true);
  }
  
  return Promise.resolve(false);
}