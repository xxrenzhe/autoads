/**
 * 简化的 AdsPower 服务
 * 专注于核心功能：打开浏览器、获取链接、关闭浏览器
 */

export interface AdsPowerConfig {
  environmentId: string;
  affiliateUrl: string;
  openCount: number;
  delaySeconds?: number;
}

export interface AdsPowerResult {
  success: boolean;
  finalUrl?: string;
  finalUrlSuffix?: string;
  error?: string;
  logs: string[];
  executionTime: number;
}

class SimpleAdsPowerService {
  private readonly API_BASE = process.env.NEXT_PUBLIC_ADSPOWER_BASE_URL || 'http://local.adspower.net:50325';

  /**
   * 执行 AdsPower 自动化流程
   */
  async executeAdsPowerFlow(config: AdsPowerConfig): Promise<AdsPowerResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    
    try {
      logs.push('开始 AdsPower 自动化流程');
      
      // 1. 启动浏览器实例
      logs.push(`启动浏览器环境: ${config.environmentId}`);
      const browserResult = await this.startBrowser(config.environmentId);
      
      if (!browserResult.success) {
        throw new Error(`启动浏览器失败: ${browserResult.error}`);
      }
      
      logs.push('浏览器启动成功');
      
      // 2. 打开广告联盟链接
      logs.push(`打开广告联盟链接: ${config.affiliateUrl}`);
      const navigateResult = await this.navigateToUrl(config.environmentId, config.affiliateUrl);
      
      if (!navigateResult.success) {
        throw new Error(`导航失败: ${navigateResult.error}`);
      }
      
      logs.push('页面导航成功');
      
      // 3. 等待页面加载和跳转
      const waitTime = (config.delaySeconds || 35) + Math.random() * 5;
      logs.push(`等待 ${waitTime.toFixed(1)} 秒...`);
      await this.delay(waitTime * 1000);
      
      // 4. 获取当前页面 URL
      logs.push('获取当前页面 URL');
      const urlResult = await this.getCurrentUrl(config.environmentId);
      
      if (!urlResult.success || !urlResult.url) {
        throw new Error(`获取 URL 失败: ${urlResult.error}`);
      }
      
      const finalUrl = urlResult.url;
      logs.push(`获取到最终 URL: ${finalUrl}`);
      
      // 5. 解析 Final URL 和 Suffix
      const { finalUrl: baseUrl, finalUrlSuffix } = this.parseUrlComponents(finalUrl);
      logs.push(`解析结果 - Base URL: ${baseUrl}`);
      logs.push(`解析结果 - Suffix: ${finalUrlSuffix}`);
      
      // 6. 关闭浏览器
      logs.push('关闭浏览器');
      await this.closeBrowser(config.environmentId);
      logs.push('浏览器已关闭');
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        finalUrl: baseUrl,
        finalUrlSuffix,
        logs,
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      logs.push(`执行失败: ${errorMessage}`);
      
      // 尝试关闭浏览器
      try {
        await this.closeBrowser(config.environmentId);
        logs.push('浏览器已关闭');
      } catch (closeError) {
        logs.push(`关闭浏览器失败: ${closeError instanceof Error ? closeError.message : '未知错误'}`);
      }
      
      return {
        success: false,
        error: errorMessage,
        logs,
        executionTime
      };
    }
  }

  /**
   * 启动浏览器
   */
  private async startBrowser(environmentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/v1/browser/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: environmentId,
          open_tabs: 1
        })
      });
      
      const result = await response.json();
      
      if (result.code === 0 && result.data?.ws?.selenium_url) {
        return { success: true };
      } else {
        return { success: false, error: result.msg || '启动浏览器失败' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '网络错误' };
    }
  }

  /**
   * 导航到指定 URL
   */
  private async navigateToUrl(environmentId: string, url: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/v1/browser/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: environmentId,
          url: url
        })
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        return { success: true };
      } else {
        return { success: false, error: result.msg || '导航失败' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '网络错误' };
    }
  }

  /**
   * 获取当前页面 URL
   */
  private async getCurrentUrl(environmentId: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/v1/browser/current_url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: environmentId
        })
      });
      
      const result = await response.json();
      
      if (result.code === 0 && result.data?.url) {
        return { success: true, url: result.data.url };
      } else {
        return { success: false, error: result.msg || '获取 URL 失败' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '网络错误' };
    }
  }

  /**
   * 关闭浏览器
   */
  private async closeBrowser(environmentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/v1/browser/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: environmentId
        })
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        return { success: true };
      } else {
        return { success: false, error: result.msg || '关闭浏览器失败' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '网络错误' };
    }
  }

  /**
   * 解析 URL 组件
   */
  private parseUrlComponents(url: string): { finalUrl: string; finalUrlSuffix?: string } {
    try {
      const urlObj = new URL(url);
      
      // 移除跟踪参数，获取干净的 URL
      const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;
      
      // 获取查询参数作为 suffix
      const suffix = urlObj.search;
      
      return {
        finalUrl: cleanUrl,
        finalUrlSuffix: suffix ? suffix.substring(1) : undefined // 移除 '?'
      };
    } catch (error) {
      // 如果 URL 解析失败，返回原始 URL
      const questionIndex = url.indexOf('?');
      if (questionIndex > 0) {
        return {
          finalUrl: url.substring(0, questionIndex),
          finalUrlSuffix: url.substring(questionIndex + 1)
        };
      }
      
      return {
        finalUrl: url,
        finalUrlSuffix: undefined
      };
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 测试 AdsPower 连接
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/v1/user/list`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        return { success: true };
      } else {
        return { success: false, error: result.msg || '连接失败' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '网络错误' };
    }
  }

  /**
   * 获取可用环境列表
   */
  async getEnvironmentList(): Promise<{ success: boolean; environments?: any[]; error?: string }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/v1/user/list`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.code === 0 && result.data?.list) {
        return { 
          success: true, 
          environments: result.data.list.map((env: any) => ({
            id: env.user_id,
            name: env.user_name || env.user_id,
            group: env.group_name || 'default'
          }))
        };
      } else {
        return { success: false, error: result.msg || '获取环境列表失败' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '网络错误' };
    }
  }
}

export const simpleAdsPowerService = new SimpleAdsPowerService();