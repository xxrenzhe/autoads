/**
 * 优化的Redis客户端
 * 优先使用外部Redis集群，内存优化，性能提升
 */

import Redis from 'ioredis';
import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('OptimizedRedisClient');

interface RedisConnectionConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  tls?: boolean;
  cluster?: boolean;
  clusterNodes?: string[];
}

interface RedisClientOptions {
  keyPrefix?: string;
  connectTimeout?: number;
  commandTimeout?: number;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
  keepAlive?: number;
  maxMemoryPolicy?: string;
}

class OptimizedRedisClient {
  // 使用 any 以避免在不同 ioredis 类型定义下的 Cluster 类型冲突
  private client: any = null;
  private fallbackClient: any = null;
  private isConnected = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private config: RedisConnectionConfig;
  private options: RedisClientOptions;

  constructor() {
    this.config = this.parseRedisConfig();
    this.options = this.getOptimizedOptions();
    this.initializeClient();
  }

  /**
   * 解析Redis配置，优先使用REDIS_URL环境变量
   */
  private parseRedisConfig(): RedisConnectionConfig {
    const redisUrl = process.env.REDIS_URL;
    
    if (redisUrl) {
      logger.info('使用REDIS_URL配置外部Redis集群');
      
      try {
        // 检查是否为集群配置
        if (redisUrl.includes(',')) {
          // 集群模式：redis://host1:port1,redis://host2:port2
          const nodes = redisUrl.split(',').map((url: any) => {
            const parsed = new URL(url.trim());
            return `${parsed.hostname}:${parsed.port || 6379}`;
          });
          
          logger.info('检测到Redis集群配置', { nodeCount: nodes.length });
          
          return {
            cluster: true,
            clusterNodes: nodes,
            password: new URL(redisUrl.split(',')[0]).password || undefined,
            db: parseInt(new URL(redisUrl.split(',')[0]).pathname.slice(1)) || 0
          };
        } else {
          // 单节点模式
          const url = new URL(redisUrl);
          
          return {
            url: redisUrl,
            host: url.hostname,
            port: parseInt(url.port) || (url.protocol === 'rediss:' ? 6380 : 6379),
            password: url.password || undefined,
            db: parseInt(url.pathname.slice(1)) || 0,
            tls: url.protocol === 'rediss:'
          };
        }
      } catch (error) {
        logger.error('解析REDIS_URL失败，使用fallback', error instanceof Error ? error : new Error(String(error)));
        return {};
      }
    }

    // 回退到单独的环境变量
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0')
    };
  }

  /**
   * 获取优化的Redis选项
   */
  private getOptimizedOptions(): RedisClientOptions {
    return {
      keyPrefix: 'urlchecker:',
      connectTimeout: 10000,
      commandTimeout: 5000,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      lazyConnect: true,
      keepAlive: 30000, // 30秒保活
      maxMemoryPolicy: 'allkeys-lru' // LRU内存策略
    };
  }

  /**
   * 初始化Redis客户端
   */
  private async initializeClient(): Promise<void> {
    try {
      if (this.config.cluster && this.config.clusterNodes) {
        // 集群模式
        logger.info('初始化Redis集群客户端', { 
          nodeCount: this.config.clusterNodes.length 
        });
        
        this.client = new Redis.Cluster(
          this.config.clusterNodes.map((node: any) => {
            const [host, port] = node.split(':');
            return { host, port: parseInt(port) };
          }),
          {
            redisOptions: {
              password: this.config.password,
              db: this.config.db,
              ...this.options
            },
            enableOfflineQueue: false,
            maxRedirections: 3,
            retryDelayOnFailover: 100
          }
        );
      } else if (this.config.url || this.config.host) {
        // 单节点模式
        logger.info('初始化Redis单节点客户端', { 
          host: this.config.host,
          port: this.config.port,
          tls: this.config.tls
        });
        
        const clientConfig: any = {
          ...this.config,
          ...this.options,
          retryStrategy: this.getRetryStrategy()
        };

        if (this.config.tls) {
          clientConfig.tls = {};
        }

        this.client = new Redis(clientConfig);
      } else {
        logger.warn('未配置Redis，使用内存fallback');
        this.initializeFallbackClient();
        return;
      }

      this.setupEventHandlers();
      
      // 尝试连接
      await this.testConnection();
      
    } catch (error) {
      logger.error('Redis客户端初始化失败', error instanceof Error ? error : new Error(String(error)));
      this.initializeFallbackClient();
    }
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      logger.info('Redis连接成功');
      this.isConnected = true;
      this.connectionAttempts = 0;
      
      // 清除重连定时器
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    });

    this.client.on('ready', () => {
      logger.info('Redis客户端就绪');
      this.optimizeRedisSettings();
    });

    this.client.on('error', (error: Error) => {
      const errorWithAttempts = new Error(error.message);
      (errorWithAttempts as any).attempts = this.connectionAttempts;
      logger.error('Redis连接错误', errorWithAttempts);
      this.isConnected = false;
      this.scheduleReconnect();
    });

    this.client.on('close', () => {
      logger.warn('Redis连接关闭');
      this.isConnected = false;
      this.scheduleReconnect();
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis重连中...');
    });
  }

  /**
   * 优化Redis设置
   */
  private async optimizeRedisSettings(): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      // 设置内存优化配置
      await this.client.config('SET', 'maxmemory-policy', 'allkeys-lru');
      await this.client.config('SET', 'timeout', '300'); // 5分钟超时
      await this.client.config('SET', 'tcp-keepalive', '60'); // TCP保活
      
      logger.info('Redis优化设置已应用');
    } catch (error) {
      logger.warn('应用Redis优化设置失败', { 
        message: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * 重试策略
   */
  private getRetryStrategy() {
    return (times: number) => {
      if (times > this.maxConnectionAttempts) {
        logger.error('Redis重连次数超限，切换到fallback');
        this.initializeFallbackClient();
        return null;
      }
      
      const delay = Math.min(Math.exp(times) * 100, 5000);
      logger.info(`Redis重连延迟: ${delay}ms (第${times}次)`);
      return delay;
    };
  }

  /**
   * 调度重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.connectionAttempts >= this.maxConnectionAttempts) {
      return;
    }

    this.connectionAttempts++;
    const delay = Math.min(Math.exp(this.connectionAttempts) * 1000, 30000);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isConnected) {
        logger.info('尝试重新连接Redis...');
        this.initializeClient();
      }
    }, delay);
  }

  /**
   * 测试连接
   */
  private async testConnection(): Promise<void> {
    if (!this.client) throw new Error('Redis客户端未初始化');

    try {
      const result = await this.client.ping();
      if (result === 'PONG') {
        logger.info('Redis连接测试成功');
        this.isConnected = true;
      } else {
        throw new Error('Redis ping响应异常');
      }
    } catch (error) {
      logger.error('Redis连接测试失败', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 初始化fallback客户端（内存缓存）
   */
  private initializeFallbackClient(): void {
    logger.info('初始化内存fallback客户端');
    
    const memoryStore = new Map<string, { value: any; expiry?: number }>();
    
    this.fallbackClient = {
      // 基础操作
      get: async (key: string) => {
        const item = memoryStore.get(key);
        if (!item) return null;
        
        if (item.expiry && Date.now() > item.expiry) {
          memoryStore.delete(key);
          return null;
        }
        
        return item.value;
      },
      
      set: async (key: string, value: any, mode?: string, duration?: number) => {
        const expiry = duration ? Date.now() + duration * 1000 : undefined;
        memoryStore.set(key, { value, expiry });
        return 'OK';
      },
      
      setex: async (key: string, seconds: number, value: any) => {
        const expiry = Date.now() + seconds * 1000;
        memoryStore.set(key, { value, expiry });
        return 'OK';
      },
      
      del: async (...keys: string[]) => {
        let deleted = 0;
        keys.forEach((key: any) => {
          if (memoryStore.delete(key)) deleted++;
        });
        return deleted;
      },
      
      exists: async (...keys: string[]) => {
        return keys.filter((key: any) => memoryStore.has(key)).length;
      },
      
      expire: async (key: string, seconds: number) => {
        const item = memoryStore.get(key);
        if (!item) return 0;
        
        item.expiry = Date.now() + seconds * 1000;
        return 1;
      },
      
      ttl: async (key: string) => {
        const item = memoryStore.get(key);
        if (!item) return -2;
        if (!item.expiry) return -1;
        
        const remaining = Math.ceil((item.expiry - Date.now()) / 1000);
        return remaining > 0 ? remaining : -2;
      },
      
      // 计数操作
      incr: async (key: string) => {
        const current = parseInt(await this.fallbackClient.get(key) || '0');
        const newValue = current + 1;
        await this.fallbackClient.set(key, newValue.toString());
        return newValue;
      },
      
      decr: async (key: string) => {
        const current = parseInt(await this.fallbackClient.get(key) || '0');
        const newValue = current - 1;
        await this.fallbackClient.set(key, newValue.toString());
        return newValue;
      },
      
      // 哈希操作
      hget: async (key: string, field: string) => {
        const hash = await this.fallbackClient.get(key);
        return hash?.[field] || null;
      },
      
      hset: async (key: string, field: string, value: any) => {
        let hash = await this.fallbackClient.get(key) || {};
        hash[field] = value;
        await this.fallbackClient.set(key, hash);
        return 1;
      },
      
      // 列表操作
      lpush: async (key: string, ...values: any[]) => {
        const list = await this.fallbackClient.get(key) || [];
        list.unshift(...values);
        await this.fallbackClient.set(key, list);
        return list.length;
      },
      
      lrange: async (key: string, start: number, stop: number) => {
        const list = await this.fallbackClient.get(key) || [];
        return list.slice(start, stop === -1 ? undefined : stop + 1);
      },
      
      // 工具方法
      keys: async (pattern: string) => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return Array.from(memoryStore.keys()).filter((key: any) => regex.test(key));
      },
      
      flushall: async () => {
        memoryStore.clear();
        return 'OK';
      },
      
      ping: async () => 'PONG',
      
      info: async () => 'fallback_redis_info',
      
      // 管道操作（简化版）
      pipeline: () => ({
        exec: async () => []
      })
    };
    
    this.isConnected = true; // fallback总是"连接"的
  }

  /**
   * 获取客户端实例
   */
  getClient(): Redis | any {
    return this.client || this.fallbackClient;
  }

  /**
   * 检查连接状态
   */
  isRedisConnected(): boolean {
    return this.isConnected && (this.client?.status === 'ready' || !!this.fallbackClient);
  }

  /**
   * 获取连接信息
   */
  getConnectionInfo(): {
    connected: boolean;
    type: 'redis' | 'cluster' | 'fallback';
    config: any;
  } {
    return {
      connected: this.isConnected,
      type: this.client ? (this.config.cluster ? 'cluster' : 'redis') : 'fallback',
      config: {
        host: this.config.host,
        port: this.config.port,
        cluster: this.config.cluster,
        nodeCount: this.config.clusterNodes?.length
      }
    };
  }

  /**
   * 优雅关闭
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.client) {
      try {
        await this.client.quit();
        logger.info('Redis客户端已断开');
      } catch (error) {
        logger.warn('Redis断开连接时出错', { 
          message: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    this.isConnected = false;
  }
}

// 单例实例
let optimizedRedisClient: OptimizedRedisClient | null = null;

export function getOptimizedRedisClient(): OptimizedRedisClient {
  if (!optimizedRedisClient) {
    optimizedRedisClient = new OptimizedRedisClient();
  }
  return optimizedRedisClient;
}

export { OptimizedRedisClient };
