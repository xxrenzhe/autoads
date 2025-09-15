/**
 * Puppeteer Visitor Stub (frontend)
 * 执行器已迁移到后端；此处仅保留接口以兼容引用。
 */

import { ProxyConfig } from '@/lib/utils/proxy-utils'

export interface PuppeteerVisitOptions {
  url: string
  proxy?: ProxyConfig
  userAgent?: string
  timeout?: number
  referer?: string
  stealthMode?: boolean
  headers?: Record<string, string>
}

export interface PuppeteerVisitResult {
  success: boolean
  error?: string
  loadTime?: number
  finalUrl?: string
  content?: string
  title?: string
  proxyUsed: boolean
}

export class PuppeteerVisitor {
  async visit(_options: PuppeteerVisitOptions): Promise<PuppeteerVisitResult> {
    return {
      success: false,
      error: 'Puppeteer execution runs on backend now. Use API via BFF.',
      proxyUsed: false
    }
  }

  async visitUrl(options: PuppeteerVisitOptions): Promise<PuppeteerVisitResult> {
    return this.visit(options)
  }
}

export const puppeteerVisitor = new PuppeteerVisitor()
              setTimeout(() => reject(new Error('Proxy authentication timeout')), 10000)
            )
          ]);
          
          const authEndTime = Date.now();
          logger.info('✅ 代理认证设置完成', {
            visitId,
            authTime: authEndTime - authStartTime
          });
        } catch (authError) {
          logger.warn('⚠️ 代理认证失败，但继续尝试', {
            visitId,
            error: authError instanceof Error ? authError.message : String(authError)
          });
        }
      }
      
      // 设置视口
      const viewportStartTime = Date.now();
      logger.debug('🖥️ 正在设置视口...', { visitId });
      
      await page.setViewport({ width: 1920, height: 1080 });
      
      const viewportEndTime = Date.now();
      logger.debug('✅ 视口设置完成', {
        visitId,
        viewportTime: viewportEndTime - viewportStartTime
      });
      
      // 设置User-Agent
      if (options.userAgent) {
        await page.setUserAgent(options.userAgent);
        logger.debug('设置User-Agent', { userAgent: options.userAgent });
      }
      
      // 准备headers
      const headers: Record<string, string> = {
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      };
      
      // 设置Referer（重要！）
      if (options.referer) {
        headers['Referer'] = options.referer;
        logger.debug('设置Referer', { referer: options.referer });
      }
      
      // 合并自定义headers
      if (options.headers) {
        Object.assign(headers, options.headers);
        logger.debug('合并自定义headers', { count: Object.keys(options.headers).length });
      }
      
      // 设置headers
      const headersStartTime = Date.now();
      logger.debug('📋 正在设置HTTP headers...', { 
        visitId,
        headersCount: Object.keys(headers).length 
      });
      
      await page.setExtraHTTPHeaders(headers);
      const headersEndTime = Date.now();
      
      logger.debug('✅ HTTP headers设置完成', { 
        visitId,
        headersTime: headersEndTime - headersStartTime,
        headers: Object.keys(headers) 
      });

      // 验证代理是否生效（如果配置了代理）- 简化版本
      if (options.proxy) {
        const proxyCheckStartTime = Date.now();
        logger.info('🔍 正在验证代理是否生效...', { visitId });
        
        try {
          // 使用fetch快速验证代理，不使用page.goto
          await page.evaluate(() => {
            return fetch('http://api.ipify.org', {
              method: 'GET',
              mode: 'no-cors'
            }).then(response => response.text()).catch(() => 'proxy-check-failed');
          });
          
          const proxyCheckEndTime = Date.now();
          logger.info('✅ 代理验证完成', {
            visitId,
            proxyCheckTime: proxyCheckEndTime - proxyCheckStartTime
          });
        } catch (error) {
          const proxyCheckEndTime = Date.now();
          logger.warn('❌ 代理验证失败，但继续执行', { 
            visitId,
            error: error instanceof Error ? error.message : String(error),
            proxyCheckTime: proxyCheckEndTime - proxyCheckStartTime 
          });
        }
      }

      // 访问目标页面
      const navigationStartTime = Date.now();
      const baseTimeout = options.timeout || 90000; // 默认90秒
      logger.info('🌐 开始访问目标页面...', { 
        visitId,
        url: options.url,
        timeout: baseTimeout,
        waitUntil: 'domcontentloaded'
      });
      
      let response: any;
      let navigationAttempts = 0;
      const maxNavigationAttempts = 2; // 减少重试次数，加快失败反馈
      
      while (navigationAttempts < maxNavigationAttempts) {
        try {
          navigationAttempts++;
          
          // 计算本次超时时间
          const timeout = navigationAttempts === 1 ? 30000 : 60000; // 首次30秒，第二次60秒
          
          logger.debug(`🎯 导航尝试 ${navigationAttempts}/${maxNavigationAttempts}`, {
            visitId,
            timeout,
            waitUntil: 'domcontentloaded'
          });
          
          // 设置页面超时
          await page.setDefaultTimeout(timeout);
          
          // 尝试导航
          response = await page.goto(options.url, {
            waitUntil: 'domcontentloaded',
            timeout: timeout
          });
          
          // 如果成功，跳出重试循环
          logger.debug(`✅ 导航尝试 ${navigationAttempts} 成功`, { visitId });
          break;
          
        } catch (navError: any) {
          const errorMsg = navError.message || String(navError);
          logger.warn(`⚠️ 导航尝试 ${navigationAttempts} 失败`, {
            visitId,
            error: errorMsg,
            errorCode: navError.code,
            attempt: navigationAttempts
          });
          
          if (navigationAttempts >= maxNavigationAttempts) {
            // 最后一次尝试，使用最基本的策略
            logger.info(`🔄 最后尝试：使用最小化导航策略`, { visitId });
            
            try {
              // 清除所有事件监听器
              await page.evaluate(() => {
                window.stop();
              });
              
              // 等待一下
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // 最简单的导航
              response = await page.goto(options.url, {
                waitUntil: 'domcontentloaded', // 使用 domcontentloaded 而不是 commit
                timeout: 15000
              });
              
              logger.info(`✅ 最小化导航成功`, { visitId });
              break;
              
            } catch (finalError) {
              throw new Error(`导航失败: ${errorMsg} (最小化策略也失败)`);
            }
          }
          
          // 短暂等待后重试
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      const navigationEndTime = Date.now();
      
      logger.info('✅ 页面导航完成', {
        visitId,
        navigationTime: navigationEndTime - navigationStartTime,
        statusCode: response?.status(),
        statusText: response?.statusText()
      });

      // 等待页面稳定（使用更短的等待时间）
      const stabilizationStartTime = Date.now();
      const stabilizationWaitTime = navigationAttempts > 1 ? 1000 : 2000; // 如果重试过，等待时间更短
      
      logger.debug('⏳ 等待页面稳定...', { visitId, waitTime: stabilizationWaitTime });
      
      // 使用 Promise.race 防止无限等待
      await Promise.race([
        new Promise(resolve => setTimeout(resolve, stabilizationWaitTime)),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Stabilization timeout')), stabilizationWaitTime + 5000)
        )
      ]);
      
      const stabilizationEndTime = Date.now();
      
      logger.debug('✅ 页面稳定完成', {
        visitId,
        stabilizationTime: stabilizationEndTime - stabilizationStartTime
      });
      
      const contentStartTime = Date.now();
      logger.debug('📖 正在获取页面内容...', { visitId });
      
      // 使用超时保护获取页面内容
      let content: string = '';
      let title: string = '';
      let finalUrl: string = '';
      
      try {
        await Promise.race([
          (async () => {
            // 如果响应为null或undefined，使用fallback内容
            if (!response) {
              throw new Error('No response received');
            }
            
            content = await page.content();
            title = await page.title();
            finalUrl = page.url();
          })(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Content retrieval timeout')), 10000)
          )
        ]);
      } catch (contentError) {
        logger.warn('⚠️ 获取页面内容失败，使用fallback信息', { 
          visitId,
          error: contentError instanceof Error ? contentError.message : String(contentError)
        });
        
        // 根据响应状态生成fallback内容
        const statusCode = response?.status() || 0;
        const statusText = response?.statusText() || 'Unknown Error';
        
        content = `<!DOCTYPE html>
<html>
<head>
    <title>Visit Result - ${statusCode}</title>
    <meta charset="utf-8">
</head>
<body>
    <h1>Page Visit Summary</h1>
    <p><strong>URL:</strong> ${options.url}</p>
    <p><strong>Status:</strong> ${statusCode} ${statusText}</p>
    <p><strong>Proxy Used:</strong> ${options.proxy ? 'Yes' : 'No'}</p>
    <p><strong>Navigation Time:</strong> ${navigationEndTime - navigationStartTime}ms</p>
    <p><strong>Final URL:</strong> ${page.url()}</p>
    <hr>
    <p><em>Content retrieval failed or timed out</em></p>
</body>
</html>`;
        
        title = `Page ${statusCode} - ${options.url.split('/')[2] || 'Unknown'}`;
        finalUrl = page.url();
      }
      
      const contentEndTime = Date.now();
      
      const loadTime = Date.now() - startTime;
      const success = response?.ok() ?? false;

      logger.info('🎉 Puppeteer访问完成', {
        visitId,
        url: options.url,
        success,
        statusCode: response?.status(),
        statusText: response?.statusText(),
        loadTime,
        contentTime: contentEndTime - contentStartTime,
        contentLength: content.length,
        title: title?.substring(0, 100),
        finalUrl: finalUrl !== options.url ? finalUrl : undefined,
        redirected: finalUrl !== options.url,
        proxyUsed: !!options.proxy,
        timing: {
          total: loadTime,
          navigation: navigationEndTime - navigationStartTime,
          stabilization: stabilizationEndTime - stabilizationStartTime,
          content: contentEndTime - contentStartTime
        }
      });

      return {
        success,
        loadTime,
        finalUrl: finalUrl !== options.url ? finalUrl : undefined,
        content,
        title,
        proxyUsed: !!options.proxy
      };

    } catch (error) {
      const errorTime = Date.now();
      const loadTime = errorTime - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('❌ Puppeteer访问失败', {
        visitId,
        url: options.url,
        error: errorMessage,
        errorCode: (error as any).code,
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        loadTime,
        proxyUsed: !!options.proxy,
        stackTrace: (error as Error).stack?.split('\n').slice(0, 5) // 只取前5行堆栈
      });

      return {
        success: false,
        error: errorMessage,
        loadTime,
        proxyUsed: !!options.proxy
      };
    } finally {
      // 确保浏览器正确关闭，添加超时保护
      if (browser) {
        try {
          await Promise.race([
            browser.close(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Browser close timeout')), 5000)
            )
          ]);
        } catch (closeError) {
          logger.warn('⚠️ 关闭浏览器时出错', {
            visitId,
            error: closeError instanceof Error ? closeError.message : String(closeError)
          });
          // 强制关闭进程
          if (browser && (browser as any).process) {
            try {
              (browser as any).process.kill('SIGKILL');
            } catch (killError) {
              // 忽略杀死进程的错误
            }
          }
        }
      }
    }
  }
  
  /**
   * 别名方法，保持与SimpleHttpVisitor一致的接口
   */
  async visitUrl(options: PuppeteerVisitOptions): Promise<PuppeteerVisitResult> {
    return this.visit(options);
  }

  /**
   * 批量访问
   */
  async batchVisit(urls: string[], options: Omit<PuppeteerVisitOptions, 'url'>): Promise<PuppeteerVisitResult[]> {
    const results: PuppeteerVisitResult[] = [];

    for (const url of urls) {
      const result = await this.visit({ ...options, url });
      results.push(result);
      
      // 在访问之间添加延迟
      if (urls.indexOf(url) < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));
      }
    }

    return results;
  }
}

// 导出实例
export const puppeteerVisitor = new PuppeteerVisitor();
