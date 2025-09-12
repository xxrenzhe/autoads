/**
 * HTML Sanitization Utilities
 * 用于安全地处理HTML内容，防止XSS攻击
 */

import DOMPurify from 'dompurify';

/**
 * 安全的HTML清理配置
 */
const SAFE_HTML_CONFIG = {
  // 允许的标签
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'code', 'pre'
  ],
  // 允许的属性
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id'],
  // 禁止的标签
  FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'textarea', 'select'],
  // 禁止的属性
  FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur']
};

/**
 * 清理HTML内容，移除潜在的XSS攻击向量
 * @param html - 要清理的HTML字符串
 * @param options - 可选的清理配置
 * @returns 清理后的安全HTML字符串
 */
export function sanitizeHtml(html: string, options?: Partial<typeof SAFE_HTML_CONFIG>): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const config = { ...SAFE_HTML_CONFIG, ...options };
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: config.ALLOWED_TAGS,
    ALLOWED_ATTR: config.ALLOWED_ATTR,
    FORBID_TAGS: config.FORBID_TAGS,
    FORBID_ATTR: config.FORBID_ATTR,
    KEEP_CONTENT: true
  });
}

/**
 * 清理用户输入的文本内容，只保留纯文本
 * @param input - 用户输入的内容
 * @returns 清理后的纯文本
 */
export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // 移除所有HTML标签，只保留纯文本
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
}

/**
 * 清理国际化内容，允许基本的格式化标签
 * @param i18nContent - 国际化内容
 * @returns 清理后的安全HTML
 */
export function sanitizeI18nContent(i18nContent: string): string {
  if (!i18nContent || typeof i18nContent !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(i18nContent, {
    ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'u', 'br', 'span', 'code', 'a', 'div'],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel'],
    KEEP_CONTENT: true
  });
}

/**
 * 验证HTML内容是否安全
 * @param html - 要验证的HTML内容
 * @returns 如果内容安全返回true，否则返回false
 */
export function isHtmlSafe(html: string): boolean {
  if (!html || typeof html !== 'string') {
    return true;
  }

  const cleaned = sanitizeHtml(html);
  return cleaned === html;
}

/**
 * React组件的安全HTML渲染Hook
 * @param html - 要渲染的HTML内容
 * @param options - 清理选项
 * @returns 包含清理后HTML的对象，可直接用于dangerouslySetInnerHTML
 */
export function useSafeHtml(html: string, options?: Partial<typeof SAFE_HTML_CONFIG>) {
  const sanitizedHtml = sanitizeHtml(html, options);
  
  return {
    __html: sanitizedHtml
  };
}

/**
 * 用于国际化内容的安全渲染Hook
 * @param i18nContent - 国际化内容
 * @returns 包含清理后HTML的对象
 */
export function useSafeI18nHtml(i18nContent: string) {
  const sanitizedHtml = sanitizeI18nContent(i18nContent);
  
  return {
    __html: sanitizedHtml
  };
}