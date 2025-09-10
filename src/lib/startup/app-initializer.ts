/**
 * Application Initializer
 * 应用程序启动初始化器
 */

import { initializeLogging } from '@/lib/logging/log-initializer';
import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('AppInitializer');

/**
 * 初始化应用程序
 */
export async function initializeApp(): Promise<void> {
  try {
    logger.info('Starting application initialization...');
    
    // 1. 初始化日志系统
    await initializeLogging();
    logger.info('✓ Logging system initialized');
    
    // 2. 其他初始化任务可以在这里添加
    // 例如：数据库连接、缓存初始化、外部服务连接等
    
    logger.info('Application initialization completed successfully');
  } catch (error) {
    logger.error('Application initialization failed:', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * 应用程序健康检查
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  checks: Record<string, boolean>;
  timestamp: string;
}> {
  const checks: Record<string, boolean> = {};
  
  try {
    // 检查日志系统
    const { checkLoggingHealth } = await import('@/lib/logging/log-initializer');
    checks.logging = await checkLoggingHealth();
    
    // 其他健康检查可以在这里添加
    checks.memory = process.memoryUsage().heapUsed < 500 * 1024 * 1024; // 500MB
    
    const allHealthy = Object.values(checks).every(check => check);
    
    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Health check failed:', error instanceof Error ? error : new Error(String(error)));
    return {
      status: 'unhealthy',
      checks,
      timestamp: new Date().toISOString()
    };
  }
}