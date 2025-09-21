/**
 * 低内存环境配置
 * 专为1CPU 1GB内存容器优化
 */

// 浏览器池配置 - 大幅降低资源使用
export const LOW_MEMORY_BROWSER_CONFIG = {
  maxInstances: 1,        // 1核只能跑1个实例
  maxPagesPerInstance: 3, // 每个实例最多3个页面
  idleTimeout: 2 * 60 * 1000, // 2分钟空闲超时（降低60%）
  healthCheckInterval: 1 * 60 * 1000, // 1分钟健康检查
  cleanupInterval: 30 * 1000, // 30秒清理一次（更频繁）
  maxAge: 10 * 60 * 1000, // 10分钟最大生命周期（降低67%）
  browserType: 'chromium' as const
};

// 任务管理器配置 - 更激进的清理策略
export const LOW_MEMORY_TASK_CONFIG = {
  CLEANUP_INTERVAL: 1 * 60 * 1000, // 1分钟清理（更频繁）
  TASK_LIFECYCLE: {
    EXPIRED: 10 * 60 * 1000, // 10分钟 - 过期任务（降低67%）
    FAILED: 5 * 60 * 1000,   // 5分钟 - 失败任务（降低67%）
    COMPLETED: 2 * 60 * 1000, // 2分钟 - 完成任务（降低60%）
    TERMINATED: 1 * 60 * 1000, // 1分钟 - 终止任务（降低50%）
    IDLE: 5 * 60 * 1000      // 5分钟 - 空闲任务（降低75%）
  },
  MEMORY_MONITOR: {
    WARNING_THRESHOLD: 10,    // 10个任务警告（降低80%）
    CRITICAL_THRESHOLD: 20,   // 20个任务强制清理（降低80%）
    MAX_TASKS: 30           // 最大30个任务（降低80%）
  },
  ADAPTIVE: {
    HIGH_LOAD_THRESHOLD: 0.7, // 70%就触发（更敏感）
    CLEANUP_MULTIPLIER: 3,    // 高负载时清理间隔乘数
    TASK_LIFECYCLE_MULTIPLIER: 0.3, // 高负载时任务生命周期乘数
    MIN_CLEANUP_INTERVAL: 20 * 1000, // 最小20秒
    MAX_CLEANUP_INTERVAL: 5 * 60 * 1000 // 最大5分钟
  }
};

// 代理缓存配置
export const LOW_MEMORY_PROXY_CONFIG = {
  MAX_CACHE_SIZE: 20,         // 最大缓存20个代理
  CACHE_TTL: 10 * 60 * 1000,  // 10分钟过期
  CLEANUP_INTERVAL: 2 * 60 * 1000, // 2分钟清理一次
  ENABLE_COMPRESSION: true,   // 启用压缩
  MAX_REQUESTS_PER_PROXY: 10, // 每个代理最多10次请求
  FAIL_FAST: true            // 快速失败模式
};

// Playwright 配置优化
export const LOW_MEMORY_PLAYWRIGHT_CONFIG = {
  launchOptions: {
    headless: true,
    timeout: 30000,          // 30秒超时
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-images',      // 禁用图片
      '--disable-javascript',  // 禁用JS（如需要）
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-web-security',
      '--ignore-certificate-errors',
      '--single-process',     // 单进程模式
      '--disable-features=VizDisplayCompositor',
      '--memory-pressure-off', // 关闭内存压力检测
      '--max-old-space-size=512', // 限制浏览器内存
      '--disable-background-mode',
      '--disable-client-side-phishing-detection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost'
    ]
  },
  contextOptions: {
    viewport: { width: 1024, height: 768 }, // 更小视口
    javaScriptEnabled: false, // 根据需求决定
    ignoreHTTPSErrors: true,
    bypassCSP: true,
    serviceWorkers: 'block'
  }
};

// 并发控制配置
export const LOW_MEMORY_CONCURRENCY_CONFIG = {
  MAX_CONCURRENT_TASKS: 1,     // 1核只能跑1个任务
  MAX_CONCURRENT_URLS: 3,      // 最多3个并发URL
  REQUEST_TIMEOUT: 30000,      // 30秒超时
  RETRY_DELAY: 1000,           // 1秒重试延迟
  MAX_RETRIES: 2               // 最多重试2次
};

// 日志配置优化
export const LOW_MEMORY_LOG_CONFIG = {
  MAX_FILE_SIZE: '5MB',       // 5MB文件大小
  MAX_FILES: 2,               // 保留2个文件
  COMPRESS: true,
  RETENTION_DAYS: 1,           // 只保留1天
  LEVEL: 'warn'                // 只记录警告及以上级别
};

// 检测是否为低内存环境
export function isLowMemoryEnvironment(): boolean {
  // 检查容器内存限制
  const memoryLimit = process.env.MEMORY_LIMIT || 
                     process.env.CONTAINER_MEMORY_LIMIT || 
                     process.env.LOW_MEMORY_MODE;
  
  if (memoryLimit && memoryLimit !== '0') {
    const limitMB = parseInt(memoryLimit);
    return limitMB <= 1024; // 小于等于1GB
  }
  
  // 检查Node.js内存限制
  const nodeOptions = process.env.NODE_OPTIONS || '';
  if (nodeOptions.includes('--max-old-space-size')) {
    const match = nodeOptions.match(/--max-old-space-size[= ](\d+)/);
    if (match && parseInt(match[1]) <= 768) {
      return true;
    }
  }
  
  // 检查环境变量
  const envTrue = (v?: string) => ['true', '1', 'yes', 'on'].includes((v ?? '').toLowerCase())
  return envTrue(process.env.LOW_MEMORY_MODE) ||
         envTrue(process.env.DOCKER_ENV) ||
         envTrue(process.env.VERCEL);
}

// 导出所有配置
export const LOW_MEMORY_CONFIG = {
  browser: LOW_MEMORY_BROWSER_CONFIG,
  task: LOW_MEMORY_TASK_CONFIG,
  proxy: LOW_MEMORY_PROXY_CONFIG,
  playwright: LOW_MEMORY_PLAYWRIGHT_CONFIG,
  concurrency: LOW_MEMORY_CONCURRENCY_CONFIG,
  log: LOW_MEMORY_LOG_CONFIG
};
