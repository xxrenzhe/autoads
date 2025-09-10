/**
 * Unified Proxy Utilities
 * 统一的代理处理工具，避免重复代码
 */

import { createClientLogger } from '@/lib/utils/security/client-secure-logger';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('ProxyUtils');

// 检测是否为静默模式
const isSilentMode = process.env.SILENT_MODE === 'true' || 
                    process.env.NEXT_PUBLIC_SILENT_MODE === 'true' ||
                    globalThis.hasOwnProperty('isSilentMode');

export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  url?: string;           // 完整代理URL
  
  // 新增字段：支持Session和提供商识别
  sessionId?: string;     // Session ID (如IPRocket的sid-123456)
  uniqueKey?: string;     // 完整唯一标识
  provider?: string;      // 代理提供商 (如 'iprocket', 'brightdata', 'oxylabs')
  
  // 现有字段
  score?: number;
  responseTime?: number;
  lastUsed?: number;
  active?: boolean;
  validated?: boolean;
  isPremium?: boolean;
}

/**
 * 转换代理配置为Playwright格式
 * 注意：Playwright不支持SOCKS5代理认证，会自动提供解决方案建议
 */
export function formatProxyForPlaywright(proxy: ProxyConfig): { 
  server: string; 
  username?: string; 
  password?: string;
  warning?: string;
  solution?: string;
} {
  const { protocol, host, port, username, password } = proxy;
  
  // 对于SOCKS5代理，Playwright不支持认证
  if (protocol === 'socks5') {
    const hasAuth = username && password;
    
    if (hasAuth) {
      logger.error('❌ Playwright不支持SOCKS5代理认证', { 
        proxy: `${host}:${port}`,
        solution: '建议使用代理转换工具或HTTP代理'
      } as any);
      
      return {
        server: `socks5://${host}:${port}`,
        warning: 'Playwright不支持SOCKS5代理认证',
        solution: '请使用 socks5-proxy-helper.js 工具进行协议转换，或切换到HTTP代理'
      };
    } else {
      logger.warn('⚠️ 使用无认证SOCKS5代理，可能连接失败', { 
        proxy: `${host}:${port}` 
      });
      
      return {
        server: `socks5://${host}:${port}`,
        warning: '无认证SOCKS5代理可能不稳定',
        solution: '建议使用HTTP代理或启用代理转换服务'
      };
    }
  }
  
  // 对于HTTP/HTTPS代理，使用分离的认证信息格式
  if (username && password) {
    logger.info('配置带认证的HTTP代理:', { 
      server: `${protocol}://${host}:${port}`,
      username: username,
      password: password
    });
    return {
      server: `${protocol}://${host}:${port}`,
      username: username,
      password: password
    };
  }
  
  return {
    server: `${protocol}://${host}:${port}`
  };
}

/**
 * 转换代理配置为Puppeteer格式
 */
export function formatProxyForPuppeteer(proxy: ProxyConfig): string {
  // Puppeteer需要字符串格式的代理URL
  const { protocol, host, port, username, password } = proxy;
  
  if (username && password) {
    return `${protocol}://${username}:${password}@${host}:${port}`;
  }
  
  return `${protocol}://${host}:${port}`;
}

/**
 * 验证代理配置是否有效
 */
export function validateProxyConfig(proxy: ProxyConfig): boolean {
  if (!proxy.host || !proxy.port) {
    logger.warn('代理配置缺少主机或端口', { proxy });
    return false;
  }
  
  if (proxy.port < 1 || proxy.port > 65535) {
    logger.warn('代理端口无效', { port: proxy.port });
    return false;
  }
  
  // 验证主机名格式
  const hostRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (!hostRegex.test(proxy.host)) {
    logger.warn('代理主机名格式无效', { host: proxy.host });
    return false;
  }
  
  return true;
}

/**
 * 获取代理的显示名称（用于日志）
 */
export function getProxyDisplayName(proxy: ProxyConfig): string {
  const auth = proxy.username && proxy.password 
    ? (isSilentMode ? `${proxy.username}:${proxy.password}@` : '***:***@') 
    : '';
  return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
}

/**
 * 检查代理是否需要认证
 */
export function proxyRequiresAuthentication(proxy: ProxyConfig): boolean {
  return !!(proxy.username && proxy.password);
}

/**
 * 生成代理配置的缓存键（支持Session感知）
 */
export function getProxyCacheKey(proxy: ProxyConfig): string {
  // 如果有Session ID且是支持的提供商，使用包含Session的唯一键
  if (proxy.sessionId && proxy.provider && ['iprocket'].includes(proxy.provider)) {
    return `${proxy.protocol}://${proxy.host}:${proxy.port}:${proxy.sessionId}:${proxy.username || ''}:${proxy.password || ''}`;
  }
  
  // 对于其他代理，使用包含凭据的完整唯一键
  // 这确保了不同凭据的相同主机和端口被视为不同的代理
  return `${proxy.protocol}://${proxy.host}:${proxy.port}:${proxy.username || ''}:${proxy.password || ''}`;
}

/**
 * 生成IPRocket专用的唯一键
 */
export function getIPRocketUniqueKey(
  host: string, 
  port: string, 
  sessionId: string
): string {
  return `http://${host}:${port}:${sessionId}`;
}

/**
 * 解析代理响应文本为配置对象
 */
export function parseProxyResponse(
  responseText: string, 
  proxyType: 'http' | 'https' | 'socks4' | 'socks5' = 'http',
  provider?: string
): ProxyConfig | null {
  try {
    const text = responseText.trim();
    
    // 检测HTML响应并提取代理信息
    if (text.startsWith('<') || text.toLowerCase().includes('<html') || text.toLowerCase().includes('<!doctype') || text.includes('<pre')) {
      logger.info('检测到HTML响应，尝试提取代理信息:', {
        startsWithHtml: text.startsWith('<'),
        containsHtmlTag: text.toLowerCase().includes('<html'),
        containsDoctype: text.toLowerCase().includes('<!doctype'),
        containsPreTag: text.includes('<pre'),
        preview: text.substring(0, 200)
      });
      
      // 尝试从HTML中提取代理信息
      // 1. 从<pre>标签中提取
      const preMatch = text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      if (preMatch) {
        const preContent = preMatch[1].trim();
        logger.info('从<pre>标签中提取内容:', { content: preContent });
        
        // 尝试解析提取的内容
        const extractedProxy = parseProxyResponse(preContent, proxyType);
        if (extractedProxy) {
          logger.info('成功从HTML中提取代理:', extractedProxy);
          return extractedProxy;
        }
      }
      
      // 2. 直接从HTML中查找IP:PORT模式
      const ipPortPattern = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})(?::([^:]+)(?::([^:]+))?)?/g;
      const matches = [...text.matchAll(ipPortPattern)];
      
      if (matches.length > 0) {
        const match = matches[0]; // 使用第一个匹配
        const proxyConfig: ProxyConfig = {
          host: match[1],
          port: parseInt(match[2]),
          username: match[3],
          password: match[4],
          protocol: proxyType
        };
        
        logger.info('使用正则表达式从HTML中提取代理:', proxyConfig);
        return proxyConfig;
      }
      
      logger.warn('无法从HTML响应中提取代理信息');
      return null as any;
    }
    
    // 检测JSON错误响应
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const json = JSON.parse(text);
        if (json.error || json.message || json.code) {
          logger.warn('检测到JSON错误响应:', {
            error: json.error,
            message: json.message,
            code: json.code,
            preview: text.substring(0, 200)
          });
          return null as any;
        }
      } catch (jsonError) {
        // 不是有效的JSON，继续处理
      }
    }
    
    // 检测常见的错误消息
    const errorKeywords = [
      'error', '错误', 'invalid', '无效', 'unauthorized', '认证失败', 
      'limit', '限制', 'exceeded', '超出', 'blocked', '被封', 
      'maintenance', '维护', 'timeout', '超时'
    ];
    
    const lowerText = text.toLowerCase();
    const foundErrors = errorKeywords.filter(keyword => lowerText.includes(keyword));
    
    if (foundErrors.length > 0) {
      logger.warn('检测到可能的错误消息:', {
        foundKeywords: foundErrors,
        preview: text.substring(0, 200)
      });
      // 不直接返回null，只是记录警告，因为可能是正常的代理格式
    }
    
    // 尝试解析JSON格式（如proxylist.geonode）
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const json = JSON.parse(text);
        
        // 处理proxylist.geonode格式
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          const proxy = json.data[0];
          if (proxy.ip && proxy.port) {
            logger.info('使用JSON格式代理:', { 
              ip: proxy.ip, 
              port: proxy.port, 
              username: proxy.username,
              password: proxy.password,
              protocol: proxyType 
            });
            return {
              host: proxy.ip,
              port: parseInt(proxy.port),
              username: proxy.username,
              password: proxy.password,
              protocol: proxyType
            };
          }
        }
        
        // 处理其他可能的JSON格式
        if (json.ip && json.port) {
          return {
            host: json.ip,
            port: parseInt(json.port),
            username: json.username,
            password: json.password,
            protocol: proxyType
          };
        }
      } catch (jsonError) {
        logger.debug('JSON解析失败，尝试其他格式');
      }
    }
    
    // 格式1: 139.162.174.182:9595:com49692430-res-ROW-sid-18481891:ApL72Exh03 L0tgTLcb12
    if (text.includes(':')) {
      // 先处理换行符，特别处理密码后跟IP地址的情况
      let normalizedText = text.trim();
      
      // 检查是否有换行符，如果有则只处理第一行（这个函数应该只处理单个代理）
      if (/[\r\n]/.test(normalizedText)) {
        const firstLine = normalizedText.split(/[\r\n]+/)[0].trim();
        logger.warn('parseProxyResponse收到多行文本，只处理第一行', {
          originalLength: normalizedText.length,
          firstLineLength: firstLine.length,
          firstLine: firstLine.substring(0, 50)
        });
        normalizedText = firstLine;
      }
      
      // 检查是否有换行符后跟IP地址的模式（常见问题）
      const ipAfterNewline = normalizedText.match(/[\r\n]+(\d+\.\d+\.\d+\.\d+)$/);
      if (ipAfterNewline) {
        // 移除换行符和后面的IP地址
        normalizedText = normalizedText.substring(0, normalizedText.lastIndexOf(ipAfterNewline[0])).trim();
        logger.info('检测并移除了密码后的IP地址:', { removedIp: ipAfterNewline[1] });
      }
      
      const parts = normalizedText.split(':');
      if (parts.length >= 2) {
        // 清理主机地址（去除可能的空白字符）
        const host = parts[0].trim();
        const port = parseInt(parts[1].trim());
        
        // 验证主机和端口
        if (!host || isNaN(port) || port < 1 || port > 65535) {
          logger.warn('代理格式无效 - 主机或端口错误:', { 
            host, 
            port: parts[1], 
            parsedPort: port,
            parts: parts.slice(0, 4) 
          });
          return null as any;
        }
        
        // 构建代理配置
        // 处理密码中可能包含冒号的情况
        let username: string | undefined = undefined;
        let password: string | undefined = undefined;
        
        if (parts.length > 2) {
          username = parts[2].trim();
          
          if (parts.length > 3) {
            // 密码可能包含冒号，需要重新组合
            password = parts.slice(3).join(':').trim();
          }
        }
        
        const result: ProxyConfig = {
          host,
          port,
          username,
          password,
          protocol: proxyType,
          provider
        };
        
        // 验证用户名和密码不为空字符串
        if (result.username === '') result.username = undefined;
        if (result.password === '') result.password = undefined;
        
        // 提取Session ID信息（针对IPRocket格式）
        if (result.username && result.username.includes('sid-')) {
          const sidMatch = result.username.match(/sid-(\d+)/);
          if (sidMatch) {
            result.sessionId = sidMatch[1];
            result.uniqueKey = `${result.host}:${result.port}:${result.sessionId}`;
          }
        }
        
        logger.info('成功解析代理配置:', { 
          host: result.host, 
          port: result.port, 
          username: result.username,
          password: result.password,
          protocol: result.protocol,
          sessionId: result.sessionId,
          provider: result.provider
        });
        
        return result;
      }
    }
    
    // 格式2: 139.162.174.182:9595 (简单格式)
    const match = text.match(/^(\\d+\\.\\d+\\.\\d+\\.\\d+):(\\d+)$/);
    if (match) {
      return {
        host: match[1],
        port: parseInt(match[2]),
        protocol: proxyType
      };
    }
    
    // 尝试清理文本后重新解析（只处理换行符，保留密码中的空格）
    const cleanedText = text.trim().replace(/[\r\n]+/g, ' ').replace(/\s*:\s*/g, ':');
    if (cleanedText !== text) {
      logger.info('尝试清理后的文本重新解析:', { original: text.substring(0, 50), cleaned: cleanedText.substring(0, 50) });
      return parseProxyResponse(cleanedText, proxyType);
    }
    
    logger.warn('无法解析代理格式:', { 
      text: text.substring(0, 50), 
      length: text.length,
      containsColon: text.includes(':'),
      containsDot: text.includes('.'),
      firstChar: text.charAt(0),
      lastChar: text.charAt(text.length - 1)
    });
    return null as any;
  } catch (error) {
    logger.error('解析代理响应异常:', new EnhancedError('解析代理响应异常:', { error: error instanceof Error ? error.message : String(error)  }));
    return null as any;
  }
}

/**
 * 带重试的fetch函数 - 增强版
 * 针对网络不稳定和连接重置问题进行优化
 */
export async function fetchWithRetry(
  url: string, 
  options: RequestInit & { maxRetries?: number; timeout?: number } = {}
): Promise<Response> {
  // 针对网络不稳定问题优化：增加超时时间和重试次数
  const { maxRetries = 6, timeout = 30000, ...fetchOptions } = options;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      logger.info(`代理请求尝试 ${attempt}/${maxRetries}:`, { 
        url: url,
        timeout,
        attempt 
      });
      
      // 设置超时
      timeoutId = setTimeout(() => {
        logger.warn(`代理请求超时，中止请求 (${timeout}ms):`, { 
          url: url,
          attempt 
        });
        controller.abort();
      }, timeout);
      
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        // 添加更多的请求头来提高成功率
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          ...fetchOptions.headers
        }
      });
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        logger.warn(`代理API响应错误:`, { 
          url: url,
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 200),
          attempt 
        });
        
        // 检查是否为IPRocket API
        const isIPRocket = url.includes('iprocket.io');
        
        // 对于IPRocket API，遇到429或403错误时，增加更长的延迟
        if (isIPRocket && (response.status === 429 || response.status === 403) && attempt < maxRetries) {
          const retryDelay = Math.min(5000 * Math.pow(2, attempt - 1), 30000); // 更长的退避，最大30秒
          logger.warn(`IPRocket API限制，等待 ${retryDelay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        // 对于5xx错误或其他429错误，进行重试
        if ((response.status >= 500 || response.status === 429) && attempt < maxRetries) {
          const retryDelay = Math.min(2000 * Math.pow(2, attempt - 1), 10000); // 指数退避，最大10秒
          logger.info(`等待 ${retryDelay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        // 对于4xx错误，不重试，直接返回响应
        return response;
      }
      
      logger.info(`代理请求成功:`, { 
        url: url,
        status: response.status,
        attempt 
      });
      
      return response;
      
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // 检查是否应该重试 - 增强网络错误检测
      const shouldRetry = attempt < maxRetries && (
        lastError.name === 'AbortError' || 
        lastError.name === 'TimeoutError' ||
        lastError.message.includes('This operation was aborted') ||
        lastError.message.includes('ECONNREFUSED') ||
        lastError.message.includes('ENOTFOUND') ||
        lastError.message.includes('ETIMEDOUT') ||
        lastError.message.includes('ECONNRESET') ||  // 连接重置
        lastError.message.includes('ECONNABORTED') || // 连接中断
        lastError.message.includes('network error') ||
        lastError.message.includes('fetch failed') ||
        lastError.message.includes('Connection reset') ||
        lastError.message.includes('Connection refused') ||
        lastError.message.includes('Connection timed out')
      );
      
      if (shouldRetry) {
        const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 8000); // 指数退避，最大8秒
        logger.warn(`代理请求异常，准备重试:`, { 
          url: url,
          attempt, 
          error: lastError.message,
          retryDelay
        });
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      // 不应该重试的错误，直接抛出
      logger.error(`代理请求失败，不再重试:`, new EnhancedError('代理请求失败:', {
        url: url,
        attempt,
        error: lastError.message,
        errorName: lastError.name
      }));
      
      throw lastError;
    }
  }
  
  // 所有重试都失败了
  const finalError = new EnhancedError('代理请求重试次数已用完:', {
    url: url,
    maxRetries,
    lastError: lastError?.message || 'Unknown error'
  });
  
  logger.error('代理请求最终失败:', finalError);
  throw finalError;
}

/**
 * 验证代理URL格式（增强版）
 */
export function validateProxyUrl(proxyUrl: string): { isValid: boolean; error?: string; details?: any } {
  if (!proxyUrl || !proxyUrl.trim()) {
    return { isValid: true };
  }

  const trimmedUrl = proxyUrl.trim();

  // 基本格式检查
  if (!trimmedUrl.startsWith('http')) {
    return { isValid: false, error: '代理API地址必须以http开头' };
  }

  // 长度检查
  if (trimmedUrl.length > 2048) {
    return { isValid: false, error: '代理URL长度不能超过2048字符' };
  }

  // 安全检查 - 仅检查基本协议安全，允许代理API地址
  const dangerousProtocols = [
    /^javascript:/i,
    /^data:/i,
    /^vbscript:/i,
    /^file:/i,
    /^ftp:/i,
    /^ssh:/i,
    /^telnet:/i
  ];

  if (dangerousProtocols.some(pattern => pattern.test(trimmedUrl))) {
    return { isValid: false, error: '代理URL使用了不支持的协议' };
  }

  try {
    const url = new URL(trimmedUrl);
    
    // 验证协议
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { isValid: false, error: '代理URL必须使用HTTP或HTTPS协议' };
    }

    // 验证主机名
    if (!url.hostname || url.hostname.includes('..')) {
      return { isValid: false, error: '代理URL主机名无效' };
    }

    // 验证端口号（如果指定）
    if (url.port) {
      const portNum = parseInt(url.port);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        return { isValid: false, error: '代理URL端口号无效' };
      }
    }

    return { 
      isValid: true, 
      details: {
        protocol: url.protocol,
        hostname: url.hostname
      }
    };
  } catch (error) {
    return { 
      isValid: false, 
      error: '代理URL格式无效',
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 从代理URL的proxyType参数中提取协议类型
 * 如果没有指定proxyType参数，默认返回http
 * 支持SOCKS5但会提供兼容性警告和解决方案
 */
export function extractProxyType(proxyUrl: string): 'http' | 'https' | 'socks4' | 'socks5' | 'iprocket' | 'geonode' | 'brightdata' {
  try {
    const urlObj = new URL(proxyUrl);
    
  // 首先检查主机名来识别代理提供商
    if (urlObj.hostname.includes('iprocket.io')) {
      return 'iprocket';
    } else if (urlObj.hostname.includes('geonode.com')) {
      return 'geonode';
    } else if (urlObj.hostname.includes('brightdata.com') || urlObj.hostname.includes('luminati.io')) {
      return 'brightdata';
    }
    
    // 然后检查proxyType参数
    const proxyTypeParam = urlObj.searchParams.get('proxyType');
    
    if (proxyTypeParam === 'socks5') {
      logger.warn('⚠️ 检测到SOCKS5代理请求', {
        compatibility: 'Playwright不支持SOCKS5认证',
        solution: '建议使用 socks5-proxy-helper.js 进行协议转换'
      });
      return 'socks5';
    } else if (proxyTypeParam === 'socks4') {
      return 'socks4';
    } else if (proxyTypeParam === 'https') {
      return 'https';
    }
  } catch (error) {
    logger.warn('无法解析代理URL获取类型，使用默认http');
  }
  return 'http';
}

/**
 * 从URL中提取代理提供商信息
 */
export function extractProxyProvider(proxyUrl: string): 'iprocket' | 'geonode' | 'brightdata' | 'unknown' {
  try {
    const urlObj = new URL(proxyUrl);
    
    if (urlObj.hostname.includes('iprocket.io')) {
      return 'iprocket';
    } else if (urlObj.hostname.includes('geonode.com')) {
      return 'geonode';
    } else if (urlObj.hostname.includes('brightdata.com') || urlObj.hostname.includes('luminati.io')) {
      return 'brightdata';
    }
  } catch (error) {
    // 忽略错误
  }
  return 'unknown';
}

/**
 * 获取代理URL验证建议
 */
export function getProxyValidationSuggestions(proxyUrl: string): string[] {
  const suggestions: string[] = [];
  
  // 检查常见的代理服务提供商
  const providers = [
    { name: 'IPRocket', pattern: /iprocket/i, url: 'https://api.iprocket.io/api' },
    { name: 'GeoNode', pattern: /geonode/i, url: 'https://proxylist.geonode.com/api/proxy-list' },
    { name: 'BrightData', pattern: /brightdata/i, url: 'https://brightdata.com/api' },
    { name: 'Oxylabs', pattern: /oxylabs/i, url: 'https://oxylabs.io/api' }
  ];
  
  if (!providers.some(p => p.pattern.test(proxyUrl))) {
    suggestions.push('建议使用知名代理服务提供商: IPRocket, GeoNode, BrightData, Oxylabs');
  }
  
    
  return suggestions;
}

/**
 * 验证代理URL并返回详细报告
 */
export function validateProxyUrlWithReport(proxyUrl: string): {
  isValid: boolean;
  error?: string;
  details?: any;
  suggestions: string[];
  confidence: 'low' | 'medium' | 'high';
} {
  const basicValidation = validateProxyUrl(proxyUrl);
  const suggestions = getProxyValidationSuggestions(proxyUrl);
  
  let confidence: 'low' | 'medium' | 'high' = 'medium';
  
  if (basicValidation.isValid && basicValidation.details) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }
  
  return {
    ...basicValidation,
    suggestions,
    confidence
  };
}

// 代理使用记录映射（用于智能复用策略）
const proxyUsageMap = new Map<string, { lastUsed: number; useCount: number }>();

/**
 * 检测SOCKS5代理兼容性问题并提供解决方案
 */
export function checkSOCKS5Compatibility(proxy: ProxyConfig): {
  isCompatible: boolean;
  issues: string[];
  solutions: string[];
  severity: 'low' | 'medium' | 'high';
} {
  const issues: string[] = [];
  const solutions: string[] = [];
  let severity: 'low' | 'medium' | 'high' = 'low';
  
  if (proxy.protocol === 'socks5') {
    if (proxy.username && proxy.password) {
      issues.push('Playwright不支持SOCKS5代理认证');
      solutions.push('使用 socks5-proxy-helper.js 工具进行协议转换');
      solutions.push('切换到HTTP/HTTPS代理');
      solutions.push('配置SOCKS5代理允许无认证访问');
      severity = 'high';
    } else {
      issues.push('无认证SOCKS5代理可能不稳定');
      solutions.push('建议使用HTTP代理以获得更好的兼容性');
      solutions.push('确保SOCKS5代理服务器正常运行');
      severity = 'medium';
    }
  }
  
  return {
    isCompatible: proxy.protocol !== 'socks5' || (!proxy.username && !proxy.password),
    issues,
    solutions,
    severity
  };
}

/**
 * 生成SOCKS5代理转换命令
 */
export function generateSOCKS5ConversionCommand(proxy: ProxyConfig): string | null {
  if (proxy.protocol !== 'socks5' || !proxy.username || !proxy.password) {
    return null as any;
  }
  
  const envVars = [
    `SOCKS_HOST=${proxy.host}`,
    `SOCKS_PORT=${proxy.port}`,
    `SOCKS_USERNAME=${proxy.username}`,
    `SOCKS_PASSWORD=${proxy.password}`,
    'HTTP_PROXY_PORT=8888'
  ].join(' ');
  
  return `${envVars} node socks5-proxy-helper.js`;
}

/**
 * 解析多个代理响应（用于ips=n参数）
 * 支持多种多代理格式：换行分隔、逗号分隔等
 */
/**
 * 代理去重函数 - 使用Session感知的去重键
 * 避免错误地将不同Session或凭据的代理视为重复
 */
function deduplicateProxies(proxies: ProxyConfig[]): ProxyConfig[] {
  const uniqueProxies = new Map<string, ProxyConfig>();
  
  for (const proxy of proxies) {
    // 使用Session感知的去重键
    const key = getProxyCacheKey(proxy);
    if (!uniqueProxies.has(key)) {
      uniqueProxies.set(key, proxy);
    }
  }
  
  const deduplicated = Array.from(uniqueProxies.values());
  if (deduplicated.length !== proxies.length) {
    logger.info(`代理去重完成 (Session感知): ${proxies.length} -> ${deduplicated.length}`);
  }
  
  return deduplicated;
}

export function parseMultipleProxiesResponse(
  responseText: string,
  proxyType: 'http' | 'https' | 'socks4' | 'socks5' = 'http',
  provider?: string
): ProxyConfig[] {
  const text = responseText.trim();
  const proxies: ProxyConfig[] = [];
  
  try {
    
    logger.info('开始解析多个代理响应:', {
      textLength: text.length,
      proxyType,
      preview: text.substring(0, 200)
    });
    
    // 检测HTML响应并提取代理信息
    if (text.startsWith('<') || text.toLowerCase().includes('<html') || text.toLowerCase().includes('<!doctype') || text.includes('<pre')) {
      logger.info('检测到HTML响应，尝试提取多个代理信息');
      
      // 从<pre>标签中提取
      const preMatch = text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      if (preMatch) {
        const preContent = preMatch[1].trim();
        const extractedProxies = parseMultipleProxiesResponse(preContent, proxyType, provider);
        if (extractedProxies.length > 0) {
          logger.info(`从HTML中成功提取${extractedProxies.length}个代理`);
          proxies.push(...extractedProxies);
        }
      }
      
      // 直接从HTML中查找多个IP:PORT模式
      const ipPortPattern = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})(?::([^:]+)(?::([^:]+))?)?/g;
      const matches = [...text.matchAll(ipPortPattern)];
      
      if (matches.length > 0) {
        for (const match of matches) {
          const proxyConfig: ProxyConfig = {
            host: match[1],
            port: parseInt(match[2]),
            username: match[3],
            password: match[4],
            protocol: proxyType,
            provider
          };
          
          // 验证代理配置
          if (validateProxyConfig(proxyConfig)) {
            proxies.push(proxyConfig);
          }
        }
        
        logger.info(`使用正则表达式从HTML中提取${proxies.length}个代理`);
      }
    }
    
    // 检测JSON格式（如proxylist.geonode）
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const json = JSON.parse(text);
        
        // 处理proxylist.geonode格式
        if (json.data && Array.isArray(json.data)) {
          for (const proxy of json.data) {
            if (proxy.ip && proxy.port) {
              const proxyConfig: ProxyConfig = {
                host: proxy.ip,
                port: parseInt(proxy.port),
                username: proxy.username,
                password: proxy.password,
                protocol: proxyType,
                provider
              };
              
              if (validateProxyConfig(proxyConfig)) {
                proxies.push(proxyConfig);
              }
            }
          }
          
          logger.info(`从JSON格式中解析${proxies.length}个代理`);
        }
      } catch (jsonError) {
        logger.debug('JSON解析失败，尝试其他格式');
      }
    }
    
    // 尝试按行分割
    const lines = text.split(/[\r\n]+/).filter(line => line.trim());
    if (lines.length > 1) {
      logger.info(`检测到${lines.length}行文本，尝试逐行解析`);
      
      for (const line of lines) {
        const proxy = parseProxyResponse(line.trim(), proxyType, provider);
        if (proxy) {
          proxies.push(proxy);
        }
      }
      
      if (proxies.length > 0) {
        logger.info(`按行解析成功，获得${proxies.length}个代理`);
      }
    }
    
    // 尝试按逗号分割
    if (text.includes(',')) {
      const parts = text.split(',').filter(part => part.trim());
      if (parts.length > 1) {
        logger.info(`检测到${parts.length}个逗号分隔的部分，尝试逐个解析`);
        
        for (const part of parts) {
          const proxy = parseProxyResponse(part.trim(), proxyType, provider);
          if (proxy) {
            proxies.push(proxy);
          }
        }
        
        if (proxies.length > 0) {
          logger.info(`按逗号解析成功，获得${proxies.length}个代理`);
        }
      }
    }
    
    // 如果以上方法都失败，且没有解析到任何代理，才尝试作为单个代理解析
    if (proxies.length === 0) {
      const singleProxy = parseProxyResponse(text, proxyType, provider);
      if (singleProxy) {
        logger.info('作为单个代理解析成功');
        proxies.push(singleProxy);
      }
    }
    
  } catch (error) {
    logger.error('解析多个代理响应异常:', new EnhancedError('解析多个代理响应异常', { 
      error: error instanceof Error ? error.message : String(error) 
    }));
    return [];
  }
  
  // 如果没有解析到任何代理，返回空数组
  if (proxies.length === 0) {
    logger.warn('无法解析多个代理响应');
    return [];
  }
  
  // 对解析结果进行去重
  return deduplicateProxies(proxies);
}

/**
 * 智能复用分配策略（带冷却时间）
 * 记录每个代理的使用情况，避免短时间内重复使用
 */
export function assignProxyWithCooling(
  proxyPool: ProxyConfig[],
  currentIndex: number,
  minInterval: number = 5000 // 默认5秒冷却时间
): ProxyConfig | undefined {
  if (!proxyPool || proxyPool.length === 0) {
    return undefined;
  }
  
  const now = Date.now();
  let bestProxy: ProxyConfig | undefined;
  let bestIndex = -1;
  let longestIdle = 0;
  
  // 寻找冷却时间最长的代理
  for (let i = 0; i < proxyPool.length; i++) {
    const proxy = proxyPool[i];
    const proxyKey = `${proxy.host}:${proxy.port}`;
    const usage = proxyUsageMap.get(proxyKey);
    
    if (!usage || (now - usage.lastUsed) >= minInterval) {
      // 如果代理未使用过或已冷却，优先选择
      bestProxy = proxy;
      bestIndex = i;
      break;
    } else {
      // 记录最久未使用的代理（作为备选）
      const idleTime = now - usage.lastUsed;
      if (idleTime > longestIdle) {
        longestIdle = idleTime;
        bestProxy = proxy;
        bestIndex = i;
      }
    }
  }
  
  if (bestProxy) {
    // 更新使用记录
    const proxyKey = `${bestProxy.host}:${bestProxy.port}`;
    const usage = proxyUsageMap.get(proxyKey) || { lastUsed: 0, useCount: 0 };
    usage.lastUsed = now;
    usage.useCount++;
    proxyUsageMap.set(proxyKey, usage);
    
    // 检查SOCKS5兼容性
    const compatibility = checkSOCKS5Compatibility(bestProxy);
    if (!compatibility.isCompatible && compatibility.severity === 'high') {
      logger.warn(`代理兼容性问题：`, {
        proxy: getProxyDisplayName(bestProxy),
        issues: compatibility.issues,
        solutions: compatibility.solutions
      });
    }
    
    logger.debug(`智能复用分配（冷却）：访问${currentIndex + 1}使用代理${bestIndex + 1}/${proxyPool.length}，空闲${longestIdle}ms`);
  }
  
  return bestProxy;
}

/**
 * 测试代理连接可用性
 * 使用 Node.js 的 https 模块通过代理进行实际连接测试
 */
export async function testProxyConnection(proxy: ProxyConfig): Promise<{
  success: boolean;
  responseTime: number;
  error?: string;
  details?: any;
}> {
  const startTime = Date.now();
  
  try {
    logger.info(`开始验证代理连接: ${getProxyDisplayName(proxy)}`, {
      sessionId: proxy.sessionId || null
    });
    
    // 首先验证代理配置格式
    const isValidConfig = validateProxyConfig(proxy);
    if (!isValidConfig) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: 'Invalid proxy configuration format'
      };
    }
    
    // 创建测试请求
    const testUrl = new URL('http://httpbin.org/ip');
    const options: any = {
      hostname: proxy.host,
      port: proxy.port,
      path: testUrl.href,
      method: 'GET',
      timeout: 10000,
      headers: {
        'Host': testUrl.host,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Connection': 'close'
      }
    };
    
    // 如果需要认证，添加 Proxy-Authorization 头
    if (proxy.username && proxy.password) {
      const auth = Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64');
      options.headers['Proxy-Authorization'] = `Basic ${auth}`;
    }
    
    // 使用 HTTP 模块进行代理连接测试
    const http = require('http');
    
    return new Promise((resolve) => {
      const req = http.request(options, (res: any) => {
        let data = '';
        
        res.on('data', (chunk: any) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          
          if (res.statusCode === 200) {
            try {
              const result = JSON.parse(data);
              logger.info(`代理验证成功: ${getProxyDisplayName(proxy)}`, {
                responseTime,
                actualIP: result.origin,
                statusCode: res.statusCode,
                sessionId: proxy.sessionId || null
              });
              
              resolve({
                success: true,
                responseTime,
                details: {
                  actualIP: result.origin,
                  statusCode: res.statusCode
                }
              });
            } catch (parseError) {
              logger.warn(`代理响应解析失败: ${getProxyDisplayName(proxy)}`, {
                responseTime,
                data: data.substring(0, 100),
                sessionId: proxy.sessionId || null
              });
              
              resolve({
                success: true,
                responseTime,
                details: {
                  actualIP: 'response_received',
                  statusCode: res.statusCode,
                  note: 'Response received but JSON parsing failed'
                }
              });
            }
          } else {
            logger.warn(`代理返回错误状态: ${getProxyDisplayName(proxy)}`, {
              responseTime,
              statusCode: res.statusCode,
              statusMessage: res.statusMessage,
              sessionId: proxy.sessionId || null
            });
            
            resolve({
              success: false,
              responseTime,
              error: `HTTP ${res.statusCode}: ${res.statusMessage}`
            });
          }
        });
      });
      
      req.on('error', (error: any) => {
        const responseTime = Date.now() - startTime;
        logger.warn(`代理连接失败: ${getProxyDisplayName(proxy)}`, {
          error: error.message,
          responseTime,
          sessionId: proxy.sessionId || null
        });
        
        resolve({
          success: false,
          responseTime,
          error: error.message
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        logger.warn(`代理连接超时: ${getProxyDisplayName(proxy)}`, {
          sessionId: proxy.sessionId || null
        });
        resolve({
          success: false,
          responseTime: 10000,
          error: 'Connection timeout'
        });
      });
      
      req.setTimeout(10000);
      req.end();
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.warn(`代理验证异常: ${getProxyDisplayName(proxy)}`, {
      error: errorMessage,
      responseTime,
      sessionId: proxy.sessionId || null
    });
    
    return {
      success: false,
      responseTime,
      error: errorMessage
    };
  }
}

/**
 * 批量测试代理连接
 * 并发验证多个代理的可用性
 */
export async function testMultipleProxyConnections(
  proxies: ProxyConfig[],
  options?: {
    concurrency?: number;
    timeout?: number;
  }
): Promise<Array<{
  proxy: ProxyConfig;
  result: Awaited<ReturnType<typeof testProxyConnection>>;
}>> {
  const concurrency = options?.concurrency || 3;
  const timeout = options?.timeout || 15000;
  
  logger.info(`开始批量验证 ${proxies.length} 个代理`, { concurrency, timeout });
  
  const results: Array<{
    proxy: ProxyConfig;
    result: Awaited<ReturnType<typeof testProxyConnection>>;
  }> = [];
  
  // 使用并发控制进行批量验证
  const chunks: ProxyConfig[][] = [];
  for (let i = 0; i < proxies.length; i += concurrency) {
    chunks.push(proxies.slice(i, i + concurrency));
  }
  
  for (const chunk of chunks) {
    const promises = chunk?.filter(Boolean)?.map(async (proxy) => {
      const result = await testProxyConnection(proxy);
      return { proxy, result };
    });
    
    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults);
  }
  
  // 统计结果
  const successCount = results.filter(r => r.result.success).length;
  const avgResponseTime = results.reduce((sum, r) => sum + r.result.responseTime, 0) / results.length;
  
  logger.info('批量代理验证完成', {
    total: proxies.length,
    success: successCount,
    failed: proxies.length - successCount,
    successRate: `${((successCount / proxies.length) * 100).toFixed(1)}%`,
    avgResponseTime: `${avgResponseTime.toFixed(0)}ms`
  });
  
  return results;
}