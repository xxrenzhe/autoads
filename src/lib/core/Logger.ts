/**
 * 核心日志服务
 * 提供统一的日志记录功能
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  service: string;
  message: string;
  data?: Record<string, unknown> | string | number | boolean | null;
  requestId?: string;
  userId?: string;
  sessionId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: number;
  format: 'text' | 'json';
}

export class Logger {
  private config: LoggerConfig;
  private service: string;

  constructor(service: string, config: Partial<LoggerConfig> = {}) {
    this.service = service;
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      format: 'text',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      ...config
    };
  }

  debug(message: string, data?: Record<string, unknown> | string | number | boolean | null): void {
    if (this.config.level <= LogLevel.DEBUG) {
      this.log(LogLevel.DEBUG, message, data);
    }
  }

  info(message: string, data?: Record<string, unknown> | string | number | boolean | null): void {
    if (this.config.level <= LogLevel.INFO) {
      this.log(LogLevel.INFO, message, data);
    }
  }

  warn(message: string, data?: Record<string, unknown> | string | number | boolean | null): void {
    if (this.config.level <= LogLevel.WARN) {
      this.log(LogLevel.WARN, message, data);
    }
  }

  error(message: string, data?: Record<string, unknown> | string | number | boolean | null): void {
    if (this.config.level <= LogLevel.ERROR) {
      this.log(LogLevel.ERROR, message, data);
    }
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown> | string | number | boolean | null): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      service: this.service,
      message,
      data,
      requestId: this.getRequestId(),
      userId: this.getUserId(),
      sessionId: this.getSessionId()
    };

    this.output(entry);
  }

  private async output(entry: LogEntry): Promise<void> {
    const formattedLog = this.formatLog(entry);

    if (this.config.enableConsole) {
      this.writeToConsole(entry, formattedLog);
    }

    if (this.config.enableFile) {
      await this.writeToFile(formattedLog);
    }
  }

  private formatLog(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify({
        timestamp: entry.timestamp,
        level: LogLevel[entry.level],
        service: entry.service,
        message: entry.message,
        ...(entry.data && { data: entry.data }),
        ...(entry.requestId && { requestId: entry.requestId }),
        ...(entry.userId && { userId: entry.userId }),
        ...(entry.sessionId && { sessionId: entry.sessionId })
      });
    }

    // Text format
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level].padEnd(5);
    const service = entry.service.padEnd(15);
    let logLine = `[${timestamp}] ${level} ${service} ${entry.message}`;

    if (entry.data) {
      if (typeof entry.data === 'object' && entry.data !== null) {
        logLine += ` ${JSON.stringify(entry.data)}`;
      } else {
        logLine += ` ${entry.data}`;
      }
    }

    if (entry.requestId) {
      logLine += ` [req:${entry.requestId}]`;
    }

    if (entry.userId) {
      logLine += ` [user:${entry.userId}]`;
    }

    if (entry.sessionId) {
      logLine += ` [session:${entry.sessionId}]`;
    }

    return logLine;
  }

  private writeToConsole(entry: LogEntry, formattedLog: string): void {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m'  // Red
    };

    const reset = '\x1b[0m';
    const color = colors[entry.level] || '';
    
    console.log(`${color}${formattedLog}${reset}`);
  }

  private async writeToFile(formattedLog: string): Promise<void> { 
      try {
        const fs = await import('fs/promises');
        const path = await import('path');

        // 确保日志目录存在
        const logDir = path.dirname(this.config.filePath!);
        await fs.mkdir(logDir, { recursive: true });
        // 写入日志文件
        await fs.appendFile(this.config.filePath!, formattedLog + '\n');

        // 检查文件大小并轮转
        await this.rotateLogFile();
      } catch (error) {
        console.error('Failed to write to log file:', error);
      }
    }

  private async rotateLogFile(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const stats = await fs.stat(this.config.filePath!);
      
      if (stats.size > this.config.maxFileSize!) {
        const dir = path.dirname(this.config.filePath!);
        const ext = path.extname(this.config.filePath!);
        const name = path.basename(this.config.filePath!, ext);
        
        // 轮转日志文件
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = path.join(dir, `${name}.${timestamp}${ext}`);
        
        await fs.rename(this.config.filePath!, rotatedPath);
        
        // 创建新的日志文件
        await fs.writeFile(this.config.filePath!, '');
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  private getRequestId(): string | undefined {
    try {
      return (global as Record<string, unknown>).__requestId as string;
    } catch {
      return undefined;
    }
  }

  private getUserId(): string | undefined {
    try {
      return (global as Record<string, unknown>).__userId as string;
    } catch {
      return undefined;
    }
  }

  private getSessionId(): string | undefined {
    try {
      return (global as Record<string, unknown>).__sessionId as string;
    } catch {
      return undefined;
    }
  }

  static setRequestId(requestId: string): void {
    (global as Record<string, unknown>).__requestId = requestId;
  }

  static setUserId(userId: string): void {
    (global as Record<string, unknown>).__userId = userId;
  }

  static setSessionId(sessionId: string): void {
    (global as Record<string, unknown>).__sessionId = sessionId;
  }

  static clearContext(): void {
    delete (global as Record<string, unknown>).__requestId;
    delete (global as Record<string, unknown>).__userId;
    delete (global as Record<string, unknown>).__sessionId;
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getLevel(): LogLevel {
    return this.config.level;
  }

  isDebugEnabled(): boolean {
    return this.config.level <= LogLevel.DEBUG;
  }

  isInfoEnabled(): boolean {
    return this.config.level <= LogLevel.INFO;
  }

  isWarnEnabled(): boolean {
    return this.config.level <= LogLevel.WARN;
  }

  isErrorEnabled(): boolean {
    return this.config.level <= LogLevel.ERROR;
  }
}