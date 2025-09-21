/**
 * Common Type Definitions
 * 通用类型定义，用于替换any类型
 */

// 通用对象类型
export interface GenericObject {
  [key: string]: unknown;
}

// 事件数据类型
export interface EventData {
  [key: string]: unknown;
}

// API响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 配置对象类型
export interface ConfigObject {
  [key: string]: string | number | boolean | undefined;
}

// 元数据类型
export interface Metadata {
  [key: string]: string | number | boolean | Date | undefined;
}

// 函数回调类型
export type Callback<T = unknown> = (data: T) => void | Promise<void>;

// 过滤器函数类型
export type FilterFunction<T = unknown> = (data: T) => boolean | Promise<boolean>;

// 转换函数类型
export type TransformFunction<T = unknown, R = unknown> = (input: T) => R | Promise<R>;

// 验证函数类型
export type ValidatorFunction<T = unknown> = (data: T) => boolean | string | Promise<boolean | string>;

// 事件监听器类型
export type EventListener<T = unknown> = (data: T) => void | Promise<void>;

// 错误处理函数类型
export type ErrorHandler = (error: Error, context?: string) => void | Promise<void>;

// 日志数据类型
export interface LogData {
  [key: string]: string | number | boolean | Date | Error | undefined;
}

// 查询参数类型
export interface QueryParams {
  [key: string]: string | number | boolean | string[] | undefined;
}

// 表单数据类型
export interface FormData {
  [key: string]: string | number | boolean | File | undefined;
}

// 全局上下文类型
export interface GlobalContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  timestamp?: string;
}

// 映射数据类型
export interface MappingData {
  id: string;
  originalUrl: string;
  finalUrl: string;
  adId?: string;
  campaignId?: string;
  adGroupId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

// URL 结果类型
export interface UrlResult {
  url: string;
  originalUrl?: string;
  valid: boolean;
  error?: string;
  title?: string;
  status?: number;
  loadTime?: number;
  finalUrl?: string;
  domain?: string;
  rank?: number;
  priority?: "high" | "medium" | "low";
  timestamp?: string;
  proxyStatus?: {
    success: boolean;
    actualIP?: string;
    error?: string;
  };
}

/**
 * Represents an Offer in the system, aligning with the Prisma schema.
 */
export interface Offer {
  id: string;
  userId: string;
  name: string;
  originalUrl: string;
  status: 'evaluating' | 'optimizing' | 'scaling' | 'archived';
  siterankScore?: number | null;
  createdAt: string; // Using string to represent ISO date format for simplicity in transfer
}
