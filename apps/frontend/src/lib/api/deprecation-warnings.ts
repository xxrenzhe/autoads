/**
 * 废弃功能警告系统
 * 管理API功能的废弃通知和迁移指导
 */

import { NextRequest, NextResponse } from 'next/server';

export interface DeprecatedFeature {
  name: string;
  deprecatedSince: string;
  removalVersion?: string;
  removalDate?: Date;
  replacement?: string;
  migrationGuide?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedEndpoints: string[];
  reason: string;
}

// 废弃功能配置
export const DEPRECATED_FEATURES: Record<string, DeprecatedFeature> = {
  'legacy-token-format': {
    name: 'Legacy Token Format',
    deprecatedSince: 'v2.0',
    removalVersion: 'v4.0',
    removalDate: new Date('2025-06-01'),
    replacement: 'Enhanced Token Management',
    migrationGuide: '/docs/migration/token-format',
    severity: 'medium',
    affectedEndpoints: ['/api/v1/users/tokens', '/api/v2/tokens/legacy'],
    reason: '旧的Token格式不支持高级功能和安全特性'
  },
  'basic-auth': {
    name: 'Basic Authentication',
    deprecatedSince: 'v2.5',
    removalVersion: 'v3.5',
    removalDate: new Date('2025-03-01'),
    replacement: 'OAuth2 Authentication',
    migrationGuide: '/docs/migration/auth-oauth2',
    severity: 'high',
    affectedEndpoints: ['/api/v1/auth/login', '/api/v2/auth/basic'],
    reason: '基础认证不够安全，建议使用OAuth2'
  },
  'sync-operations': {
    name: 'Synchronous Operations',
    deprecatedSince: 'v3.0',
    removalVersion: 'v4.0',
    removalDate: new Date('2025-08-01'),
    replacement: 'Async Operations with Webhooks',
    migrationGuide: '/docs/migration/async-operations',
    severity: 'medium',
    affectedEndpoints: ['/api/v2/batch/sync', '/api/v3/operations/sync'],
    reason: '同步操作影响性能，推荐使用异步操作'
  },
  'xml-format': {
    name: 'XML Response Format',
    deprecatedSince: 'v1.5',
    removalVersion: 'v3.0',
    removalDate: new Date('2024-12-31'),
    replacement: 'JSON Response Format',
    migrationGuide: '/docs/migration/json-format',
    severity: 'low',
    affectedEndpoints: ['/api/v1/export/xml', '/api/v2/reports/xml'],
    reason: 'JSON格式更轻量且易于处理'
  }
};

/**
 * 废弃警告管理器
 */
export class DeprecationWarningManager {
  /**
   * 检查端点是否使用了废弃功能
   */
  static checkDeprecatedFeatures(request: NextRequest): DeprecatedFeature[] {
    const pathname = request.nextUrl.pathname;
    const deprecatedFeatures: DeprecatedFeature[] = [];

    Object.values(DEPRECATED_FEATURES).forEach((feature: any) => {
      if (feature.affectedEndpoints.some(endpoint => pathname.includes(endpoint))) {
        deprecatedFeatures.push(feature);
      }
    });

    return deprecatedFeatures;
  }

  /**
   * 生成废弃警告消息
   */
  static generateWarningMessage(feature: DeprecatedFeature): string {
    let message = `功能 "${feature.name}" 已在 ${feature.deprecatedSince} 版本中废弃`;
    
    if (feature.removalVersion) {
      message += `，将在 ${feature.removalVersion} 版本中移除`;
    }
    
    if (feature.removalDate) {
      const dateStr = feature.removalDate.toISOString().split('T')[0];
      message += `（预计 ${dateStr}）`;
    }
    
    if (feature.replacement) {
      message += `。请使用 "${feature.replacement}" 替代`;
    }
    
    message += `。原因: ${feature.reason}`;
    
    return message;
  }

  /**
   * 添加废弃警告到响应头
   */
  static addWarningHeaders(
    response: NextResponse, 
    features: DeprecatedFeature[]
  ): NextResponse {
    if (features.length === 0) {
      return response;
    }

    // 添加废弃警告头
    response.headers.set('Deprecation', 'true');
    
    // 添加警告详情
    const warnings = features?.filter(Boolean)?.map((feature: any) => {
      const code = this.getSeverityCode(feature.severity);
      const message = this.generateWarningMessage(feature);
      return `${code} - "${message}"`;
    });
    
    response.headers.set('Warning', warnings.join(', '));

    // 添加迁移指南链接
    const migrationGuides = features
      .filter((f: any) => f.migrationGuide)
      ?.filter(Boolean)?.map((f: any) => f.migrationGuide)
      .join(', ');
    
    if (migrationGuides) {
      response.headers.set('Migration-Guide', migrationGuides);
    }

    // 添加移除日期
    const earliestRemoval = features
      .filter((f: any) => f.removalDate)
      .sort((a, b) => (a.removalDate!.getTime() - b.removalDate!.getTime()))[0];
    
    if (earliestRemoval?.removalDate) {
      response.headers.set('Sunset', earliestRemoval.removalDate.toISOString());
    }

    return response;
  }

  /**
   * 获取严重程度对应的警告代码
   */
  private static getSeverityCode(severity: string): number {
    switch (severity) {
      case 'low': return 299;
      case 'medium': return 298;
      case 'high': return 297;
      case 'critical': return 296;
      default: return 299;
    }
  }

  /**
   * 创建包含废弃警告的响应
   */
  static createWarningResponse<T>(
    data: T,
    request: NextRequest,
    status: number = 200
  ): NextResponse {
    const deprecatedFeatures = this.checkDeprecatedFeatures(request);
    
    // 创建响应数据
    const responseData: any = {
      data,
      warnings: deprecatedFeatures.length > 0 ? {
        deprecated_features: deprecatedFeatures?.filter(Boolean)?.map((feature: any) => ({
          name: feature.name,
          message: this.generateWarningMessage(feature),
          severity: feature.severity,
          migration_guide: feature.migrationGuide,
          removal_date: feature.removalDate?.toISOString()
        }))
      } : undefined
    };

    // 清理undefined字段
    if (!responseData.warnings) {
      delete responseData.warnings;
    }

    const response = NextResponse.json(responseData, { status });
    
    // 添加警告头
    return this.addWarningHeaders(response, deprecatedFeatures);
  }

  /**
   * 检查功能是否即将被移除
   */
  static isFeatureNearRemoval(featureName: string, daysThreshold: number = 90): boolean {
    const feature = DEPRECATED_FEATURES[featureName];
    if (!feature?.removalDate) {
      return false;
    }

    const now = new Date();
    const timeDiff = feature.removalDate.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return daysDiff <= daysThreshold && daysDiff > 0;
  }

  /**
   * 获取所有废弃功能的摘要
   */
  static getDeprecationSummary(): {
    total: number;
    by_severity: Record<string, number>;
    near_removal: DeprecatedFeature[];
  } {
    const features = Object.values(DEPRECATED_FEATURES);
    
    const bySeverity = features.reduce((acc, feature: any) => {
      acc[feature.severity] = (acc[feature.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const nearRemoval = features.filter((feature: any) => 
      this.isFeatureNearRemoval(feature.name)
    );

    return {
      total: features.length,
      by_severity: bySeverity,
      near_removal: nearRemoval
    };
  }

  /**
   * 记录废弃功能使用情况
   */
  static async logDeprecatedUsage(
    feature: DeprecatedFeature,
    request: NextRequest,
    userAgent?: string
  ): Promise<void> {
    try {
      // 这里可以集成到日志系统或分析系统
      const logData = {
        timestamp: new Date().toISOString(),
        feature_name: feature.name,
        endpoint: request.nextUrl.pathname,
        user_agent: userAgent || request.headers.get('user-agent'),
        ip: request.ip || request.headers.get('x-forwarded-for'),
        severity: feature.severity,
        removal_date: feature.removalDate?.toISOString()
      };

      // 发送到日志服务（这里使用console.log作为示例）
      console.warn('Deprecated feature usage:', logData);

      // 可以集成到外部服务
      // await sendToAnalytics(logData);
      // await sendToLoggingService(logData);
    } catch (error) {
      console.error('Failed to log deprecated usage:', error);
    }
  }
}

/**
 * 废弃功能检查中间件
 */
export function withDeprecationWarnings(handler: Function) {
  return async (request: NextRequest, ...args: any[]) => {
    // 检查废弃功能
    const deprecatedFeatures = DeprecationWarningManager.checkDeprecatedFeatures(request);

    // 记录使用情况
    for (const feature of deprecatedFeatures) {
      await DeprecationWarningManager.logDeprecatedUsage(feature, request);
    }

    // 调用原始处理器
    const response = await handler(request, ...args);

    // 添加废弃警告
    if (response instanceof NextResponse && deprecatedFeatures.length > 0) {
      return DeprecationWarningManager.addWarningHeaders(response, deprecatedFeatures);
    }

    return response;
  };
}

/**
 * 废弃功能装饰器
 */
export function deprecated(
  featureName: string,
  options?: {
    replacement?: string;
    migrationGuide?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (request: NextRequest, ...args: any[]) {
      // 创建临时废弃功能信息
      const feature: DeprecatedFeature = {
        name: featureName,
        deprecatedSince: 'current',
        severity: options?.severity || 'medium',
        affectedEndpoints: [request.nextUrl.pathname],
        reason: '此功能已废弃',
        replacement: options?.replacement,
        migrationGuide: options?.migrationGuide
      };

      // 记录使用情况
      await DeprecationWarningManager.logDeprecatedUsage(feature, request);

      // 调用原始方法
      const result = await originalMethod.apply(this, [request, ...args]);

      // 如果返回NextResponse，添加警告头
      if (result instanceof NextResponse) {
        return DeprecationWarningManager.addWarningHeaders(result, [feature]);
      }

      return result;
    };

    return descriptor;
  };
}