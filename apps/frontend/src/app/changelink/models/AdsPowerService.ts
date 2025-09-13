/**
 * 统一的AdsPower服务
 * 合并了原有的两个AdsPower服务（AdsPowerApiClient、ImprovedAdsPowerClient）
 * 
 * 核心功能：
 * 1. 浏览器环境管理
 * 2. 会话生命周期管理
 * 3. URL提取和链接处理
 * 4. 错误处理和重试机制
 * 5. 资源清理和僵尸进程处理
 * 
 * 注意：此服务专门使用 Puppeteer 连接 AdsPower，因为：
 * - AdsPower 官方只支持 Puppeteer 的 WebSocket 连接
 * - Puppeteer 是唯一与 AdsPower 完全兼容的浏览器自动化库
 * - Puppeteer 在此项目中仅用于 AdsPower 功能
 */

import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('AdsPowerService');

// ==================== 类型定义 ====================

export interface BrowserSession {
  userId: string;
  wsEndpoint?: string;
  debuggingPort?: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  pid?: number;
  startTime: Date;
}

export interface AdsPowerConfig {
  apiUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

export interface BrowserOptions {
  headless?: boolean;
  open_tabs?: number;
  autoRecover?: boolean;
  timeout?: number;
}

export interface LinkExtractionResult {
  success: boolean;
  originalUrl: string;
  finalUrl?: string;
  finalUrlBase?: string;
  finalUrlSuffix?: string;
  redirectChain: string[];
  extractionTime: number;
  errorMessage?: string;
}

export interface EnvironmentValidation {
  valid: boolean;
  error?: string;
  details?: {
    status: string;
    lastCheck?: Date;
    profileId?: string;
    proxyConfigured?: boolean;
  };
}

// ==================== 主服务类 ====================

export class AdsPowerService {
  private config: AdsPowerConfig;
  private activeSessions = new Map<string, BrowserSession>();
  private readonly DEFAULT_DELAY = 35000; // 35秒基础延时
  private readonly RANDOM_DELAY_MAX = 5000; // 最大5秒随机延时

  constructor(config: Partial<AdsPowerConfig> = {}) {
    this.config = {
      apiUrl: 'http://local.adspower.net:50325',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 2000,
      ...config
    };
    
    logger.info('AdsPower服务初始化完成', { apiUrl: this.config.apiUrl });
  }

  // ==================== 浏览器生命周期管理 ====================

  /**
   * 启动浏览器（带智能重试）
   */
  async startBrowser(environmentId: string, options: BrowserOptions = {}): Promise<BrowserSession> {
    return this.executeWithRetry(async () => {
      // 检查是否已有活跃会话
      const existingSession = this.activeSessions.get(environmentId);
      if (existingSession && existingSession.status === 'running') {
        logger.info('重用现有浏览器会话', { environmentId });
        return existingSession;
      }

      // 清理可能存在的僵尸进程
      await this.forceCloseBrowser(environmentId);

      // 启动新浏览器
      const session = await this.doStartBrowser(environmentId, options);
      this.activeSessions.set(environmentId, session);
      
      logger.info('浏览器启动成功', { 
        environmentId, 
        userId: session.userId,
        pid: session.pid 
      });
      return session;
    });
  }

  /**
   * 实际启动浏览器的逻辑
   */
  private async doStartBrowser(environmentId: string, options: BrowserOptions): Promise<BrowserSession> {
    const url = `${this.config.apiUrl}/api/v1/browser/start`;
    const params = new URLSearchParams({ 
      user_id: environmentId,
      open_tabs: String(options.open_tabs || 1),
      headless: options.headless ? '1' : '0'
    });
    
    const response = await fetch(`${url}?${params}`, { 
      method: 'GET',
      signal: AbortSignal.timeout(this.config.timeout)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.code !== 0) {
      throw new Error(`AdsPower API错误: ${data.msg || '未知错误'}`);
    }

    return {
      userId: environmentId,
      wsEndpoint: data.data?.ws?.puppeteer,
      debuggingPort: data.data?.debug_port,
      status: 'running',
      pid: data.data?.pid,
      startTime: new Date()
    };
  }

  /**
   * 安全关闭浏览器
   */
  async stopBrowser(environmentId: string): Promise<void> {
    const session = this.activeSessions.get(environmentId);
    if (!session) {
      logger.warn('未找到活跃的浏览器会话', { environmentId });
      return;
    }

    try {
      session.status = 'stopping';
      
      const url = `${this.config.apiUrl}/api/v1/browser/stop`;
      const params = new URLSearchParams({ user_id: environmentId });
      const response = await fetch(`${url}?${params}`, { 
        method: 'GET',
        signal: AbortSignal.timeout(10000) // 10秒超时
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.code === 0) {
          session.status = 'stopped';
          this.activeSessions.delete(environmentId);
          logger.info('浏览器正常关闭', { environmentId });
          return;
        }
      }

      // 正常关闭失败，尝试强制关闭
      await this.forceCloseBrowser(environmentId);
      
    } catch (error) {
      logger.error('关闭浏览器失败', new EnhancedError('关闭浏览器失败', {  
        environmentId, 
        error: error instanceof Error ? error.message : String(error) 
       }));
      // 尝试强制关闭
      await this.forceCloseBrowser(environmentId);
    }
  }

  /**
   * 强制关闭浏览器（清理僵尸进程）
   */
  private async forceCloseBrowser(environmentId: string): Promise<void> {
    try {
      // 尝试通过API强制关闭
      const url = `${this.config.apiUrl}/api/v1/browser/stop`;
      const params = new URLSearchParams({ 
        user_id: environmentId,
        force: '1'
      });
      
      await fetch(`${url}?${params}`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      // 清理本地会话记录
      this.activeSessions.delete(environmentId);
      
      logger.info('强制关闭浏览器完成', { environmentId });
    } catch (error) {
      logger.warn('强制关闭浏览器失败', { 
        environmentId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ==================== URL提取和链接处理 ====================

  /**
   * 批量处理链接（核心功能）
   */
  async batchProcessLinks(
    links: string[], 
    environmentId: string, 
    repeatCount: number = 1
  ): Promise<LinkExtractionResult[]> {
    const results: LinkExtractionResult[] = [];
    let browser: BrowserSession | null = null;

    try {
      // 启动浏览器
      browser = await this.startBrowser(environmentId, { headless: false });
      
      for (const [index, link] of links.entries()) {
        logger.info(`处理链接 ${index + 1}/${links.length}`, { link });
        
        for (let attempt = 1; attempt <= repeatCount; attempt++) {
          try {
            // 智能延时
            if (index > 0 || attempt > 1) {
              await this.smartDelay();
            }

            const result = await this.extractUrlFromLink(browser, link, attempt);
            results.push(result);

            if (result.success) {
              logger.info('链接处理成功', { 
                link, 
                attempt, 
                finalUrl: result.finalUrl 
              });
            } else {
              logger.warn('链接处理失败，但继续执行', { 
                link, 
                attempt, 
                error: result.errorMessage 
              });
            }

          } catch (error) {
            const errorResult: LinkExtractionResult = {
              success: false,
              originalUrl: link,
              redirectChain: [],
              extractionTime: 0,
              errorMessage: error instanceof Error ? error.message : String(error)
            };
            
            results.push(errorResult);
            logger.error('链接处理异常', new EnhancedError('链接处理异常', {  
              link, 
              attempt, 
              error: errorResult.errorMessage 
             }));
          }
        }
      }
      
      return results;
      
    } finally {
      // 确保浏览器被关闭
      if (browser) {
        await this.stopBrowser(environmentId);
      }
    }
  }

  /**
   * 从单个链接提取URL（实际实现）
   */
  private async extractUrlFromLink(
    session: BrowserSession, 
    originalUrl: string, 
    attempt: number
  ): Promise<LinkExtractionResult> {
    const startTime = Date.now();
    
    try {
      // 连接到浏览器实例
      // 注意：Puppeteer 仅用于 AdsPower 连接，这是项目中唯一使用 Puppeteer 的地方
      // AdsPower 官方只支持 Puppeteer 的 WebSocket endpoint 连接
      const { connect } = await import('puppeteer');
      const browser = await connect({
        browserWSEndpoint: session.wsEndpoint,
        defaultViewport: null
      });
      
      const page = await browser.newPage();
      
      try {
        // 设置页面超时和错误处理
        page.setDefaultTimeout(30000);
        page.setDefaultNavigationTimeout(30000);
        
        // 监听网络请求以跟踪重定向
        const redirectChain: string[] = [];
        page.on('request', (request) => {
          const url = request.url();
          if (url !== originalUrl && !redirectChain.includes(url)) {
            redirectChain.push(url);
          }
        });
        
        // 设置用户代理和视窗
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        
        // 访问原始链接
        logger.info(`开始访问链接 (尝试 ${attempt}):`, { originalUrl });
        
        const response = await page.goto(originalUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        if (!response) {
          throw new Error('页面响应为空');
        }
        
        // 等待页面完全加载
        await page.waitForSelector('body', { timeout: 10000 });
        
        // 获取最终URL
        const finalUrl = page.url();
        
        // 解析URL组件
        const urlParts = finalUrl.split('?');
        const finalUrlBase = urlParts[0];
        const finalUrlSuffix = urlParts[1] || '';
        
        logger.info('链接提取成功', { 
          originalUrl, 
          finalUrl,
          redirectChain: redirectChain.length,
          extractionTime: Date.now() - startTime 
        });
        
        return {
          success: true,
          originalUrl,
          finalUrl,
          finalUrlBase,
          finalUrlSuffix,
          redirectChain: [originalUrl, ...redirectChain],
          extractionTime: Date.now() - startTime
        };
        
      } finally {
        // 清理页面和连接
        await page.close();
        await browser.disconnect();
      }
      
    } catch (error) {
      logger.error('链接提取失败', new EnhancedError('链接提取失败', {  
        originalUrl, 
        attempt, 
        error: error instanceof Error ? error.message : String(error) 
       }));
      
      return {
        success: false,
        originalUrl,
        redirectChain: [],
        extractionTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 模拟URL提取（实际环境中应该用真实的Puppeteer逻辑）
   */
  private async simulateUrlExtraction(originalUrl: string) {
    // 模拟网络延时
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    
    // 模拟URL解析
    const finalUrl = 'https://www.example.com/?ref=affiliate&id=123&campaign=test';
    const urlParts = finalUrl.split('?');
    
    return {
      finalUrl,
      finalUrlBase: urlParts[0],
      finalUrlSuffix: urlParts[1] || '',
      redirectChain: [originalUrl, finalUrl]
    };
  }

  /**
   * 智能延时（35秒基础 + 随机延时）
   */
  private async smartDelay(): Promise<void> {
    const randomDelay = Math.random() * this.RANDOM_DELAY_MAX;
    const totalDelay = this.DEFAULT_DELAY + randomDelay;
    
    logger.info(`智能延时 ${Math.round(totalDelay / 1000)} 秒`);
    await new Promise(resolve => setTimeout(resolve, totalDelay));
  }

  // ==================== 官方链接提取增强功能 ====================

  /**
   * 获取官方链接（核心功能）
   */
  async getOfficialLinks(
    links: string[],
    environmentId: string,
    options: {
      repeatCount?: number;
      extractFinalUrl?: boolean;
      extractRedirectChain?: boolean;
      includePerformanceMetrics?: boolean;
    } = {}
  ): Promise<{
    results: LinkExtractionResult[];
    summary: {
      totalLinks: number;
      successfulLinks: number;
      failedLinks: number;
      averageExtractionTime: number;
      totalExecutionTime: number;
    };
    performance?: {
      browserStartupTime: number;
      averagePageLoadTime: number;
      networkLatency: number;
    };
  }> {
    const {
      repeatCount = 1,
      extractFinalUrl = true,
      extractRedirectChain = true,
      includePerformanceMetrics = false
    } = options;

    const startTime = Date.now();
    const results: LinkExtractionResult[] = [];
    let browser: BrowserSession | null = null;
    const performanceMetrics = includePerformanceMetrics ? {
      browserStartupTime: 0,
      pageLoadTimes: [] as number[],
      networkLatencies: [] as number[]
    } : null;

    try {
      // 启动浏览器并记录启动时间
      const browserStartTime = Date.now();
      browser = await this.startBrowser(environmentId, { headless: false });
      
      if (performanceMetrics) {
        performanceMetrics.browserStartupTime = Date.now() - browserStartTime;
      }

      // 处理每个链接
      for (const [index, link] of links.entries()) {
        logger.info(`处理链接 ${index + 1}/${links.length}`, { link });
        
        for (let attempt = 1; attempt <= repeatCount; attempt++) {
          try {
            // 智能延时（除了第一次处理）
            if (index > 0 || attempt > 1) {
              await this.smartDelay();
            }

            const pageStartTime = Date.now();
            const result = await this.extractOfficialUrl(
              browser,
              link,
              attempt,
              extractFinalUrl,
              extractRedirectChain
            );
            
            if (performanceMetrics) {
              const pageLoadTime = Date.now() - pageStartTime;
              performanceMetrics.pageLoadTimes.push(pageLoadTime);
            }

            results.push(result);

            if (result.success) {
              logger.info('官方链接提取成功', { 
                link, 
                attempt, 
                finalUrl: result.finalUrl,
                extractionTime: result.extractionTime
              });
            } else {
              logger.warn('官方链接提取失败', { 
                link, 
                attempt, 
                error: result.errorMessage 
              });
            }

          } catch (error) {
            const errorResult: LinkExtractionResult = {
              success: false,
              originalUrl: link,
              redirectChain: [],
              extractionTime: 0,
              errorMessage: error instanceof Error ? error.message : String(error)
            };
            
            results.push(errorResult);
            logger.error('官方链接提取异常', new EnhancedError('官方链接提取异常', {  
              link, 
              attempt, 
              error: errorResult.errorMessage 
             }));
          }
        }
      }
      
      // 计算汇总统计
      const successfulLinks = results.filter((r: any) => r.success).length;
      const failedLinks = results.filter((r: any) => !r.success).length;
      const averageExtractionTime = results.reduce((sum, r: any) => sum + r.extractionTime, 0) / results.length;
      
      const summary = {
        totalLinks: links.length,
        successfulLinks,
        failedLinks,
        averageExtractionTime: Math.round(averageExtractionTime),
        totalExecutionTime: Date.now() - startTime
      };

      // 计算性能指标
      let performance: any;
      if (performanceMetrics) {
        performance = {
          browserStartupTime: performanceMetrics.browserStartupTime,
          averagePageLoadTime: performanceMetrics.pageLoadTimes.length > 0 
            ? Math.round(performanceMetrics.pageLoadTimes.reduce((a, b: any) => a + b, 0) / performanceMetrics.pageLoadTimes.length)
            : 0,
          networkLatency: performanceMetrics.networkLatencies.length > 0
            ? Math.round(performanceMetrics.networkLatencies.reduce((a, b: any) => a + b, 0) / performanceMetrics.networkLatencies.length)
            : 0
        };
      }

      return {
        results,
        summary,
        performance
      };
      
    } finally {
      // 确保浏览器被关闭
      if (browser) {
        await this.stopBrowser(environmentId);
      }
    }
  }

  /**
   * 提取官方链接（增强版）
   */
  private async extractOfficialUrl(
    session: BrowserSession,
    originalUrl: string,
    attempt: number,
    extractFinalUrl: boolean,
    extractRedirectChain: boolean
  ): Promise<LinkExtractionResult> {
    const startTime = Date.now();
    
    try {
      // 连接到浏览器实例
      // 注意：Puppeteer 仅用于 AdsPower 连接，这是项目中唯一使用 Puppeteer 的地方
      // AdsPower 官方只支持 Puppeteer 的 WebSocket endpoint 连接
      const { connect } = await import('puppeteer');
      const browser = await connect({
        browserWSEndpoint: session.wsEndpoint,
        defaultViewport: null
      });
      
      const page = await browser.newPage();
      
      try {
        // 配置页面设置
        await this.configurePage(page);
        
        // 监听网络请求
        const redirectChain: string[] = [];
        const requestTimings: { [url: string]: number } = {};
        
        if (extractRedirectChain) {
          page.on('request', (request) => {
            const url = request.url();
            if (url !== originalUrl && !redirectChain.includes(url)) {
              redirectChain.push(url);
              requestTimings[url] = Date.now();
            }
          });
          
          page.on('response', (response) => {
            const url = response.url();
            if (requestTimings[url]) {
              const latency = Date.now() - requestTimings[url];
              // 可以在这里记录网络延迟
            }
          });
        }
        
        // 访问链接
        logger.info(`访问官方链接 (尝试 ${attempt}):`, { originalUrl });
        
        const response = await page.goto(originalUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        if (!response) {
          throw new Error('页面响应为空');
        }
        
        // 等待页面稳定
        await this.waitForPageStability(page);
        
        // 获取最终URL
        const finalUrl = page.url();
        
        // 解析URL组件
        let finalUrlBase = '';
        let finalUrlSuffix = '';
        
        if (extractFinalUrl) {
          const urlParts = finalUrl.split('?');
          finalUrlBase = urlParts[0];
          finalUrlSuffix = urlParts[1] || '';
        }
        
        logger.info('官方链接提取成功', { 
          originalUrl, 
          finalUrl,
          redirectChain: redirectChain.length,
          extractionTime: Date.now() - startTime 
        });
        
        return {
          success: true,
          originalUrl,
          finalUrl: extractFinalUrl ? finalUrl : undefined,
          finalUrlBase: extractFinalUrl ? finalUrlBase : undefined,
          finalUrlSuffix: extractFinalUrl ? finalUrlSuffix : undefined,
          redirectChain: extractRedirectChain ? [originalUrl, ...redirectChain] : [],
          extractionTime: Date.now() - startTime
        };
        
      } finally {
        await page.close();
        await browser.disconnect();
      }
      
    } catch (error) {
      logger.error('官方链接提取失败', new EnhancedError('官方链接提取失败', {  
        originalUrl, 
        attempt, 
        error: error instanceof Error ? error.message : String(error) 
       }));
      
      return {
        success: false,
        originalUrl,
        redirectChain: [],
        extractionTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 配置页面设置
   */
  private async configurePage(page: any): Promise<void> {
    // 设置用户代理
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // 设置视窗
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 设置超时
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    
    // 绕过常见检测
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    
    // 禁用图片加载以提高性能
    await page.setRequestInterception(true);
    page.on('request', (request: any) => {
      if (request.resourceType() === 'image') {
        request.abort();
      } else {
        request.continue();
      }
    });
  }

  /**
   * 等待页面稳定
   */
  private async waitForPageStability(page: any): Promise<void> {
    try {
      // 等待DOM完全加载
      await page.waitForSelector('body', { timeout: 10000 });
      
      // 等待网络空闲（模拟）
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 额外等待1秒确保页面稳定
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      logger.warn('等待页面稳定超时，继续执行');
    }
  }

  // ==================== 环境验证和管理 ====================

  /**
   * 验证AdsPower环境
   */
  async validateEnvironment(environmentId: string): Promise<EnvironmentValidation> {
    try {
      // 检查环境状态
      const session = this.activeSessions.get(environmentId);
      
      if (session && session.status === 'running') {
        return {
          valid: true,
          details: {
            status: 'running',
            lastCheck: new Date(),
            profileId: environmentId,
            proxyConfigured: true
          }
        };
      }

      // 尝试启动并立即关闭来验证环境
      const testSession = await this.doStartBrowser(environmentId, { headless: true });
      await this.forceCloseBrowser(environmentId);

      return {
        valid: true,
        details: {
          status: 'validated',
          lastCheck: new Date(),
          profileId: environmentId,
          proxyConfigured: true
        }
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '环境验证失败';
      logger.error('环境验证失败', new EnhancedError('环境验证失败', {  environmentId, error: errorMessage  }));
      
      return {
        valid: false,
        error: errorMessage,
        details: {
          status: 'error',
          lastCheck: new Date(),
          profileId: environmentId,
          proxyConfigured: false
        }
      };
    }
  }

  /**
   * 获取环境列表
   */
  async getEnvironmentList(): Promise<Array<{
    id: string;
    name?: string;
    status: string;
    lastUsed?: Date;
  }>> {
    try {
      const url = `${this.config.apiUrl}/api/v1/user/list`;
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.timeout)
      });
      
      if (!response.ok) {
        throw new Error(`获取环境列表失败: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.code !== 0) {
        throw new Error(`AdsPower API错误: ${data.msg || '未知错误'}`);
      }

      // 转换为标准格式
      return (data.data?.list || []).map((env: any: any) => ({
        id: env.user_id,
        name: env.user_name || env.user_id,
        status: env.status || 'unknown',
        lastUsed: env.last_active ? new Date(env.last_active) : undefined
      }));
      
    } catch (error) {
      logger.error('获取环境列表失败', new EnhancedError('获取环境列表失败', { error: error instanceof Error ? error.message : String(error)  }));
      return [];
    }
  }

  // ==================== 会话管理 ====================

  /**
   * 获取所有活跃会话
   */
  getActiveSessions(): BrowserSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * 获取特定会话
   */
  getSession(environmentId: string): BrowserSession | null {
    return this.activeSessions.get(environmentId) || null;
  }

  /**
   * 清理所有会话（应用关闭时调用）
   */
  async cleanup(): Promise<void> {
    logger.info('开始清理所有浏览器会话');
    
    const sessionIds = Array.from(this.activeSessions.keys());
    await Promise.all(
      sessionIds?.filter(Boolean)?.map((id: any) => this.stopBrowser(id))
    );
    
    logger.info('浏览器会话清理完成');
  }

  // ==================== 工具方法 ====================

  /**
   * 带重试的执行包装器
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        try {

        return await operation();

        } catch (error) {

          console.error(error);
          throw error;

        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.config.maxRetries) {
          logger.warn(`操作失败，准备重试 (${attempt}/${this.config.maxRetries})`, { 
            error: lastError.message 
          });
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        }
      }
    }

    throw lastError!;
  }

  /**
   * 健康检查
   */
  async performHealthCheck(): Promise<{
    apiConnection: boolean;
    activeSessions: number;
    environmentCount: number;
    lastCheck: Date;
  }> {
    try {
      // 检查API连接
      const url = `${this.config.apiUrl}/api/v1/user/list`;
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      const apiConnection = response.ok;
      
      // 获取环境数量
      const environments = await this.getEnvironmentList();
      
      return {
        apiConnection,
        activeSessions: this.activeSessions.size,
        environmentCount: environments.length,
        lastCheck: new Date()
      };
      
    } catch (error) {
      logger.error('健康检查失败', new EnhancedError('健康检查失败', { error: error instanceof Error ? error.message : String(error)  }));
      return {
        apiConnection: false,
        activeSessions: this.activeSessions.size,
        environmentCount: 0,
        lastCheck: new Date()
      };
    }
  }
}

// 创建全局AdsPower服务实例
export const globalAdsPowerService = new AdsPowerService();