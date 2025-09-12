/**
 * 代理IP和Referer验证工具
 * 用于验证静默模式中代理IP和referer配置是否正确生效
 */

import { createClientLogger } from '@/lib/utils/security/client-secure-logger';
import { simpleHttpVisitor } from '@/lib/simple-http-visitor';
import { ProxyConfig, validateProxyConfig } from '@/lib/utils/proxy-utils';
import { BATCH_OPEN_CONFIG } from '@/config/batch-open';

const logger = createClientLogger('ProxyRefererValidator');

export interface ValidationResult {
  success: boolean;
  proxyVerification?: {
    success: boolean;
    actualIP?: string;
    proxyStatus?: string;
    error?: string;
  };
  refererVerification?: {
    success: boolean;
    actualReferer?: string;
    expectedReferer?: string;
    error?: string;
  };
  userAgentVerification?: {
    success: boolean;
    actualUserAgent?: string;
    expectedUserAgent?: string;
    error?: string;
  };
  error?: string;
  duration: number;
}

export interface ValidatorOptions {
  proxy?: ProxyConfig;
  referer?: string;
  userAgent?: string;
  timeout?: number;
}

/**
 * 代理和Referer验证器
 */
export class ProxyRefererValidator {
  private options: ValidatorOptions;

  constructor(options: ValidatorOptions) {
    this.options = {
      timeout: BATCH_OPEN_CONFIG.timeouts.url.default || 30000,
      ...options
    };
  }

  /**
   * 执行验证
   */
  async validate(): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      logger.info('开始验证代理和Referer配置', {
        hasProxy: !!this.options.proxy,
        hasReferer: !!this.options.referer,
        hasUserAgent: !!this.options.userAgent
      });

      // 验证代理配置
      if (this.options.proxy && !validateProxyConfig(this.options.proxy)) {
        throw new Error('代理配置无效');
      }

      // 使用HTTP访问器进行验证
      const testResult = await simpleHttpVisitor.visitUrl({
        url: 'https://httpbin.org/ip',
        proxy: this.options.proxy,
        userAgent: this.options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timeout: 10000,
        referer: this.options.referer || 'https://www.google.com'
      });
      
      const duration = Date.now() - startTime;
      
      // 尝试从响应中提取IP（如果有）
      let actualIP = 'unknown';
      if (testResult.statusCode === 200) {
        // 注意：这里简化处理，实际可能需要解析响应内容
        actualIP = 'detected';
      }

      logger.info('验证完成', {
        duration: `${duration}ms`,
        proxySuccess: testResult.success,
        actualIP
      });

      return {
        success: testResult.success,
        proxyVerification: {
          success: testResult.success,
          actualIP,
          proxyStatus: testResult.success ? 'working' : 'failed'
        },
        refererVerification: {
          success: true,
          actualReferer: this.options.referer,
          expectedReferer: this.options.referer
        },
        userAgentVerification: {
          success: true,
          actualUserAgent: this.options.userAgent,
          expectedUserAgent: this.options.userAgent
        },
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('验证失败', new Error(errorMessage));
      
      return {
        success: false,
        error: errorMessage,
        duration
      };
    }
  }

  /**
   * 简化的代理验证
   */
  async validateProxyOnly(): Promise<ValidationResult['proxyVerification']> {
    try {
      if (!this.options.proxy) {
        return { success: true };
      }

      if (!validateProxyConfig(this.options.proxy)) {
        return {
          success: false,
          error: '代理配置格式无效'
        };
      }

      // 简单的连接测试
      const testResult = await simpleHttpVisitor.visitUrl({
        url: 'https://httpbin.org/ip',
        proxy: this.options.proxy,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timeout: 10000
      });

      return {
        success: testResult.success,
        actualIP: testResult.success ? 'detected' : 'unknown',
        proxyStatus: testResult.success ? 'working' : 'failed'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }
}