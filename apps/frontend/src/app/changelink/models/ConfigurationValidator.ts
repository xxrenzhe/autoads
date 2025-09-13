import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('ConfigurationValidator');

/**
 * 配置验证服务
 * 负责验证AdsPower环境、测试链接等功能
 */

export interface ValidationResult {
  valid: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

export interface LinkTestResult {
  url: string;
  valid: boolean;
  error?: string;
  responseTime?: number;
  finalUrl?: string;
}

export interface EnvironmentInfo {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  browserType: string;
  version: string;
}

export class ConfigurationValidator {
  private adsPowerBaseUrl = process.env.NEXT_PUBLIC_ADSPOWER_BASE_URL || 'http://local.adspower.net:50325';

  /**
   * 验证AdsPower环境ID
   */
  async validateEnvironment(environmentId: string): Promise<ValidationResult> {
    try {
      // 检查环境ID格式
      if (!environmentId || environmentId.trim() === '') {
        return {
          valid: false,
          message: '环境ID不能为空'
        };
      }

      // 尝试获取环境信息
      const response = await fetch(`${this.adsPowerBaseUrl}/api/v1/user/list`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          valid: false,
          message: '无法连接到AdsPower服务，请确保AdsPower正在运行'
        };
      }

      const data = await response.json();

      // 检查环境是否存在
      const environment = data.data?.list?.find((env: Record<string, unknown>: any) => (env as { user_id: string }).user_id === environmentId);

      if (!environment) {
        return {
          valid: false,
          message: '环境ID不存在，请检查环境ID是否正确'
        };
      }

      // 检查环境状态
      if (environment.user_status !== 'Active') {
        return {
          valid: false,
          message: `环境状态异常: ${environment.user_status}`
        };
      }

      return {
        valid: true,
        message: '环境验证成功',
        details: {
          id: environment.user_id,
          name: environment.name,
          status: environment.user_status,
          browserType: environment.browser_kernel,
          lastUsed: environment.last_open_time
        }
      };

    } catch (error) {
      logger.error('Environment validation error:', new EnhancedError('Environment validation error:', { error: error instanceof Error ? error.message : String(error)  }));
      return {
        valid: false,
        message: '验证过程中发生错误: ' + (error instanceof Error ? error.message : '未知错误')
      };
    }
  }

  /**
   * 测试链接可访问性
   */
  async testLinks(links: string[]): Promise<LinkTestResult[]> {
    const results: LinkTestResult[] = [];

    for (const url of links) {
      const startTime = Date.now();

      try {
        // 基本URL格式验证
        new URL(url);

        // 尝试访问链接（使用HEAD请求减少数据传输）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        if (response.ok || response.status === 405) { // 405 Method Not Allowed也算成功
          results.push({
            url,
            valid: true,
            responseTime,
            finalUrl: response.url !== url ? response.url : undefined
          });
        } else {
          results.push({
            url,
            valid: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
            responseTime
          });
        }

      } catch (error) {
        const responseTime = Date.now() - startTime;

        if (error instanceof TypeError && error.message.includes('Invalid URL')) {
          results.push({
            url,
            valid: false,
            error: 'URL格式无效',
            responseTime
          });
        } else if (error instanceof Error && error.name === 'AbortError') {
          results.push({
            url,
            valid: false,
            error: '请求超时（10秒）',
            responseTime
          });
        } else {
          results.push({
            url,
            valid: false,
            error: error instanceof Error ? error.message : '未知错误',
            responseTime
          });
        }
      }
    }

    return results;
  }

  /**
   * 获取AdsPower环境列表
   */
  async getEnvironmentList(): Promise<EnvironmentInfo[]> {
    try {
      const response = await fetch(`${this.adsPowerBaseUrl}/api/v1/user/list`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('无法获取环境列表');
      }

      const data = await response.json();

      return data.data?.list?.map((env: Record<string, unknown>: any) => ({
        id: env.user_id,
        name: env.name,
        status: env.user_status === 'Active' ? 'active' :
          env.user_status === 'Inactive' ? 'inactive' : 'error',
        browserType: env.browser_kernel,
        version: env.browser_version
      })) || [];

    } catch (error) {
      logger.error('Failed to get environment list:', new EnhancedError('Failed to get environment list:', { error: error instanceof Error ? error.message : String(error)  }));
      return [];
    }
  }

  /**
   * 验证配置完整性
   */
  validateConfiguration(config: Partial<import('../types').TrackingConfiguration>): ValidationResult {
    const errors: string[] = [];

    // 基础字段验证
    if (!config.name || config.name.trim() === '') {
      errors.push('配置名称不能为空');
    }

    if (!config.environmentId || config.environmentId.trim() === '') {
      errors.push('AdsPower环境ID不能为空');
    }

    if (!config.notificationEmail || !this.isValidEmail(config.notificationEmail)) {
      errors.push('请输入有效的通知邮箱');
    }

    if (!config.repeatCount || config.repeatCount < 1 || config.repeatCount > 10) {
      errors.push('重复次数必须在1-10之间');
    }

    // 链接验证
    if (!config.originalLinks || config.originalLinks.length === 0) {
      errors.push('至少需要一个原始链接');
    } else {
      const validLinks = config.originalLinks.filter((link: string: any) => link && link.trim() !== '');
      if (validLinks.length === 0) {
        errors.push('至少需要一个有效的原始链接');
      } else {
        validLinks.forEach((link: string, index: number: any) => {
          try {
            new URL(link);
          } catch {
            errors.push(`第${index + 1}个链接格式无效`);
          }
        });
      }
    }

    // 映射配置验证
    if (config.adMappingConfig && config.adMappingConfig.length > 0) {
      config.adMappingConfig.forEach((mapping: any, index: number: any) => {
        if (!mapping.adMappings || mapping.adMappings.length === 0) {
          errors.push(`映射${index + 1}未选择目标广告`);
        }

        // 检查执行次数是否超出范围
        for (const adMapping of mapping.adMappings || []) {
          if (config.repeatCount && adMapping.executionNumber > config.repeatCount) {
            errors.push(
              `映射${index + 1}的广告映射执行次数 ${adMapping.executionNumber} 超出配置的执行次数 ${config.repeatCount}`
            );
          }
          if (adMapping.executionNumber < 1) {
            errors.push(`执行次数必须大于0: 映射${index + 1}`);
          }
        }
      });
    }

    return {
      valid: errors.length === 0,
      message: errors.length > 0 ? errors.join('; ') : '配置验证通过',
      details: { errors }
    };
  }

  /**
   * 验证邮箱格式
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 预估执行时间
   */
  estimateExecutionTime(config: Partial<import('../types').TrackingConfiguration>): {
    totalTime: number; // 总时间（秒）
    breakdown: {
      linkProcessing: number;
      googleAdsUpdates: number;
      overhead: number;
    };
  } {
    const linkCount = config.originalLinks?.filter((l: string: any) => l.trim()).length || 0;
    const repeatCount = config.repeatCount || 1;
    const totalLinkExecutions = linkCount * repeatCount;

    // 每个链接执行时间：35秒 + 1-5秒随机延迟 + 20秒页面加载
    const avgLinkTime = 35 + 3 + 20; // 平均58秒
    const linkProcessingTime = totalLinkExecutions * avgLinkTime;

    // Google Ads更新时间估算
    const adCount = this.countTotalAds(config);
    const googleAdsUpdateTime = adCount * 2; // 每个广告约2秒

    // 系统开销
    const overhead = 30; // 30秒系统开销

    return {
      totalTime: linkProcessingTime + googleAdsUpdateTime + overhead,
      breakdown: {
        linkProcessing: linkProcessingTime,
        googleAdsUpdates: googleAdsUpdateTime,
        overhead
      }
    };
  }

  /**
   * 计算总广告数量
   */
  private countTotalAds(config: Partial<import('../types').TrackingConfiguration>): number {
    if (!config.adMappingConfig) return 0;

    const uniqueAdIds = new Set<string>();
    config.adMappingConfig.forEach((mapping: any: any) => {
      if (mapping.adMappings) {
        mapping.adMappings.forEach((adMapping: any: any) => {
          if (adMapping.targetAdId) {
            uniqueAdIds.add(adMapping.targetAdId);
          }
        });
      }
    });

    return uniqueAdIds.size;
  }
}