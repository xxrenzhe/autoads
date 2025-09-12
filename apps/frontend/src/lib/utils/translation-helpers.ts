/**
 * Translation Utilities
 * 统一的翻译辅助工具，避免重复代码
 */

/**
 * 获取翻译文本的工具函数，提供默认值和类型安全
 */
export function getT(
  t: (key: string) => string | string[] | undefined, 
  key: string, 
  defaultValue?: string
): string {
  if (!t || typeof t !== 'function') {
    console.warn('Translation function is not provided or not a function');
    return defaultValue || key;
  }

  const result = t(key);
  
  if (typeof result === 'string') {
    return result;
  }
  
  if (Array.isArray(result)) {
    return result.join(', ');
  }
  
  if (result === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    
    // 返回key作为fallback，但格式化一下
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
  
  return String(result);
}

/**
 * 获取数组类型的翻译文本
 */
export function getTArray(
  t: (key: string) => string | string[] | undefined, 
  key: string, 
  defaultValue: string[] = []
): string[] {
  if (!t || typeof t !== 'function') {
    console.warn('Translation function is not provided or not a function');
    return defaultValue;
  }

  const result = t(key);
  
  if (Array.isArray(result)) {
    return result;
  }
  
  if (typeof result === 'string') {
    return [result];
  }
  
  if (result === undefined) {
    return defaultValue;
  }
  
  return [String(result)];
}

/**
 * 获取数字类型的翻译文本
 */
export function getTNumber(
  t: (key: string) => string | string[] | undefined, 
  key: string, 
  defaultValue: number = 0
): number {
  if (!t || typeof t !== 'function') {
    console.warn('Translation function is not provided or not a function');
    return defaultValue;
  }

  const result = t(key);
  
  if (typeof result === 'number') {
    return result;
  }
  
  if (typeof result === 'string') {
    const parsed = parseInt(result, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  if (result === undefined) {
    return defaultValue;
  }
  
  return defaultValue;
}

/**
 * 获取布尔类型的翻译文本
 */
export function getTBoolean(
  t: (key: string) => string | string[] | undefined, 
  key: string, 
  defaultValue: boolean = false
): boolean {
  if (!t || typeof t !== 'function') {
    console.warn('Translation function is not provided or not a function');
    return defaultValue;
  }

  const result = t(key);
  
  if (typeof result === 'boolean') {
    return result;
  }
  
  if (typeof result === 'string') {
    return result.toLowerCase() === 'true' || result === '1';
  }
  
  if (result === undefined) {
    return defaultValue;
  }
  
  return defaultValue;
}

/**
 * 安全的翻译获取器，提供完整的类型安全和默认值
 */
export class TranslationHelper {
  constructor(
    private t: (key: string) => string | string[] | undefined,
    private fallback: string = ''
  ) {}

  string(key: string, defaultValue?: string): string {
    return getT(this.t, key, defaultValue || this.fallback);
  }

  array(key: string, defaultValue: string[] = []): string[] {
    return getTArray(this.t, key, defaultValue);
  }

  number(key: string, defaultValue: number = 0): number {
    return getTNumber(this.t, key, defaultValue);
  }

  boolean(key: string, defaultValue: boolean = false): boolean {
    return getTBoolean(this.t, key, defaultValue);
  }

  /**
   * 创建带有特定前缀的翻译助手
   */
  withPrefix(prefix: string): TranslationHelper {
    return new TranslationHelper(
      (key: string) => this.t(`${prefix}.${key}`),
      this.fallback
    );
  }
}

/**
 * 创建翻译助手实例
 */
export function createTranslationHelper(
  t: (key: string) => string | string[] | undefined,
  fallback: string = ''
): TranslationHelper {
  return new TranslationHelper(t, fallback);
}