/**
 * 链接提取服务
 * 通过 AdsPower 浏览器访问广告联盟链接，提取最终的官网链接
 */

import { adsPowerClient } from '@/lib/api/AdsPowerApiClient';
import { ExtractedUrl, AdsPowerConfig } from '../types';
import { EnhancedError } from '@/lib/utils/error-handling';

export interface LinkExtractionOptions {
  timeout?: number; // 超时时间，默认30秒
  maxRetries?: number; // 最大重试次数，默认3次
  delayRange?: [number, number]; // 延迟时间范围，默认[35, 40]秒
  waitForStable?: boolean; // 是否等待URL稳定，默认true
  stableCheckInterval?: number; // 稳定性检查间隔，默认2秒
  stableCheckCount?: number; // 稳定性检查次数，默认3次
}

export interface LinkExtractionResult {
  success: boolean;
  originalUrl: string;
  finalUrl?: string;
  finalUrlSuffix?: string;
  processingTime: number;
  retryCount: number;
  error?: string;
  logs: string[];
}

export class LinkExtractionService {
  private defaultOptions: LinkExtractionOptions = {
    timeout: 30000,
    maxRetries: 3,
    delayRange: [35, 40],
    waitForStable: true,
    stableCheckInterval: 2000,
    stableCheckCount: 3,
  };

  async extractFinalUrl(
    affiliateUrl: string,
    config: AdsPowerConfig,
    options: LinkExtractionOptions = {}
  ): Promise<LinkExtractionResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const logs: string[] = [];
    const startTime = Date.now();

    try {
      logs.push(`开始提取链接: ${affiliateUrl}`);
      logs.push(`使用配置: ${config.name} (${config.environmentId})`);

      // 检查 AdsPower 服务状态
      const isServiceHealthy = await adsPowerClient.checkStatus();
      if (!isServiceHealthy) {
        throw new Error('AdsPower 服务不可用');
      }
      logs.push('AdsPower 服务状态正常');

      // 启动浏览器
      logs.push('正在启动浏览器...');
      const browserResponse = await adsPowerClient.startBrowser(config.environmentId, {
        headless: false, // 需要显示浏览器界面
        window_size: { width: 1200, height: 800 },
        profile_id: config.environmentId,
      });

      if (browserResponse.code !== 0) {
        throw new Error(`浏览器启动失败: ${browserResponse.msg}`);
      }
      logs.push('浏览器启动成功');

      // 打开新标签页访问广告联盟链接
      logs.push(`正在访问广告联盟链接: ${affiliateUrl}`);
      const tabResponse = await adsPowerClient.openTab(config.environmentId, affiliateUrl, true);

      if (!tabResponse.tab_id) {
        throw new Error('打开标签页失败');
      }
      logs.push('标签页打开成功');

      // 等待页面加载
      logs.push('等待页面加载...');
      const pageLoaded = await adsPowerClient.waitForPageLoad(config.environmentId, mergedOptions.timeout);
      if (!pageLoaded) {
        throw new Error('页面加载超时');
      }
      logs.push('页面加载完成');

      // 等待重定向完成
      if (mergedOptions.waitForStable) {
        logs.push('等待URL稳定...');
        const stableUrl = await this.waitForStableUrl(config.environmentId, mergedOptions);
        logs.push(`URL已稳定: ${stableUrl}`);
      }

      // 获取最终URL
      const finalUrl = await adsPowerClient.getCurrentUrl(config.environmentId);
      logs.push(`获取到最终URL: ${finalUrl}`);

      // 解析 Final URL 和 Final URL Suffix
      const { finalUrl: parsedFinalUrl, finalUrlSuffix } = this.parseFinalUrl(finalUrl);
      logs.push(`解析结果 - Final URL: ${parsedFinalUrl}, Suffix: ${finalUrlSuffix || '无'}`);

      // 多次验证确保获取到的是官网链接
      let verifiedUrl = finalUrl;
      let verificationCount = 0;
      const maxVerifications = 3;

      while (verificationCount < maxVerifications) {
        verificationCount++;
        logs.push(`第 ${verificationCount} 次验证URL...`);
        
        // 等待一段时间再次检查
        await this.delay(3000);
        const currentUrl = await adsPowerClient.getCurrentUrl(config.environmentId);
        
        if (currentUrl === verifiedUrl) {
          logs.push('URL验证通过');
          break;
        } else {
          logs.push(`URL发生变化: ${currentUrl}`);
          verifiedUrl = currentUrl;
        }
      }

      // 关闭标签页
      await adsPowerClient.closeTab(config.environmentId, tabResponse.tab_id);
      logs.push('标签页已关闭');

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        originalUrl: affiliateUrl,
        finalUrl: parsedFinalUrl,
        finalUrlSuffix,
        processingTime,
        retryCount: 0,
        logs,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      logs.push(`提取失败: ${errorMessage}`);
      
      return {
        success: false,
        originalUrl: affiliateUrl,
        processingTime,
        retryCount: 0,
        error: errorMessage,
        logs,
      };
    } finally {
      // 确保浏览器关闭
      try {
        await adsPowerClient.closeBrowser(config.environmentId);
        logs.push('浏览器已关闭');
      } catch (error) {
        logs.push(`关闭浏览器时出错: ${error}`);
      }
    }
  }

  async batchExtractUrls(
    affiliateUrls: string[],
    config: AdsPowerConfig,
    options: LinkExtractionOptions = {}
  ): Promise<LinkExtractionResult[]> {
    const results: LinkExtractionResult[] = [];
    const mergedOptions = { ...this.defaultOptions, ...options };

    for (let i = 0; i < affiliateUrls.length; i++) {
      const url = affiliateUrls[i];
      
      console.log(`正在处理第 ${i + 1}/${affiliateUrls.length} 个URL: ${url}`);
      
      // 重试机制
      let retryCount = 0;
      let result: LinkExtractionResult;

      while (retryCount <= mergedOptions.maxRetries!) {
        try {
          result = await this.extractFinalUrl(url, config, mergedOptions);
          
          if (result.success || retryCount === mergedOptions.maxRetries) {
            break;
          }
          
          retryCount++;
          result.retryCount = retryCount;
          
          // 重试前等待
          const retryDelay = Math.floor(Math.random() * 5000) + 5000; // 5-10秒
          console.log(`第 ${retryCount} 次重试，等待 ${retryDelay}ms...`);
          await this.delay(retryDelay);
          
        } catch (error) {
          retryCount++;
          console.error(`处理URL时发生错误: ${error}`);
          
          if (retryCount > mergedOptions.maxRetries!) {
            result = {
              success: false,
              originalUrl: url,
              processingTime: 0,
              retryCount,
              error: error instanceof Error ? error.message : '未知错误',
              logs: [`处理失败: ${error}`],
            };
            break;
          }
        }
      }

      results.push(result!);

      // 批量处理间隔
      if (i < affiliateUrls.length - 1) {
        const [minDelay, maxDelay] = mergedOptions.delayRange!;
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1000)) + minDelay;
        console.log(`等待 ${delay}ms 后处理下一个URL...`);
        await this.delay(delay);
      }
    }

    return results;
  }

  private async waitForStableUrl(
    profileId: string,
    options: LinkExtractionOptions
  ): Promise<string> {
    const { stableCheckInterval = 2000, stableCheckCount = 3 } = options;
    let lastUrl = '';
    let stableCount = 0;

    while (stableCount < stableCheckCount) {
      await this.delay(stableCheckInterval);
      
      try {
        const currentUrl = await adsPowerClient.getCurrentUrl(profileId);
        
        if (currentUrl === lastUrl) {
          stableCount++;
        } else {
          stableCount = 0;
          lastUrl = currentUrl;
        }
        
        console.log(`URL检查 ${stableCount}/${stableCheckCount}: ${currentUrl}`);
      } catch (error) {
        console.warn('获取URL失败:', error);
        stableCount = 0;
      }
    }

    return lastUrl;
  }

  private parseFinalUrl(url: string): { finalUrl: string; finalUrlSuffix?: string } {
    try {
      const urlObj = new URL(url);
      
      // 检查是否包含查询参数
      if (urlObj.search) {
        return {
          finalUrl: `${urlObj.origin}${urlObj.pathname}`,
          finalUrlSuffix: urlObj.search.substring(1), // 去掉 '?' 符号
        };
      } else {
        return {
          finalUrl: url,
          finalUrlSuffix: undefined,
        };
      }
    } catch (error) {
      // 如果URL解析失败，尝试手动分割
      const queryIndex = url.indexOf('?');
      if (queryIndex !== -1) {
        return {
          finalUrl: url.substring(0, queryIndex),
          finalUrlSuffix: url.substring(queryIndex + 1),
        };
      } else {
        return {
          finalUrl: url,
          finalUrlSuffix: undefined,
        };
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 工具方法：验证是否为官网链接
  isValidOfficialUrl(url: string): boolean {
    // 排除已知的中间页面域名
    const excludedDomains = [
      'yeahpromos.com',
      'trackinglink.com',
      'clicktrack.com',
      'adtrack.com',
    ];

    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      // 检查是否在排除列表中
      if (excludedDomains.some(excluded => domain.includes(excluded))) {
        return false;
      }

      // 检查是否为知名电商域名
      const officialDomains = [
        'amazon.com', 'amazon.',
        'walmart.com', 'walmart.',
        'homedepot.com', 'homedepot.',
        'target.com', 'target.',
        'bestbuy.com', 'bestbuy.',
        'ebay.com', 'ebay.',
        'shopify.com', 'shopify.',
      ];

      return officialDomains.some(official => domain.includes(official));
    } catch (error) {
      return false;
    }
  }

  // 工具方法：提取域名
  extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return '';
    }
  }

  // 工具方法：清理URL
  sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // 移除追踪参数
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'clickid', 'irgwc', 'irclickid',
        'aff_track', 'aff_id', 'affiliate_id',
      ];

      const searchParams = new URLSearchParams(urlObj.search);
      trackingParams.forEach((param: any) => {
        searchParams.delete(param);
      });

      urlObj.search = searchParams.toString();
      return urlObj.toString();
    } catch (error) {
      return url;
    }
  }
}

// 导出单例实例
export const linkExtractionService = new LinkExtractionService();