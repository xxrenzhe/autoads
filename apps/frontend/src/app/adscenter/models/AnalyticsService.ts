// 分析服务 - 提供数据分析功能

import { ExecutionResult, LinkResult } from '../types';

export interface ExecutionAnalytics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  totalProcessingTime: number;
  successRate: number;
}

export interface LinkAnalytics {
  totalLinks: number;
  successfulLinks: number;
  failedLinks: number;
  averageProcessingTime: number;
  uniqueDomains: number;
  topDomains: Array<{ domain: string; count: number; }>;
}

export class AnalyticsService {
  /**
   * 分析执行结果
   */
  static analyzeExecutions(executions: ExecutionResult[]): ExecutionAnalytics {
    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter((e: any) => e.status === 'SUCCESS').length;
    const failedExecutions = totalExecutions - successfulExecutions;
    
    const totalProcessingTime = executions.reduce((sum, e: any) => {
      return sum + (e.processingTime || 0);
    }, 0);
    
    const averageExecutionTime = totalExecutions > 0 ? totalProcessingTime / totalExecutions : 0;
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      totalProcessingTime,
      successRate
    };
  }

  /**
   * 分析链接结果
   */
  static analyzeLinks(links: LinkResult[]): LinkAnalytics {
    const totalLinks = links.length;
    const successfulLinks = links.filter((l: any) => l.status === 'success').length;
    const failedLinks = totalLinks - successfulLinks;
    
    const totalProcessingTime = links.reduce((sum, l: any) => {
      return sum + (l.processingTime || 0);
    }, 0);
    
    const averageProcessingTime = totalLinks > 0 ? totalProcessingTime / totalLinks : 0;
    
    // 分析域名
    const domains = new Map<string, number>();
    links.forEach((link: any) => {
      try {
        const url = new URL(link.originalUrl);
        const domain = url.hostname;
        domains.set(domain, (domains.get(domain) || 0) + 1);
      } catch { // 忽略无效URL
      }
    });
    const uniqueDomains = domains.size;
    const topDomains = Array.from(domains.entries())
      .map(([domain, count]: any) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    return {
      totalLinks,
      successfulLinks,
      failedLinks,
      averageProcessingTime,
      uniqueDomains,
      topDomains
    };
  }

  /**
   * 生成执行洞察
   */
  static generateExecutionInsights(analytics: ExecutionAnalytics): string[] {
    const insights: string[] = [];
    
    if (analytics.successRate >= 95) {
      insights.push('执行成功率优秀，系统运行稳定');
    } else if (analytics.successRate >= 80) {
      insights.push('执行成功率良好，建议关注失败原因');
    } else {
      insights.push('执行成功率偏低，需要优化系统稳定性');
    }
    
    if (analytics.averageExecutionTime > 300000) { // 5分钟
      insights.push('平均执行时间较长，建议优化处理流程');
    }
    
    return insights;
  }

  /**
   * 生成链接洞察
   */
  static generateLinkInsights(analytics: LinkAnalytics): string[] {
    const insights: string[] = [];
    
    const successRate = analytics.totalLinks > 0 ? 
      (analytics.successfulLinks / analytics.totalLinks) * 100 : 0;
    
    if (successRate >= 95) {
      insights.push('链接处理成功率优秀');
    } else if (successRate >= 80) {
      insights.push('链接处理成功率良好');
    } else {
      insights.push('链接处理成功率偏低，需要检查链接质量');
    }
    
    if (analytics.averageProcessingTime > 5000) { // 5秒
      insights.push('链接处理时间较长，建议优化网络连接');
    }
    
    return insights;
  }

  /**
   * 生成优化建议
   */
  static generateOptimizationSuggestions(
    executionAnalytics: ExecutionAnalytics,
    linkAnalytics: LinkAnalytics
  ): string[] {
    const suggestions: string[] = [];
    
    if (executionAnalytics.successRate < 90) {
      suggestions.push('建议增加错误重试机制');
    }
    
    if (linkAnalytics.averageProcessingTime > 3000) {
      suggestions.push('建议优化网络请求并发数');
    }
    
    if (linkAnalytics.uniqueDomains > 50) {
      suggestions.push('建议按域名分组处理，避免对单个域名请求过于频繁');
    }
    
    return suggestions;
  }

  /**
   * 生成性能报告
   */
  static generatePerformanceReport(
    executionAnalytics: ExecutionAnalytics,
    linkAnalytics: LinkAnalytics
  ): string {
    const report = [
      '=== 性能分析报告 ===',
      '',
      '执行统计:',
      `  总执行次数: ${executionAnalytics.totalExecutions}`,
      `  成功次数: ${executionAnalytics.successfulExecutions}`,
      `  失败次数: ${executionAnalytics.failedExecutions}`,
      `  成功率: ${executionAnalytics.successRate.toFixed(2)}%`,
      `  平均执行时间: ${(executionAnalytics.averageExecutionTime / 1000).toFixed(2)}秒`,
      '',
      '链接统计:',
      `  总链接数: ${linkAnalytics.totalLinks}`,
      `  成功处理: ${linkAnalytics.successfulLinks}`,
      `  处理失败: ${linkAnalytics.failedLinks}`,
      `  平均处理时间: ${(linkAnalytics.averageProcessingTime / 1000).toFixed(2)}秒`,
      `  涉及域名: ${linkAnalytics.uniqueDomains}个`,
      '',
      '热门域名:',
      ...linkAnalytics.topDomains?.filter(Boolean)?.map((d: any) => `  ${d.domain}: ${d.count}次`),
      '',
      '优化建议:',
      ...this.generateOptimizationSuggestions(executionAnalytics, linkAnalytics)
        ?.filter(Boolean)?.map((s: any) => `  - ${s}`),
      ''
    ];
    
    return report.join('\n');
  }
}