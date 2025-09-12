/**
 * Input Validation Utilities
 * 提供安全的输入验证功能
 */

import { z } from 'zod';
import { EnhancedError } from '@/lib/utils/error-handling';

// URL验证
export const urlSchema = z.string()
  .min(1, 'URL不能为空')
  .max(2048, 'URL长度不能超过2048字符')
  .transform((str) => str.trim())
  .refine(
    (str) => {
      try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: '请输入有效的HTTP/HTTPS URL' }
  )
  .refine(
    (str) => {
      try {
        const url = new URL(str);
        // 防止内网IP访问
        const hostname = url.hostname;
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (ipPattern.test(hostname)) {
          const parts = hostname.split('.');
          return parts.some(part => parseInt(part) > 255);
        }
        return true;
      } catch {
        return false;
      }
    },
    { message: '不允许访问内网IP地址' }
  );

// 代理URL验证
export const proxyUrlSchema = z.string()
  .transform((str) => str.trim())
  .refine(
    (str) => {
      try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: '请输入有效的代理URL' }
  );

// 任务ID验证
export const taskIdSchema = z.string()
  .min(1, '任务ID不能为空')
  .max(100, '任务ID长度不能超过100字符')
  .transform((str) => str.trim())
  .refine(
    (str) => /^[a-zA-Z0-9_-]+$/.test(str),
    { message: '任务ID只能包含字母、数字、下划线和连字符' }
  );

// 批量任务参数验证
export const batchTaskSchema = z.object({
  taskId: taskIdSchema,
  urls: z.array(urlSchema)
    .min(1, '至少需要一个URL')
    .max(1000, 'URL数量不能超过1000个'),
  cycleCount: z.number()
    .min(1, '循环次数至少为1')
    .max(100, '循环次数不能超过100'),
  openCount: z.number()
    .min(1, '打开次数至少为1')
    .max(50, '打开次数不能超过50')
    .optional(),
  openInterval: z.number()
    .min(1, '间隔时间至少为1秒')
    .max(300, '间隔时间不能超过300秒'),
  proxyUrl: proxyUrlSchema.optional(),
  refererOption: z.enum(['social', 'custom']),
  customReferer: z.string()
    .max(500, '自定义Referer长度不能超过500字符')
    .optional(),
  proxyValidated: z.boolean().optional(),
  concurrencyLimit: z.number()
    .min(1, '并发限制至少为1')
    .max(20, '并发限制不能超过20')
    .optional(),
  isSilentMode: z.boolean().optional(),
  urlVisits: z.array(z.number().min(1)).optional(),
  actualTotalVisits: z.number().min(1).optional(),
  });

// 验证结果类型
export type ValidationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
  details?: z.ZodError;
};

/**
 * 验证输入数据
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || '输入验证失败',
        details: error
      };
    }
    return {
      success: false,
      error: '输入验证失败'
    };
  }
}

/**
 * 安全的URL解析
 */
export function safeUrlParse(urlString: string): URL | null {
  try {
    // 移除潜在的恶意字符
    const sanitized = urlString.trim().replace(/[\x00-\x1F\x7F]/g, '');
    const url = new URL(sanitized);
    
    // 验证协议
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null as any;
    }
    
    // 验证主机名
    if (!url.hostname || url.hostname.includes('..')) {
      return null as any;
    }
    
    return url;
  } catch {
    return null as any;
  }
}

/**
 * 检查是否为恶意URL
 */
export function isMaliciousUrl(urlString: string): boolean {
  const maliciousPatterns = [
    // JavaScript协议
    /^javascript:/i,
    // 数据URI
    /^data:/i,
    // VBScript
    /^vbscript:/i,
    // 文件协议
    /^file:/i,
    // FTP协议
    /^ftp:/i,
    // SSH协议
    /^ssh:/i,
    // Telnet协议
    /^telnet:/i,
    // 内网IP
    /(?:^|\.)(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|127\.|169\.254\.|::1|localhost)/i,
    // 特殊字符
    /[\x00-\x1F\x7F]/,
    // SQL注入
    /['";]/i,
    // XSS
    /<script|<\/script|on\w+\s*=/i
  ];
  
  return maliciousPatterns.some(pattern => pattern.test(urlString));
}

/**
 * 清理输入字符串
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // 移除控制字符
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // 移除script标签
    .replace(/javascript:/gi, '') // 移除javascript协议
    .replace(/on\w+\s*=/gi, '') // 移除事件处理器
    .substring(0, 10000); // 限制长度
}

/**
 * 验证URL列表
 */
export function validateUrlList(urls: unknown): string[] {
  if (!Array.isArray(urls)) {
    throw new Error('URL列表必须是数组');
  }
  
  const validUrls: string[] = [];
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    
    if (typeof url !== 'string') {
      throw new Error(`第${i + 1}个URL必须是字符串`);
    }
    
    if (isMaliciousUrl(url)) {
      throw new Error(`第${i + 1}个URL包含恶意内容`);
    }
    
    const parsedUrl = safeUrlParse(url);
    if (!parsedUrl) {
      throw new Error(`第${i + 1}个URL格式无效`);
    }
    
    validUrls.push(parsedUrl.toString());
  }
  
  return validUrls;
}