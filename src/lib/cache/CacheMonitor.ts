/**
 * Cache Monitoring Service
 * 缓存监控服务，提供实时监控、告警和性能分析
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { UnifiedCacheManager, CacheStats } from './UnifiedCacheManager';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('CacheMonitor');

/**
 * 监控指标接口
 */
export interface CacheHealthStatus {
  status: 'healthy' | 'warning' | 'critical'
  message: string
  recommendations: string[]
}

export interface MonitoringMetrics {
  timestamp: string;
  hitRate: number;
  responseTime: {
    l1: number;
    l2: number;
    l3: number;
    l4: number;
  };
  memoryUsage: {
    l1: number;
    l2: number;
    l3: number;
    total: number;
  };
  errorRate: number;
  throughput: number;
}

/**
 * 告警规则接口
 */
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldown: number; // 冷却时间（毫秒）
  lastTriggered?: Date;
}

/**
 * 告警事件接口
 */
export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  metrics: MonitoringMetrics;
  resolved: boolean;
  resolvedAt?: Date;
}

/**
 * 性能报告接口
 */
export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalRequests: number;
    totalHits: number;
    totalMisses: number;
    averageHitRate: number;
    averageResponseTime: number;
  };
  layerAnalysis: {
    l1: {
      hits: number;
      misses: number;
      hitRate: number;
      avgResponseTime: number;
    };
    l2: {
      hits: number;
      misses: number;
      hitRate: number;
      avgResponseTime: number;
    };
    l3: {
      hits: number;
      misses: number;
      hitRate: number;
      avgResponseTime: number;
    };
    l4: {
      hits: number;
      misses: number;
      hitRate: number;
      avgResponseTime: number;
    };
  };
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurred: Date;
  }>;
  recommendations: string[];
}

/**
 * 缓存监控服务类
 */
export class CacheMonitor {
  private cacheManager: UnifiedCacheManager;
  private metrics: MonitoringMetrics[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private alertEvents: Map<string, AlertEvent> = new Map();
  private isRunning: boolean = false;
  private metricsInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private maxMetricsHistory: number = 1000;
  private maxAlertHistory: number = 100;

  constructor(cacheManager: UnifiedCacheManager) {
    this.cacheManager = cacheManager;
    this.initializeDefaultAlertRules();
  }

  /**
   * 启动监控服务
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('缓存监控服务已经在运行中');
      return;
    }

    this.isRunning = true;
    logger.info('缓存监控服务已启动');

    // 启动指标收集
    this.startMetricsCollection();
    
    // 启动清理任务
    this.startCleanupTask();
  }

  /**
   * 停止监控服务
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('缓存监控服务未运行');
      return;
    }

    this.isRunning = false;
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    logger.info('缓存监控服务已停止');
  }

  /**
   * 获取当前监控指标
   */
  getCurrentMetrics(): MonitoringMetrics {
    const stats = this.cacheManager.getStatistics();
    const health = this.cacheManager.getHealthStatus();
    
    return {
      timestamp: new Date().toISOString(),
      hitRate: stats.hitRate,
      responseTime: {
        l1: this.calculateAverageResponseTime(stats.responseTime.l1),
        l2: this.calculateAverageResponseTime(stats.responseTime.l2),
        l3: this.calculateAverageResponseTime(stats.responseTime.l3),
        l4: this.calculateAverageResponseTime(stats.responseTime.l4)
      },
      memoryUsage: {
        l1: stats.size,
        l2: 0,
        l3: 0,
        total: stats.size
      },
      errorRate: this.calculateErrorRate(),
      throughput: this.calculateThroughput(stats)
    };
  }

  /**
   * 获取历史监控指标
   */
  getMetricsHistory(period: '1h' | '6h' | '24h' | '7d' = '1h'): MonitoringMetrics[] {
    const now = Date.now();
    let periodMs: number;
    
    switch (period) {
      case '1h':
        periodMs = 60 * 60 * 1000;
        break;
      case '6h':
        periodMs = 6 * 60 * 60 * 1000;
        break;
      case '24h':
        periodMs = 24 * 60 * 60 * 1000;
        break;
      case '7d':
        periodMs = 7 * 24 * 60 * 60 * 1000;
        break;
    }
    
    const cutoffTime = now - periodMs;
    return this.metrics.filter(m => new Date(m.timestamp).getTime() > cutoffTime);
  }

  /**
   * 添加告警规则
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info(`添加告警规则: ${rule.name}`);
  }

  /**
   * 移除告警规则
   */
  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    logger.info(`移除告警规则: ${ruleId}`);
  }

  /**
   * 获取所有告警规则
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): AlertEvent[] {
    return Array.from(this.alertEvents.values()).filter(alert => !alert.resolved);
  }

  /**
   * 获取告警历史
   */
  getAlertHistory(period: '1h' | '6h' | '24h' | '7d' = '24h'): AlertEvent[] {
    const now = Date.now();
    let periodMs: number;
    
    switch (period) {
      case '1h':
        periodMs = 60 * 60 * 1000;
        break;
      case '6h':
        periodMs = 6 * 60 * 60 * 1000;
        break;
      case '24h':
        periodMs = 24 * 60 * 60 * 1000;
        break;
      case '7d':
        periodMs = 7 * 24 * 60 * 60 * 1000;
        break;
    }
    
    const cutoffTime = now - periodMs;
    return Array.from(this.alertEvents.values())
      .filter(alert => alert.timestamp.getTime() > cutoffTime)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * 解决告警
   */
  resolveAlert(alertId: string): void {
    const alert = this.alertEvents.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      logger.info(`告警已解决: ${alert.ruleName}`);
    }
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(period: '1h' | '6h' | '24h' | '7d' = '24h'): PerformanceReport {
    const metrics = this.getMetricsHistory(period);
    const now = new Date();
    const startTime = new Date(now.getTime() - this.getPeriodMs(period));
    
    const summary = this.calculateSummary(metrics);
    const layerAnalysis = this.calculateLayerAnalysis(metrics);
    const topErrors = this.getTopErrors();
    const recommendations = this.generateRecommendations(metrics);

    return {
      period: {
        start: startTime,
        end: now
      },
      summary,
      layerAnalysis,
      topErrors,
      recommendations
    };
  }

  /**
   * 获取缓存健康状态
   */
  getHealthStatus(): CacheHealthStatus {
    return this.cacheManager.getHealthStatus();
  }

  // 私有方法

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      if (this.isRunning) {
        this.collectMetrics();
        this.checkAlerts();
      }
    }, 10000); // 每10秒收集一次指标
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      if (this.isRunning) {
        this.cleanupOldData();
      }
    }, 60000); // 每分钟清理一次
  }

  private collectMetrics(): void {
    const metrics = this.getCurrentMetrics();
    this.metrics.push(metrics);
    
    // 保持历史记录在限制范围内
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  private checkAlerts(): void {
    const currentMetrics = this.getCurrentMetrics();
    
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      
      // 检查冷却时间
      if (rule.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
        if (timeSinceLastTrigger < rule.cooldown) {
          continue;
        }
      }
      
      // 检查告警条件
      if (this.evaluateAlertCondition(rule, currentMetrics)) {
        this.triggerAlert(rule, currentMetrics);
        rule.lastTriggered = new Date();
      }
    }
  }

  private evaluateAlertCondition(rule: AlertRule, metrics: MonitoringMetrics): boolean {
    switch (rule.condition) {
      case 'hit_rate_low':
        return metrics.hitRate < rule.threshold;
      case 'response_time_high':
        return metrics.responseTime.l1 > rule.threshold || 
               metrics.responseTime.l2 > rule.threshold ||
               metrics.responseTime.l3 > rule.threshold;
      case 'memory_usage_high':
        return metrics.memoryUsage.total > rule.threshold;
      case 'error_rate_high':
        return metrics.errorRate > rule.threshold;
      case 'throughput_low':
        return metrics.throughput < rule.threshold;
      default:
        return false;
    }
  }

  private triggerAlert(rule: AlertRule, metrics: MonitoringMetrics): void {
    const alertId = `${rule.id}-${Date.now()}`;
    const alert: AlertEvent = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: this.generateAlertMessage(rule, metrics),
      timestamp: new Date(),
      metrics,
      resolved: false
    };

    this.alertEvents.set(alertId, alert);
    
    // 保持告警历史在限制范围内
    if (this.alertEvents.size > this.maxAlertHistory) {
      const oldestKey = this.alertEvents.keys().next().value;
      if (oldestKey) {
        this.alertEvents.delete(oldestKey);
      }
    }

    // 记录告警日志
    logger.security(`缓存告警触发: ${rule.name}`, rule.severity, {
        ruleId: rule.id,
        threshold: rule.threshold,
        currentValue: this.getAlertCurrentValue(rule.condition, metrics),
        metrics
      } as Record<string, unknown>);

    // 如果是高或严重告警，立即通知
    if (rule.severity === 'high' || rule.severity === 'critical') {
      this.sendAlertNotification(alert);
    }
  }

  private generateAlertMessage(rule: AlertRule, metrics: MonitoringMetrics): string {
    const currentValue = this.getAlertCurrentValue(rule.condition, metrics);
    return `${rule.name}: 当前值 ${currentValue.toFixed(2)} ${this.getAlertUnit(rule.condition)}, 阈值 ${rule.threshold}`;
  }

  private getAlertCurrentValue(condition: string, metrics: MonitoringMetrics): number {
    switch (condition) {
      case 'hit_rate_low':
        return metrics.hitRate;
      case 'response_time_high':
        return Math.max(metrics.responseTime.l1, metrics.responseTime.l2, metrics.responseTime.l3);
      case 'memory_usage_high':
        return metrics.memoryUsage.total;
      case 'error_rate_high':
        return metrics.errorRate;
      case 'throughput_low':
        return metrics.throughput;
      default:
        return 0;
    }
  }

  private getAlertUnit(condition: string): string {
    switch (condition) {
      case 'hit_rate_low':
        return '%';
      case 'response_time_high':
        return 'ms';
      case 'memory_usage_high':
        return 'MB';
      case 'error_rate_high':
        return '%';
      case 'throughput_low':
        return 'req/s';
      default:
        return '';
    }
  }

  private sendAlertNotification(alert: AlertEvent): void {
    // 这里可以实现具体的告警通知逻辑
    // 例如：发送邮件、Slack、PagerDuty等
    logger.error(`🚨 缓存告警通知: ${alert.message}`);
  }

  private cleanupOldData(): void {
    const now = Date.now();
    const cutoffTime = now - (24 * 60 * 60 * 1000); // 保留24小时的数据
    
    // 清理旧的指标数据
    this.metrics = this.metrics.filter(m => new Date(m.timestamp).getTime() > cutoffTime);
    
    // 清理已解决的告警
    const resolvedAlertsToDelete: string[] = [];
    for (const [id, alert] of this.alertEvents.entries()) {
      if (alert.resolved && alert.resolvedAt && 
          (now - alert.resolvedAt.getTime()) > cutoffTime) {
        resolvedAlertsToDelete.push(id);
      }
    }
    
    resolvedAlertsToDelete.forEach(id => this.alertEvents.delete(id));
  }

  private calculateAverageResponseTime(responseTime: number): number {
    return responseTime;
  }

  private calculateErrorRate(): number {
    // 这里应该实现错误率计算逻辑
    return 0;
  }

  private calculateThroughput(stats: any): number {
    // 这里应该实现吞吐量计算逻辑
    return 0;
  }

  private calculateSummary(metrics: MonitoringMetrics[]) {
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        totalHits: 0,
        totalMisses: 0,
        averageHitRate: 0,
        averageResponseTime: 0
      };
    }

    const totalHits = metrics.reduce((sum, m) => sum + (m.hitRate * 100), 0);
    const totalMisses = metrics.reduce((sum, m) => sum + ((1 - m.hitRate) * 100), 0);
    const avgResponseTime = metrics.reduce((sum, m) => 
      sum + (m.responseTime.l1 + m.responseTime.l2 + m.responseTime.l3 + m.responseTime.l4) / 4, 0
    ) / metrics.length;

    return {
      totalRequests: metrics.length,
      totalHits,
      totalMisses,
      averageHitRate: totalHits / (totalHits + totalMisses),
      averageResponseTime: avgResponseTime
    };
  }

  private calculateLayerAnalysis(metrics: MonitoringMetrics[]) {
    if (metrics.length === 0) {
      return {
        l1: { hits: 0, misses: 0, hitRate: 0, avgResponseTime: 0 },
        l2: { hits: 0, misses: 0, hitRate: 0, avgResponseTime: 0 },
        l3: { hits: 0, misses: 0, hitRate: 0, avgResponseTime: 0 },
        l4: { hits: 0, misses: 0, hitRate: 0, avgResponseTime: 0 }
      };
    }

    return {
      l1: {
        hits: metrics.reduce((sum, m) => sum + m.hitRate * 25, 0), // 假设L1占25%
        misses: metrics.reduce((sum, m) => sum + (1 - m.hitRate) * 25, 0),
        hitRate: metrics.reduce((sum, m) => sum + m.hitRate, 0) / metrics.length,
        avgResponseTime: metrics.reduce((sum, m) => sum + m.responseTime.l1, 0) / metrics.length
      },
      l2: {
        hits: metrics.reduce((sum, m) => sum + m.hitRate * 25, 0), // 假设L2占25%
        misses: metrics.reduce((sum, m) => sum + (1 - m.hitRate) * 25, 0),
        hitRate: metrics.reduce((sum, m) => sum + m.hitRate, 0) / metrics.length,
        avgResponseTime: metrics.reduce((sum, m) => sum + m.responseTime.l2, 0) / metrics.length
      },
      l3: {
        hits: metrics.reduce((sum, m) => sum + m.hitRate * 25, 0), // 假设L3占25%
        misses: metrics.reduce((sum, m) => sum + (1 - m.hitRate) * 25, 0),
        hitRate: metrics.reduce((sum, m) => sum + m.hitRate, 0) / metrics.length,
        avgResponseTime: metrics.reduce((sum, m) => sum + m.responseTime.l3, 0) / metrics.length
      },
      l4: {
        hits: metrics.reduce((sum, m) => sum + m.hitRate * 25, 0), // 假设L4占25%
        misses: metrics.reduce((sum, m) => sum + (1 - m.hitRate) * 25, 0),
        hitRate: metrics.reduce((sum, m) => sum + m.hitRate, 0) / metrics.length,
        avgResponseTime: metrics.reduce((sum, m) => sum + m.responseTime.l4, 0) / metrics.length
      }
    };
  }

  private getTopErrors(): Array<{ message: string; count: number; lastOccurred: Date }> {
    // 这里应该实现错误统计逻辑
    return [];
  }

  private generateRecommendations(metrics: MonitoringMetrics[]): string[] {
    const recommendations: string[] = [];
    
    if (metrics.length === 0) return recommendations;
    
    const avgHitRate = metrics.reduce((sum, m) => sum + m.hitRate, 0) / metrics.length;
    const avgResponseTime = metrics.reduce((sum, m) => 
      sum + (m.responseTime.l1 + m.responseTime.l2 + m.responseTime.l3 + m.responseTime.l4) / 4, 0
    ) / metrics.length;
    
    if (avgHitRate < 0.6) {
      recommendations.push('缓存命中率较低，建议检查缓存策略或增加预热');
    }
    
    if (avgResponseTime > 100) {
      recommendations.push('缓存响应时间较长，建议优化缓存层配置');
    }
    
    const latestMetrics = metrics[metrics.length - 1];
    if (latestMetrics.memoryUsage.total > 8000) {
      recommendations.push('内存使用率较高，建议清理过期缓存或调整缓存大小');
    }
    
    return recommendations;
  }

  private getPeriodMs(period: string): number {
    switch (period) {
      case '1h':
        return 60 * 60 * 1000;
      case '6h':
        return 6 * 60 * 60 * 1000;
      case '24h':
        return 24 * 60 * 60 * 1000;
      case '7d':
        return 7 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  private initializeDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'hit_rate_low',
        name: '缓存命中率过低',
        description: '当缓存命中率低于60%时触发告警',
        condition: 'hit_rate_low',
        threshold: 0.6,
        severity: 'medium',
        enabled: true,
        cooldown: 5 * 60 * 1000 // 5分钟冷却时间
      },
      {
        id: 'response_time_high',
        name: '缓存响应时间过长',
        description: '当缓存响应时间超过200ms时触发告警',
        condition: 'response_time_high',
        threshold: 200,
        severity: 'high',
        enabled: true,
        cooldown: 3 * 60 * 1000 // 3分钟冷却时间
      },
      {
        id: 'memory_usage_high',
        name: '内存使用率过高',
        description: '当缓存内存使用超过80%时触发告警',
        condition: 'memory_usage_high',
        threshold: 8000,
        severity: 'critical',
        enabled: true,
        cooldown: 10 * 60 * 1000 // 10分钟冷却时间
      },
      {
        id: 'error_rate_high',
        name: '错误率过高',
        description: '当缓存错误率超过5%时触发告警',
        condition: 'error_rate_high',
        threshold: 0.05,
        severity: 'high',
        enabled: true,
        cooldown: 5 * 60 * 1000 // 5分钟冷却时间
      }
    ];

    defaultRules.forEach(rule => this.addAlertRule(rule));
  }
}

/**
 * 创建默认的缓存监控服务
 */
export function createCacheMonitor(cacheManager: UnifiedCacheManager): CacheMonitor {
  return new CacheMonitor(cacheManager);
}