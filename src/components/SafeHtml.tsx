/**
 * SafeHtml Component
 * 安全的HTML渲染组件，自动清理HTML内容以防止XSS攻击
 */

import React, { ElementType } from 'react';
import { sanitizeHtml, sanitizeI18nContent, sanitizeUserInput } from "@/lib/utils/security/sanitize";

interface SafeHtmlProps {
  /** 要渲染的HTML内容 */
  html: string;
  /** 渲染模式 */
  mode?: 'html' | 'i18n' | 'user-input';
  /** 自定义清理选项 */
  sanitizeOptions?: {
    allowedTags?: string[];
    allowedAttributes?: string[];
    forbiddenTags?: string[];
    forbiddenAttributes?: string[];
  };
  /** 额外的CSS类名 */
  className?: string;
  /** HTML元素标签类型 */
  as?: ElementType;
  /** 其他HTML属性 */
  [key: string]: unknown;
}

/**
 * 安全的HTML渲染组件
 */
export const SafeHtml: React.FC<SafeHtmlProps> = ({
  html,
  mode = 'html',
  sanitizeOptions,
  className,
  as: Component = 'div',
  ...props
}) => {
  // 根据模式选择合适的清理函数
  const getSanitizedHtml = () => {
    if (!html || typeof html !== 'string') {
      return '';
    }

    switch (mode) {
      case 'i18n':
        return sanitizeI18nContent(html);
      case 'user-input':
        return sanitizeUserInput(html);
      case 'html':
      default:
        // 转换属性名以匹配 sanitizeHtml 的期望格式
        const convertedOptions = sanitizeOptions ? {
          ALLOWED_TAGS: sanitizeOptions.allowedTags,
          ALLOWED_ATTR: sanitizeOptions.allowedAttributes,
          FORBID_TAGS: sanitizeOptions.forbiddenTags,
          FORBID_ATTR: sanitizeOptions.forbiddenAttributes
        } : undefined;
        return sanitizeHtml(html, convertedOptions);
    }
  };

  const sanitizedHtml = getSanitizedHtml();

  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      {...props}
    />
  );
};

/**
 * 专门用于国际化内容的安全HTML组件
 */
export const SafeI18nHtml: React.FC<Omit<SafeHtmlProps, 'mode'> & { html: string }> = (props) => (
  <SafeHtml {...props} mode="i18n" />
);

/**
 * 专门用于用户输入内容的安全HTML组件
 */
export const SafeUserHtml: React.FC<Omit<SafeHtmlProps, 'mode'> & { html: string }> = (props) => (
  <SafeHtml {...props} mode="user-input" />
);

/**
 * 用于渲染受信任内容的组件（如系统生成的内容）
 * 仍然会进行基本的清理，但允许更多的HTML标签
 */
export const TrustedHtml: React.FC<Omit<SafeHtmlProps, 'mode' | 'sanitizeOptions'> & { html: string }> = (props) => (
  <SafeHtml
    {...props}
    mode="html"
    sanitizeOptions={{
      allowedTags: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        'a', 'code', 'pre', 'blockquote',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'img'
      ],
      allowedAttributes: [
        'href', 'target', 'rel', 'class', 'id', 'title',
        'src', 'alt', 'width', 'height'
      ]
    }}
  />
);

export default SafeHtml;