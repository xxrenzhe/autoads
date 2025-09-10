/**
 * 浏览器实例优化配置
 * 解决浏览器实例池达到上限的问题
 */

// 增强的浏览器实例配置
export const BROWSER_INSTANCE_CONFIG = {
  // 生产环境配置
  production: {
    maxInstances: 8,            // 限制为8个实例以避免资源耗尽
    maxTasksPerInstance: 15,    // 每个实例最大任务数
    maxPagesPerInstance: 10,    // 每个实例最大页面数
    
    // 实例管理
    instanceTimeout: 30000,     // 30秒超时
    idleTimeout: 60000,         // 60秒空闲超时
    healthCheckInterval: 30000, // 30秒健康检查
    
    // 性能优化
    adaptiveTimeout: {
      enabled: true,
      minTimeout: 10000,       // 10秒最小超时
      maxTimeout: 120000,      // 2分钟最大超时
      baseTimeout: 30000       // 30秒基础超时
    },
    
    // 资源管理
    memory: {
      threshold: 0.8,          // 80%内存使用率阈值
      checkInterval: 30000     // 30秒检查间隔
    },
    
    // 重试策略
    retry: {
      maxAttempts: 3,
      baseDelay: 1000,         // 1秒基础延迟
      maxDelay: 30000,         // 30秒最大延迟
      backoffFactor: 2         // 指数退避因子
    }
  },
  
  // 开发环境配置
  development: {
    maxInstances: 5,            // 开发环境5个实例
    maxTasksPerInstance: 10,
    maxPagesPerInstance: 8,
    
    instanceTimeout: 60000,     // 开发环境超时更长
    idleTimeout: 120000,
    healthCheckInterval: 60000,
    
    adaptiveTimeout: {
      enabled: true,
      minTimeout: 15000,
      maxTimeout: 180000,
      baseTimeout: 45000
    },
    
    memory: {
      threshold: 0.7,
      checkInterval: 60000
    },
    
    retry: {
      maxAttempts: 5,           // 开发环境更多重试
      baseDelay: 2000,
      maxDelay: 60000,
      backoffFactor: 2
    }
  },
  
  // 测试环境配置
  test: {
    maxInstances: 10,
    maxTasksPerInstance: 5,
    maxPagesPerInstance: 5,
    
    instanceTimeout: 120000,
    idleTimeout: 300000,
    healthCheckInterval: 120000,
    
    adaptiveTimeout: {
      enabled: false,           // 测试环境关闭自适应超时
      minTimeout: 30000,
      maxTimeout: 300000,
      baseTimeout: 60000
    },
    
    memory: {
      threshold: 0.9,
      checkInterval: 120000
    },
    
    retry: {
      maxAttempts: 1,           // 测试环境少重试
      baseDelay: 5000,
      maxDelay: 30000,
      backoffFactor: 1.5
    }
  }
};

// 获取当前环境的配置
export function getBrowserConfig() {
  const env = process.env.NODE_ENV || 'development';
  return BROWSER_INSTANCE_CONFIG[env] || BROWSER_INSTANCE_CONFIG.development;
}

// 动态调整配置的函数
export function adjustBrowserConfig(options: {
  maxInstances?: number;
  maxTasksPerInstance?: number;
  memoryThreshold?: number;
}) {
  const config = getBrowserConfig();
  
  if (options.maxInstances) {
    config.maxInstances = Math.min(options.maxInstances, 100); // 上限100
  }
  
  if (options.maxTasksPerInstance) {
    config.maxTasksPerInstance = Math.min(options.maxTasksPerInstance, 20);
  }
  
  if (options.memoryThreshold) {
    config.memory.threshold = Math.max(0.5, Math.min(options.memoryThreshold, 0.95));
  }
  
  return config;
}

// 导出默认配置
export default getBrowserConfig();