/**
 * 运行时配置工具
 * 用于替代硬编码的环境变量引用
 */

import { getSyncClientConfig } from './runtime';

// 获取API基础URL
export function getApiBaseUrl(): string {
  const config = getSyncClientConfig();
  if (config.API_BASE_URL) {
    return config.API_BASE_URL;
  }
  
  // 如果没有配置，使用默认值
  if (typeof window !== 'undefined') {
    // 客户端
    return `${window.location.origin}/api`;
  }
  
  // 服务器端
  return '/api';
}

// 获取SimilarWeb配置
export function getSimilarWebConfig() {
  const config = getSyncClientConfig();
  return {
    apiUrl: config.SIMILARWEB_API_URL || "https://data.similarweb.com/api/v1/data",
    timeout: config.SIMILARWEB_TIMEOUT || 30000,
  };
}

// 获取部署环境
export function getDeploymentEnv(): string {
  const config = getSyncClientConfig();
  return config.DEPLOYMENT_ENV || 'production';
}

// 获取应用环境
export function getAppEnv(): string {
  const config = getSyncClientConfig();
  return config.APP_ENV || 'production';
}

// 检查是否在开发环境
export function isDevelopment(): boolean {
  return getAppEnv() === 'development';
}

// 检查是否在生产环境
export function isProduction(): boolean {
  return getAppEnv() === 'production';
}

// 检查是否在预览环境
export function isPreview(): boolean {
  return getDeploymentEnv() === 'preview';
}

// 获取GA ID
export function getGaId(): string | undefined {
  const config = getSyncClientConfig();
  return config.GA_ID;
}