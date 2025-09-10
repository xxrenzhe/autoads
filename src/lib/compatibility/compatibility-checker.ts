/**
 * 兼容性检查工具
 * 检测系统兼容性问题并提供解决方案
 */

import { NextRequest } from 'next/server';

export interface CompatibilityIssue {
  type: 'breaking_change' | 'deprecation' | 'performance' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  description: string;
  impact: string;
  solution: string;
  migrationGuide?: string;
  affectedVersions: string[];
  detectedAt: Date;
}

export interface CompatibilityReport {
  overall_status: 'compatible' | 'warning' | 'incompatible';
  issues: CompatibilityIssue[];
  recommendations: string[];
  migration_required: boolean;
  estimated_effort: 'low' | 'medium' | 'high';
}

export interface SystemInfo {
  api_version: string;
  client_version?: string;
  user_agent: string;
  features_used: string[];
  endpoints_accessed: string[];
}

/**
 * 兼容性检查器
 */
export class CompatibilityChecker {
  private static knownIssues: CompatibilityIssue[] = [
    {
      type: 'breaking_change',
      severity: 'high',
      component: 'User API',
      description: 'User.tokenBalance字段已重命名为tokens',
      impact: '使用旧字段名的客户端将收到undefined值',
      solution: '更新客户端代码使用新的tokens字段',
      migrationGuide: '/docs/migration/user-tokens',
      affectedVersions: ['v1'],
      detectedAt: new Date('2024-06-01')
    },
    {
      type: 'breaking_change',
      severity: 'high',
      component: 'User API',
      description: 'User.isActive字段已替换为status枚举',
      impact: '布尔值检查将失效，需要检查status值',
      solution: '使用status === "ACTIVE"替代isActive检查',
      migrationGuide: '/docs/migration/user-status',
      affectedVersions: ['v1'],
      detectedAt: new Date('2024-06-01')
    },
    {
      type: 'deprecation',
      severity: 'medium',
      component: 'Authentication',
      description: '基础认证方式已废弃',
      impact: '安全性降低，功能受限',
      solution: '迁移到OAuth2认证',
      migrationGuide: '/docs/migration/oauth2',
      affectedVersions: ['v1', 'v2'],
      detectedAt: new Date('2024-08-01')
    },
    {
      type: 'performance',
      severity: 'medium',
      component: 'Batch Operations',
      description: '同步批量操作影响性能',
      impact: '大量数据处理时可能超时',
      solution: '使用异步批量操作API',
      migrationGuide: '/docs/migration/async-batch',
      affectedVersions: ['v2'],
      detectedAt: new Date('2024-09-01')
    },
    {
      type: 'security',
      severity: 'critical',
      component: 'Token Management',
      description: '旧版Token格式缺乏安全特性',
      impact: 'Token可能被伪造或重放攻击',
      solution: '升级到新的Token格式',
      migrationGuide: '/docs/migration/secure-tokens',
      affectedVersions: ['v1'],
      detectedAt: new Date('2024-10-01')
    }
  ];

  /**
   * 执行兼容性检查
   */
  static async checkCompatibility(
    request: NextRequest,
    systemInfo: SystemInfo
  ): Promise<CompatibilityReport> {
    const issues: CompatibilityIssue[] = [];
    const recommendations: string[] = [];

    // 检查API版本兼容性
    const versionIssues = this.checkApiVersionCompatibility(systemInfo.api_version);
    issues.push(...versionIssues);

    // 检查功能使用兼容性
    const featureIssues = this.checkFeatureCompatibility(
      systemInfo.features_used,
      systemInfo.api_version
    );
    issues.push(...featureIssues);

    // 检查端点兼容性
    const endpointIssues = this.checkEndpointCompatibility(
      systemInfo.endpoints_accessed,
      systemInfo.api_version
    );
    issues.push(...endpointIssues);

    // 检查客户端兼容性
    if (systemInfo.client_version) {
      const clientIssues = this.checkClientCompatibility(
        systemInfo.client_version,
        systemInfo.api_version
      );
      issues.push(...clientIssues);
    }

    // 生成建议
    recommendations.push(...this.generateRecommendations(issues, systemInfo));

    // 确定整体状态
    const overallStatus = this.determineOverallStatus(issues);

    // 评估迁移需求
    const migrationRequired = issues.some(
      issue => issue.type === 'breaking_change' && issue.severity === 'critical'
    );

    // 估算工作量
    const estimatedEffort = this.estimateEffort(issues);

    return {
      overall_status: overallStatus,
      issues,
      recommendations,
      migration_required: migrationRequired,
      estimated_effort: estimatedEffort
    };
  }

  /**
   * 检查API版本兼容性
   */
  private static checkApiVersionCompatibility(apiVersion: string): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];

    // 检查是否使用了废弃版本
    if (apiVersion === 'v1') {
      issues.push(...this.knownIssues.filter(issue => 
        issue.affectedVersions.includes('v1')
      ));
    }

    return issues;
  }

  /**
   * 检查功能兼容性
   */
  private static checkFeatureCompatibility(
    featuresUsed: string[],
    apiVersion: string
  ): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];

    // 检查废弃功能使用
    const deprecatedFeatures = [
      'basic-auth',
      'sync-operations',
      'xml-format',
      'legacy-token-format'
    ];

    featuresUsed.forEach(feature => {
      if (deprecatedFeatures.includes(feature)) {
        const relatedIssue = this.knownIssues.find(issue => 
          issue.component.toLowerCase().includes(feature.replace('-', ' '))
        );
        if (relatedIssue) {
          issues.push(relatedIssue);
        }
      }
    });

    return issues;
  }

  /**
   * 检查端点兼容性
   */
  private static checkEndpointCompatibility(
    endpointsAccessed: string[],
    apiVersion: string
  ): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];

    // 检查废弃端点
    const deprecatedEndpoints = [
      '/api/v1/auth/login',
      '/api/v1/users/tokens',
      '/api/v2/batch/sync'
    ];

    endpointsAccessed.forEach(endpoint => {
      if (deprecatedEndpoints.some(deprecated => endpoint.includes(deprecated))) {
        const relatedIssue = this.knownIssues.find(issue => 
          issue.description.toLowerCase().includes('auth') ||
          issue.description.toLowerCase().includes('token') ||
          issue.description.toLowerCase().includes('batch')
        );
        if (relatedIssue) {
          issues.push(relatedIssue);
        }
      }
    });

    return issues;
  }

  /**
   * 检查客户端兼容性
   */
  private static checkClientCompatibility(
    clientVersion: string,
    apiVersion: string
  ): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];

    // 检查客户端版本是否过旧
    const [major, minor] = clientVersion.split('.')?.filter(Boolean)?.map(Number);
    
    if (major < 2) {
      issues.push({
        type: 'breaking_change',
        severity: 'high',
        component: 'Client SDK',
        description: `客户端版本 ${clientVersion} 过旧`,
        impact: '可能无法使用新功能，存在安全风险',
        solution: '升级到最新客户端版本',
        migrationGuide: '/docs/migration/client-upgrade',
        affectedVersions: [apiVersion],
        detectedAt: new Date()
      });
    } else if (major === 2 && minor < 5) {
      issues.push({
        type: 'deprecation',
        severity: 'medium',
        component: 'Client SDK',
        description: `客户端版本 ${clientVersion} 建议升级`,
        impact: '部分新功能不可用',
        solution: '升级到最新客户端版本',
        migrationGuide: '/docs/migration/client-upgrade',
        affectedVersions: [apiVersion],
        detectedAt: new Date()
      });
    }

    return issues;
  }

  /**
   * 生成建议
   */
  private static generateRecommendations(
    issues: CompatibilityIssue[],
    systemInfo: SystemInfo
  ): string[] {
    const recommendations: string[] = [];

    // 基于问题严重程度生成建议
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    const highIssues = issues.filter(issue => issue.severity === 'high');

    if (criticalIssues.length > 0) {
      recommendations.push('立即处理关键兼容性问题以确保系统安全');
    }

    if (highIssues.length > 0) {
      recommendations.push('尽快解决高优先级兼容性问题');
    }

    // API版本建议
    if (systemInfo.api_version === 'v1') {
      recommendations.push('强烈建议升级到API v3以获得最佳性能和安全性');
    } else if (systemInfo.api_version === 'v2') {
      recommendations.push('考虑升级到API v3以使用最新功能');
    }

    // 功能使用建议
    if (systemInfo.features_used.includes('basic-auth')) {
      recommendations.push('迁移到OAuth2认证以提高安全性');
    }

    if (systemInfo.features_used.includes('sync-operations')) {
      recommendations.push('使用异步操作以提高性能');
    }

    return recommendations;
  }

  /**
   * 确定整体状态
   */
  private static determineOverallStatus(issues: CompatibilityIssue[]): 'compatible' | 'warning' | 'incompatible' {
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    const highIssues = issues.filter(issue => issue.severity === 'high');

    if (criticalIssues.length > 0) {
      return 'incompatible';
    } else if (highIssues.length > 0) {
      return 'warning';
    } else if (issues.length > 0) {
      return 'warning';
    } else {
      return 'compatible';
    }
  }

  /**
   * 估算工作量
   */
  private static estimateEffort(issues: CompatibilityIssue[]): 'low' | 'medium' | 'high' {
    const criticalCount = issues.filter(issue => issue.severity === 'critical').length;
    const highCount = issues.filter(issue => issue.severity === 'high').length;
    const totalIssues = issues.length;

    if (criticalCount > 2 || totalIssues > 10) {
      return 'high';
    } else if (criticalCount > 0 || highCount > 3 || totalIssues > 5) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 获取迁移路径
   */
  static getMigrationPath(
    currentVersion: string,
    targetVersion: string = 'v3'
  ): { steps: string[]; guides: string[] } {
    const steps: string[] = [];
    const guides: string[] = [];

    if (currentVersion === 'v1' && targetVersion === 'v3') {
      steps.push(
        '1. 更新用户数据字段映射',
        '2. 迁移到OAuth2认证',
        '3. 更新Token管理逻辑',
        '4. 测试所有API调用',
        '5. 部署并验证'
      );
      guides.push(
        '/docs/migration/v1-to-v3',
        '/docs/migration/user-tokens',
        '/docs/migration/oauth2'
      );
    } else if (currentVersion === 'v2' && targetVersion === 'v3') {
      steps.push(
        '1. 更新认证方式',
        '2. 迁移同步操作到异步',
        '3. 测试新功能',
        '4. 部署验证'
      );
      guides.push(
        '/docs/migration/v2-to-v3',
        '/docs/migration/async-operations'
      );
    }

    return { steps, guides };
  }

  /**
   * 创建兼容性检查报告
   */
  static async generateDetailedReport(
    request: NextRequest,
    systemInfo: SystemInfo
  ): Promise<{
    report: CompatibilityReport;
    migration_path?: { steps: string[]; guides: string[] };
    timeline?: string;
  }> {
    const report = await this.checkCompatibility(request, systemInfo);
    
    let migrationPath;
    let timeline;

    if (report.migration_required) {
      migrationPath = this.getMigrationPath(systemInfo.api_version);
      
      // 估算时间线
      switch (report.estimated_effort) {
        case 'low':
          timeline = '1-2周';
          break;
        case 'medium':
          timeline = '3-6周';
          break;
        case 'high':
          timeline = '2-3个月';
          break;
      }
    }

    return {
      report,
      migration_path: migrationPath,
      timeline
    };
  }
}