/**
 * 代理连接诊断工具
 * 用于诊断不同环境下的代理连接问题
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { ProxyConfig } from '@/lib/utils/proxy-utils';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const logger = createLogger('ProxyDiagnostics');

interface DiagnosticResult {
  environment: string;
  domain: string;
  proxy: ProxyConfig;
  testResults: {
    directConnection: boolean;
    proxyConnection: boolean;
    httpsUrl: string;
    statusCode?: number;
    error?: string;
    headers?: Record<string, string>;
  }[];
  recommendations: string[];
}

export class ProxyDiagnostics {
  /**
   * 诊断代理连接问题
   */
  static async diagnoseProxyConnection(
    proxy: ProxyConfig,
    testUrls: string[] = [
      'https://httpbin.org/ip',
      'https://api.ipify.org?format=json',
      'https://ifconfig.me/ip'
    ]
  ): Promise<DiagnosticResult> {
    const environment = process.env.DEPLOYMENT_ENV || 'unknown';
    const domain = process.env.DOMAIN || process.env.VERCEL_URL || 'localhost';
    
    const results: DiagnosticResult = {
      environment,
      domain,
      proxy,
      testResults: [],
      recommendations: []
    };

    logger.info('开始代理连接诊断', {
      environment,
      domain,
      proxy: {
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol,
        hasAuth: !!(proxy.username && proxy.password)
      }
    });

    // 测试1: 直接连接（作为基准）
    try {
      const directResponse = await axios.get('https://httpbin.org/ip', {
        timeout: 10000
      });
      results.testResults.push({
        directConnection: true,
        proxyConnection: false,
        httpsUrl: 'https://httpbin.org/ip',
        statusCode: directResponse.status,
        headers: directResponse.headers as Record<string, string>
      });
      logger.info('直接连接测试成功');
    } catch (error) {
      results.testResults.push({
        directConnection: true,
        proxyConnection: false,
        httpsUrl: 'https://httpbin.org/ip',
        error: error instanceof Error ? error.message : String(error)
      });
      logger.warn('直接连接测试失败', { error });
    }

    // 测试2: 代理连接
    for (const url of testUrls) {
      try {
        // 创建代理Agent
        const proxyUrl = proxy.username && proxy.password
          ? `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
          : `${proxy.protocol}://${proxy.host}:${proxy.port}`;
        
        const proxyAgent = new HttpsProxyAgent(proxyUrl);
        
        // 准备请求头
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };
        
        // 添加Proxy-Authorization头
        if (proxy.username && proxy.password) {
          const authString = Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64');
          headers['Proxy-Authorization'] = `Basic ${authString}`;
        }
        
        logger.info(`测试代理连接: ${url}`, {
          proxyUrl: proxyUrl.replace(/:([^:@]+)@/, ':***@'),
          hasProxyAuth: !!headers['Proxy-Authorization']
        });
        
        const response = await axios.get(url, {
          timeout: 15000,
          httpAgent: proxyAgent,
          httpsAgent: proxyAgent,
          headers,
          validateStatus: (status) => status < 500
        });
        
        results.testResults.push({
          directConnection: false,
          proxyConnection: true,
          httpsUrl: url,
          statusCode: response.status,
          headers: response.headers as Record<string, string>
        });
        
        logger.info(`代理连接测试成功: ${url}`, {
          statusCode: response.status,
          proxyUsed: !!response.request?.agent?.proxy
        });
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.testResults.push({
          directConnection: false,
          proxyConnection: true,
          httpsUrl: url,
          error: errorMessage
        });
        
        logger.error(`代理连接测试失败: ${url}`, { error: errorMessage });
        
        // 分析错误类型
        if (errorMessage.includes('407')) {
          results.recommendations.push(
            '代理认证失败 (HTTP 407): 请检查用户名和密码是否正确',
            '考虑显式添加Proxy-Authorization请求头',
            '确认代理服务商的认证格式要求'
          );
        } else if (errorMessage.includes('ECONNREFUSED')) {
          results.recommendations.push(
            '代理连接被拒绝: 请检查代理服务器是否正常运行',
            '确认代理地址和端口是否正确'
          );
        } else if (errorMessage.includes('timeout')) {
          results.recommendations.push(
            '代理连接超时: 可能是网络问题或代理服务器响应慢',
            '考虑增加超时时间或更换代理服务器'
          );
        } else if (errorMessage.includes('certificate') || errorMessage.includes('CERT_UNTRUSTED')) {
          results.recommendations.push(
            'HTTPS证书问题: 代理可能存在SSL证书验证问题',
            '考虑添加rejectUnauthorized: false选项（仅用于测试）'
          );
        }
      }
    }

    // 环境特定的建议
    if (domain.includes('autoads.dev')) {
      results.recommendations.push(
        '生产环境 (autoads.dev): 检查是否有特殊的代理配置或防火墙规则',
        '确认生产环境的代理API URL是否正确配置'
      );
    } else if (domain.includes('urlchecker.dev')) {
      results.recommendations.push(
        '预发环境 (urlchecker.dev): 检查预发环境特有的代理配置',
        '预发环境可能使用不同的代理服务商或配置'
      );
    }

    // 域名相关的建议
    if (environment === 'production') {
      results.recommendations.push(
        '生产环境建议: 检查HTTPS代理配置',
        '确认生产环境的网络策略是否允许代理连接'
      );
    }

    return results;
  }

  /**
   * 比较两个环境的代理配置
   */
  static async compareEnvironments(proxy: ProxyConfig): Promise<{
    production: DiagnosticResult;
    preview: DiagnosticResult;
    differences: string[];
  }> {
    // 模拟两个环境的测试
    const productionResult = await this.diagnoseProxyConnection(proxy);
    
    // 修改环境变量来模拟预发环境
    const originalEnv = process.env.DEPLOYMENT_ENV;
    const originalDomain = process.env.DOMAIN;
    
    process.env.DEPLOYMENT_ENV = 'preview';
    process.env.DOMAIN = 'urlchecker.dev';
    
    const previewResult = await this.diagnoseProxyConnection(proxy);
    
    // 恢复原始环境变量
    if (originalEnv) process.env.DEPLOYMENT_ENV = originalEnv;
    if (originalDomain) process.env.DOMAIN = originalDomain;
    else delete process.env.DOMAIN;
    
    // 分析差异
    const differences: string[] = [];
    
    if (productionResult.testResults.length !== previewResult.testResults.length) {
      differences.push('测试结果数量不同');
    }
    
    productionResult.testResults.forEach((prodTest, index) => {
      const prevTest = previewResult.testResults[index];
      if (!prevTest) return;
      
      if (prodTest.statusCode !== prevTest.statusCode) {
        differences.push(
          `URL ${prodTest.httpsUrl}: 生产状态 ${prodTest.statusCode} vs 预发状态 ${prevTest.statusCode}`
        );
      }
      
      if (prodTest.error !== prevTest.error) {
        differences.push(
          `URL ${prodTest.httpsUrl}: 错误信息不同`
        );
      }
    });
    
    return {
      production: productionResult,
      preview: previewResult,
      differences
    };
  }
}

export default ProxyDiagnostics;