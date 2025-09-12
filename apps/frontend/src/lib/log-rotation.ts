/**
 * Log Rotation Manager
 * 日志轮转管理器，防止日志文件过大
 * 注意：此模块不支持 Edge Runtime，仅在 Node.js 环境中运行
 */

// 动态导入 Node.js 模块，避免在 Edge Runtime 中报错
let fs: any;
let path: any;
let createWriteStream: any;

// 检查是否在 Edge Runtime 环境中
const isEdgeRuntime = typeof process === 'undefined' || process.env.NEXT_RUNTIME === 'edge';

export interface LogRotationConfig {
  maxSize: number; // 最大文件大小（字节）
  maxFiles: number; // 保留的最大文件数
  compress: boolean; // 是否压缩旧日志
  checkInterval: number; // 检查间隔（毫秒）
}

export class LogRotationManager {
  private config: LogRotationConfig;
  private timer?: NodeJS.Timeout;
  private logDir: string;
  private baseFilename: string;
  private isNodeEnv: boolean;

  constructor(
    logDir: string = './logs',
    baseFilename: string = 'output.log',
    config: Partial<LogRotationConfig> = {}
  ) {
    this.logDir = logDir;
    this.baseFilename = baseFilename;
    this.isNodeEnv = !isEdgeRuntime;
    
    this.config = {
      maxSize: config.maxSize || 50 * 1024 * 1024, // 默认50MB
      maxFiles: config.maxFiles || 10,
      compress: config.compress !== false, // 默认启用压缩
      checkInterval: config.checkInterval || 60000 // 默认1分钟
    };
    
    // 如果在 Edge Runtime 中，记录警告
    if (!this.isNodeEnv) {
      console.warn('LogRotationManager: Running in Edge Runtime - log rotation disabled');
    }
  }

  /**
   * 启动日志轮转检查
   */
  start() {
    if (!this.isNodeEnv) {
      console.warn('LogRotationManager: Cannot start in Edge Runtime');
      return;
    }
    
    // 动态导入 Node.js 模块
    this.importNodeModules().then(() => {
      this.timer = setInterval(() => {
        this.checkAndRotate().catch(console.error);
      }, this.config.checkInterval);
      
      // 立即执行一次检查
      this.checkAndRotate().catch(console.error);
    }).catch(console.error);
  }

  /**
   * 动态导入 Node.js 模块
   */
  private async importNodeModules(): Promise<void> {
    if (!fs) {
      fs = await import('fs').then(m => m.promises);
      path = await import('path');
      createWriteStream = await import('fs').then(m => m.createWriteStream);
    }
  }

  /**
   * 停止日志轮转检查
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * 检查并执行日志轮转
   */
  async checkAndRotate(): Promise<void> {
    if (!this.isNodeEnv) {
      return;
    }
    
    try {
      await this.importNodeModules();
      const logPath = path.join(this.logDir, this.baseFilename);
      
      // 检查文件是否存在
      try {
        const stats = await fs.stat(logPath);
        
        // 如果文件超过最大大小，执行轮转
        if (stats.size >= this.config.maxSize) {
          await this.rotateLogs();
        }
      } catch (e) {
        // 文件不存在，无需轮转
      }
    } catch (error) {
      console.error('Log rotation check failed:', error);
    }
  }

  /**
   * 执行日志轮转
   */
  private async rotateLogs(): Promise<void> {
    try {
      await this.importNodeModules();
      
      // 确保目录存在
      await fs.mkdir(this.logDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFilename = `${this.baseFilename}.${timestamp}`;
      const rotatedPath = path.join(this.logDir, rotatedFilename);
      const currentPath = path.join(this.logDir, this.baseFilename);
      
      // 重命名当前日志文件
      await fs.rename(currentPath, rotatedPath);
      
      // 压缩旧日志（如果启用）
      if (this.config.compress) {
        this.compressLog(rotatedPath).catch(console.error);
      }
      
      // 清理旧日志文件
      await this.cleanupOldLogs();
      
      console.log(`Log rotated: ${this.baseFilename} -> ${rotatedFilename}`);
    } catch (error) {
      console.error('Log rotation failed:', error);
    }
  }

  /**
   * 压缩日志文件
   */
  private async compressLog(filePath: string): Promise<void> {
    if (!this.isNodeEnv) {
      return;
    }
    
    try {
      await this.importNodeModules();
      const zlib = await import('zlib');
      const brotli = await import('zlib').then(m => m.createBrotliCompress);
      
      const compressedPath = `${filePath}.br`;
      const data = await fs.readFile(filePath);
      
      return new Promise((resolve, reject) => {
        const compress = brotli();
        const output = createWriteStream(compressedPath);
        
        compress.on('error', reject);
        output.on('error', reject);
        output.on('finish', () => {
          // 删除原始文件
          fs.unlink(filePath).catch(() => {});
          resolve();
        });
        
        compress.pipe(output);
        compress.end(data);
      });
    } catch (error) {
      console.error('Log compression failed:', error);
    }
  }

  /**
   * 清理旧日志文件
   */
  private async cleanupOldLogs(): Promise<void> {
    if (!this.isNodeEnv) {
      return;
    }
    
    try {
      await this.importNodeModules();
      const files = await fs.readdir(this.logDir);
      const logFiles: Array<{ name: string; path: string; stats: any }> = [];
      
      // 收集所有日志文件
      for (const file of files) {
        if (file.startsWith(this.baseFilename) && file !== this.baseFilename) {
          const filePath = path.join(this.logDir, file);
          try {
            const stats = await fs.stat(filePath);
            logFiles.push({ name: file, path: filePath, stats });
          } catch (e) {
            // 无法访问的文件
          }
        }
      }
      
      // 按修改时间排序，最新的在前
      logFiles.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
      
      // 删除超过限制的文件
      if (logFiles.length > this.config.maxFiles) {
        const filesToDelete = logFiles.slice(this.config.maxFiles);
        await Promise.allSettled(
          filesToDelete?.filter(Boolean)?.map(file => fs.unlink(file.path))
        );
      }
    } catch (error) {
      console.error('Log cleanup failed:', error);
    }
  }

  /**
   * 获取所有日志文件列表
   */
  async getLogFiles(): Promise<Array<{
    name: string;
    path: string;
    size: number;
    modified: string;
    compressed: boolean;
  }>> {
    if (!this.isNodeEnv) {
      return [];
    }
    
    try {
      await this.importNodeModules();
      const files = await fs.readdir(this.logDir);
      const logFiles: Array<any> = [];
      
      for (const file of files) {
        if (file.startsWith(this.baseFilename)) {
          const filePath = path.join(this.logDir, file);
          try {
            const stats = await fs.stat(filePath);
            logFiles.push({
              name: file,
              path: filePath,
              size: stats.size,
              modified: stats.mtime.toISOString(),
              compressed: file.endsWith('.br')
            });
          } catch (e) {
            // 忽略无法访问的文件
          }
        }
      }
      
      // 按修改时间倒序排序
      return logFiles.sort((a, b) => 
        new Date(b.modified).getTime() - new Date(a.modified).getTime()
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * 获取日志统计信息
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    currentSize: number;
    oldestLog?: string;
    newestLog?: string;
  }> {
    if (!this.isNodeEnv) {
      return {
        totalFiles: 0,
        totalSize: 0,
        currentSize: 0
      };
    }
    
    try {
      const files = await this.getLogFiles();
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const currentFile = files.find(f => f.name === this.baseFilename);
      
      return {
        totalFiles: files.length,
        totalSize,
        currentSize: currentFile?.size || 0,
        oldestLog: files[files.length - 1]?.name,
        newestLog: files[0]?.name
      };
    } catch (error) {
      return {
        totalFiles: 0,
        totalSize: 0,
        currentSize: 0
      };
    }
  }
}

// 创建默认实例，使用绝对路径
const defaultLogDir = process.env.DATA_DIR ? `${process.env.DATA_DIR}/logs` : '/app/logs';
export const logRotationManager = new LogRotationManager(defaultLogDir);