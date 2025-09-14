import Redis from 'ioredis';
import type { Redis as RedisClientType } from 'ioredis';
import { createLogger } from './utils/security/secure-logger';

const logger = createLogger('RedisClient');

// Redis 配置接口
interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  url?: string;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
  enableReadyCheck?: boolean;
  connectTimeout?: number;
  commandTimeout?: number;
  keepAlive?: number;
  family?: number;
}

// 获取 Redis 配置
function getRedisConfig(): RedisConfig {
  // 生产环境配置
  if (process.env.REDIS_URL) {
    return {
      url: process.env.REDIS_URL,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 15000, // 增加连接超时时间
      commandTimeout: 10000, // 增加命令超时时间
      keepAlive: 30000,
      family: 4 // 强制使用 IPv4
    };
  }
  
  // 开发环境配置
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: true,
    connectTimeout: 10000,
    commandTimeout: 5000
  };
}

// 创建 Redis 客户端
let redisClient: RedisClientType | null = null;

export function createRedisClient(): RedisClientType {
  if (redisClient) {
    return redisClient;
  }
  
  const config = getRedisConfig();
  
  try {
    redisClient = new Redis(config);
    
    // 连接事件监听
    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });
    
    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });
    
    redisClient.on('error', (error) => {
      logger.error('Redis client error', error);
    });
    
    redisClient.on('reconnecting', (delay: number) => {
      logger.warn('Redis client reconnecting', { delay });
    });
    
    redisClient.on('end', () => {
      logger.info('Redis client disconnected');
    });
    
    return redisClient;
    
  } catch (error) {
    logger.error('Failed to create Redis client', error);
    throw error;
  }
}

// 获取 Redis 客户端实例
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  
  return redisClient;
}

// 健康检查
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    logger.error('Redis health check failed', error);
    return false;
  }
}

// 关闭 Redis 连接
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Failed to close Redis connection', error);
    }
  }
}

// Redis 操作封装
export class RedisService {
  private client: RedisClientType;
  
  constructor(client?: RedisClientType) {
    this.client = client || getRedisClient();
  }
  
  // 字符串操作
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }
  
  async set(key: string, value: string | number, options?: { EX?: number; PX?: number }): Promise<'OK'> {
    if (options?.EX) {
      return this.client.setex(key, options.EX, value);
    }
    if (options?.PX) {
      await this.client.psetex(key, options.PX, value);
      return 'OK';
    }
    return this.client.set(key, value);
  }
  
  async del(key: string | string[]): Promise<number> {
    if (Array.isArray(key)) {
      return this.client.del(...key);
    }
    return this.client.del(key);
  }
  
  async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }
  
  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  // 兼容 setex 便捷方法
  async setex(key: string, seconds: number, value: string | number): Promise<'OK'> {
    // @ts-ignore underlying client supports setex
    return this.client.setex(key, seconds, value as any);
  }
  
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }
  
  // 哈希操作
  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }
  
  async hset(key: string, field: string, value: string): Promise<number> {
    return this.client.hset(key, field, value);
  }
  
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }
  
  async hdel(key: string, field: string | string[]): Promise<number> {
    if (Array.isArray(field)) {
      return this.client.hdel(key, ...field);
    }
    return this.client.hdel(key, field);
  }
  
  // 列表操作
  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.client.lpush(key, ...values);
  }
  
  async rpush(key: string, ...values: string[]): Promise<number> {
    return this.client.rpush(key, ...values);
  }
  
  async lpop(key: string): Promise<string | null> {
    return this.client.lpop(key);
  }
  
  async rpop(key: string): Promise<string | null> {
    return this.client.rpop(key);
  }
  
  async llen(key: string): Promise<number> {
    return this.client.llen(key);
  }
  
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lrange(key, start, stop);
  }
  
  // 集合操作
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }
  
  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }
  
  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }
  
  async sismember(key: string, member: string): Promise<number> {
    return this.client.sismember(key, member);
  }
  
  // 有序集合操作
  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.client.zadd(key, score, member);
  }
  
  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zrange(key, start, stop);
  }
  
  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zrevrange(key, start, stop);
  }
  
  async zrem(key: string, ...members: string[]): Promise<number> {
    return this.client.zrem(key, ...members);
  }
  
  // 事务
  async multi(): Promise<ReturnType<RedisClientType['multi']>> {
    // Cast is safe as ioredis returns a chainable commander instance
    return this.client.multi() as ReturnType<RedisClientType['multi']>;
  }
  
  async exec(pipeline: ReturnType<RedisClientType['multi']>): Promise<[Error | null, any][]> {
    const result = await pipeline.exec();
    return result || [];
  }
  
  // 发布订阅
  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }
  
  subscribe(channel: string, callback: (message: string) => void): void {
    this.client.subscribe(channel);
    this.client.on('message', (ch: string, message: string) => {
      if (ch === channel) {
        callback(message);
      }
    });
  }
  
  unsubscribe(channel?: string): void {
    if (channel) {
      this.client.unsubscribe(channel);
    }
  }
  
  // 键操作
  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }
  
  async flushdb(): Promise<'OK'> {
    return this.client.flushdb();
  }
  
  async flushall(): Promise<'OK'> {
    return this.client.flushall();
  }
  
  // Lua 脚本
  async eval(script: string, keys: string[], args: string[]): Promise<any> {
    return this.client.eval(script, keys.length, ...keys, ...args);
  }
  
  // 管道
  async pipeline(commands: Array<[string, ...string[]]>): Promise<[Error | null, any][]> {
    const pipeline = this.client.pipeline();
    
    commands.forEach(([command, ...args]: any) => {
      (pipeline as any)[command](...args);
    });
    
    const result = await pipeline.exec();
    return result || [];
  }
}

// 导出单例实例
export const redisService = new RedisService();

// 兼容性导出
export default getRedisClient();
