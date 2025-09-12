/**
 * 代理缓存服务
 * 提供代理IP缓存和验证功能，避免重复的代理验证调用
 */

import { createLogger } from "@/lib/utils/security/secure-logger";
import { ProxyConfig as BaseProxyConfig } from "@/lib/utils/proxy-utils";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('ProxyCacheService');

// 代理缓存项接口
interface ProxyCacheItem {
  proxy: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    protocol?: 'http' | 'https' | 'socks4' | 'socks5';
  };
  proxyUrl: string;
  validatedAt: number;
  expiresAt: number;
  success: boolean;
  error?: string;
}

// 代理配置接口
export interface ProxyConfig extends Omit<BaseProxyConfig, 'protocol'> {
  // Extended properties specific to proxy cache service
  protocol?: 'http' | 'https' | 'socks4' | 'socks5';
}

export class ProxyCacheService {
  private static instance: ProxyCacheService;
  private cache: Map<string, ProxyCacheItem> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  // 缓存配置
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  private readonly MAX_CACHE_SIZE = 50; // 最大缓存数量
  private readonly CLEANUP_INTERVAL = 2 * 60 * 1000; // 2分钟清理一次

  private constructor() {
    this.startCleanupTimer();
  }

  static getInstance(): ProxyCacheService {
    if (!ProxyCacheService.instance) {
      ProxyCacheService.instance = new ProxyCacheService();
    }
    return ProxyCacheService.instance;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(proxyUrl: string): string {
    // 简化URL，移除时间戳等动态参数
    const urlObj = new URL(proxyUrl);
    urlObj.searchParams.delete('timestamp');
    urlObj.searchParams.delete('_t');
    urlObj.searchParams.delete('cache');
    return urlObj.toString();
  }

  /**
   * 检查缓存中是否有有效的代理
   */
  hasValidProxy(proxyUrl: string): boolean {
    const cacheKey = this.generateCacheKey(proxyUrl);
    const cached = this.cache.get(cacheKey);
    
    if (!cached) {
      return false;
    }

    // 检查是否过期
    if (Date.now() > cached.expiresAt) {
      logger.debug('代理缓存已过期:', { proxyUrl, cacheKey });
      this.cache.delete(cacheKey);
      return false;
    }

    // 检查是否验证成功
    if (!cached.success) {
      logger.debug('代理验证失败，跳过缓存:', { proxyUrl, error: cached.error });
      return false;
    }

    logger.debug('使用缓存的代理:', { proxyUrl, cacheKey, proxy: cached.proxy });
    return true;
  }

  /**
   * 从缓存获取代理
   */
  getCachedProxy(proxyUrl: string): ProxyConfig | null {
    const cacheKey = this.generateCacheKey(proxyUrl);
    const cached = this.cache.get(cacheKey);
    
    if (!cached || !this.hasValidProxy(proxyUrl)) {
      return null as any;
    }

    return cached.proxy;
  }

  /**
   * 缓存代理结果
   */
  cacheProxy(
    proxyUrl: string, 
    proxy: ProxyConfig | null, 
    success: boolean, 
    error?: string
  ): void {
    const cacheKey = this.generateCacheKey(proxyUrl);
    
    // 如果缓存已满，清理最旧的项
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanupExpired();
    }

    const cacheItem: ProxyCacheItem = {
      proxy: proxy || {
        host: '',
        port: 0,
        protocol: 'http'
      },
      proxyUrl,
      validatedAt: Date.now(),
      expiresAt: Date.now() + this.CACHE_TTL,
      success,
      error
    };

    this.cache.set(cacheKey, cacheItem);
    
    logger.info('代理已缓存:', {
      proxyUrl,
      cacheKey,
      success,
      proxy: proxy ? `${proxy.host}:${proxy.port}` : 'null',
      expiresAt: new Date(cacheItem.expiresAt).toISOString()
    });
  }

  /**
   * 批量预加载代理
   */
  async preloadProxies(proxyUrls: string[]): Promise<void> {
    logger.info('开始预加载代理:', { count: proxyUrls.length });
    
    const promises = proxyUrls?.filter(url => url)?.map(async (proxyUrl) => {
      if (this.hasValidProxy(proxyUrl)) {
        return; // 跳过已缓存的代理
      }

      try {
        const proxy = await this.fetchProxyWithValidation(proxyUrl);
        if (proxy) {
          this.cacheProxy(proxyUrl, proxy, true);
        } else {
          this.cacheProxy(proxyUrl, null, false, '预加载失败');
        }
      } catch (error) {
        this.cacheProxy(proxyUrl, null, false, error instanceof Error ? error.message : String(error));
      }
    });

    await Promise.allSettled(promises);
    logger.info('代理预加载完成');
  }

  /**
   * 获取代理并验证（带缓存）
   */
  async getProxyWithCache(proxyUrl: string): Promise<ProxyConfig | null> {
    // 首先检查缓存
    if (this.hasValidProxy(proxyUrl)) {
      const cached = this.getCachedProxy(proxyUrl);
      if (cached) {
        logger.debug('使用缓存的代理配置:', { proxyUrl, proxy: cached });
        return cached;
      }
    }

    // 缓存未命中，获取新代理
    logger.debug('缓存未命中，获取新代理:', { proxyUrl });
    try {
      const proxy = await this.fetchProxyWithValidation(proxyUrl);
      this.cacheProxy(proxyUrl, proxy, proxy !== null);
      return proxy;
    } catch (error) {
      this.cacheProxy(proxyUrl, null, false, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 获取代理并验证（实际实现）
   */
  private async fetchProxyWithValidation(proxyUrl: string): Promise<ProxyConfig | null> {
    try {
      logger.info('获取新代理:', { proxyUrl });
      
      // 从URL参数中提取代理类型
      let proxyType: 'http' | 'https' | 'socks4' | 'socks5' = 'http';
      try {
        const urlObj = new URL(proxyUrl);
        const proxyTypeParam = urlObj.searchParams.get('proxyType');
        if (proxyTypeParam === 'socks5') {
          proxyType = 'socks5';
        } else if (proxyTypeParam === 'socks4') {
          proxyType = 'socks4';
        } else if (proxyTypeParam === 'https') {
          proxyType = 'https';
        }
      } catch (error) {
        logger.warn('无法解析代理URL获取类型，使用默认http');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
      
      const response = await fetch(proxyUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        },
        redirect: 'manual'
      });
      
      clearTimeout(timeoutId);

      if (response.status === 200) {
        const proxyText = await response.text();
        const proxyConfig = this.parseProxyResponse(proxyText, proxyType);
        
        if (proxyConfig) {
          logger.info('代理获取成功:', proxyConfig);
          return proxyConfig;
        } else {
          logger.warn('代理格式解析失败:', { responseText: proxyText.substring(0, 100) });
          return null as any;
        }
      } else {
        logger.warn('代理请求失败:', { 
          status: response.status, 
          statusText: response.statusText 
        });
        return null as any;
      }
    } catch (error) {
      logger.error('获取代理失败:', new EnhancedError('获取代理失败:', {  
        proxyUrl, 
        error: error instanceof Error ? error.message : String(error) 
       }));
      return null as any;
    }
  }

  /**
   * 解析代理响应
   */
  private parseProxyResponse(responseText: string, proxyType: 'http' | 'https' | 'socks4' | 'socks5' = 'http'): ProxyConfig | null {
    try {
      const text = responseText.trim();
      
      // 尝试解析JSON格式
      if (text.startsWith('{') || text.startsWith('[')) {
        try {
          const json = JSON.parse(text);
          
          if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            const proxy = json.data[0];
            if (proxy.ip && proxy.port) {
              return {
                host: proxy.ip,
                port: parseInt(proxy.port),
                protocol: proxyType
              };
            }
          }
          
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
      
      // 格式1: 139.162.174.182:9595:username:password
      if (text.includes(':')) {
        const parts = text.split(':');
        if (parts.length >= 2) {
          const result = {
            host: parts[0],
            port: parseInt(parts[1]),
            username: parts.length > 2 ? parts[2] : undefined,
            password: parts.length > 3 ? parts[3] : undefined,
            protocol: proxyType
          };
          
          if (!result.host || isNaN(result.port) || result.port < 1 || result.port > 65535) {
            return null as any;
          }
          
          if (result.username && result.username.includes('-res-')) {
            result.username = result.username.split('-res-')[0];
          }
          
          return result;
        }
      }
      
      // 格式2: 139.162.174.182:9595
      const match = text.match(/^(\d+\.\d+\.\d+\.\d+):(\d+)$/);
      if (match) {
        return {
          host: match[1],
          port: parseInt(match[2]),
          protocol: proxyType
        };
      }
      
      return null as any;
    } catch (error) {
      logger.error('解析代理响应异常:', new EnhancedError('解析代理响应异常:', { error: error instanceof Error ? error.message : String(error)  }));
      return null as any;
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.cache.delete(key);
    }
    
    if (expiredKeys.length > 0) {
      logger.debug('清理过期代理缓存:', { count: expiredKeys.length });
    }
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    if (typeof window === 'undefined') {
      // 只在服务端执行
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpired();
      }, this.CLEANUP_INTERVAL);
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): { total: number; valid: number; expired: number; hitRate: number } {
    const now = Date.now();
    let valid = 0;
    let expired = 0;
    
    for (const item of this.cache.values()) {
      if (now > item.expiresAt) {
        expired++;
      } else if (item.success) {
        valid++;
      }
    }
    
    return {
      total: this.cache.size,
      valid,
      expired,
      hitRate: this.cache.size > 0 ? valid / this.cache.size : 0
    };
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('代理缓存已清空');
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clearCache();
  }
}

// 导出单例实例
export const proxyCacheService = ProxyCacheService.getInstance();