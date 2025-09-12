/**
 * Simplified Proxy Service
 * 简化的代理管理服务，提供基础的代理获取、验证和分配功能
 */

import { getLogger } from '@/lib/core/logger-manager';
import { ProxyConfig, parseProxyResponse, extractProxyType, extractProxyProvider, parseMultipleProxiesResponse } from '@/lib/utils/proxy-utils';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

const logger = getLogger('ProxyService');

// 简单的内存缓存
const proxyCache = new Map<string, {
  proxies: ProxyConfig[];
  timestamp: number;
}>();

// 缓存有效期：5分钟
const CACHE_TTL = 5 * 60 * 1000;

export interface ProxyValidationResult {
  isValid: boolean;
  error?: string;
  proxies?: ProxyConfig[];
}

class ProxyService {
  private static instance: ProxyService;
  
  private constructor() {}
  
  public static getInstance(): ProxyService {
    if (!ProxyService.instance) {
      ProxyService.instance = new ProxyService();
    }
    return ProxyService.instance;
  }

  /**
   * 验证代理URL格式并获取代理IP
   * 使用简单的HTTP访问方式
   */
  public async validateProxyUrlFormat(proxyUrl: string): Promise<ProxyValidationResult> {
    try {
      logger.info('验证代理URL格式和IP获取能力', { proxyUrl });
      
      // 验证URL格式和ips参数
      try {
        const urlObj = new URL(proxyUrl);
        
        // 检查是否为iprocket API URL
        if (urlObj.hostname.includes('iprocket.io') || urlObj.hostname.includes('iprocket.net')) {
          const ipsParam = urlObj.searchParams.get('ips');
          
          // 如果ips参数不存在或为空，则验证失败
          if (!ipsParam || ipsParam.trim() === '') {
            return {
              isValid: false,
              error: '❌ 代理API URL格式错误：缺少ips参数\n\n请提供正确的代理API URL，例如：\nhttps://api.iprocket.io/api?username=xxx&password=xxx&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt\n\n💡 提示：\n- ips参数是必需的，用于指定要获取的代理IP数量\n- 如果您使用的是其他格式的URL，请确保它包含ips参数'
            };
          }
          
          // 验证ips参数是否为有效数字
          const ipsValue = parseInt(ipsParam);
          if (isNaN(ipsValue) || ipsValue < 1) {
            return {
              isValid: false,
              error: '❌ 代理API URL格式错误：ips参数值无效\n\nips参数必须是大于0的整数，例如：\n- ips=1（获取1个代理IP）\n- ips=5（获取5个代理IP）\n\n请修改您的代理API URL后重试。'
            };
          }
        }
      } catch (urlError) {
        return {
          isValid: false,
          error: '❌ 代理API URL格式无效\n\n请检查URL格式是否正确，确保包含完整的协议（http/https）和所有必需的参数。'
        };
      }
      
      // 使用简单的HTTP GET请求验证URL可访问性
      const response = await axios.get(proxyUrl, {
        timeout: 15000, // 15秒超时
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.status === 200) {
        // URL可访问，现在尝试解析代理
        const proxyType = extractProxyType(proxyUrl);
        const proxyProvider = extractProxyProvider(proxyUrl);
        
        let proxies: ProxyConfig[] = [];
        
        if (proxyProvider === 'iprocket') {
          // IPRocket 特殊处理 - 检查是否请求了多个代理
          const urlObj = new URL(proxyUrl);
          const ipsParam = urlObj.searchParams.get('ips');
          const requestedCount = ipsParam ? parseInt(ipsParam) : 1;
          
          if (requestedCount > 1) {
            // 请求多个代理，使用多代理解析函数
            proxies = parseMultipleProxiesResponse(response.data, 'http', proxyProvider);
          } else {
            // 请求单个代理，使用单代理解析函数
            const proxy = parseProxyResponse(response.data, 'http', proxyProvider);
            if (proxy) {
              proxies = [proxy];
            }
          }
        } else {
          // 尝试解析
          proxies = parseMultipleProxiesResponse(response.data, 'http', proxyProvider);
        }
        
        if (proxies.length > 0) {
          logger.info('代理URL格式验证成功', { 
            proxyUrl,
            proxyCount: proxies.length
          });
          
          return {
            isValid: true,
            proxies
          };
        } else {
          return {
            isValid: false,
            error: 'URL可访问但无法解析代理信息'
          };
        }
      } else {
        return {
          isValid: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
      
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('代理URL格式验证失败', new Error(errorMessage));
      
      // 简化错误消息
      let simpleError = errorMessage;
      if (error.code === 'ECONNABORTED' || errorMessage.includes('timeout')) {
        simpleError = '代理服务器响应超时，请检查网络连接或稍后重试';
      } else if (error.response?.status === 401) {
        simpleError = '代理认证失败，请检查用户名和密码';
      } else if (error.response?.status === 403) {
        simpleError = '代理访问被拒绝，请检查账号权限';
      }
      
      return {
        isValid: false,
        error: simpleError
      };
    }
  }

  /**
   * 验证代理IP的实际连接有效性
   * 专门用于ProxyValidationAPI - 测试代理服务器是否真的能工作
   * 使用与SimpleHttpVisitor相同的认证逻辑
   */
  public async validateProxyConnectivity(proxyConfig: ProxyConfig): Promise<ProxyValidationResult> {
    const validationStartTime = Date.now();
    try {
      logger.info('🔍 开始验证代理连接有效性', { 
        host: proxyConfig.host,
        port: proxyConfig.port,
        provider: proxyConfig.provider,
        sessionId: proxyConfig.sessionId,
        protocol: proxyConfig.protocol,
        hasAuth: !!(proxyConfig.username && proxyConfig.password),
        validationId: `val_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      });
      
      // 使用与SimpleHttpVisitor相同的代理Agent创建逻辑
      const createProxyAgent = (proxy: ProxyConfig) => {
        if (!proxy) return undefined;
        
        let proxyUrl: string;
        const protocol = proxy.protocol;
        
        // protocol已经从URL参数中正确获取，不需要根据provider修改
        
        if (proxy.username && proxy.password) {
          // IPRocket代理可能需要特殊处理
          if (proxy.provider === 'iprocket' && proxy.username.includes('res-row-sid-')) {
            // IPRocket的认证格式已经包含在用户名中，直接使用
            proxyUrl = `${protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
          } else {
            // 标准代理认证格式
            proxyUrl = `${protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
          }
        } else {
          proxyUrl = `${protocol}://${proxy.host}:${proxy.port}`;
        }
        
        logger.debug(`🔧 创建代理Agent用于验证:`, { 
          proxyUrl: proxyUrl.replace(/:([^:@]+)@/, ':***@'), // 隐藏密码
          protocol: proxy.protocol,
          provider: proxy.provider,
          agentType: protocol === 'socks5' || protocol === 'socks4' ? 'SocksProxyAgent' : 'HttpsProxyAgent',
          proxyTunnel: !(proxy.provider === 'iprocket')
        });
        
        if (protocol === 'socks5' || protocol === 'socks4') {
          return new SocksProxyAgent(proxyUrl);
        } else {
          // 为HTTP/HTTPS代理添加额外配置
          const proxyOptions = {
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 256,
            maxFreeSockets: 256,
            scheduling: 'lifo' as const,
            // 对于IPRocket，可能需要禁用代理隧道以避免认证问题
            proxyTunnel: !(proxy.provider === 'iprocket')
          };
          
          return new HttpsProxyAgent(proxyUrl, proxyOptions);
        }
      };
      
      // 使用axios进行代理验证测试
      const testUrl = 'https://httpbin.org/ip';
      const proxyAgent = createProxyAgent(proxyConfig);
      const agentCreateTime = Date.now();
      
      if (!proxyAgent) {
        logger.error('❌ 无法创建代理连接器', {
          host: proxyConfig.host,
          port: proxyConfig.port,
          provider: proxyConfig.provider
        });
        return {
          isValid: false,
          error: '无法创建代理连接器'
        };
      }
      
      logger.info('✅ 代理Agent创建成功', {
        agentCreateTime: agentCreateTime - validationStartTime,
        agentType: proxyConfig.protocol === 'socks5' || proxyConfig.protocol === 'socks4' ? 'SocksProxyAgent' : 'HttpsProxyAgent'
      });
      
      // 准备请求配置
      const axiosConfig = {
        method: 'GET',
        url: testUrl,
        timeout: 15000,
        httpAgent: proxyAgent,
        httpsAgent: proxyAgent,
        // 注意：当使用代理Agent时，不需要在请求头中添加Proxy-Authorization
        // 代理Agent会自动处理认证信息
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      };
      
      const requestStartTime = Date.now();
      logger.info('🌐 正在发送代理验证请求...', {
        targetUrl: testUrl,
        proxyHost: proxyConfig.host,
        proxyPort: proxyConfig.port,
        hasAuth: !!(proxyConfig.username && proxyConfig.password),
        timeout: 15000,
        requestPhase: 'starting'
      });
      
      const response = await axios(axiosConfig);
      const requestEndTime = Date.now();
      
      if (response.status === 200) {
        const totalTime = requestEndTime - validationStartTime;
        const requestTime = requestEndTime - requestStartTime;
        
        // 检查响应是否包含代理IP信息
        const responseData = response.data;
        const detectedIp = responseData?.origin || 'unknown';
        
        logger.info('✅ 代理连接验证成功', { 
          host: proxyConfig.host,
          port: proxyConfig.port,
          statusCode: response.status,
          provider: proxyConfig.provider,
          sessionId: proxyConfig.sessionId,
          detectedIp,
          requestTime,
          totalTime,
          responseSize: JSON.stringify(responseData).length,
          validationPhase: 'completed'
        });
        
        return {
          isValid: true,
          proxies: [proxyConfig]
        };
      } else {
        logger.error('❌ 代理验证响应状态码异常', {
          expectedStatus: 200,
          actualStatus: response.status,
          statusText: response.statusText,
          host: proxyConfig.host,
          port: proxyConfig.port,
          provider: proxyConfig.provider
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error: any) {
      const errorTime = Date.now();
      const totalTime = errorTime - validationStartTime;
      
      logger.error('❌ 代理连接验证失败', {
        host: proxyConfig.host,
        port: proxyConfig.port,
        error: error.message,
        errorCode: error.code,
        errorType: error.constructor.name,
        statusCode: error.response?.status,
        statusMessage: error.response?.statusText,
        provider: proxyConfig.provider,
        sessionId: proxyConfig.sessionId,
        totalTime,
        validationPhase: 'failed',
        stackTrace: error.stack?.split('\n').slice(0, 3) // 只取前3行堆栈
      });
      
      // 提供更友好的错误信息
      let errorMessage = `代理连接失败: ${error.message}`;
      if (error.response?.status === 503) {
        errorMessage = `代理服务器 ${proxyConfig.host}:${proxyConfig.port} 暂时不可用 (HTTP 503)。这是代理服务商的问题，建议稍后重试或联系代理客服`;
      } else if (error.response?.status === 401) {
        errorMessage = '代理认证失败，请检查用户名和密码是否正确';
      } else if (error.response?.status === 403) {
        errorMessage = '代理访问被拒绝，可能是IP被限制或账号权限不足';
      } else if (error.response?.status === 407) {
        errorMessage = '代理需要认证，请检查认证信息';
      } else if (error.response?.status >= 500) {
        errorMessage = `代理服务器内部错误 (HTTP ${error.response.status})，请稍后重试`;
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        errorMessage = `无法连接到代理服务器 ${proxyConfig.host}:${proxyConfig.port}，请检查代理地址和端口`;
      }
      
      return {
        isValid: false,
        error: errorMessage
      };
    }
  }

  /**
   * 验证代理配置 - 兼容性方法，自动判断验证类型
   */
  public async validateProxyConfiguration(proxyUrl: string): Promise<ProxyValidationResult> {
    // 首先验证URL格式和IP获取
    const urlValidation = await this.validateProxyUrlFormat(proxyUrl);
    
    if (!urlValidation.isValid || !urlValidation.proxies || urlValidation.proxies.length === 0) {
      return urlValidation;
    }
    
    // 如果URL验证成功，继续验证实际连接
    try {

    return await this.validateProxyConnectivity(urlValidation.proxies[0]);

    } catch (error) {

      console.error(error);

      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Proxy validation failed'
      };

    }
  }
  
  /**
   * 获取代理池
   */
  public async fetchProxyPool(
    proxyUrl: string,
    requiredCount: number,
    isSilentMode: boolean = false,
    taskId?: string,
    urlCount?: number,
    enableCache: boolean = true
  ): Promise<ProxyConfig[]> {
    // 动态更新 ips 参数
    let updatedProxyUrl = proxyUrl;
    if (requiredCount > 1) {
      // 替换 ips 参数为所需的数量
      updatedProxyUrl = proxyUrl.replace(/ips=\d+/, `ips=${requiredCount}`);
    }
    
    const cacheKey = `${updatedProxyUrl}-${requiredCount}`;
    
    // 检查缓存
    if (enableCache) {
      const cached = proxyCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logger.info('使用缓存的代理池', { 
          proxyUrl, 
          count: cached.proxies.length,
          cacheAge: Date.now() - cached.timestamp 
        });
        return cached.proxies;
      }
    }
    
    try {
      logger.info('获取代理池', {
        proxyUrl: updatedProxyUrl,
        requiredCount,
        isSilentMode,
        taskId,
        urlCount
      });
      
      // 获取代理列表
      const proxies = await this.fetchProxyFromUrl(updatedProxyUrl, requiredCount);
      
      if (proxies.length === 0) {
        logger.warn('未能获取到任何代理IP', { proxyUrl: updatedProxyUrl });
        return [];
      }
      
      // 缓存结果
      if (enableCache) {
        proxyCache.set(cacheKey, {
          proxies,
          timestamp: Date.now()
        });
      }
      
      logger.info('代理池获取成功', { 
        actualCount: proxies.length,
        requiredCount,
        proxyUrl: updatedProxyUrl 
      });
      
      return proxies;
      
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('获取代理池失败', new Error(errorMessage));
      throw error;
    }
  }

  /**
   * 从URL获取代理
   */
  private async fetchProxyFromUrl(proxyUrl: string, count: number): Promise<ProxyConfig[]> {
    const maxRetries = 3;
    const baseTimeout = 30000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info('尝试获取代理IP', {
          proxyUrl,
          count,
          attempt,
          maxRetries
        });
        
        // 检测代理类型和提供商
        const proxyType = extractProxyType(proxyUrl);
        const proxyProvider = extractProxyProvider(proxyUrl);
        logger.info('检测到代理配置', { proxyType, proxyProvider, proxyUrl });
        
        // 根据代理提供商选择解析方法
        let proxies: ProxyConfig[] = [];
        
        if (proxyProvider !== 'unknown') {
          // 使用新的解析方法，增加超时时间
          const timeout = baseTimeout * attempt; // 逐次增加超时时间
          logger.info(`使用超时时间: ${timeout}ms`, { attempt });
          
          // 为不同提供商添加特定头部
          const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          };
          
          // IPRocket可能需要额外的头部
          if (proxyProvider === 'iprocket') {
            headers['Accept'] = 'text/plain,*/*';
            headers['Cache-Control'] = 'no-cache';
            headers['Pragma'] = 'no-cache';
          }
          
          const response = await axios.get(proxyUrl, {
            timeout,
            headers
          });
        
        if (response.status === 200) {
          const responseText = response.data;
          logger.info('获取代理响应成功', {
            proxyUrl,
            responseLength: responseText.length,
            attempt
          });
          
          // 根据代理提供商选择解析策略
          if (proxyProvider === 'iprocket') {
            // IPRocket 特殊处理 - 检查是否请求了多个代理
            const urlObj = new URL(proxyUrl);
            const ipsParam = urlObj.searchParams.get('ips');
            const requestedCount = ipsParam ? parseInt(ipsParam) : 1;
            
            if (requestedCount > 1) {
              // 请求多个代理，使用多代理解析函数
              proxies = parseMultipleProxiesResponse(responseText, 'http', proxyProvider);
            } else {
              // 请求单个代理，使用单代理解析函数
              const proxy = parseProxyResponse(responseText, 'http', proxyProvider);
              if (proxy) {
                proxies = [proxy];
              }
            }
          } else {
            // 尝试多种解析策略
            proxies = parseMultipleProxiesResponse(responseText, 'http', proxyProvider);
          }
          
          if (proxies.length > 0) {
            logger.info('成功解析代理配置', {
              host: proxies[0].host,
              port: proxies[0].port,
              username: proxies[0].username ? '[HIDDEN]' : undefined,
              protocol: proxies[0].protocol,
              sessionId: proxies[0].sessionId,
              provider: proxies[0].provider,
              attempt
            });
          }
        }
      } else {
        // 其他代理类型，使用默认解析
        const timeout = baseTimeout * attempt;
        const response = await axios.get(proxyUrl, {
          timeout
        });
        
        if (response.status === 200) {
          const proxy = parseProxyResponse(response.data, proxyType as 'http' | 'https' | 'socks4' | 'socks5');
          if (proxy) {
            proxies = [proxy];
          }
        }
      }
      
      // 如果解析失败，尝试其他解析方法
      if (proxies.length === 0) {
        logger.warn('标准解析失败，尝试备用解析方法', { proxyUrl, attempt });
        const timeout = baseTimeout * attempt;
        const response = await axios.get(proxyUrl, { timeout });
        proxies = parseMultipleProxiesResponse(response.data);
      }
      
      if (proxies.length === 0) {
        throw new Error(`无法解析代理响应: ${proxyUrl}`);
      }
      
      return proxies;
        
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isTimeout = error.code === 'ECONNABORTED' || errorMessage.includes('timeout');
        
        logger.warn(`获取代理IP失败 (尝试 ${attempt}/${maxRetries})`, {
          error: errorMessage,
          isTimeout,
          proxyUrl,
          attempt
        });
        
        // 如果是最后一次尝试，抛出错误
        if (attempt === maxRetries) {
          // 创建更友好的错误消息
          let userFriendlyError = errorMessage;
          
          if (isTimeout) {
            userFriendlyError = `代理服务器响应超时。这可能是由于：
1. 网络连接问题
2. 代理服务器负载过高
3. 防火墙阻止了连接

建议：
- 检查网络连接是否正常
- 稍后重试
- 联系代理服务商确认服务状态`;
          } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
            userFriendlyError = `无法解析代理服务器域名。请检查：
1. 代理URL是否正确
2. DNS配置是否正常
3. 网络连接是否正常`;
          } else if (errorMessage.includes('ECONNREFUSED')) {
            userFriendlyError = `代理服务器拒绝连接。请检查：
1. 代理服务器是否正在运行
2. 端口号是否正确
3. 代理服务器是否允许您的IP访问`;
          }
          
          logger.error('获取代理IP失败，已达到最大重试次数', new Error(errorMessage));
          
          // 创建包含用户友好信息的错误
          const enhancedError = new Error(userFriendlyError);
          enhancedError.name = error.name;
          enhancedError.stack = error.stack;
          throw enhancedError;
        }
        
        // 如果不是最后一次尝试，等待一段时间后重试
        const delay = Math.min(2000 * attempt, 10000); // 递增延迟，最大10秒
        logger.info(`等待 ${delay}ms 后重试...`, { attempt });
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // 继续下一次尝试
        continue;
      }
    }
    
    // 理论上不应该到达这里
    throw new Error('获取代理IP失败：未知错误');
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    proxyCache.clear();
    logger.info('代理缓存已清除');
  }

  /**
   * 获取缓存统计
   */
  public getCacheStats(): { count: number; size: number } {
    return {
      count: proxyCache.size,
      size: Array.from(proxyCache.values()).reduce((total, cache) => 
        total + cache.proxies.length, 0
      )
    };
  }

  /**
   * 兼容性方法：分配代理
   */
  public assignProxy(proxyPool: ProxyConfig[], currentIndex: number): ProxyConfig | undefined {
    if (!proxyPool || proxyPool.length === 0) {
      return undefined;
    }
    return proxyPool[currentIndex % proxyPool.length];
  }
}

// 导出单例实例和兼容性函数
export const proxyService = ProxyService.getInstance();
export default proxyService;

// 兼容性导出
export const fetchProxyPool = (proxyUrl: string, requiredCount: number, isSilentMode?: boolean, taskId?: string, urlCount?: number, enableCache?: boolean) => 
  proxyService.fetchProxyPool(proxyUrl, requiredCount, isSilentMode, taskId, urlCount, enableCache);