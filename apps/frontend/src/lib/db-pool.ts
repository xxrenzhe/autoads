// Removed Prisma types; frontend does not manage DB pool anymore.
import { createLogger } from './utils/security/secure-logger'
import { prisma as sharedPrisma } from './db'

const logger = createLogger('DatabasePool');

// 连接池配置
interface PoolConfig {
  maxConnections?: number;
  minConnections?: number;
  idleTimeoutMillis?: number;
  acquireTimeoutMillis?: number;
  reapIntervalMillis?: number;
}

// 连接池统计
interface PoolStats {
  total: number;
  active: number;
  idle: number;
  waiting: number;
  max: number;
}

// Prisma连接池包装器
export class PrismaConnectionPool {
  private prisma: any;
  private config: Required<PoolConfig>;
  private stats: PoolStats;
  private connectionTimeout: NodeJS.Timeout | null = null;

  constructor(config: PoolConfig = {}) {
    this.config = {
      maxConnections: config.maxConnections || 20,
      minConnections: config.minConnections || 2,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      acquireTimeoutMillis: config.acquireTimeoutMillis || 10000,
      reapIntervalMillis: config.reapIntervalMillis || 1000
    };

    this.stats = {
      total: 0,
      active: 0,
      idle: 0,
      waiting: 0,
      max: this.config.maxConnections
    };

    // 使用全局单例 Prisma 客户端，避免重复创建连接
    this.prisma = sharedPrisma as any

    // 监听查询事件（仅开发环境详细记录）
    try {
      (this.prisma as any).$on?.('query', (e: any) => {
        this.stats.active++;
        if (process.env.NODE_ENV !== 'production') {
          logger.debug('Database query', {
            query: e.query,
            params: e.params,
            duration: e.duration,
            active: this.stats.active
          });
        }
      });
    } catch {}

    // 启动定期清理
    this.startReaper();
  }

  // 获取Prisma客户端实例
  get client(): any {
    return this.prisma;
  }

  // 执行带监控的查询
  async executeQuery<T>(
    operation: string,
    fn: (prisma: any) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      this.stats.active++;
      const result = await fn(this.prisma);
      const duration = Date.now() - startTime;
      
      // 记录慢查询
      if (duration > 1000) {
        logger.warn('Slow database query', { operation, duration });
      }
      
      return result;
    } catch (error) {
      logger.error('Database query failed', { 
        operation, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    } finally {
      this.stats.active--;
    }
  }

  // 事务执行
  async executeTransaction<T>(
    fn: (prisma: any) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      this.stats.active++;
      const result = await this.prisma.$transaction(fn as any);
      const duration = Date.now() - startTime;
      
      logger.info('Database transaction completed', { duration });
      return result as T;
    } catch (error) {
      logger.error('Database transaction failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    } finally {
      this.stats.active--;
    }
  }

  // 批量操作
  async executeBatch<T>(
    operations: Array<(prisma: any) => Promise<T>>
  ): Promise<T[]> {
    const startTime = Date.now();
    
    try {
      this.stats.active += operations.length;
      const results = await Promise.all(
        operations.map((op: any) => op(this.prisma))
      );
      const duration = Date.now() - startTime;
      
      logger.info('Database batch operations completed', { 
        count: operations.length, 
        duration 
      });
      
      return results;
    } catch (error) {
      logger.error('Database batch operations failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    } finally {
      this.stats.active -= operations.length;
    }
  }

  // 获取连接池统计
  getStats(): PoolStats {
    // 获取实际的连接统计
    const poolStats = (this.prisma as any)._engine?.pool;
    
    if (poolStats) {
      return {
        total: poolStats.numOpen() || 0,
        active: poolStats.numUsed() || 0,
        idle: poolStats.numFree() || 0,
        waiting: poolStats.numPendingAcquires() || 0,
        max: this.config.maxConnections
      };
    }
    
    return { ...this.stats };
  }

  // 健康检查
  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed', error);
      return false;
    }
  }

  // 启动连接清理器
  private startReaper(): void {
    this.connectionTimeout = setInterval(() => {
      const stats = this.getStats();
      
      // 记录连接池状态
      logger.debug('Connection pool stats', stats);
      
      // 检查连接泄漏
      if (stats.active > this.config.maxConnections * 0.8) {
        logger.warn('High connection usage detected', stats);
      }
      
    }, this.config.reapIntervalMillis);
  }

  // 关闭连接池
  async close(): Promise<void> {
    if (this.connectionTimeout) {
      clearInterval(this.connectionTimeout);
    }
    // 统一由全局 prisma 管理连接生命周期
    try { await this.prisma.$disconnect(); } catch {}
    logger.info('Database connection pool closed');
  }
}

// 全局连接池实例
export const dbPool = new PrismaConnectionPool({
  maxConnections: 20,
  minConnections: 2,
  idleTimeoutMillis: 30000,
  acquireTimeoutMillis: 10000
});

// 便捷的查询执行器
export async function dbQuery<T>(
  operation: string,
  fn: (prisma: any) => Promise<T>
): Promise<T> {
  return dbPool.executeQuery(operation, fn);
}

// 便捷的事务执行器
export async function dbTransaction<T>(
  fn: (prisma: any) => Promise<T>
): Promise<T> {
  return dbPool.executeTransaction(fn);
}
