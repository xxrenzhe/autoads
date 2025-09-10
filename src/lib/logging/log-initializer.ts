/**
 * Log Initializer
 * 日志系统初始化器，确保在生产环境中所有日志都写入文件
 */

import { createDefaultLoggingService } from './LoggingService';
import { createLogger } from '@/lib/utils/security/secure-logger';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = createLogger('LogInitializer');

/**
 * 初始化日志系统
 */
export async function initializeLogging(): Promise<void> {
  try {
    // 确保日志目录存在
    const logDir = './logs';
    await fs.mkdir(logDir, { recursive: true });
    
    // 创建默认日志文件（如果不存在）
    const logFiles = ['app.log', 'output.log'];
    
    for (const logFile of logFiles) {
      const logPath = path.join(logDir, logFile);
      try {
        await fs.access(logPath);
      } catch (error) {
        // 文件不存在，创建空文件
        await fs.writeFile(logPath, `# ${logFile} - Created at ${new Date().toISOString()}\n`);
        logger.info(`Created log file: ${logPath}`);
      }
    }
    
    // 初始化日志服务
    const loggingService = createDefaultLoggingService();
    
    // 记录初始化成功
    loggingService.info('Logging system initialized successfully');
    
    logger.info('Logging system initialized successfully');
    
    // 设置进程退出时的清理
    process.on('exit', () => {
      loggingService.flush().catch(console.error);
    });
    
    process.on('SIGINT', () => {
      loggingService.flush().then(() => process.exit(0)).catch(() => process.exit(1));
    });
    
    process.on('SIGTERM', () => {
      loggingService.flush().then(() => process.exit(0)).catch(() => process.exit(1));
    });
    
  } catch (error) {
    console.error('Failed to initialize logging system:', error);
    throw error;
  }
}

/**
 * 检查日志系统健康状态
 */
export async function checkLoggingHealth(): Promise<boolean> {
  try {
    const logDir = './logs';
    const logFiles = ['app.log', 'output.log'];
    
    // 检查日志目录是否存在
    await fs.access(logDir);
    
    // 检查日志文件是否可写
    for (const logFile of logFiles) {
      const logPath = path.join(logDir, logFile);
      await fs.access(logPath, fs.constants.W_OK);
    }
    
    return true;
  } catch (error) {
    logger.error('Logging health check failed:', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * 获取日志统计信息
 */
export async function getLoggingStats(): Promise<{
  logDirectory: string;
  files: Array<{
    name: string;
    size: number;
    lastModified: Date;
  }>;
}> {
  const logDir = './logs';
  const stats = {
    logDirectory: logDir,
    files: [] as Array<{
      name: string;
      size: number;
      lastModified: Date;
    }>
  };
  
  try {
    const files = await fs.readdir(logDir);
    
    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(logDir, file);
        const fileStat = await fs.stat(filePath);
        
        stats.files.push({
          name: file,
          size: fileStat.size,
          lastModified: fileStat.mtime
        });
      }
    }
  } catch (error) {
    logger.error('Failed to get logging stats:', error instanceof Error ? error : new Error(String(error)));
  }
  
  return stats;
}