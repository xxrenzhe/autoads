/**
 * Enhanced HTTP-based URL visitor with real proxy support and browser simulation
 * 支持真实代理连接和浏览器请求模拟的HTTP访问器
 */

import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
import { ProxyConfig } from '@/lib/utils/proxy-utils';
import axios, { AxiosRequestConfig } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import * as http from 'http';
import * as https from 'https';
import { LookupAddress } from 'dns';

const logger = createLogger('SimpleHttpVisitor');

// 访问选项
interface VisitOptions {
  url: string;
  proxy?: ProxyConfig;
  referer?: string; // 支持undefined，表示不发送Referer头
  userAgent: string;
  timeout: number;
  headers?: Record<string, string>; // 自定义HTTP头
  verifyProxyIP?: boolean; // 是否验证代理IP一致性，默认false
  
  // 浏览器模拟增强选项
  simulateBrowser?: boolean; // 是否模拟浏览器行为，默认true
  randomizeHeaders?: boolean; // 是否随机化部分请求头，默认false
  language?: string; // 浏览器语言，默认'en-US,en;q=0.9'
  acceptEncoding?: string; // 接受的编码格式
  extraHeaders?: Record<string, string>; // 额外的请求头
  
  // Cookie 选项
  cookies?: Record<string, string>; // 要发送的 cookies
  persistCookies?: boolean; // 是否持久化 cookies（仅当前会话）
  
  // 请求时序选项
  humanLikeTiming?: boolean; // 是否启用类人时序，默认false
  minDelay?: number; // 最小延迟（毫秒），默认100
  maxDelay?: number; // 最大延迟（毫秒），默认1000
  
  // 重定向处理选项
  followRedirects?: boolean; // 是否跟随重定向，默认true
  maxRedirects?: number; // 最大重定向次数，默认10
  redirectDelay?: number; // 重定向之间的延迟（毫秒），默认1000
  
  // 重试机制
  retryCount?: number; // 重试次数，默认0
  retryDelay?: number; // 重试延迟（毫秒），默认2000
  
}

// 访问结果
export interface VisitResult {
  success: boolean;
  error?: string;
  loadTime?: number;
  statusCode?: number;
  finalUrl?: string;
  isRedirect?: boolean; // 是否发生了重定向
  redirectCount?: number; // 重定向次数
  proxyVerification?: {
    success: boolean;
    actualIP?: string;
    proxyStatus?: string;
    error?: string;
    responseTime?: number;
  };
  refererVerification?: {
    success: boolean;
    actualReferer?: string;
    refererStatus?: string;
    error?: string;
  };
  // 新增字段
  headers?: Record<string, string>; // 实际发送的请求头
  responseHeaders?: Record<string, string>; // 响应头
  effectiveProxy?: string; // 实际使用的代理
  connectionType?: 'direct' | 'http' | 'https' | 'socks4' | 'socks5'; // 连接类型
  actualSourceIP?: string; // 真实来源IP
}

export class SimpleHttpVisitor {
  // 简单的 cookie 存储器（内存中）
  private cookieJar: Map<string, string> = new Map();
  
  /**
   * 生成增强的浏览器请求头
   * 针对CloudFlare优化，添加更多真实浏览器特征
   */
  private generateBrowserHeaders(options: VisitOptions, optimizer?: any): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // 基础请求头（必须）
    headers['User-Agent'] = options.userAgent;
    headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
    headers['Accept-Language'] = options.language || this.generateAcceptLanguage(this.detectOS(options.userAgent));
    headers['Accept-Encoding'] = 'gzip, deflate, br';
    
    // 添加Referer（如果存在）
    if (options.referer) {
      headers['Referer'] = options.referer;
    }
    
    // 添加Cache-Control和Pragma
    headers['Cache-Control'] = 'max-age=0';
    headers['Pragma'] = 'no-cache';
    
    // 添加基本的Fetch头（现代浏览器标准）
    headers['Sec-Fetch-Dest'] = 'document';
    headers['Sec-Fetch-Mode'] = 'navigate';
    headers['Sec-Fetch-Site'] = options.referer ? 'cross-site' : 'none';
    headers['Sec-Fetch-User'] = '?1';
    headers['Upgrade-Insecure-Requests'] = '1';
    
    // Chrome特定头（如果是Chrome）
    if (options.userAgent.includes('Chrome')) {
      const chromeVersion = this.extractChromeVersion(options.userAgent);
      // 更真实的Sec-Ch-Ua头
      headers['Sec-Ch-Ua'] = `"Chromium";v="${chromeVersion}", "Google Chrome";v="${chromeVersion}", "Not(A:Brand";v="99"`;
      headers['Sec-Ch-Ua-Mobile'] = '?0';
      headers['Sec-Ch-Ua-Platform'] = this.getMatchingPlatform(options.userAgent);
      headers['Sec-Ch-Ua-Platform-Version'] = '"15.0.0"';
      headers['Sec-Ch-Ua-Full-Version'] = `"${chromeVersion}.0.0.0"`;
    }
    
    // 添加DNT和Sec-GPC
    headers['DNT'] = '1';
    headers['Sec-GPC'] = '1';
    
    // 添加现代浏览器常见的安全头
    headers['Accept-CH'] = 'Sec-CH-UA, Sec-CH-UA-Mobile, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version';
    headers['Critical-CH'] = 'Sec-CH-UA, Sec-CH-UA-Mobile, Sec-CH-UA-Platform';
    
    // 针对特定网站的优化
    if (options.url.includes('yeahpromos.com')) {
      // yeahpromos.com 可能需要特定的头
      headers['Purpose'] = 'prefetch';
      headers['X-Purpose'] = 'prefetch';
      headers['X-Moz'] = 'prefetch';
    }
    
    // 合并自定义请求头
    if (options.headers) {
      Object.assign(headers, options.headers);
    }
    
    // 合并额外请求头
    if (options.extraHeaders) {
      Object.assign(headers, options.extraHeaders);
    }
    
    return headers;
  }
  
  /**
   * 从 User-Agent 提取 Chrome 版本
   */
  private extractChromeVersion(userAgent: string): string {
    const match = userAgent.match(/Chrome\/(\d+)/);
    return match ? match[1] : '126';
  }
  
  /**
   * 根据 User-Agent 检测操作系统
   */
  private detectOS(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Macintosh') || userAgent.includes('macOS')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    return 'Windows'; // 默认
  }
  
  /**
   * 根据操作系统生成合适的 Accept-Language（增强版）
   */
  private generateAcceptLanguage(os: string, language?: string): string {
    if (language) return language;
    
    // 根据操作系统设置默认语言偏好（增加更多变化）
    const languageOptions: Record<string, string[]> = {
      'Windows': [
        'zh-CN,zh;q=0.9,en;q=0.8',
        'zh-CN,zh;q=0.8,en;q=0.7',
        'zh-TW,zh;q=0.9,en;q=0.8',
        'en-US,en;q=0.9,zh-CN;q=0.8',
        'en-US,en;q=0.8,zh-CN;q=0.7'
      ],
      'macOS': [
        'en-US,en;q=0.9,zh-CN;q=0.8',
        'en-US,en;q=0.8,zh-CN;q=0.7',
        'zh-CN,zh;q=0.9,en;q=0.8',
        'zh-CN,zh;q=0.8,en;q=0.7'
      ],
      'Linux': [
        'en-US,en;q=0.9',
        'en-US,en;q=0.8',
        'en-GB,en;q=0.9',
        'zh-CN,zh;q=0.9,en;q=0.8'
      ],
      'Android': [
        'zh-CN,zh;q=0.9,en;q=0.8',
        'zh-CN,zh;q=0.8,en;q=0.7',
        'en-US,en;q=0.9,zh-CN;q=0.8'
      ],
      'iOS': [
        'en-US,en;q=0.9,zh-CN;q=0.8',
        'zh-CN,zh;q=0.9,en;q=0.8',
        'zh-TW,zh;q=0.9,en;q=0.8'
      ]
    };
    
    const options = languageOptions[os] || languageOptions['Windows'];
    return options[Math.floor(Math.random() * options.length)];
  }
  
  /**
   * 获取与 User-Agent 匹配的平台信息
   */
  private getMatchingPlatform(userAgent: string): string {
    const os = this.detectOS(userAgent);
    const platforms: Record<string, string> = {
      'Windows': '"Windows"',
      'macOS': '"macOS"',
      'Linux': '"Linux"',
      'Android': '"Android"',
      'iOS': '"iOS"'
    };
    return platforms[os] || '"Windows"';
  }
  
  /**
   * 生成类人延迟时间
   * 模拟人类浏览行为的随机延迟（优化版本）
   */
  private async generateHumanLikeDelay(options: VisitOptions): Promise<void> {
    // 根据是否为重定向URL调整延迟策略
    const isRedirectUrl = options.url.includes('yeahpromos.com') || 
                          options.url.includes('openurl') ||
                          options.url.includes('track=');
    
    // 优化后的延迟时间大幅减少
    const minDelay = isRedirectUrl ? 1000 : (options.minDelay || 500);
    const maxDelay = isRedirectUrl ? 3000 : (options.maxDelay || 2000);
    
    // 使用更高效的延迟分布：
    // - 70%概率：快速浏览
    // - 20%概率：正常停留
    // - 10%概率：稍长停留
    
    let delay: number;
    const rand = Math.random();
    
    if (rand < 0.7) {
      // 快速浏览
      delay = minDelay + Math.random() * (maxDelay - minDelay) * 0.3;
    } else if (rand < 0.9) {
      // 正常停留
      delay = minDelay + (maxDelay - minDelay) * 0.3 + Math.random() * (maxDelay - minDelay) * 0.3;
    } else {
      // 稍长停留
      delay = minDelay + (maxDelay - minDelay) * 0.6 + Math.random() * (maxDelay - minDelay) * 0.4;
    }
    
    // 确保最小延迟不低于300ms，最大不超过3500ms
    delay = Math.max(300, Math.min(3500, delay));
    
    logger.debug(`应用优化后的类人延迟: ${Math.round(delay)}ms`, {
      range: `${minDelay}-${maxDelay}`,
      isRedirectUrl
    });
    
    // 使用更精确的延迟方式
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  /**
   * 创建代理配置
   */
  private createProxyConfig(proxy: ProxyConfig): AxiosRequestConfig['proxy'] {
    if (!proxy) return undefined;
    
    const proxyUrl = `${proxy.protocol}://`;
    if (proxy.username && proxy.password) {
      return {
        protocol: proxy.protocol,
        host: proxy.host,
        port: proxy.port,
        auth: {
          username: proxy.username,
          password: proxy.password
        }
      };
    }
    
    return {
      protocol: proxy.protocol,
      host: proxy.host,
      port: proxy.port
    };
  }
  
  /**
   * 创建代理 Agent
   */
  private createProxyAgent(proxy: ProxyConfig) {
    if (!proxy) return undefined;
    
    let proxyUrl: string;
    if (proxy.username && proxy.password) {
      // 标准代理认证格式，需要对用户名和密码进行URL编码
      const encodedUsername = encodeURIComponent(proxy.username);
      const encodedPassword = encodeURIComponent(proxy.password);
      proxyUrl = `${proxy.protocol}://${encodedUsername}:${encodedPassword}@${proxy.host}:${proxy.port}`;
    } else {
      proxyUrl = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
    }
    
    logger.debug(`创建代理Agent:`, { 
      proxyUrl: proxyUrl.replace(/:([^:@]+)@/, ':***@'), // 隐藏密码
      protocol: proxy.protocol,
      provider: proxy.provider
    });
    
    if (proxy.protocol === 'socks5' || proxy.protocol === 'socks4') {
      return new SocksProxyAgent(proxyUrl);
    } else {
      // 为HTTP/HTTPS代理添加额外配置
      const proxyOptions = {
        keepAlive: true,
        keepAliveMsecs: 30000,
        maxSockets: 50, // 减少最大连接数避免资源耗尽
        maxFreeSockets: 10,
        scheduling: 'lifo' as const,
        timeout: 45000, // 代理连接超时
        // 对于IPRocket，禁用代理隧道以避免认证问题
        proxyTunnel: proxy.provider !== 'iprocket'
      };
      
      return new HttpsProxyAgent(proxyUrl, proxyOptions);
    }
  }

  /**
   * 创建CloudFlare优化的HTTPS Agent
   */
  private createCloudflareOptimizedAgent() {
    return new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 60000, // 增加keep-alive时间
      maxSockets: 100, // 增加最大连接数
      maxFreeSockets: 20, // 增加空闲连接数
      timeout: 45000, // 增加超时时间
      rejectUnauthorized: true,
      // 启用ALPN以支持HTTP/2
      ALPNProtocols: ['h2', 'http/1.1'],
      // 设置更真实的TLS选项
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
      // 使用更常见的密码套件
      ciphers: [
        'ECDHE-ECDSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-ECDSA-CHACHA20-POLY1305',
        'ECDHE-RSA-CHACHA20-POLY1305',
        'ECDHE-RSA-AES128-SHA256',
        'ECDHE-RSA-AES256-SHA384'
      ].join(':'),
      honorCipherOrder: false,
      // 禁用会话重用以避免指纹
      sessionTimeout: 30000,
      // 添加重试机制
      lookup: (hostname: string, options: any, callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
        // 使用默认DNS解析，但增加超时
        const dns = require('dns');
        const timeout = setTimeout(() => {
          callback(new Error('DNS lookup timeout'), '', 4);
        }, 5000);
        
        dns.lookup(hostname, options, (err: NodeJS.ErrnoException | null, address: string, family: number) => {
          clearTimeout(timeout);
          callback(err, address, family);
        });
      }
    });
  }

  /**
   * 检测是否为CloudFlare保护的网站
   */
  private async detectCloudflare(url: string): Promise<boolean> {
    try {
      const hostname = new URL(url).hostname;
      // 已知的CloudFlare特征
      const cloudflareIndicators = [
        'server: cloudflare',
        'cf-ray:',
        '__cfduid',
        'cf_clearance'
      ];
      
      // 简单的域名检查（可以扩展）
      return hostname.includes('dognet.com') || 
             hostname.includes('dyson.hr') ||
             hostname.includes('yeahpromos.com') || // 添加 yeahpromos.com
             url.includes('cloudflare');
    } catch {
      return false;
    }
  }

  /**
   * 应用CloudFlare优化策略
   */
  private applyCloudflareOptimizations(options: VisitOptions): VisitOptions {
    const optimized = { ...options };
    
    // 强制使用更真实的浏览器headers
    optimized.simulateBrowser = true;
    optimized.randomizeHeaders = true;
    optimized.humanLikeTiming = true;
    
    // 设置更长的延迟以模拟真实用户
    optimized.minDelay = 3000; // 最小3秒
    optimized.maxDelay = 12000; // 最大12秒
    
    // 添加额外的CloudFlare专用headers
    optimized.extraHeaders = {
      ...optimized.extraHeaders,
      'X-Forwarded-For': this.generateRandomIP(),
      'X-Real-IP': this.generateRandomIP(),
      'CF-IPCountry': 'US',
      'CF-Visitor': '{"scheme":"https"}'
    };
    
    return optimized;
  }
  
  /**
   * 应用针对yeahpromos.com的特殊优化
   */
  private applyYeahpromosOptimizations(options: VisitOptions): VisitOptions {
    const optimized = { ...options };
    
    // yeahpromos.com 特定的优化
    optimized.simulateBrowser = true;
    optimized.humanLikeTiming = true;
    optimized.minDelay = 4000; // 更长的最小延迟
    optimized.maxDelay = 12000; // 最大12秒
    optimized.followRedirects = true;
    optimized.maxRedirects = 15; // 允许更多重定向
    optimized.redirectDelay = 2000; // 重定向间延迟2秒
    optimized.retryCount = 2; // 优化重试次数
    optimized.retryDelay = 1500; // 优化重试延迟为1.5秒
    
    // 添加特定的headers
    optimized.extraHeaders = {
      ...optimized.extraHeaders,
      'Purpose': 'prefetch',
      'X-Purpose': 'prefetch',
      'X-Moz': 'prefetch',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Cache-Control': 'max-age=0',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-User': '?1'
    };
    
    return optimized;
  }

  /**
   * 生成随机IP地址
   */
  private generateRandomIP(): string {
    const octet = () => Math.floor(Math.random() * 256);
    return `${octet()}.${octet()}.${octet()}.${octet()}`;
  }

  /**
   * 使用增强的HTTP请求访问URL
   * 支持真实代理连接和浏览器模拟
   */
  async visitUrl(options: VisitOptions): Promise<VisitResult> {
    const startTime = Date.now();
    
    // 设置默认选项
    let finalOptions: VisitOptions = {
      followRedirects: true,
      maxRedirects: 10,
      redirectDelay: 1000,
      retryCount: 1, // 优化为默认重试1次
      retryDelay: 2000,
      ...options
    };
    
    // 检测是否为CloudFlare保护的网站
    const isCloudflareSite = await this.detectCloudflare(finalOptions.url);
    if (isCloudflareSite) {
      logger.info('检测到CloudFlare保护，应用优化策略', { url: finalOptions.url });
      // 应用CloudFlare特定的优化
      finalOptions = this.applyCloudflareOptimizations(finalOptions);
    }
    
    // 检测是否为yeahpromos.com URL
    if (finalOptions.url.includes('yeahpromos.com')) {
      logger.info('检测到yeahpromos.com URL，应用特殊优化', { url: finalOptions.url });
      // 应用yeahpromos特定的优化
      finalOptions = this.applyYeahpromosOptimizations(finalOptions);
    }
    
    // 尝试访问，包括重试
    let lastError: any = null;
    for (let attempt = 1; attempt <= (finalOptions.retryCount || 1) + 1; attempt++) {
      try {
        if (attempt > 1) {
          logger.info(`重试访问: ${finalOptions.url} (第${attempt}次尝试)`);
          
          // 使用指数退避策略，但减少基础延迟
          const baseDelay = finalOptions.retryDelay || 1500;
          const exponentialDelay = baseDelay * Math.pow(1.5, attempt - 2); // 从第二次重试开始指数增长
          const actualDelay = Math.min(exponentialDelay, 5000); // 最大不超过5秒
          
          await new Promise(resolve => setTimeout(resolve, actualDelay));
        }
        
        const result = await this.attemptVisit(finalOptions, startTime);
        if (result.success) {
          return result;
        }
        
        // 检查是否为不可重试的错误（如403 Forbidden）
        if (result.error && result.error.includes('403')) {
          logger.warn(`遇到403错误，停止重试: ${finalOptions.url}`);
          break;
        }
        
        lastError = result.error;
      } catch (error) {
        lastError = error;
        logger.warn(`访问失败: ${finalOptions.url} (第${attempt}次尝试)`, { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    // 所有尝试都失败了
    return {
      success: false,
      error: lastError?.message || lastError || 'All retry attempts failed',
      loadTime: Date.now() - startTime
    };
  }
  
  /**
   * 实际执行访问的方法
   */
  private async attemptVisit(options: VisitOptions, startTime: number): Promise<VisitResult> {
    try {
      // 格式化代理信息（包含sessionId）
      const configuredProxyInfo = options.proxy ? 
        `${options.proxy.host}:${options.proxy.port}${options.proxy.sessionId ? ` (Session: ${options.proxy.sessionId})` : ''}` : 
        'direct';
      
      logger.info(`使用增强HTTP访问: ${options.url}`, {
        proxy: options.proxy ? `${options.proxy.protocol}://${options.proxy.host}:${options.proxy.port}` : 'direct',
        configuredProxyInfo, // 添加配置的代理IP（带sessionId）
        referer: options.referer,
        sessionId: options.proxy?.sessionId || null,
        provider: options.proxy?.provider || null,
        simulateBrowser: options.simulateBrowser ?? true,
      });

      // 生成浏览器请求头
      const headers = this.generateBrowserHeaders(options);
      
      // 记录生成的请求头数量（用于调试）
      logger.debug(`生成 ${Object.keys(headers).length} 个请求头`, {
        secFetchSite: headers['Sec-Fetch-Site'],
        hasReferer: !!headers['Referer'],
        acceptLanguage: headers['Accept-Language']?.split(',')[0],
        userAgentType: options.userAgent.includes('Chrome') ? 'Chrome' : 
                      options.userAgent.includes('Firefox') ? 'Firefox' : 
                      options.userAgent.includes('Safari') ? 'Safari' : 'Other'
      });

      // 准备 axios 配置
      const axiosConfig: AxiosRequestConfig = {
        method: 'GET',
        url: options.url,
        headers: headers,
        timeout: options.timeout || 90000, // 增加默认超时到90秒
        maxRedirects: options.followRedirects ? (options.maxRedirects || 10) : 0,
        validateStatus: (status) => status < 500, // 接受所有小于500的状态码
        decompress: true, // 自动解压缩
        responseType: 'text',
        // 添加 DNS 解析相关配置
        httpAgent: new http.Agent({ 
          keepAlive: true,
          keepAliveMsecs: 60000, // 增加keep-alive时间
          maxSockets: 100, // 增加最大连接数
          maxFreeSockets: 20, // 增加空闲连接数
          timeout: 45000, // 增加连接超时
          scheduling: 'lifo' as const
        }),
        httpsAgent: this.createCloudflareOptimizedAgent(),
        // 添加请求转换器以处理重定向延迟
        transformRequest: [(data, headers) => {
          return data;
        }],
        transformResponse: [(data) => {
          return data;
        }]
      };

      // 配置代理
      let effectiveProxy: string | undefined;
      let connectionType: VisitResult['connectionType'] = 'direct';
      
      if (options.proxy) {
        // 使用代理 Agent（这是更可靠的方式）
        const proxyAgent = this.createProxyAgent(options.proxy);
        if (proxyAgent) {
          // 代理 Agent 会覆盖默认的 httpAgent 和 httpsAgent
          axiosConfig.httpAgent = proxyAgent;
          axiosConfig.httpsAgent = proxyAgent;
          // 为代理连接设置更长的超时
          axiosConfig.timeout = options.timeout || 90000; // 代理连接使用90秒超时
        }
        
        effectiveProxy = `${options.proxy.protocol}://${options.proxy.host}:${options.proxy.port}`;
        connectionType = options.proxy.protocol;
        
        logger.info(`配置代理连接: ${effectiveProxy}`, {
          protocol: options.proxy.protocol,
          hasAuth: !!(options.proxy.username && options.proxy.password),
          sessionId: options.proxy.sessionId || null,
          provider: options.proxy.provider || null,
          timeout: axiosConfig.timeout
        });
      } else {
        // 非代理连接使用默认的 Agent 配置
        axiosConfig.timeout = options.timeout || 60000; // 直连使用60秒超时
      }

      // 应用类人延迟（总是启用，避免请求过快）
      options.humanLikeTiming = true;
      await this.generateHumanLikeDelay(options);
      
      // 发送请求
      const response = await axios(axiosConfig);
      const loadTime = Date.now() - startTime;

      // 获取响应头
      const responseHeaders: Record<string, string> = {};
      if (response.headers) {
        Object.entries(response.headers).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            responseHeaders[key] = value.join(', ');
          } else {
            responseHeaders[key] = String(value);
          }
        });
      }
      
      // 检查是否有重定向
      const finalUrl = response.request?.res?.responseURL || options.url;
      const isRedirect = finalUrl !== options.url;
      
      if (isRedirect && options.followRedirects) {
        logger.info(`检测到重定向: ${options.url} → ${finalUrl}`, {
          statusCode: response.status,
          redirectCount: response.request?._redirectable?._redirectCount || 0
        });
        
        // 如果是 yeahpromos.com 的重定向，添加额外处理
        if (finalUrl.includes('adpgtrack.com') || finalUrl.includes('yeahpromos.com')) {
          // 等待重定向处理
          if (options.redirectDelay) {
            await new Promise(resolve => setTimeout(resolve, options.redirectDelay));
          }
        }
      }

      // 验证代理和IP一致性
      let proxyVerification: VisitResult['proxyVerification'] = undefined;
      let actualSourceIP: string | undefined;
      
      if (options.proxy && options.verifyProxyIP) {
        const verifyStartTime = Date.now();
        proxyVerification = await this.verifyProxyIP(options.proxy, options.url);
        proxyVerification.responseTime = Date.now() - verifyStartTime;
        actualSourceIP = proxyVerification.actualIP;
      } else if (options.proxy) {
        // 不验证IP时，显示基本信息
        const sessionInfo = options.proxy.sessionId ? ` (Session: ${options.proxy.sessionId})` : '';
        proxyVerification = {
          success: true,
          actualIP: 'Verification disabled',
          proxyStatus: `代理已配置: ${options.proxy.host}:${options.proxy.port}${sessionInfo}`,
          responseTime: loadTime
        };
        actualSourceIP = options.proxy.host; // 使用代理IP作为显示
      } else {
        // 直连情况
        actualSourceIP = 'direct';
      }

      // 验证Referer
      const refererVerification = {
        success: true,
        actualReferer: options.referer,
        refererStatus: options.referer 
          ? `HTTP请求头已设置Referer: ${options.referer}`
          : 'HTTP请求头未设置Referer'
      };

      // 检查是否成功
      const isSuccess = response.status >= 200 && response.status < 400;

      logger.info(`增强HTTP访问完成: ${options.url}`, {
        loadTime,
        statusCode: response.status,
        finalUrl: response.request?.res?.responseURL || options.url,
        success: isSuccess,
        proxyUsed: !!options.proxy,
        configuredProxyInfo, // 添加配置的代理IP（带sessionId）
        connectionType,
        proxyVerification: proxyVerification?.success,
        actualSourceIP, // 添加真实来源IP
        sourceIPInfo: actualSourceIP === 'direct' ? '直连' : 
                     actualSourceIP === options.proxy?.host ? '代理IP' : 
                     `动态IP (${actualSourceIP})`
      });

      return {
        success: isSuccess,
        loadTime,
        statusCode: response.status,
        finalUrl: isRedirect ? finalUrl : undefined,
        isRedirect, // 添加重定向标志
        redirectCount: response.request?._redirectable?._redirectCount || 0,
        proxyVerification,
        refererVerification,
        headers: headers,
        responseHeaders: responseHeaders,
        effectiveProxy,
        connectionType,
        actualSourceIP // 添加真实来源IP到返回结果
      };

    } catch (error) {
      const loadTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 格式化代理信息（包含sessionId）
      const configuredProxyInfo = options.proxy ? 
        `${options.proxy.host}:${options.proxy.port}${options.proxy.sessionId ? ` (Session: ${options.proxy.sessionId})` : ''}` : 
        'direct';
      
      // 更详细的错误日志
      if (axios.isAxiosError(error)) {
        const errorDetails = {
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          proxy: options.proxy ? `${options.proxy.protocol}://${options.proxy.host}:${options.proxy.port}` : 'direct',
          actualSourceIP: options.proxy ? options.proxy.host : 'direct',
          // 这些属性可能在某些错误中存在
          errno: (error as any).errno,
          syscall: (error as any).syscall,
          address: (error as any).address,
          port: (error as any).port
        };
        
        // 构建详细的错误消息
        const detailedErrorMessage = `HTTP访问失败: ${options.url} [${error.code || 'UNKNOWN'}]`;
        
        logger.error(`HTTP访问失败 (Axios): ${options.url}`, new EnhancedError(detailedErrorMessage, { 
          error: errorMessage,
          details: {
            ...errorDetails,
            configuredProxyInfo // 添加配置的代理IP（带sessionId）到错误详情
          },
          loadTime
        }));
      } else {
        logger.error(`HTTP访问失败: ${options.url}`, new EnhancedError(`HTTP访问失败: ${options.url}`, { 
          error: errorMessage,
          configuredProxyInfo, // 添加配置的代理IP（带sessionId）
          loadTime
        }));
      }

      return {
        success: false,
        error: errorMessage,
        loadTime,
        effectiveProxy: options.proxy ? `${options.proxy.protocol}://${options.proxy.host}:${options.proxy.port}` : undefined,
        connectionType: options.proxy?.protocol || 'direct',
        actualSourceIP: options.proxy ? options.proxy.host : 'direct'
      };
    }
  }

  /**
   * 批量访问URL
   */
  async batchVisit(urls: string[], options: Omit<VisitOptions, 'url'>): Promise<VisitResult[]> {
    const results: VisitResult[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      
      // 如果不是第一个URL且启用了类人时序，在URL之间添加额外延迟
      if (i > 0 && options.humanLikeTiming) {
        const minDelay = options.minDelay || 100;
        const maxDelay = options.maxDelay || 1000;
        const betweenUrlDelay = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;
        
        logger.debug(`URL间延迟: ${betweenUrlDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, betweenUrlDelay));
      }
      
      const result = await this.visitUrl({
        ...options,
        url
      });
      results.push(result);
    }

    return results;
  }

  /**
   * 验证代理IP一致性 - 增强实现
   * 使用实际的外部IP检测服务验证代理是否生效
   * 特别支持动态代理IP的Session机制
   */
  private async verifyProxyIP(proxy: ProxyConfig, targetUrl: string): Promise<{
    success: boolean;
    actualIP?: string;
    proxyStatus?: string;
    error?: string;
  }> {
    try {
      logger.info(`开始验证代理IP: ${proxy.host}:${proxy.port}`, {
        targetUrl,
        protocol: proxy.protocol,
        sessionId: proxy.sessionId || null,
        provider: proxy.provider || null,
        username: proxy.username || null
      });

      // 使用多个IP检测服务进行验证
      const ipCheckServices = [
        'https://api.ipify.org?format=json',
        'https://httpbin.org/ip',
        'https://ifconfig.me/ip',
        'https://icanhazip.com'
      ];

      let actualIP: string | undefined;
      let lastError: string | undefined;

      // 准备代理配置
      const proxyAgent = this.createProxyAgent(proxy);
      
      for (const service of ipCheckServices) {
        try {
          const response = await axios({
            method: 'GET',
            url: service,
            timeout: 10000,
            httpAgent: proxyAgent,
            httpsAgent: proxyAgent,
            responseType: 'json'
          });

          if (response.status === 200) {
            // 解析不同服务的响应格式
            if (service.includes('ipify.org')) {
              actualIP = response.data?.ip;
            } else if (service.includes('httpbin.org')) {
              actualIP = response.data?.origin;
            } else {
              // 纯IP响应
              actualIP = typeof response.data === 'string' ? response.data.trim() : undefined;
            }

            if (actualIP) {
              // 验证返回的IP是否与代理IP不同（说明代理生效）
              const isProxyWorking = actualIP !== proxy.host;
              
              // 对于动态代理IP（如IPRocket），IP不同是正常的
              let statusMessage: string;
              if (proxy.provider === 'iprocket' && proxy.sessionId) {
                statusMessage = `动态代理生效: ${proxy.host}:${proxy.port} (Session: ${proxy.sessionId}) → ${actualIP}`;
              } else {
                statusMessage = `代理${isProxyWorking ? '生效' : '可能未生效'}: ${proxy.host}:${proxy.port} → ${actualIP}`;
              }
              
              logger.info(`代理IP验证完成: ${proxy.host}:${proxy.port}`, {
                service,
                actualIP,
                isProxyWorking,
                proxyIP: proxy.host,
                sessionId: proxy.sessionId,
                provider: proxy.provider
              });

              return {
                success: true,
                actualIP,
                proxyStatus: statusMessage,
                error: undefined
              };
            }
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          logger.debug(`IP检测服务 ${service} 失败:`, { error: lastError });
          continue; // 尝试下一个服务
        }
      }

      // 所有服务都失败了
      logger.warn(`所有IP检测服务失败: ${proxy.host}:${proxy.port}`, {
        lastError
      });

      return {
        success: false,
        actualIP: undefined,
        proxyStatus: `代理验证失败: ${proxy.host}:${proxy.port}`,
        error: lastError || '所有IP检测服务都不可用'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error(`代理IP验证异常: ${proxy.host}:${proxy.port}`, new Error(errorMessage));

      return {
        success: false,
        actualIP: undefined,
        proxyStatus: `代理验证异常: ${proxy.host}:${proxy.port}`,
        error: errorMessage
      };
    }
  }
}

/**
 * 常用浏览器 User-Agent 生成器
 */
export class UserAgentGenerator {
  private static userAgents = {
    chrome: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    ],
    firefox: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0',
      'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0'
    ],
    safari: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    ],
    edge: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'
    ]
  };

  /**
   * 获取随机的 User-Agent
   */
  static getRandom(browserType?: 'chrome' | 'firefox' | 'safari' | 'edge'): string {
    const browsers = browserType ? [browserType] : Object.keys(this.userAgents) as Array<keyof typeof this.userAgents>;
    const selectedBrowser = browsers[Math.floor(Math.random() * browsers.length)];
    const agents = this.userAgents[selectedBrowser];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  /**
   * 获取 Chrome User-Agent
   */
  static getChrome(): string {
    return this.getRandom('chrome');
  }

  /**
   * 获取 Firefox User-Agent
   */
  static getFirefox(): string {
    return this.getRandom('firefox');
  }

  /**
   * 获取 Safari User-Agent
   */
  static getSafari(): string {
    return this.getRandom('safari');
  }

  /**
   * 获取 Edge User-Agent
   */
  static getEdge(): string {
    return this.getRandom('edge');
  }
}

// 导出实例
export const simpleHttpVisitor = new SimpleHttpVisitor();