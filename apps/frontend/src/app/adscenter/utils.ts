// Google Ads自动化系统的工具函数

import { TrackingConfiguration, ValidationResult, ValidationError, ValidationWarning } from './types';

/**
 * 生成唯一ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}_${randomStr}` : `${timestamp}_${randomStr}`;
}

/**
 * 验证URL格式
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证邮箱格式
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 解析URL参数
 */
export function parseUrlParameters(url: string): { baseUrl: string; parameters: string } {
  try {
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    const parameters = urlObj.search.substring(1); // 去掉开头的?
    return { baseUrl, parameters };
  } catch {
    return { baseUrl: url, parameters: '' };
  }
}

/**
 * 基础配置验证（简化版本，详细验证请使用ValidationService）
 */
export function validateConfiguration(config: Partial<TrackingConfiguration>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 必填字段验证
  if (!config.name?.trim()) {
    errors.push({
      field: 'name',
      message: '配置名称不能为空',
      code: 'REQUIRED',
      severity: 'error'
    });
  }

  if (!config.environmentId?.trim()) {
    errors.push({
      field: 'environmentId',
      message: '环境ID不能为空',
      code: 'REQUIRED',
      severity: 'error'
    });
  }

  if (!config.repeatCount || config.repeatCount < 1) {
    errors.push({
      field: 'repeatCount',
      message: '执行次数必须大于0',
      code: 'INVALID_VALUE',
      severity: 'error'
    });
  }

  if (!config.originalLinks || config.originalLinks.length === 0) {
    errors.push({
      field: 'originalLinks',
      message: '至少需要一个原始链接',
      code: 'REQUIRED',
      severity: 'error'
    });
  } else {
    // 验证链接格式
    config.originalLinks.forEach((link, index: any) => {
      if (!isValidUrl(link)) {
        errors.push({
          field: `originalLinks[${index}]`,
          message: `第${index + 1}个链接格式无效`,
          code: 'INVALID_URL',
          severity: 'error'
        });
      }
    });
  }

  if (config.notificationEmail && !isValidEmail(config.notificationEmail)) {
    errors.push({
      field: 'notificationEmail',
      message: '邮箱格式无效',
      code: 'INVALID_EMAIL',
      severity: 'error'
    });
  }

  // 业务逻辑验证
  const adCount = config.adMappingConfig ? config.adMappingConfig.reduce((sum, mapping: any) => sum + (mapping.adMappings?.length || 0), 0) : 0;
  if (config.repeatCount && adCount > 0 && config.repeatCount < adCount) {
    warnings.push({
      field: 'repeatCount',
      message: '执行次数少于广告数量，部分广告可能不会被更新',
      suggestion: `建议将执行次数设置为至少${adCount}次`,
      severity: 'warning'
    });
  }

  if (config.repeatCount && config.repeatCount > 10) {
    warnings.push({
      field: 'repeatCount',
      message: '执行次数较多，可能会增加处理时间',
      suggestion: '建议根据实际需要调整执行次数',
      severity: 'warning'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 格式化时间显示
 */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return '刚刚';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours}小时前`;
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return formatDateTime(date);
  }
}

/**
 * 计算执行进度百分比
 */
export function calculateProgress(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * 生成执行报告摘要
 */
export function generateExecutionSummary(
  totalLinks: number,
  successfulLinks: number,
  failedLinks: number,
  executionTime: number
): string {
  const successRate = totalLinks > 0 ? Math.round((successfulLinks / totalLinks) * 100) : 0;
  const avgTime = totalLinks > 0 ? Math.round(executionTime / totalLinks) : 0;
  
  return `处理${totalLinks}个链接，成功${successfulLinks}个，失败${failedLinks}个，成功率${successRate}%，平均处理时间${avgTime}秒`;
}

/**
 * 深拷贝对象
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 安全的JSON解析
 */
export function safeJsonParse<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString);
  } catch {
    return defaultValue;
  }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 生成随机延时（毫秒）
 */
export function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 检查是否为工作时间
 */
export function isWorkingHours(date: Date = new Date()): boolean {
  const hour = date.getHours();
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  
  // 工作日的9:00-18:00
  return day >= 1 && day <= 5 && hour >= 9 && hour < 18;
}

/**
 * 计算下次执行时间
 */
export function calculateNextExecution(
  scheduleType: string,
  scheduleTime: string,
  scheduleDays?: number[]
): Date {
  const now = new Date();
  const [hours, minutes] = scheduleTime.split(':')?.filter(Boolean)?.map(Number);
  
  switch (scheduleType) {
    case 'daily': {
      const nextExecution = new Date(now);
      nextExecution.setHours(hours, minutes, 0, 0);
      
      // 如果今天的时间已过，设置为明天
      if (nextExecution <= now) {
        nextExecution.setDate(nextExecution.getDate() + 1);
      }
      
      return nextExecution;
    }
    
    case 'weekly': {
      const nextExecution = new Date(now);
      nextExecution.setHours(hours, minutes, 0, 0);
      
      if (scheduleDays && scheduleDays.length > 0) {
        // 找到下一个执行日
        const currentDay = now.getDay();
        const sortedDays = scheduleDays.sort((a, b) => a - b);
        
        let nextDay = sortedDays.find((day: any) => day > currentDay);
        if (!nextDay) {
          // 如果本周没有更多执行日，使用下周的第一个
          nextDay = sortedDays[0] + 7;
        }
        
        const daysToAdd = nextDay - currentDay;
        nextExecution.setDate(nextExecution.getDate() + daysToAdd);
        
        // 如果是今天但时间已过，移到下周同一天
        if (daysToAdd === 0 && nextExecution <= now) {
          nextExecution.setDate(nextExecution.getDate() + 7);
        }
      }
      
      return nextExecution;
    }
    
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 默认24小时后
  }
}