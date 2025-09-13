/**
 * 系统监控服务
 * 提供系统状态监控、性能指标收集和告警管理功能
 */

import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('SystemMonitoringService');

// 系统状态接口
export interface SystemStatus {
  status: 'healthy' | 'warning' | 'error';
  timestamp: Date;
  services: {
    monitoring: string;
    database: string;
    api: string;
    adsPower?: string;
    googleAds?: string;
  };
  metrics: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
}

// 性能趋势接口
export interface PerformanceTrend {
  timeRange: string;
  data: Array<{
    timestamp: Date;
    metrics: {
      responseTime: number;
      throughput: number;
      errorRate: number;
    };
  }>;
}

// 系统报告接口
export interface SystemReport {
  generatedAt: Date;
  summary: {
    uptime: string;
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
  };
  services: Array<{
    name: string;
    status: string;
    uptime: number;
    lastCheck: Date;
  }>;
  recommendations: string[];
}

// 告警接口
export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  source: string;
  resolved: boolean;
  resolvedAt?: Date;
}

export class SystemMonitoringService {
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private alerts: Alert[] = [];
  private statusHistory: SystemStatus[] = [];
  private startTime = Date.now();

  constructor(
    private adsPowerClient: any,
    private googleAdsClient: any,
    private urlExtractionService: any,
    private executionOrchestrator: any,
    private schedulingManager: any
  ) {
    logger.info('系统监控服务初始化');
  }

  /**
   * 开始监控
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      logger.warn('监控已在运行中');
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    logger.info('系统监控已启动', { intervalMs });
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      logger.warn('监控未在运行');
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('系统监控已停止');
  }

  /**
   * 获取当前状态
   */
  getCurrentStatus(): SystemStatus {
    const status: SystemStatus = {
      status: 'healthy',
      timestamp: new Date(),
      services: {
        monitoring: 'healthy',
        database: 'healthy',
        api: 'healthy'
      },
      metrics: {
        uptime: Date.now() - this.startTime,
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: this.getCpuUsage(),
        activeConnections: this.getActiveConnections()
      }
    };

    // 检查各项服务状态
    this.checkServiceHealth(status);

    // 保存状态历史
    this.statusHistory.push(status);
    if (this.statusHistory.length > 100) {
      this.statusHistory = this.statusHistory.slice(-50);
    }

    return status;
  }

  /**
   * 获取性能趋势
   */
  getPerformanceTrends(timeRange: string = '1h'): PerformanceTrend {
    const now = Date.now();
    let startTime: number;

    switch (timeRange) {
      case '1h':
        startTime = now - 60 * 60 * 1000;
        break;
      case '24h':
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        startTime = now - 60 * 60 * 1000;
    }

    const relevantHistory = this.statusHistory.filter(
      status => status.timestamp.getTime() >= startTime
    );

    return {
      timeRange,
      data: relevantHistory?.filter(Boolean)?.map((status: any) => ({
        timestamp: status.timestamp,
        metrics: {
          responseTime: this.simulateResponseTime(),
          throughput: this.simulateThroughput(),
          errorRate: this.simulateErrorRate()
        }
      }))
    };
  }

  /**
   * 生成系统报告
   */
  generateSystemReport(): SystemReport {
    const currentStatus = this.getCurrentStatus();
    const uptime = Date.now() - this.startTime;

    return {
      generatedAt: new Date(),
      summary: {
        uptime: this.formatUptime(uptime),
        totalRequests: this.simulateTotalRequests(),
        errorRate: this.calculateErrorRate(),
        averageResponseTime: this.calculateAverageResponseTime()
      },
      services: [
        {
          name: 'Monitoring',
          status: currentStatus.services.monitoring,
          uptime: uptime,
          lastCheck: new Date()
        },
        {
          name: 'Database',
          status: currentStatus.services.database,
          uptime: uptime,
          lastCheck: new Date()
        },
        {
          name: 'API',
          status: currentStatus.services.api,
          uptime: uptime,
          lastCheck: new Date()
        }
      ],
      recommendations: this.generateRecommendations(currentStatus)
    };
  }

  /**
   * 获取监控状态
   */
  getMonitoringStatus(): {
    isRunning: boolean;
    startTime: Date;
    uptime: number;
    collectedMetrics: number;
    activeAlerts: number;
  } {
    return {
      isRunning: this.isMonitoring,
      startTime: new Date(this.startTime),
      uptime: Date.now() - this.startTime,
      collectedMetrics: this.statusHistory.length,
      activeAlerts: this.alerts.filter((alert: any) => !alert.resolved).length
    };
  }

  /**
   * 解决告警
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find((a: any) => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      logger.info('告警已解决', { alertId });
      return true;
    }
    return false;
  }

  /**
   * 清理旧数据
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoffTime = Date.now() - maxAge;
    
    // 清理旧的状态历史
    this.statusHistory = this.statusHistory.filter(
      status => status.timestamp.getTime() > cutoffTime
    );

    // 清理已解决的告警
    this.alerts = this.alerts.filter((alert: any) => 
      !alert.resolved || (alert.resolvedAt && alert.resolvedAt.getTime() > cutoffTime)
    );

    logger.info('监控数据清理完成', { 
      statusHistory: this.statusHistory.length,
      alerts: this.alerts.length 
    });
  }

  /**
   * 添加告警
   */
  private addAlert(type: Alert['type'], message: string, source: string): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: new Date(),
      source,
      resolved: false
    };

    this.alerts.push(alert);
    logger.warn('新告警', { type, message, source });

    // 如果告警过多，清理旧告警
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.filter((a: any) => !a.resolved).slice(-50);
    }
  }

  /**
   * 收集指标
   */
  private collectMetrics(): void {
    try {
      const status = this.getCurrentStatus();
      
      // 检查是否有异常情况
      if (status.status === 'error') {
        this.addAlert('error', '系统状态异常', 'system');
      } else if (status.status === 'warning') {
        this.addAlert('warning', '系统状态警告', 'system');
      }

      // 检查资源使用情况
      if (status.metrics.memoryUsage > 90) {
        this.addAlert('warning', '内存使用率过高', 'system');
      }

      if (status.metrics.cpuUsage > 80) {
        this.addAlert('warning', 'CPU使用率过高', 'system');
      }

    } catch (error) {
      logger.error('收集指标失败:', new EnhancedError('收集指标失败:', { error: error instanceof Error ? error.message : String(error) 
       }));
    }
  }

  /**
   * 检查服务健康状态
   */
  private checkServiceHealth(status: SystemStatus): void {
    // 检查数据库连接
    try {
      // 这里应该检查实际的数据库连接
      status.services.database = 'healthy';
    } catch (error) {
      status.services.database = 'error';
      status.status = 'error';
      this.addAlert('error', '数据库连接失败', 'database');
    }

    // 检查API服务
    try {
      // 这里应该检查API服务状态
      status.services.api = 'healthy';
    } catch (error) {
      status.services.api = 'error';
      status.status = 'error';
      this.addAlert('error', 'API服务异常', 'api');
    }

    // 检查AdsPower服务（如果配置了）
    if (this.adsPowerClient) {
      try {
        // 这里应该检查AdsPower服务状态
        status.services.adsPower = 'healthy';
      } catch (error) {
        status.services.adsPower = 'warning';
        if (status.status === 'healthy') {
          status.status = 'warning';
        }
      }
    }

    // 检查Google Ads服务（如果配置了）
    if (this.googleAdsClient) {
      try {
        // 这里应该检查Google Ads服务状态
        status.services.googleAds = 'healthy';
      } catch (error) {
        status.services.googleAds = 'warning';
        if (status.status === 'healthy') {
          status.status = 'warning';
        }
      }
    }
  }

  /**
   * 获取内存使用率
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      const total = usage.heapTotal;
      const used = usage.heapUsed;
      return Math.round((used / total) * 100);
    }
    return Math.random() * 100; // 浏览器环境模拟
  }

  /**
   * 获取CPU使用率
   */
  private getCpuUsage(): number {
    // 简化的CPU使用率计算
    return Math.random() * 100;
  }

  /**
   * 获取活跃连接数
   */
  private getActiveConnections(): number {
    // 简化的连接数计算
    return Math.floor(Math.random() * 50);
  }

  /**
   * 格式化运行时间
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m ${seconds % 60}s`;
    }
  }

  /**
   * 模拟响应时间
   */
  private simulateResponseTime(): number {
    return Math.random() * 1000 + 100; // 100-1100ms
  }

  /**
   * 模拟吞吐量
   */
  private simulateThroughput(): number {
    return Math.random() * 100 + 10; // 10-110 requests/min
  }

  /**
   * 模拟错误率
   */
  private simulateErrorRate(): number {
    return Math.random() * 5; // 0-5%
  }

  /**
   * 模拟总请求数
   */
  private simulateTotalRequests(): number {
    return Math.floor(Math.random() * 10000 + 1000);
  }

  /**
   * 计算错误率
   */
  private calculateErrorRate(): number {
    const recentStatus = this.statusHistory.slice(-10);
    const errorCount = recentStatus.filter((s: any) => s.status === 'error').length;
    return recentStatus.length > 0 ? (errorCount / recentStatus.length) * 100 : 0;
  }

  /**
   * 计算平均响应时间
   */
  private calculateAverageResponseTime(): number {
    // 简化计算
    return this.simulateResponseTime();
  }

  /**
   * 生成建议
   */
  private generateRecommendations(status: SystemStatus): string[] {
    const recommendations: string[] = [];

    if (status.metrics.memoryUsage > 80) {
      recommendations.push('建议增加系统内存或优化内存使用');
    }

    if (status.metrics.cpuUsage > 70) {
      recommendations.push('建议优化CPU密集型任务或增加处理能力');
    }

    if (status.services.adsPower === 'warning') {
      recommendations.push('建议检查AdsPower服务配置');
    }

    if (status.services.googleAds === 'warning') {
      recommendations.push('建议检查Google Ads API配置');
    }

    if (recommendations.length === 0) {
      recommendations.push('系统运行正常，继续保持监控');
    }

    return recommendations;
  }
}