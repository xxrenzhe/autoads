/**
 * Docker 环境日志工具
 * 确保在 Docker 容器中正确输出日志到 stdout
 */

export class DockerLogger {
  private context: string;

  constructor(context: string = 'Docker') {
    this.context = context;
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      ...(data && { data })
    };
    return JSON.stringify(logEntry);
  }

  info(message: string, data?: any): void {
    console.log(this.formatMessage('INFO', message, data));
  }

  warn(message: string, data?: any): void {
    console.warn(this.formatMessage('WARN', message, data));
  }

  error(message: string, data?: any): void {
    console.error(this.formatMessage('ERROR', message, data));
  }

  debug(message: string, data?: any): void {
    if (process.env.NEXT_PUBLIC_DEBUG_MODE === 'true') {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }
}

// 导出单例实例
export const dockerLogger = new DockerLogger();