/**
 * Security Configuration
 * 安全配置文件，定义了应用程序的安全策略
 */

/**
 * HTML清理配置
 */
export const HTML_SANITIZE_CONFIG = {
  // 基本安全配置 - 用于用户输入
  BASIC: {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i'],
    ALLOWED_ATTR: [],
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'iframe'],
    FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'style']
  },
  
  // 国际化内容配置 - 用于翻译文本
  I18N: {
    ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'u', 'br', 'span', 'code'],
    ALLOWED_ATTR: ['class'],
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'iframe'],
    FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'style']
  },
  
  // 富文本配置 - 用于编辑器内容
  RICH_TEXT: {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      'a', 'code', 'pre', 'blockquote'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id'],
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'iframe'],
    FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur']
  },
  
  // 严格配置 - 只允许纯文本
  STRICT: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    FORBID_TAGS: ['*'],
    FORBID_ATTR: ['*']
  }
};

/**
 * 内容安全策略 (CSP) 配置
 */
export const CSP_CONFIG = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // 需要用于Google Analytics等
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com'
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // 需要用于Tailwind CSS
    'https://fonts.googleapis.com'
  ],
  'font-src': [
    "'self'",
    'https://fonts.gstatic.com'
  ],
  'img-src': [
    "'self'",
    'data:',
    'https:'
  ],
  'connect-src': [
    "'self'",
    'https://www.google-analytics.com',
    'https://ipapi.co'
  ],
  'frame-src': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"]
};

/**
 * 输入验证配置
 */
export const INPUT_VALIDATION_CONFIG = {
  // 文本输入限制
  TEXT_INPUT: {
    MAX_LENGTH: 1000,
    MIN_LENGTH: 0,
    ALLOWED_CHARS: /^[a-zA-Z0-9\s\u4e00-\u9fff\-_.,!?()[\]{}'"@#$%^&*+=|\\:;<>/~`]*$/
  },
  
  // 邮箱验证
  EMAIL: {
    MAX_LENGTH: 254,
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  
  // URL验证
  URL: {
    MAX_LENGTH: 2048,
    ALLOWED_PROTOCOLS: ['http:', 'https:']
  },
  
  // API密钥验证
  API_KEY: {
    MIN_LENGTH: 20,
    MAX_LENGTH: 100,
    PATTERN: /^[a-zA-Z0-9_-]+$/
  },
  
  // 文件名验证
  FILENAME: {
    MAX_LENGTH: 255,
    FORBIDDEN_CHARS: /[<>:"|?*\x00-\x1f]/,
    FORBIDDEN_NAMES: ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']
  }
};

/**
 * 速率限制配置
 */
export const RATE_LIMIT_CONFIG = {
  // API请求限制
  API_REQUESTS: {
    WINDOW_MS: 15 * 60 * 1000, // 15分钟
    MAX_REQUESTS: 100
  },
  
  // 登录尝试限制
  LOGIN_ATTEMPTS: {
    WINDOW_MS: 15 * 60 * 1000, // 15分钟
    MAX_ATTEMPTS: 5
  },
  
  // 文件上传限制
  FILE_UPLOAD: {
    WINDOW_MS: 60 * 1000, // 1分钟
    MAX_UPLOADS: 10,
    MAX_FILE_SIZE: 10 * 1024 * 1024 // 10MB
  }
};

/**
 * 敏感数据处理配置
 */
export const SENSITIVE_DATA_CONFIG = {
  // 需要加密的字段
  ENCRYPTED_FIELDS: [
    'password',
    'apiKey',
    'secret',
    'token',
    'credentials'
  ],
  
  // 需要脱敏的字段
  MASKED_FIELDS: [
    'email',
    'phone',
    'creditCard',
    'ssn'
  ],
  
  // 日志中需要过滤的字段
  LOG_FILTERED_FIELDS: [
    'password',
    'token',
    'secret',
    'apiKey',
    'credentials',
    'authorization'
  ]
};

/**
 * 会话安全配置
 */
export const SESSION_CONFIG = {
  // 会话超时时间 (毫秒)
  TIMEOUT: 30 * 60 * 1000, // 30分钟
  
  // 会话刷新间隔 (毫秒)
  REFRESH_INTERVAL: 5 * 60 * 1000, // 5分钟
  
  // Cookie配置
  COOKIE: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 30 * 60 * 1000 // 30分钟
  }
};

/**
 * 获取CSP头部字符串
 */
export function getCSPHeader(): string {
  return Object.entries(CSP_CONFIG)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

/**
 * 检查是否为敏感字段
 */
export function isSensitiveField(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  return SENSITIVE_DATA_CONFIG.ENCRYPTED_FIELDS.some(field => 
    lowerFieldName.includes(field.toLowerCase())
  ) || SENSITIVE_DATA_CONFIG.MASKED_FIELDS.some(field => 
    lowerFieldName.includes(field.toLowerCase())
  );
}

/**
 * 检查字段是否应该从日志中过滤
 */
export function shouldFilterFromLogs(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  return SENSITIVE_DATA_CONFIG.LOG_FILTERED_FIELDS.some(field => 
    lowerFieldName.includes(field.toLowerCase())
  );
}