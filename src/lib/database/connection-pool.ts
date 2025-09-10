import { PrismaClient } from '@prisma/client';

/**
 * 数据库连接池配置
 * 针对高并发场景优化
 */

const DEFAULT_POOL_CONFIG = {
  // 连接池大小
  poolSize: process.env.NODE_ENV === 'production' ? 20 : 10,
  
  // 最小连接数
  poolMin: process.env.NODE_ENV === 'production' ? 5 : 2,
  
  // 最大连接数
  poolMax: process.env.NODE_ENV === 'production' ? 30 : 15,
  
  // 获取连接超时时间（毫秒）
  poolAcquireTimeoutMs: 30000,
  
  // 连接空闲超时时间（毫秒）
  poolIdleTimeoutMs: 300000, // 5分钟
  
  // 连接最大生命周期（毫秒）
  poolMaxLifetimeMs: 3600000, // 1小时
  
  // 连接健康检查间隔（毫秒）
  healthCheckIntervalMs: 30000, // 30秒
  
  // 查询超时时间（毫秒）
  queryTimeoutMs: 30000,
  
  // 事务超时时间（毫秒）
  transactionTimeoutMs: 60000
};

/**
 * 读写分离配置
 */
const READ_REPLICA_CONFIG = {
  // 读副本配置（如果有的话）
  readReplicas: process.env.DATABASE_READ_REPLICAS?.split(',') || [],
  
  // 读操作权重（主库 vs 副本）
  readWeight: {
    primary: 0.3, // 30%读操作走主库
    replica: 0.7  // 70%读操作走副本
  },
  
  // 副本选择策略
  replicaSelectionStrategy: 'round-robin' // round-robin | random | least-connections
};

/**
 * 创建优化的Prisma客户端
 */
export function createOptimizedPrismaClient(options?: {
  poolSize?: number;
  readReplicas?: string[];
  enableMetrics?: boolean;
}) {
  const poolConfig = {
    ...DEFAULT_POOL_CONFIG,
    ...options
  };

  const connectionParams = {
    // 连接字符串参数
    connection_limit: poolConfig.poolMax,
    pool_timeout: poolConfig.poolAcquireTimeoutMs / 1000,
    statement_timeout: poolConfig.queryTimeoutMs,
    idle_in_transaction_session_timeout: poolConfig.transactionTimeoutMs / 1000,
    
    // SSL配置（生产环境必需）
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
    
    // 应用名称（便于监控）
    application_name: 'url-batch-checker',
    
    // 连接参数
    connect_timeout: 10,
    
    // TCP keepalive
    tcp_keepalives_idle: 120,
    tcp_keepalives_interval: 30,
    tcp_keepalives_count: 10
  };

  // 创建主库客户端
  const primaryClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
    datasources: {
      db: {
        url: `${process.env.DATABASE_URL}${Object.entries(connectionParams)
          .map(([key, value]) => `&${key}=${value}`)
          .join('')}`
      }
    }
  });

  // 创建读副本客户端（如果配置了）
  const replicaClients: PrismaClient[] = [];
  if (READ_REPLICA_CONFIG.readReplicas.length > 0) {
    READ_REPLICA_CONFIG.readReplicas.forEach((replicaUrl, index) => {
      const replicaClient = new PrismaClient({
        log: ['warn', 'error'],
        datasources: {
          db: {
            url: `${replicaUrl}${Object.entries(connectionParams)
              .map(([key, value]) => `&${key}=${value}`)
              .join('')}`
          }
        }
      });
      replicaClients.push(replicaClient);
    });
  }

  let currentReplicaIndex = 0;

  /**
   * 获取读操作客户端
   */
  function getReadClient(): PrismaClient {
    if (replicaClients.length === 0) {
      return primaryClient;
    }

    // 根据权重决定使用主库还是副本
    const usePrimary = Math.random() < READ_REPLICA_CONFIG.readWeight.primary;
    if (usePrimary) {
      return primaryClient;
    }

    // 选择副本
    switch (READ_REPLICA_CONFIG.replicaSelectionStrategy) {
      case 'round-robin':
        currentReplicaIndex = (currentReplicaIndex + 1) % replicaClients.length;
        return replicaClients[currentReplicaIndex];
      case 'random':
        return replicaClients[Math.floor(Math.random() * replicaClients.length)];
      case 'least-connections':
        // 简化版：轮询
        currentReplicaIndex = (currentReplicaIndex + 1) % replicaClients.length;
        return replicaClients[currentReplicaIndex];
      default:
        return replicaClients[0];
    }
  }

  /**
   * 监控连接池状态
   */
  async function getPoolStats(): Promise<{
    primary: {
      config: typeof poolConfig;
      status: string;
    };
    replicas: Array<{
      id: number;
      config: typeof poolConfig;
      status: string;
    }>;
  }> {
    // 注意：Prisma不直接暴露连接池统计
    // 这里返回配置信息
    return {
      primary: {
        config: poolConfig,
        status: 'active'
      },
      replicas: replicaClients.map((_, index) => ({
        id: index,
        config: poolConfig,
        status: 'active'
      }))
    };
  }

  return {
    primary: primaryClient,
    read: getReadClient(),
    replicas: replicaClients,
    getStats: getPoolStats,
    
    /**
     * 健康检查
     */
    async healthCheck(): Promise<{
      primary: string;
      replicas: Array<{
        id: number;
        status: string;
      }>;
    }> {
      try {
        await primaryClient.$queryRaw`SELECT 1`;
        const replicaChecks = await Promise.allSettled(
          replicaClients.map(client => client.$queryRaw`SELECT 1`)
        );
        
        return {
          primary: 'healthy',
          replicas: replicaChecks.map((result, index) => ({
            id: index,
            status: result.status === 'fulfilled' ? 'healthy' : 'unhealthy'
          }))
        };
      } catch (error) {
        return {
          primary: 'unhealthy',
          replicas: replicaClients.map((_, index) => ({
            id: index,
            status: 'unknown'
          }))
        };
      }
    },
    
    /**
     * 关闭所有连接
     */
    async disconnect() {
      await Promise.all([
        primaryClient.$disconnect(),
        ...replicaClients.map(client => client.$disconnect())
      ]);
    }
  };
}

/**
 * 全局数据库连接实例
 */
export const dbPool = createOptimizedPrismaClient();

/**
 * 中间件：查询性能监控
 */
export function withQueryMonitoring<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    slowQueryThreshold?: number; // 慢查询阈值（毫秒）
    enableLogging?: boolean;
  } = {}
): T {
  const { slowQueryThreshold = 1000, enableLogging = true } = options;
  
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now();
    
    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      
      if (duration > slowQueryThreshold) {
        console.warn(`Slow query detected: ${fn.name} took ${duration}ms`);
      }
      
      if (enableLogging) {
        console.log(`Query ${fn.name} executed in ${duration}ms`);
      }
      
      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      console.error(`Query ${fn.name} failed after ${duration}ms:`, error);
      throw error;
    }
  }) as T;
}

/**
 * 批量操作优化器
 */
export class BatchOperationOptimizer {
  /**
   * 批量插入优化
   */
  static async batchInsert<T>(
    model: { createMany: (args: { data: T[]; skipDuplicates?: boolean }) => Promise<any>; upsert: (args: { where: any; create: T; update: T }) => Promise<any> },
    data: T[],
    options: {
      batchSize?: number;
      conflictStrategy?: 'ignore' | 'update' | 'error';
      uniqueFields?: (keyof T)[];
    } = {}
  ) {
    const { batchSize = 1000, conflictStrategy = 'error', uniqueFields = [] } = options;
    
    const results: any[] = [];
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      try {
        let result;
        
        switch (conflictStrategy) {
          case 'ignore':
            result = await model.createMany({
              data: batch,
              skipDuplicates: true
            });
            break;
          case 'update':
            // 使用upsert处理冲突
            const upsertPromises = batch.map(item => {
              const where = uniqueFields.reduce((acc, field) => {
                acc[field as string] = item[field];
                return acc;
              }, {} as Record<string, any>);
              
              return model.upsert({
                where,
                create: item,
                update: item
              });
            });
            result = await Promise.all(upsertPromises);
            break;
          default:
            result = await model.createMany({
              data: batch
            });
        }
        
        results.push(result);
      } catch (error) {
        console.error(`Batch insert failed at offset ${i}:`, error);
        throw error;
      }
    }
    
    return results;
  }
  
  /**
   * 批量更新优化
   */
  static async batchUpdate<T>(
    model: { update: (args: { where: any; data: Partial<T> }) => Promise<T> },
    updates: Array<{
      where: any;
      data: Partial<T>;
    }>,
    options: {
      batchSize?: number;
    } = {}
  ) {
    const { batchSize = 500 } = options;
    
    const results: T[] = [];
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      const updatePromises = batch.map(({ where, data }) =>
        model.update({ where, data })
      );
      
      const batchResult = await Promise.all(updatePromises);
      results.push(...batchResult);
    }
    
    return results;
  }
}