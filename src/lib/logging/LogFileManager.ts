import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('LogFileManager');

export interface LogFileInfo {
  filename: string;
  path: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  isCurrent: boolean;
}

export class LogFileManager {
  private logDirectory: string;
  private baseFileName: string;

  constructor(logDirectory: string = './logs', baseFileName: string = 'app.log') {
    this.logDirectory = logDirectory;
    this.baseFileName = baseFileName;
  }

  /**
   * 获取当前日志文件路径
   */
  getCurrentLogPath(): string {
    return path.join(this.logDirectory, this.baseFileName);
  }

  /**
   * 获取日志目录路径
   */
  getLogDirectory(): string {
    return this.logDirectory;
  }

  /**
   * 确保日志目录存在
   */
  async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDirectory, { recursive: true });
    } catch (error) {
      throw new EnhancedError('Failed to create log directory', {
        directory: this.logDirectory,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 获取所有日志文件信息
   */
  async getLogFiles(): Promise<LogFileInfo[]> {
    try {
      await this.ensureLogDirectory();
      
      const files = await fs.readdir(this.logDirectory);
      const logFiles = files.filter(file => 
        file.endsWith('.log') && 
        (file === this.baseFileName || file.startsWith(this.baseFileName.replace('.log', '-')))
      );

      const fileInfos: LogFileInfo[] = [];

      for (const filename of logFiles) {
        try {
          const filePath = path.join(this.logDirectory, filename);
          const stats = await fs.stat(filePath);
          
          fileInfos.push({
            filename,
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            isCurrent: filename === this.baseFileName
          });
        } catch (error) {
          logger.warn(`Failed to get stats for log file ${filename}:`, new EnhancedError('Failed to get file stats', {
            filename,
            error: error instanceof Error ? error.message : String(error)
          }));
        }
      }

      // 按修改时间排序，最新的在前
      return fileInfos.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
    } catch (error) {
      throw new EnhancedError('Failed to get log files', {
        directory: this.logDirectory,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 读取日志文件内容
   */
  async readLogFile(filename: string, options?: {
    start?: number;
    end?: number;
    encoding?: BufferEncoding;
  }): Promise<string> {
    const filePath = path.join(this.logDirectory, filename);
    
    try {
      // 检查文件是否存在且在日志目录中
      const resolvedPath = path.resolve(filePath);
      const resolvedLogDir = path.resolve(this.logDirectory);
      
      if (!resolvedPath.startsWith(resolvedLogDir)) {
        throw new Error('File path is outside log directory');
      }

      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }

      if (options?.start !== undefined || options?.end !== undefined) {
        // 读取文件的特定部分
        const fileHandle = await fs.open(filePath, 'r');
        try {
          const start = options.start || 0;
          const end = options.end || stats.size;
          const length = end - start;
          
          const buffer = Buffer.alloc(length);
          await fileHandle.read(buffer, 0, length, start);
          
          return buffer.toString(options.encoding || 'utf8');
        } finally {
          await fileHandle.close();
        }
      } else {
        // 读取整个文件
        try {

        return await fs.readFile(filePath, options?.encoding || 'utf8');

        } catch (error) {

          console.error(error);

          return '';

        }
      }
    } catch (error) {
      throw new EnhancedError('Failed to read log file', {
        filename,
        filePath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 获取日志文件的最后N行
   */
  async getLastLines(filename: string, lineCount: number = 100): Promise<string[]> {
    try {
      const content = await this.readLogFile(filename);
      const lines = content.split('\n').filter(line => line.trim() !== '');
      
      return lines.slice(-lineCount);
    } catch (error) {
      throw new EnhancedError('Failed to get last lines from log file', {
        filename,
        lineCount,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 搜索日志文件中的内容
   */
  async searchLogFile(filename: string, searchTerm: string, options?: {
    caseSensitive?: boolean;
    maxResults?: number;
  }): Promise<string[]> {
    try {
      const content = await this.readLogFile(filename);
      const lines = content.split('\n');
      
      const searchRegex = new RegExp(
        searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), // 转义特殊字符
        options?.caseSensitive ? 'g' : 'gi'
      );

      const matchingLines = lines.filter(line => searchRegex.test(line));
      
      if (options?.maxResults) {
        return matchingLines.slice(0, options.maxResults);
      }
      
      return matchingLines;
    } catch (error) {
      throw new EnhancedError('Failed to search log file', {
        filename,
        searchTerm,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 删除日志文件
   */
  async deleteLogFile(filename: string): Promise<void> {
    // 不允许删除当前日志文件
    if (filename === this.baseFileName) {
      throw new Error('Cannot delete current log file');
    }

    const filePath = path.join(this.logDirectory, filename);
    
    try {
      // 安全检查：确保文件在日志目录中
      const resolvedPath = path.resolve(filePath);
      const resolvedLogDir = path.resolve(this.logDirectory);
      
      if (!resolvedPath.startsWith(resolvedLogDir)) {
        throw new Error('File path is outside log directory');
      }

      await fs.unlink(filePath);
      logger.info(`Deleted log file: ${filename}`);
    } catch (error) {
      throw new EnhancedError('Failed to delete log file', {
        filename,
        filePath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 获取日志目录的磁盘使用情况
   */
  async getDiskUsage(): Promise<{
    totalSize: number;
    fileCount: number;
    oldestFile?: Date;
    newestFile?: Date;
  }> {
    try {
      const logFiles = await this.getLogFiles();
      
      const totalSize = logFiles.reduce((sum, file) => sum + file.size, 0);
      const fileCount = logFiles.length;
      
      let oldestFile: Date | undefined;
      let newestFile: Date | undefined;
      
      if (logFiles.length > 0) {
        oldestFile = logFiles.reduce((oldest, file) => 
          file.modifiedAt < oldest ? file.modifiedAt : oldest, 
          logFiles[0].modifiedAt
        );
        
        newestFile = logFiles.reduce((newest, file) => 
          file.modifiedAt > newest ? file.modifiedAt : newest, 
          logFiles[0].modifiedAt
        );
      }

      return {
        totalSize,
        fileCount,
        oldestFile,
        newestFile
      };
    } catch (error) {
      throw new EnhancedError('Failed to get disk usage', {
        directory: this.logDirectory,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 检查磁盘空间是否充足
   */
  async checkDiskSpace(): Promise<{
    available: boolean;
    totalSize: number;
    freeSpace?: number;
    warning?: string;
  }> {
    try {
      const usage = await this.getDiskUsage();
      
      // 简单的磁盘空间检查
      // 在实际应用中，可能需要更复杂的逻辑来检查可用磁盘空间
      const maxLogSize = 100 * 1024 * 1024; // 100MB
      
      if (usage.totalSize > maxLogSize) {
        return {
          available: false,
          totalSize: usage.totalSize,
          warning: 'Log directory size exceeds maximum allowed size'
        };
      }

      return {
        available: true,
        totalSize: usage.totalSize
      };
    } catch (error) {
      throw new EnhancedError('Failed to check disk space', {
        directory: this.logDirectory,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 清理旧日志文件
   */
  async cleanupOldLogs(retentionDays: number = 7): Promise<number> {
    try {
      const logFiles = await this.getLogFiles();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let deletedCount = 0;

      for (const file of logFiles) {
        if (!file.isCurrent && file.modifiedAt < cutoffDate) {
          try {
            await this.deleteLogFile(file.filename);
            deletedCount++;
          } catch (error) {
            logger.warn(`Failed to delete old log file ${file.filename}:`, error as Error);
          }
        }
      }

      return deletedCount;
    } catch (error) {
      throw new EnhancedError('Failed to cleanup old logs', {
        directory: this.logDirectory,
        retentionDays,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * 创建默认的日志文件管理器
 */
export function createLogFileManager(
  logDirectory?: string, 
  baseFileName?: string
): LogFileManager {
  return new LogFileManager(
    logDirectory || process.env.LOG_DIRECTORY || './logs',
    baseFileName || 'app.log'
  );
}

/**
 * 读取日志文件的便捷函数
 */
export async function readLogFile(filename: string, lines?: number, filter?: string): Promise<string> {
  const logManager = createLogFileManager();
  
  try {
    if (lines) {
      // 获取最后N行
      const lastLines = await logManager.getLastLines(filename, lines);
      
      if (filter) {
        // 应用过滤器
        const filterRegex = new RegExp(filter, 'i');
        return lastLines.filter(line => filterRegex.test(line)).join('\n');
      }
      
      return lastLines.join('\n');
    } else {
      // 读取整个文件
      const content = await logManager.readLogFile(filename);
      
      if (filter) {
        // 应用过滤器
        const filterRegex = new RegExp(filter, 'i');
        return content.split('\n').filter(line => filterRegex.test(line)).join('\n');
      }
      
      return content;
    }
  } catch (error) {
    throw new EnhancedError('Failed to read log file', {
      filename,
      lines,
      filter,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}