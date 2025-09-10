/**
 * Input Validation Utilities
 * 用于验证和清理用户输入，防止安全漏洞
 */

import { sanitizeUserInput } from './sanitize';

// Re-export for convenience
export { sanitizeUserInput };

/**
 * 验证邮箱地址格式
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * 验证URL格式
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证并清理用户输入的文本
 */
export function validateAndSanitizeText(input: string, maxLength: number = 1000): {
  isValid: boolean;
  sanitized: string;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!input || typeof input !== 'string') {
    errors.push('输入不能为空');
    return { isValid: false, sanitized: '', errors };
  }
  
  if (input.length > maxLength) {
    errors.push(`输入长度不能超过${maxLength}个字符`);
  }
  
  // 清理HTML标签和潜在的恶意内容
  const sanitized = sanitizeUserInput(input);
  
  // 检查是否包含可疑的脚本内容
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /data:text\/html/i,
    /vbscript:/i
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(input)) {
      errors.push('输入包含不允许的内容');
      break;
    }
  }
  
  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  };
}

/**
 * 验证API密钥格式
 */
export function isValidApiKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  // API密钥应该是字母数字字符，长度在20-100之间
  const apiKeyRegex = /^[a-zA-Z0-9_-]{20,100}$/;
  return apiKeyRegex.test(apiKey);
}

/**
 * 验证文件名安全性
 */
export function isValidFileName(fileName: string): boolean {
  if (!fileName || typeof fileName !== 'string') {
    return false;
  }
  
  // 不允许路径遍历和特殊字符
  const dangerousPatterns = [
    /\.\./,
    /[<>:"|?*]/,
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,
    /^\./,
    /\.$/
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(fileName));
}

/**
 * 验证JSON字符串
 */
export function isValidJson(jsonString: string): boolean {
  if (!jsonString || typeof jsonString !== 'string') {
    return false;
  }
  
  try {
    JSON.parse(jsonString);
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证数字范围
 */
export function isValidNumber(value: unknown, min?: number, max?: number): boolean {
  const num = Number(value);
  
  if (isNaN(num) || !isFinite(num)) {
    return false;
  }
  
  if (min !== undefined && num < min) {
    return false;
  }
  
  if (max !== undefined && num > max) {
    return false;
  }
  
  return true;
}

/**
 * 验证字符串长度
 */
export function isValidLength(str: string, minLength: number = 0, maxLength: number = Infinity): boolean {
  if (!str || typeof str !== 'string') {
    return minLength === 0;
  }
  
  return str.length >= minLength && str.length <= maxLength;
}

/**
 * 通用输入验证器
 */
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => boolean | string;
}

export function validateInput(value: unknown, rules: ValidationRule): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // 必填验证
  if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
    errors.push('此字段为必填项');
    return { isValid: false, errors };
  }
  
  // 如果值为空且非必填，则通过验证
  if (!value && !rules.required) {
    return { isValid: true, errors: [] };
  }
  
  const strValue = String(value);
  
  // 长度验证
  if (rules.minLength !== undefined && strValue.length < rules.minLength) {
    errors.push(`最少需要${rules.minLength}个字符`);
  }
  
  if (rules.maxLength !== undefined && strValue.length > rules.maxLength) {
    errors.push(`最多允许${rules.maxLength}个字符`);
  }
  
  // 正则表达式验证
  if (rules.pattern && !rules.pattern.test(strValue)) {
    errors.push('格式不正确');
  }
  
  // 自定义验证
  if (rules.custom) {
    const customResult = rules.custom(value);
    if (customResult !== true) {
      errors.push(typeof customResult === 'string' ? customResult : '验证失败');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}