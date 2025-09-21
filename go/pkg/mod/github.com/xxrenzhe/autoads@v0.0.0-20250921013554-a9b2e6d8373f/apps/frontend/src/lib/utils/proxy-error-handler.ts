/**
 * 统一代理错误处理工具
 * 提供一致的代理相关错误处理策略
 */

import { createClientLogger } from '@/lib/utils/security/client-secure-logger';
import { EnhancedError } from '@/lib/utils/error-handling';
import { ProxyConfig } from '@/lib/utils/proxy-utils';

const logger = createClientLogger('ProxyErrorHandler');

export interface ProxyErrorContext {
  url?: string;
  proxy?: ProxyConfig;
  proxyPoolSize?: number;
  strategy?: string;
  operation: string;
  taskId?: string;
  [key: string]: any;
}

export interface ProxyErrorResult {
  success: boolean;
  error: string;
  errorCategory: string;
  shouldRetry: boolean;
  context?: ProxyErrorContext;
}

/**
 * 代理错误分类 - 增强版
 */
export enum ProxyErrorCategory {
  NETWORK_ERROR = 'network_error',          // 网络连接错误
  VALIDATION_ERROR = 'validation_error',    // 代理配置验证失败
  POOL_EMPTY = 'pool_empty',               // 代理池为空
  ALLOCATION_FAILED = 'allocation_failed',  // 代理分配失败
  TIMEOUT = 'timeout',                      // 代理超时
  RATE_LIMIT = 'rate_limit',               // 代理频率限制
  AUTH_FAILED = 'auth_failed',             // 代理认证失败
  PROXY_BANNED = 'proxy_banned',           // 代理被封禁
  DNS_FAILURE = 'dns_failure',             // DNS解析失败
  CONNECTION_RESET = 'connection_reset',   // 连接被重置
  SSL_ERROR = 'ssl_error',                 // SSL/TLS错误
  PROXY_UNREACHABLE = 'proxy_unreachable', // 代理不可达
  BAD_GATEWAY = 'bad_gateway',             // 网关错误
  SERVICE_UNAVAILABLE = 'service_unavailable', // 服务不可用
  UNKNOWN = 'unknown'                       // 未知错误
}

/**
 * 统一代理错误处理函数
 */
export function handleProxyError(
  error: Error | string,
  context: ProxyErrorContext,
  shouldLog: boolean = true
): ProxyErrorResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  let errorCategory = ProxyErrorCategory.UNKNOWN;
  let shouldRetry = true;
  let userMessage = '代理访问失败';

  // 根据错误信息进行分类 - 增强版
  if (errorMessage.includes('ECONNREFUSED')) {
    errorCategory = ProxyErrorCategory.NETWORK_ERROR;
    userMessage = '代理连接被拒绝，请检查代理状态';
  } else if (errorMessage.includes('ENOTFOUND')) {
    errorCategory = ProxyErrorCategory.DNS_FAILURE;
    userMessage = 'DNS解析失败，请检查代理地址';
    shouldRetry = false;
  } else if (errorMessage.includes('ETIMEDOUT')) {
    errorCategory = ProxyErrorCategory.TIMEOUT;
    userMessage = '代理响应超时，请稍后重试';
  } else if (errorMessage.includes('ECONNRESET')) {
    errorCategory = ProxyErrorCategory.CONNECTION_RESET;
    userMessage = '代理连接被重置，请重试';
  } else if (errorMessage.includes('CERT_') || errorMessage.includes('SSL') || errorMessage.includes('TLS')) {
    errorCategory = ProxyErrorCategory.SSL_ERROR;
    userMessage = 'SSL/TLS握手失败，请检查代理证书';
    shouldRetry = false;
  } else if (errorMessage.includes('代理') && errorMessage.includes('为空')) {
    errorCategory = ProxyErrorCategory.POOL_EMPTY;
    userMessage = '代理池为空，请检查代理配置';
    shouldRetry = false;
  } else if (errorMessage.includes('分配失败')) {
    errorCategory = ProxyErrorCategory.ALLOCATION_FAILED;
    userMessage = '代理分配失败，请重试';
  } else if (errorMessage.includes('验证失败') || errorMessage.includes('无效')) {
    errorCategory = ProxyErrorCategory.VALIDATION_ERROR;
    userMessage = '代理配置无效，请检查代理设置';
    shouldRetry = false;
  } else if (errorMessage.includes('502') || errorMessage.includes('Bad Gateway')) {
    errorCategory = ProxyErrorCategory.BAD_GATEWAY;
    userMessage = '代理网关错误，请稍后重试';
  } else if (errorMessage.includes('503') || errorMessage.includes('Service Unavailable')) {
    errorCategory = ProxyErrorCategory.SERVICE_UNAVAILABLE;
    userMessage = '代理服务暂时不可用，请稍后重试';
  } else if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
    errorCategory = ProxyErrorCategory.TIMEOUT;
    userMessage = '代理响应超时，请稍后重试';
  } else if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('407')) {
    errorCategory = ProxyErrorCategory.AUTH_FAILED;
    userMessage = '代理认证失败，请检查代理账号';
    shouldRetry = false;
  } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
    errorCategory = ProxyErrorCategory.RATE_LIMIT;
    userMessage = '代理访问频率受限，请稍后重试';
  } else if (errorMessage.includes('banned') || errorMessage.includes('blocked')) {
    errorCategory = ProxyErrorCategory.PROXY_BANNED;
    userMessage = '代理IP已被封禁，请更换代理';
    shouldRetry = false;
  } else if (errorMessage.includes('unreachable') || errorMessage.includes('host unreachable')) {
    errorCategory = ProxyErrorCategory.PROXY_UNREACHABLE;
    userMessage = '代理主机不可达，请检查代理设置';
    shouldRetry = false;
  }

  // 构建错误结果
  const result: ProxyErrorResult = {
    success: false,
    error: userMessage,
    errorCategory,
    shouldRetry,
    context
  };

  // 记录错误日志
  if (shouldLog) {
    const enhancedError = new EnhancedError(errorMessage, {
      errorCategory,
      proxy: context.proxy ? `${context.proxy.host}:${context.proxy.port}` : undefined,
      url: context.url,
      taskId: context.taskId,
      ...context
    });

    logger.error('代理错误', enhancedError, {
      category: errorCategory,
      shouldRetry,
      ...context
    });
  }

  return result;
}

/**
 * 创建代理错误上下文
 */
export function createProxyErrorContext(
  operation: string,
  overrides: Partial<ProxyErrorContext> = {}
): ProxyErrorContext {
  return {
    operation,
    timestamp: Date.now(),
    ...overrides
  };
}

/**
 * 检查是否应该重试代理操作 - 增强版
 */
export function shouldRetryProxyOperation(errorResult: ProxyErrorResult, retryCount: number): boolean {
  // 如果错误明确指示不应重试
  if (!errorResult.shouldRetry) {
    return false;
  }

  // 根据错误类型和重试次数决定
  switch (errorResult.errorCategory) {
    case ProxyErrorCategory.NETWORK_ERROR:
      return retryCount < 3; // 网络错误最多重试3次
    case ProxyErrorCategory.TIMEOUT:
      return retryCount < 2; // 超时错误最多重试2次
    case ProxyErrorCategory.CONNECTION_RESET:
      return retryCount < 3; // 连接重置可以重试3次
    case ProxyErrorCategory.RATE_LIMIT:
      return retryCount < 1; // 频率限制只重试1次
    case ProxyErrorCategory.BAD_GATEWAY:
      return retryCount < 2; // 网关错误重试2次
    case ProxyErrorCategory.SERVICE_UNAVAILABLE:
      return retryCount < 3; // 服务不可用重试3次，但间隔递增
    case ProxyErrorCategory.DNS_FAILURE:
    case ProxyErrorCategory.SSL_ERROR:
    case ProxyErrorCategory.PROXY_UNREACHABLE:
    case ProxyErrorCategory.VALIDATION_ERROR:
    case ProxyErrorCategory.POOL_EMPTY:
    case ProxyErrorCategory.ALLOCATION_FAILED:
    case ProxyErrorCategory.AUTH_FAILED:
    case ProxyErrorCategory.PROXY_BANNED:
      return false; // 这些错误类型不重试
    default:
      return retryCount < 2; // 其他错误默认重试2次
  }
}

/**
 * 获取用户友好的错误消息
 */
export function getUserFriendlyErrorMessage(errorResult: ProxyErrorResult): string {
  return errorResult.error;
}

/**
 * 获取详细的错误信息（用于日志）
 */
export function getDetailedErrorMessage(errorResult: ProxyErrorResult): string {
  const details = [
    `操作: ${errorResult.context?.operation}`,
    `错误类别: ${errorResult.errorCategory}`,
    `可重试: ${errorResult.shouldRetry}`
  ];

  if (errorResult.context?.proxy) {
    details.push(`代理: ${errorResult.context.proxy.host}:${errorResult.context.proxy.port}`);
  }

  if (errorResult.context?.url) {
    details.push(`URL: ${errorResult.context.url}`);
  }

  return `${errorResult.error} (${details.join(', ')})`;
}