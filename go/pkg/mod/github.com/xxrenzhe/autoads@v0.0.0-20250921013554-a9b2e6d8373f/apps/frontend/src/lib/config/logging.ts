/**
 * 日志配置
 * 统一管理应用程序的日志记录行为
 */

export interface LogConfig {
  // 基础配置
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  enableConsole: boolean;
  enableFile: boolean;
  enableStructured: boolean;
  
  // 格式配置
  includeTimestamp: boolean;
  includeLevel: boolean;
  includeCategory: boolean;
  includeUserId: boolean;
  includeRequestId: boolean;
  includeDuration: boolean;
  
  // 安全配置
  sanitizeHeaders: string[];
  sanitizeFields: string[];
  maxDataLength: number;
  
  // 性能配置
  enablePerformanceTracking: boolean;
  performanceSampleRate: number;
  
  // 环境特定配置
  environments: {
    development: Partial<LogConfig>;
    production: Partial<LogConfig>;
    test: Partial<LogConfig>;
  };
}

// 默认配置
const defaultConfig: LogConfig = {
  level: 'info',
  enableConsole: true,
  enableFile: true,
  enableStructured: true,
  includeTimestamp: true,
  includeLevel: true,
  includeCategory: true,
  includeUserId: true,
  includeRequestId: true,
  includeDuration: true,
  sanitizeHeaders: [
    'authorization',
    'cookie',
    'set-cookie',
    'proxy-authorization',
    'www-authenticate',
  ],
  sanitizeFields: [
    'password',
    'token',
    'secret',
    'key',
    'credit',
    'card',
    'ssn',
    'social',
  ],
  maxDataLength: 1000,
  enablePerformanceTracking: true,
  performanceSampleRate: 0.1, // 10%的性能采样率
  environments: {
    development: {
      level: 'debug',
      enableStructured: false,
      maxDataLength: 2000,
    },
    production: {
      level: 'info',
      enableConsole: true,
      enableFile: false,
      performanceSampleRate: 0.05,
    },
    test: {
      level: 'warn',
      enableConsole: false,
      enableFile: true,
    },
  },
};

// 获取当前环境的配置
export function getLogConfig(): LogConfig {
  const env = process.env.NODE_ENV || 'development';
  const baseConfig = { ...defaultConfig };
  const envConfig = defaultConfig.environments[env as keyof typeof defaultConfig.environments];
  
  return {
    ...baseConfig,
    ...envConfig,
  };
}

// 清理敏感信息的函数
export function sanitizeData(data: any, config: LogConfig): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  
  for (const key in sanitized) {
    if (config.sanitizeFields.some(field => 
      key.toLowerCase().includes(field.toLowerCase())
    )) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key], config);
    }
  }
  
  return sanitized;
}

// 清理请求头
export function sanitizeHeaders(headers: Record<string, string>, config: LogConfig): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    if (config.sanitizeHeaders.some(header => 
      key.toLowerCase().includes(header.toLowerCase())
    )) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// 截断过长的数据
export function truncateData(data: any, maxLength: number): any {
  if (typeof data === 'string' && data.length > maxLength) {
    return data.substring(0, maxLength) + '...[TRUNCATED]';
  }
  
  if (Array.isArray(data)) {
    return data.map((item: any) => truncateData(item, maxLength));
  }
  
  if (typeof data === 'object' && data !== null) {
    const truncated: any = {};
    for (const [key, value] of Object.entries(data)) {
      truncated[key] = truncateData(value, maxLength);
    }
    return truncated;
  }
  
  return data;
}