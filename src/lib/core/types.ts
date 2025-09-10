/**
 * Core Application Architecture Types
 * 核心应用架构类型定义
 */

/**
 * Service Status Type
 * 服务状态类型
 */
export type ServiceStatus = 'active' | 'inactive' | 'error' | 'pending';

/**
 * Service Configuration Interface
 * 服务配置接口
 */
export interface ServiceConfig {
  id: string;
  name: string;
  status: ServiceStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  version?: string;
  enabled?: boolean;
  dependencies?: string[];
  config?: Record<string, any>;
}

/**
 * Service Lifecycle Interface
 * 服务生命周期接口
 */
export interface IServiceLifecycle {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  destroy(): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
}

/**
 * Health Status Interface
 * 健康状态接口
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  details?: Record<string, any>;
  timestamp: string;
  uptime: number;
}

/**
 * Service Registry Interface
 * 服务注册接口
 */
export interface IServiceRegistry {
  register<T extends IServiceLifecycle>(name: string, service: T): void;
  get<T extends IServiceLifecycle>(name: string): T | undefined;
  has(name: string): boolean;
  remove(name: string): boolean;
  getAll(): Map<string, IServiceLifecycle>;
  clear(): void;
}

/**
 * Event Bus Interface
 * 事件总线接口
 */
export interface IEventBus {
  publish<T>(event: DomainEvent<T>): Promise<void>;
  subscribe<T>(eventType: string, handler: EventHandler<T>): void;
  unsubscribe<T>(eventType: string, handler: EventHandler<T>): void;
  unsubscribeAll(eventType: string): void;
}

/**
 * Domain Event Interface
 * 领域事件接口
 */
export interface DomainEvent<T = any> {
  id: string;
  type: string;
  timestamp: string;
  version: number;
  data: T;
  metadata?: Record<string, any>;
}

/**
 * Event Handler Interface
 * 事件处理器接口
 */
export interface EventHandler<T = any> {
  (event: DomainEvent<T>): Promise<void> | void;
}

/**
 * Event Middleware Interface
 * 事件中间件接口
 */
export interface EventMiddleware {
  (event: DomainEvent, next: () => Promise<void>): Promise<void>;
}

/**
 * Event Result Interface
 * 事件结果接口
 */
export interface EventResult {
  success: boolean;
  error?: Error;
  metadata?: Record<string, any>;
}

/**
 * Query Interface
 * 查询接口
 */
export interface IQuery<T = any> {
  execute(): Promise<T>;
}

/**
 * Command Interface
 * 命令接口
 */
export interface ICommand<T = any> {
  execute(): Promise<T>;
}

/**
 * Result Interface
 * 结果接口
 */
export interface Result<T = any, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
  metadata?: Record<string, any>;
}

/**
 * Repository Interface
 * 仓库接口
 */
export interface IRepository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findAll(options?: QueryOptions): Promise<T[]>;
  create(entity: Omit<T, 'id'>): Promise<T>;
  update(id: ID, entity: Partial<T>): Promise<T>;
  delete(id: ID): Promise<boolean>;
}

/**
 * Query Options Interface
 * 查询选项接口
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  filter?: Record<string, any>;
}

/**
 * Unit of Work Interface
 * 工作单元接口
 */
export interface IUnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isDisposed: boolean;
}

/**
 * Logger Interface
 * 日志接口
 */
export interface ILogger {
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, error?: Error, meta?: Record<string, any>): void;
}

/**
 * Metrics Interface
 * 指标接口
 */
export interface IMetrics {
  increment(name: string, value?: number, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  timing(name: string, value: number, tags?: Record<string, string>): void;
  histogram(name: string, value: number, tags?: Record<string, string>): void;
}

/**
 * Cache Interface
 * 缓存接口
 */
export interface ICache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * Configuration Interface
 * 配置接口
 */
export interface IConfiguration {
  get<T>(key: string, defaultValue?: T): T;
  set<T>(key: string, value: T): void;
  has(key: string): boolean;
  reload(): Promise<void>;
}

/**
 * Service Dependency Interface
 * 服务依赖接口
 */
export interface ServiceDependency {
  name: string;
  required: boolean;
  version?: string;
}

/**
 * Service Registration Interface
 * 服务注册接口
 */
export interface ServiceRegistration {
  service: IServiceLifecycle;
  dependencies: ServiceDependency[];
  status: 'registered' | 'initializing' | 'running' | 'stopped' | 'error';
  health: HealthStatus;
  startTime?: Date;
  error?: Error;
}