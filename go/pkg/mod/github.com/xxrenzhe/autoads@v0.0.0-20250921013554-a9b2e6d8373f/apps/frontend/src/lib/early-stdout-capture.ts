/**
 * Enhanced Early Stdout Capture
 * 增强的stdout捕获机制，确保从应用启动就开始记录所有日志
 * 包括Next.js生产环境日志和Docker容器日志
 */

// 立即执行，不等待任何模块加载
if (typeof process !== 'undefined' && process.stdout && !(globalThis as any).__EARLY_STDOUT_CAPTURED__) {
  (globalThis as any).__EARLY_STDOUT_CAPTURED__ = true;
  
  // 保存原始方法
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
    trace: console.trace,
    table: console.table,
    group: console.group,
    groupEnd: console.groupEnd,
    groupCollapsed: console.groupCollapsed
  };
  
  // 日志缓冲区，用于在文件系统可用前存储日志
  const logBuffer: string[] = [];
  const MAX_BUFFER_SIZE = 10000; // 最大缓冲条目数
  let fileReady = false;
  let fs: any, path: any;
  
  // 尝试初始化文件系统
  function initFilesystem() {
    try {
      if (typeof require !== 'undefined') {
        // CommonJS 环境
        fs = require('fs').promises;
        path = require('path');
        fileReady = true;
        
        // 立即写入缓冲的日志
        flushBuffer();
      } else {
        // ES Module 环境 - 使用动态导入
        // 注意：在ES模块中，这个初始化会在模块加载完成后尝试
        setTimeout(() => {
          try {
            // 使用 Function 构造函数避免ES模块限制
            const importFs = new Function('return import("fs")')();
            const importPath = new Function('return import("path")')();
            
            Promise.all([importFs, importPath])
              .then(([fsModule, pathModule]) => {
                fs = fsModule.promises;
                path = pathModule;
                fileReady = true;
                flushBuffer();
              })
              .catch(() => {
                // 导入失败，继续缓冲
              });
          } catch (e) {
            // 无法动态导入，继续缓冲
          }
        }, 0);
      }
    } catch (e) {
      // 文件系统尚未就绪，继续缓冲
    }
  }
  
  // 写入日志文件
  async function writeToFile(data: string) {
    if (!fileReady) {
      // 限制缓冲区大小
      if (logBuffer.length < MAX_BUFFER_SIZE) {
        logBuffer.push(data);
      } else {
        // 缓冲区满时，丢弃最旧的日志
        logBuffer.shift();
        logBuffer.push(data);
      }
      return;
    }
    
    try {
      // 使用绝对路径
      const logDir = process.env.DATA_DIR ? `${process.env.DATA_DIR}/logs` : '/app/logs';
      const logPath = path.join(logDir, 'output.log');
      
      // 确保目录存在
      try {
        await fs.mkdir(logDir, { recursive: true });
      } catch (e) {
        // 目录可能已存在
      }
      
      // 批量写入以提高性能
      if (logBuffer.length > 0) {
        const allData = logBuffer.join('') + data;
        logBuffer.length = 0;
        await fs.appendFile(logPath, allData);
      } else {
        await fs.appendFile(logPath, data);
      }
    } catch (e) {
      // 写入失败，继续输出到stdout
    }
  }
  
  // 刷新缓冲区
  async function flushBuffer() {
    if (logBuffer.length > 0 && fileReady) {
      const bufferedLogs = logBuffer.join('');
      logBuffer.length = 0;
      await writeToFile(bufferedLogs);
    }
  }
  
  // 格式化日志条目
  function formatLogEntry(type: string, args: any[]): string {
    const timestamp = new Date().toISOString();
    const message = args?.filter(Boolean)?.map((arg: any) => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    return `${timestamp} [${type}] ${message}\n`;
  }
  
  // 增强的stdout拦截 - 处理Next.js生产日志
  process.stdout.write = function (string: string | Uint8Array, encoding?: BufferEncoding | (() => void), cb?: () => void): boolean {
    // 调用原始方法
    const result = originalStdoutWrite.call(process.stdout, string, encoding as any, cb);
    
    // 异步写入文件
    if (string && string.toString().trim()) {
      const content = string.toString();
      const timestamp = new Date().toISOString();
      
      // 检测是否是Next.js日志并增强格式
      if (content.includes('▲ Next.js') || content.includes('Starting...') || content.includes('Ready in')) {
        writeToFile(`${timestamp} [NEXTJS] ${content}`).catch(() => {});
      } else if (content.includes('INFO') || content.includes('WARN') || content.includes('ERROR')) {
        // 保持原始格式
        writeToFile(`${timestamp} [STDOUT] ${content}`).catch(() => {});
      } else {
        // 标准输出
        writeToFile(`${timestamp} [STDOUT] ${content}`).catch(() => {});
      }
    }
    
    return result;
  };
  
  // 增强的stderr拦截
  process.stderr.write = function (string: string | Uint8Array, encoding?: BufferEncoding | (() => void), cb?: () => void): boolean {
    // 调用原始方法
    const result = originalStderrWrite.call(process.stderr, string, encoding as any, cb);
    
    // 异步写入文件
    if (string && string.toString().trim()) {
      const content = string.toString();
      const timestamp = new Date().toISOString();
      
      // 增强错误日志格式
      if (content.includes('ERROR') || content.includes('Error') || content.includes('error')) {
        writeToFile(`${timestamp} [ERROR] ${content}`).catch(() => {});
      } else {
        writeToFile(`${timestamp} [STDERR] ${content}`).catch(() => {});
      }
    }
    
    return result;
  };
  
  // 拦截所有console方法
  console.log = (...args: any[]) => {
    originalConsole.log(...args);
    writeToFile(formatLogEntry('LOG', args)).catch(() => {});
  };
  
  console.error = (...args: any[]) => {
    originalConsole.error(...args);
    writeToFile(formatLogEntry('ERROR', args)).catch(() => {});
  };
  
  console.warn = (...args: any[]) => {
    originalConsole.warn(...args);
    writeToFile(formatLogEntry('WARN', args)).catch(() => {});
  };
  
  console.info = (...args: any[]) => {
    originalConsole.info(...args);
    writeToFile(formatLogEntry('INFO', args)).catch(() => {});
  };
  
  console.debug = (...args: any[]) => {
    originalConsole.debug(...args);
    writeToFile(formatLogEntry('DEBUG', args)).catch(() => {});
  };
  
  console.trace = (...args: any[]) => {
    originalConsole.trace(...args);
    writeToFile(formatLogEntry('TRACE', args)).catch(() => {});
  };
  
  console.table = (...args: any[]) => {
    originalConsole.table(...args);
    writeToFile(formatLogEntry('TABLE', args)).catch(() => {});
  };
  
  console.group = (...args: any[]) => {
    originalConsole.group(...args);
    writeToFile(`${new Date().toISOString()} [GROUP] ${args?.filter(Boolean)?.map(String).join(' ')}\n`).catch(() => {});
  };
  
  console.groupEnd = () => {
    originalConsole.groupEnd();
    writeToFile(`${new Date().toISOString()} [GROUP END]\n`).catch(() => {});
  };
  
  console.groupCollapsed = (...args: any[]) => {
    originalConsole.groupCollapsed(...args);
    writeToFile(`${new Date().toISOString()} [GROUP COLLAPSED] ${args?.filter(Boolean)?.map(String).join(' ')}\n`).catch(() => {});
  };
  
  // 记录初始化日志
  const initMessage = `${new Date().toISOString()} [EARLY-INIT] Early stdout capture initialized\n`;
  logBuffer.push(initMessage);
  
  // 定期尝试初始化文件系统
  const initInterval = setInterval(() => {
    if (!fileReady) {
      initFilesystem();
    } else {
      clearInterval(initInterval);
    }
  }, 100);
  
  // 监听进程退出，确保缓冲区刷新
  process.on('exit', () => {
    if (logBuffer.length > 0) {
      // 同步写入最后的日志
      try {
        if (typeof require !== 'undefined') {
          const logDir = process.env.DATA_DIR ? `${process.env.DATA_DIR}/logs` : '/app/logs';
          require('fs').appendFileSync(`${logDir}/output.log`, logBuffer.join(''));
        }
      } catch (e) {
        // 无法写入
      }
    }
  });
  
  // 拦截未捕获的异常
  process.on('uncaughtException', (error) => {
    const timestamp = new Date().toISOString();
    const errorMessage = `${timestamp} [UNCAUGHT EXCEPTION] ${error.stack || error.message}\n`;
    writeToFile(errorMessage).catch(() => {});
    // 保持默认行为
    if (!process.listeners('uncaughtException').includes(process.emit as any)) {
      process.exit(1);
    }
  });
  
  // 拦截未处理的Promise拒绝
  process.on('unhandledRejection', (reason, promise) => {
    const timestamp = new Date().toISOString();
    const errorMessage = `${timestamp} [UNHANDLED REJECTION] Reason: ${String(reason)}\n`;
    writeToFile(errorMessage).catch(() => {});
    // 保持默认行为
    if (!process.listeners('unhandledRejection').includes(process.emit as any)) {
      console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
    }
  });
  
  // 拦截警告信息
  process.on('warning', (warning) => {
    const timestamp = new Date().toISOString();
    const warningMessage = `${timestamp} [WARNING] ${warning.message}\n`;
    writeToFile(warningMessage).catch(() => {});
  });
  
  // 导出函数以供其他模块使用
  (globalThis as any).__EARLY_LOGGER__ = {
    flushBuffer,
    isReady: () => fileReady,
    getBufferSize: () => logBuffer.length
  };
}