/**
 * Repository Pattern Interfaces
 * 仓库模式接口
 */

import { IUnitOfWork } from '../core/types';
import { ApplicationError } from '../core/errors/ApplicationError';

/**
 * Base domain entity interface
 * 基础领域实体接口
 */
export interface DomainEntity {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Repository Interface
 * 仓库接口
 */
export interface IRepository<T extends DomainEntity, ID = string> {
  /**
   * Find entity by ID
   * 根据ID查找实体
   */
  findById(id: ID): Promise<T | null>;

  /**
   * Find all entities with options
   * 查找所有实体，支持选项
   */
  findAll(options?: QueryOptions): Promise<T[]>;

  /**
   * Create new entity
   * 创建新实体
   */
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<T>;

  /**
   * Update existing entity
   * 更新现有实体
   */
  update(id: ID, entity: Partial<T>): Promise<T>;

  /**
   * Delete entity by ID
   * 根据ID删除实体
   */
  delete(id: ID): Promise<boolean>;

  /**
   * Check if entity exists
   * 检查实体是否存在
   */
  exists(id: ID): Promise<boolean>;

  /**
   * Count entities matching criteria
   * 统计匹配条件的实体数量
   */
  count(options?: QueryOptions): Promise<number>;
}

/**
 * Query Options
 * 查询选项
 */
export interface QueryOptions {
  /**
   * Maximum number of results to return
   * 返回结果的最大数量
   */
  limit?: number;

  /**
   * Number of results to skip
   * 跳过的结果数量
   */
  offset?: number;

  /**
   * Field to sort by
   * 排序字段
   */
  sort?: string;

  /**
   * Sort direction
   * 排序方向
   */
  order?: 'asc' | 'desc';

  /**
   * Filter criteria
   * 过滤条件
   */
  filter?: Record<string, any>;

  /**
   * Fields to include in projection
   * 包含在投影中的字段
   */
  fields?: string[];

  /**
   * Search criteria
   * 搜索条件
   */
  search?: {
    query: string;
    fields: string[];
  };

  /**
   * Aggregation pipeline
   * 聚合管道
   */
  aggregate?: {
    pipeline: any[];
    groupBy?: string;
  };
}

/**
 * Pagination Options
 * 分页选项
 */
export interface PaginationOptions {
  /**
   * Page number (1-based)
   * 页码（从1开始）
   */
  page: number;

  /**
   * Number of items per page
   * 每页项目数量
   */
  pageSize: number;

  /**
   * Sort field
   * 排序字段
   */
  sortBy?: string;

  /**
   * Sort direction
   * 排序方向
   */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination Result
 * 分页结果
 */
export interface PaginationResult<T> {
  /**
   * Array of items
   * 项目数组
   */
  items: T[];

  /**
   * Total number of items
   * 项目总数
   */
  total: number;

  /**
   * Current page number
   * 当前页码
   */
  page: number;

  /**
   * Number of items per page
   * 每页项目数量
   */
  pageSize: number;

  /**
   * Total number of pages
   * 总页数
   */
  totalPages: number;

  /**
   * Whether there is a next page
   * 是否有下一页
   */
  hasNext: boolean;

  /**
   * Whether there is a previous page
   * 是否有上一页
   */
  hasPrevious: boolean;
}

/**
 * Read-only Repository Interface
 * 只读仓库接口
 */
export interface IReadOnlyRepository<T extends DomainEntity, ID = string> {
  /**
   * Find entity by ID
   * 根据ID查找实体
   */
  findById(id: ID): Promise<T | null>;

  /**
   * Find all entities with options
   * 查找所有实体，支持选项
   */
  findAll(options?: QueryOptions): Promise<T[]>;

  /**
   * Find entities with pagination
   * 分页查找实体
   */
  findPaginated(options: PaginationOptions): Promise<PaginationResult<T>>;

  /**
   * Check if entity exists
   * 检查实体是否存在
   */
  exists(id: ID): Promise<boolean>;

  /**
   * Count entities matching criteria
   * 统计匹配条件的实体数量
   */
  count(options?: QueryOptions): Promise<number>;
}

/**
 * Write-only Repository Interface
 * 只写仓库接口
 */
export interface IWriteOnlyRepository<T extends DomainEntity, ID = string> {
  /**
   * Create new entity
   * 创建新实体
   */
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<T>;

  /**
   * Update existing entity
   * 更新现有实体
   */
  update(id: ID, entity: Partial<T>): Promise<T>;

  /**
   * Delete entity by ID
   * 根据ID删除实体
   */
  delete(id: ID): Promise<boolean>;

  /**
   * Batch create entities
   * 批量创建实体
   */
  createBatch(entities: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'version'>[]): Promise<T[]>;

  /**
   * Batch update entities
   * 批量更新实体
   */
  updateBatch(updates: Array<{ id: ID; entity: Partial<T> }>): Promise<T[]>;

  /**
   * Batch delete entities
   * 批量删除实体
   */
  deleteBatch(ids: ID[]): Promise<number>;
}

/**
 * Cacheable Repository Interface
 * 可缓存仓库接口
 */
export interface ICacheableRepository<T extends DomainEntity, ID = string> extends IRepository<T, ID> {
  /**
   * Find entity by ID with cache
   * 根据ID查找实体，支持缓存
   */
  findByIdWithCache(id: ID, ttl?: number): Promise<T | null>;

  /**
   * Find all entities with cache
   * 查找所有实体，支持缓存
   */
  findAllWithCache(options?: QueryOptions, ttl?: number): Promise<T[]>;

  /**
   * Clear entity cache
   * 清除实体缓存
   */
  clearCache(id: ID): Promise<void>;

  /**
   * Clear all cache for this repository
   * 清除此仓库的所有缓存
   */
  clearAllCache(): Promise<void>;

  /**
   * Warm cache for entities
   * 预热实体缓存
   */
  warmCache(ids: ID[]): Promise<void>;
}

/**
 * Searchable Repository Interface
 * 可搜索仓库接口
 */
export interface ISearchableRepository<T extends DomainEntity, ID = string> extends IRepository<T, ID> {
  /**
   * Search entities
   * 搜索实体
   */
  search(query: SearchQuery): Promise<SearchResult<T>>;

  /**
   * Full-text search
   * 全文搜索
   */
  fullTextSearch(text: string, options?: SearchOptions): Promise<T[]>;

  /**
   * Get search suggestions
   * 获取搜索建议
   */
  getSuggestions(prefix: string, field: string, limit?: number): Promise<string[]>;

  /**
   * Rebuild search index
   * 重建搜索索引
   */
  rebuildIndex(): Promise<void>;
}

/**
 * Search Query
 * 搜索查询
 */
export interface SearchQuery {
  /**
   * Search text
   * 搜索文本
   */
  text?: string;

  /**
   * Field filters
   * 字段过滤器
   */
  filters?: Record<string, any>;

  /**
   * Range filters
   * 范围过滤器
   */
  ranges?: Record<string, { min?: number; max?: number }>;

  /**
   * Date ranges
   * 日期范围
   */
  dateRanges?: Record<string, { start?: string; end?: string }>;

  /**
   * Pagination options
   * 分页选项
   */
  pagination?: PaginationOptions;

  /**
   * Sort options
   * 排序选项
   */
  sort?: Array<{ field: string; order: 'asc' | 'desc' }>;

  /**
   * Facets to return
   * 返回的分面
   */
  facets?: string[];
}

/**
 * Search Result
 * 搜索结果
 */
export interface SearchResult<T> {
  /**
   * Search results
   * 搜索结果
   */
  items: T[];

  /**
   * Total number of results
   * 结果总数
   */
  total: number;

  /**
   * Search time in milliseconds
   * 搜索时间（毫秒）
   */
  searchTime: number;

  /**
   * Facet results
   * 分面结果
   */
  facets?: Record<string, Array<{ value: string; count: number }>>;

  /**
   * Suggestions
   * 建议
   */
  suggestions?: string[];
}

/**
 * Search Options
 * 搜索选项
 */
export interface SearchOptions {
  /**
   * Fields to search in
   * 搜索字段
   */
  fields?: string[];

  /**
   * Fuzzy search threshold
   * 模糊搜索阈值
   */
  fuzzy?: boolean | number;

  /**
   * Maximum results
   * 最大结果数
   */
  limit?: number;

  /**
   * Include highlights
   * 包含高亮
   */
  highlights?: boolean;
}

/**
 * Auditable Repository Interface
 * 可审计仓库接口
 */
export interface IAuditableRepository<T extends DomainEntity, ID = string> extends IRepository<T, ID> {
  /**
   * Get entity history
   * 获取实体历史
   */
  getHistory(id: ID): Promise<EntityHistory[]>;

  /**
   * Get entity version
   * 获取实体版本
   */
  getVersion(id: ID, version: number): Promise<T | null>;

  /**
   * Restore entity to version
   * 恢复实体到指定版本
   */
  restoreVersion(id: ID, version: number): Promise<T>;

  /**
   * Get entity audit log
   * 获取实体审计日志
   */
  getAuditLog(id: ID): Promise<AuditLogEntry[]>;
}

/**
 * Entity History
 * 实体历史
 */
export interface EntityHistory {
  /**
   * Version number
   * 版本号
   */
  version: number;

  /**
   * Entity data at this version
   * 此版本的实体数据
   */
  data: Record<string, any>;

  /**
   * Changed fields
   * 更改的字段
   */
  changedFields: string[];

  /**
   * Timestamp of change
   * 更改时间戳
   */
  timestamp: Date;

  /**
   * User who made the change
   * 进行更改的用户
   */
  changedBy?: string;

  /**
   * Change reason
   * 更改原因
   */
  reason?: string;
}

/**
 * Audit Log Entry
 * 审计日志条目
 */
export interface AuditLogEntry {
  /**
   * Action performed
   * 执行的操作
   */
  action: 'create' | 'update' | 'delete' | 'restore';

  /**
   * Entity ID
   * 实体ID
   */
  entityId: string;

  /**
   * Entity type
   * 实体类型
   */
  entityType: string;

  /**
   * Changes made
   * 所做的更改
   */
  changes: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    fields: string[];
  };

  /**
   * Timestamp of action
   * 操作时间戳
   */
  timestamp: Date;

  /**
   * User who performed the action
   * 执行操作的用户
   */
  userId?: string;

  /**
   * IP address
   * IP地址
   */
  ipAddress?: string;

  /**
   * User agent
   * 用户代理
   */
  userAgent?: string;
}

/**
 * Transactional Repository Interface
 * 事务仓库接口
 */
export interface ITransactionalRepository<T extends DomainEntity, ID = string> extends IRepository<T, ID> {
  /**
   * Execute operation within transaction
   * 在事务中执行操作
   */
  withTransaction<T>(operation: (repository: this) => Promise<T>): Promise<T>;

  /**
   * Begin transaction
   * 开始事务
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit transaction
   * 提交事务
   */
  commitTransaction(): Promise<void>;

  /**
   * Rollback transaction
   * 回滚事务
   */
  rollbackTransaction(): Promise<void>;
}

/**
 * Repository Factory Interface
 * 仓库工厂接口
 */
export interface IRepositoryFactory {
  /**
   * Create repository for entity type
   * 为实体类型创建仓库
   */
  createRepository<T extends DomainEntity, ID = string>(
    entityType: new (...args: any[]) => T,
    options?: RepositoryOptions
  ): IRepository<T, ID>;

  /**
   * Create cacheable repository
   * 创建可缓存仓库
   */
  createCacheableRepository<T extends DomainEntity, ID = string>(
    entityType: new (...args: any[]) => T,
    options?: RepositoryOptions
  ): ICacheableRepository<T, ID>;

  /**
   * Create searchable repository
   * 创建可搜索仓库
   */
  createSearchableRepository<T extends DomainEntity, ID = string>(
    entityType: new (...args: any[]) => T,
    options?: RepositoryOptions
  ): ISearchableRepository<T, ID>;
}

/**
 * Repository Options
 * 仓库选项
 */
export interface RepositoryOptions {
  /**
   * Cache TTL in milliseconds
   * 缓存TTL（毫秒）
   */
  cacheTTL?: number;

  /**
   * Enable caching
   * 启用缓存
   */
  enableCache?: boolean;

  /**
   * Enable search
   * 启用搜索
   */
  enableSearch?: boolean;

  /**
   * Enable audit
   * 启用审计
   */
  enableAudit?: boolean;

  /**
   * Table name (for database repositories)
   * 表名（用于数据库仓库）
   */
  tableName?: string;

  /**
   * Connection string
   * 连接字符串
   */
  connectionString?: string;

  /**
   * Custom configuration
   * 自定义配置
   */
  config?: Record<string, any>;
}

/**
 * Repository Exception
 * 仓库异常
 */
export class RepositoryException extends ApplicationError {
  constructor(
    message: string,
    public readonly repository: string,
    public readonly operation: string,
    public readonly entityId?: string,
    details?: Record<string, any>
  ) {
    super(
      message,
      'REPOSITORY_ERROR',
      500,
      '数据操作失败，请稍后重试',
      {
        repository,
        operation,
        entityId,
        ...details
      }
    );
  }
}

/**
 * Concurrency Exception
 * 并发异常
 */
export class ConcurrencyException extends RepositoryException {
  constructor(
    message: string,
    repository: string,
    entityId: string,
    public readonly currentVersion: number,
    public readonly requestedVersion: number
  ) {
    super(
      message,
      repository,
      'update',
      entityId,
      {
        currentVersion,
        requestedVersion,
        conflict: 'version_mismatch'
      }
    );
  }
}

/**
 * Entity Not Found Exception
 * 实体未找到异常
 */
export class EntityNotFoundException extends RepositoryException {
  constructor(
    repository: string,
    entityId: string,
    public readonly entityType: string
  ) {
    super(
      `Entity not found: ${entityId}`,
      repository,
      'findById',
      entityId,
      {
        entityType
      }
    );
  }
}

/**
 * Repository Decorator Base Class
 * 仓库装饰器基类
 */
export abstract class RepositoryDecorator<T extends DomainEntity, ID = string> 
  implements IRepository<T, ID> {
  
  constructor(protected readonly decorated: IRepository<T, ID>) {}

  abstract findById(id: ID): Promise<T | null>;
  abstract findAll(options?: QueryOptions): Promise<T[]>;
  abstract create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<T>;
  abstract update(id: ID, entity: Partial<T>): Promise<T>;
  abstract delete(id: ID): Promise<boolean>;
  abstract exists(id: ID): Promise<boolean>;
  abstract count(options?: QueryOptions): Promise<number>;
}

/**
 * Caching Repository Decorator
 * 缓存仓库装饰器
 */
export class CachingRepositoryDecorator<T extends DomainEntity, ID = string> 
  extends RepositoryDecorator<T, ID> {
  
  constructor(
    decorated: IRepository<T, ID>,
    private readonly cache: {
      get: (key: string) => Promise<T | null>;
      set: (key: string, value: T, ttl: number) => Promise<void>;
      delete: (key: string) => Promise<void>;
    },
    private readonly ttl: number = 300000
  ) {
    super(decorated);
  }

  async findById(id: ID): Promise<T | null> {
    const cacheKey = this.generateCacheKey(id);
    
    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Fallback to decorated repository
    const entity = await this.decorated.findById(id);
    
    // Cache the result
    if (entity !== null) {
      await this.cache.set(cacheKey, entity, this.ttl);
    }

    return entity;
  }

  async findAll(options?: QueryOptions): Promise<T[]> {
    // For findAll, we don't cache by default as it can be expensive
    return this.decorated.findAll(options);
  }

  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<T> {
    const created = await this.decorated.create(entity);
    
    // No need to cache here as the entity doesn't have an ID yet
    return created;
  }

  async update(id: ID, entity: Partial<T>): Promise<T> {
    const updated = await this.decorated.update(id, entity);
    
    // Clear cache for this entity
    await this.cache.delete(this.generateCacheKey(id));
    
    return updated;
  }

  async delete(id: ID): Promise<boolean> {
    const deleted = await this.decorated.delete(id);
    
    if (deleted) {
      // Clear cache for this entity
      await this.cache.delete(this.generateCacheKey(id));
    }
    
    return deleted;
  }

  async exists(id: ID): Promise<boolean> {
    const cacheKey = this.generateCacheKey(id);
    
    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return true;
    }

    // Fallback to decorated repository
    const exists = await this.decorated.exists(id);
    
    // Cache the result (cache false results too with shorter TTL)
    if (exists) {
      await this.cache.set(cacheKey, { id } as unknown as T, this.ttl);
    }
    // Note: We don't cache null results to avoid type issues

    return exists;
  }

  async count(options?: QueryOptions): Promise<number> {
    // Count queries are expensive, so we cache them
    const cacheKey = this.generateCountCacheKey(options);
    
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return cached as any;
    }

    const count = await this.decorated.count(options);
    await this.cache.set(cacheKey, count as any, this.ttl / 2); // Shorter TTL for counts

    return count;
  }

  private generateCacheKey(id: ID): string {
    return `${this.decorated.constructor.name}:${id}`;
  }

  private generateCountCacheKey(options?: QueryOptions): string {
    return `${this.decorated.constructor.name}:count:${JSON.stringify(options || {})}`;
  }
}