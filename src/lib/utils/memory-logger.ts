/**
 * Memory Monitoring Logger
 * 专门用于内存监控相关日志的记录器，将日志写入独立文件
 */

import { promises as fs } from 'fs';
import path from 'path';

export enum MemoryLogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface MemoryLogEntry {
  timestamp: string;
  level: MemoryLogLevel;
  component: 'GCOptimizer' | 'MemoryPressure' | 'AggressiveCleanup' | 'MemoryMonitoring';
  message: string;
  data?: Record<string, unknown>;
  metrics?: {
    rss?: number;
    heapTotal?: number;
    heapUsed?: number;
    external?: number;
    heapUsedPercent?: number;
  };
}

export class MemoryLogger {
  private component: 'GCOptimizer' | 'MemoryPressure' | 'AggressiveCleanup' | 'MemoryMonitoring';
  private logDir: string;
  private enableConsole: boolean;

  constructor(
    component: 'GCOptimizer' | 'MemoryPressure' | 'AggressiveCleanup' | 'MemoryMonitoring',
    options: {
      enableConsole?: boolean;
      logDir?: string;
    } = {}
  ) {
    this.component = component;
    this.logDir = options.logDir || './logs';
    this.enableConsole = options.enableConsole ?? true;
  }

  debug(message: string, data?: Record<string, unknown>, metrics?: MemoryLogEntry['metrics']): void {
    this.log(MemoryLogLevel.DEBUG, message, data, metrics);
  }

  info(message: string, data?: Record<string, unknown>, metrics?: MemoryLogEntry['metrics']): void {
    this.log(MemoryLogLevel.INFO, message, data, metrics);
  }

  warn(message: string, data?: Record<string, unknown>, metrics?: MemoryLogEntry['metrics']): void {
    this.log(MemoryLogLevel.WARN, message, data, metrics);
  }

  error(message: string, data?: Record<string, unknown>, metrics?: MemoryLogEntry['metrics']): void {
    this.log(MemoryLogLevel.ERROR, message, data, metrics);
  }

  private async log(level: MemoryLogLevel, message: string, data?: Record<string, unknown>, metrics?: MemoryLogEntry['metrics']): Promise<void> {
    const entry: MemoryLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
      data,
      metrics
    };

    // 确保日志目录存在
    await fs.mkdir(this.logDir, { recursive: true });

    // 根据组件选择日志文件
    let logFile: string;
    switch (this.component) {
      case 'GCOptimizer':
        logFile = 'gc-optimizer.log';
        break;
      case 'MemoryPressure':
        logFile = 'memory-pressure.log';
        break;
      case 'AggressiveCleanup':
        logFile = 'aggressive-cleanup.log';
        break;
      default:
        logFile = 'memory-monitoring.log';
    }

    // 格式化日志条目
    const formattedLog = this.formatLog(entry);
    const logPath = path.join(this.logDir, logFile);

    // 写入文件
    try {
      await fs.appendFile(logPath, formattedLog + '\n');
    } catch (error) {
      console.error(`Failed to write to ${logFile}:`, error);
    }

    // 同时输出到控制台（如果启用）
    if (this.enableConsole) {
      const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
      const levelName = levelNames[level];
      
      // 检查是否在Docker环境中
      const isDockerEnv = process.env.DOCKER_ENV === 'true' || 
                         process.env.RUNNING_IN_DOCKER === 'true' ||
                         (process.env.NODE_ENV === 'production' && !process.env.VERCEL);
      
      if (isDockerEnv) {
        // Docker环境输出JSON格式
        const logJson = JSON.stringify({
          timestamp: entry.timestamp,
          level: levelName,
          component: entry.component,
          message: entry.message,
          data: entry.data,
          metrics: entry.metrics,
          type: 'memory-log'
        });
        
        switch (level) {
          case MemoryLogLevel.ERROR:
            console.error(logJson);
            break;
          case MemoryLogLevel.WARN:
            console.warn(logJson);
            break;
          case MemoryLogLevel.INFO:
            console.log(logJson);
            break;
          case MemoryLogLevel.DEBUG:
            if (process.env.NODE_ENV === 'development') {
              console.log(logJson);
            }
            break;
        }
      } else {
        // 非Docker环境输出格式化文本
        const colorCodes = {
          ERROR: '\x1b[31m',
          WARN: '\x1b[33m',
          INFO: '\x1b[36m',
          DEBUG: '\x1b[90m',
          RESET: '\x1b[0m'
        };
        
        const color = colorCodes[levelName as keyof typeof colorCodes];
        const reset = colorCodes.RESET;
        
        const metricsStr = metrics ? ` [RSS: ${Math.round((metrics.rss || 0) / 1024 / 1024)}MB, Heap: ${Math.round((metrics.heapUsed || 0) / 1024 / 1024)}/${Math.round((metrics.heapTotal || 0) / 1024 / 1024)}MB (${((metrics.heapUsedPercent || 0) * 100).toFixed(1)}%)]` : '';
        
        console.log(`${color}[${entry.timestamp}] ${levelName} [${entry.component}]${reset} ${message}${metricsStr}`);
      }
    }
  }

  private formatLog(entry: MemoryLogEntry): string {
    const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const levelName = levelNames[entry.level];
    
    const metricsStr = entry.metrics ? 
      ` [RSS: ${Math.round((entry.metrics.rss || 0) / 1024 / 1024)}MB, Heap: ${Math.round((entry.metrics.heapUsed || 0) / 1024 / 1024)}/${Math.round((entry.metrics.heapTotal || 0) / 1024 / 1024)}MB (${((entry.metrics.heapUsedPercent || 0) * 100).toFixed(1)}%)]` : '';
    
    const dataStr = entry.data ? ` | ${JSON.stringify(entry.data)}` : '';
    
    return `[${entry.timestamp}] ${levelName} [${entry.component}] ${entry.message}${metricsStr}${dataStr}`;
  }
}

// 创建内存监控日志记录器的工厂函数
const memoryLoggers = new Map<string, MemoryLogger>();

export function createMemoryLogger(
  component: 'GCOptimizer' | 'MemoryPressure' | 'AggressiveCleanup' | 'MemoryMonitoring'
): MemoryLogger {
  if (!memoryLoggers.has(component)) {
    const logger = new MemoryLogger(component, {
      enableConsole: true,
      logDir: './logs'
    });
    memoryLoggers.set(component, logger);
  }
  
  return memoryLoggers.get(component)!;
}