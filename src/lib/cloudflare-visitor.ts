/**
 * 使用Puppeteer处理CloudFlare保护的访问器
 */

import puppeteer, { Browser, LaunchOptions, Page } from 'puppeteer';
import { createLogger } from '@/lib/utils/security/secure-logger';
import { ProxyConfig } from '@/lib/utils/proxy-utils';

// 动态导入stealth插件（仅在需要时）
let puppeteerExtra: any;
let stealth: any;

const logger = createLogger('CloudflareVisitor');

export interface CloudflareVisitOptions {
  url: string;
  proxy?: ProxyConfig;
  userAgent?: string;
  timeout?: number;
  referer?: string;
  viewport?: { width: number; height: number };
  waitForSelector?: string;
  waitForTimeout?: number;
  screenshot?: boolean;
  stealthMode?: boolean;
}

export interface CloudflareVisitResult {
  success: boolean;
  error?: string;
  loadTime?: number;
  finalUrl?: string;
  content?: string;
  cookies?: any[];
  screenshot?: string;
  title?: string;
  proxyUsed: boolean;
}

export class CloudflareVisitor {
  private browser?: Browser;
  private proxy?: ProxyConfig;

  /**
   * 初始化浏览器
   */
  private async initBrowser(options: CloudflareVisitOptions): Promise<void> {
    const launchOptions: LaunchOptions = {
      headless: true, // 使用无头模式
      // ignoreHTTPSErrors is now built-in
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images', // 可选：禁用图片以提高速度
        '--disable-javascript-harmony-promises', // 减少指纹
        '--disable-web-security', // 绕过某些安全检查
        '--disable-features=VizDisplayCompositor',
        '--ignore-certificate-errors', // 忽略证书错误
        '--ignore-ssl-errors', // 忽略SSL错误
        '--ignore-certificate-errors-spki-list', // 忽略特定证书错误
      ],
    };

    // 配置代理
    if (options.proxy) {
      this.proxy = options.proxy;
      const proxyUrl = `${options.proxy.protocol}://${options.proxy.host}:${options.proxy.port}`;
      launchOptions.args?.push(`--proxy-server=${proxyUrl}`);
      
      // 如果需要认证
      if (options.proxy.username && options.proxy.password) {
        launchOptions.args?.push(
          `--proxy-auth=${options.proxy.username}:${options.proxy.password}`
        );
      }
    }

    // 启用隐身模式以减少指纹
    if (options.stealthMode) {
      try {
        // 动态导入ES模块
        if (!puppeteerExtra) {
          puppeteerExtra = await import('puppeteer-extra');
          stealth = await import('puppeteer-extra-plugin-stealth');
          puppeteerExtra.default.use(stealth.default());
        }
        this.browser = await puppeteerExtra.default.launch(launchOptions);
      } catch (error) {
        logger.warn('无法加载stealth插件，使用普通模式', { error });
        this.browser = await puppeteer.launch(launchOptions);
      }
    } else {
      this.browser = await puppeteer.launch(launchOptions);
    }
    
    // 忽略SSL错误（对于某些测试证书很有用）
    if (this.browser) {
      const browserVersion = await this.browser.version();
      logger.debug('浏览器版本:', { version: browserVersion });
    }
  }

  /**
   * 访问URL并处理CloudFlare
   */
  async visit(options: CloudflareVisitOptions): Promise<CloudflareVisitResult> {
    const startTime = Date.now();
    
    try {
      logger.info('开始使用Puppeteer访问', {
        url: options.url,
        proxy: options.proxy ? `${options.proxy.host}:${options.proxy.port}` : 'direct',
        stealth: options.stealthMode
      });

      // 初始化浏览器
      await this.initBrowser(options);
      
      if (!this.browser) {
        throw new Error('浏览器初始化失败');
      }

      const page = await this.browser.newPage();
      
      // 设置视口
      await page.setViewport(options.viewport || { width: 1920, height: 1080 });
      
      // 设置User-Agent
      const userAgent = options.userAgent || 
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
      await page.setUserAgent(userAgent);
      
      // 设置额外的headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      });

      // 如果有referer，先访问referer页面
      if (options.referer) {
        logger.debug('先访问referer页面', { referer: options.referer });
        await page.goto(options.referer, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000)); // 随机等待1-3秒
      }

      // 处理认证对话框（如果代理需要）
      if (options.proxy && options.proxy.username && options.proxy.password) {
        page.on('dialog', async (dialog) => {
          logger.debug('处理认证对话框', { type: dialog.type() });
          if (dialog.type() === 'prompt' || dialog.type() === 'alert') {
            await dialog.accept(`${options.proxy!.username}:${options.proxy!.password}`);
          }
        });
        
        // 设置代理认证头
        await page.setExtraHTTPHeaders({
          'Proxy-Authorization': `Basic ${Buffer.from(`${options.proxy.username}:${options.proxy.password}`).toString('base64')}`
        });
      }

      // 访问目标URL
      logger.debug('开始访问目标URL', { url: options.url });
      
      // 等待导航完成，处理可能的CloudFlare挑战
      const response = await page.goto(options.url, {
        waitUntil: 'networkidle2',
        timeout: options.timeout || 60000
      });

      // 检测并处理CloudFlare挑战
      if (await this.isCloudflareChallenge(page)) {
        logger.info('检测到CloudFlare挑战，尝试解决...');
        await this.solveCloudflareChallenge(page, options.waitForTimeout);
      }

      // 等待特定选择器（如果指定）
      if (options.waitForSelector) {
        try {
          await page.waitForSelector(options.waitForSelector, {
            timeout: options.waitForTimeout || 30000
          });
        } catch (error) {
          logger.warn('等待选择器超时', { selector: options.waitForSelector });
        }
      }

      // 获取页面内容
      const content = await page.content();
      const title = await page.title();
      const cookies = await page.cookies();
      const finalUrl = page.url();

      // 截图（如果需要）
      let screenshot: string | undefined;
      if (options.screenshot) {
        screenshot = await page.screenshot({ encoding: 'base64' });
      }

      const loadTime = Date.now() - startTime;
      const success = response?.ok() ?? false;

      logger.info('Puppeteer访问完成', {
        url: options.url,
        success,
        statusCode: response?.status(),
        loadTime,
        finalUrl
      });

      return {
        success,
        loadTime,
        finalUrl: finalUrl !== options.url ? finalUrl : undefined,
        content,
        cookies,
        screenshot,
        title,
        proxyUsed: !!options.proxy
      };

    } catch (error) {
      const loadTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Puppeteer访问失败', {
        url: options.url,
        error: errorMessage,
        loadTime
      });

      return {
        success: false,
        error: errorMessage,
        loadTime,
        proxyUsed: !!options.proxy
      };
    } finally {
      // 清理资源
      if (this.browser) {
        await this.browser.close();
        this.browser = undefined;
      }
    }
  }

  /**
   * 检测是否为CloudFlare挑战页面
   */
  private async isCloudflareChallenge(page: Page): Promise<boolean> {
    try {
      const title = await page.title();
      const content = await page.content();
      
      // 检查常见的CloudFlare挑战特征
      const cloudflareIndicators = [
        'Cloudflare',
        'Checking your browser',
        'DDoS protection by',
        'cf-browser-verification',
        'cf_im_under_attack',
        'jschl_vc',
        'jschl_answer',
        'cf_chl_rc'
      ];

      return cloudflareIndicators.some(indicator => 
        title.includes(indicator) || content.includes(indicator)
      );
    } catch {
      return false;
    }
  }

  /**
   * 解决CloudFlare挑战
   */
  private async solveCloudflareChallenge(page: Page, timeout?: number): Promise<void> {
    const maxWaitTime = timeout || 30000;
    const startTime = Date.now();

    // 等待挑战解决
    while (Date.now() - startTime < maxWaitTime) {
      // 检查是否还在挑战页面
      const isChallenge = await this.isCloudflareChallenge(page);
      if (!isChallenge) {
        logger.info('CloudFlare挑战已解决');
        return;
      }

      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 尝试点击任何可能的按钮
      try {
        const buttonCount = await page.evaluate(() => {
          const xpath = '//button[contains(text(), "Verify") or contains(text(), "Continue")]';
          const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          return result.snapshotLength;
        });
        
        if (buttonCount > 0) {
          await page.evaluate(() => {
            const xpath = '//button[contains(text(), "Verify") or contains(text(), "Continue")]';
            const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            if (result.snapshotLength > 0) {
              const button = result.snapshotItem(0) as HTMLElement;
              button.click();
            }
          });
        }
      } catch {
        // 忽略点击错误
      }
    }

    logger.warn('CloudFlare挑战解决超时');
  }

  /**
   * 批量访问
   */
  async batchVisit(urls: string[], options: Omit<CloudflareVisitOptions, 'url'>): Promise<CloudflareVisitResult[]> {
    const results: CloudflareVisitResult[] = [];

    for (const url of urls) {
      const result = await this.visit({ ...options, url });
      results.push(result);
      
      // 在访问之间添加延迟
      if (urls.indexOf(url) < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 5000 + 3000));
      }
    }

    return results;
  }
}

// 导出实例
export const cloudflareVisitor = new CloudflareVisitor();