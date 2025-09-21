/**
 * Service Dependency Manager
 * 服务依赖管理器，解决循环依赖问题
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('ServiceDependencyManager');

// 服务生命周期状态
export enum ServiceLifecycle {
  CREATED = 'created',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

// 服务元数据
export interface ServiceMetadata {
  name: string;
  version: string;
  description: string;
  dependencies: string[];
  lifecycle: ServiceLifecycle;
  priority: number;
  isOptional: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// 服务实例
export interface ServiceInstance {
  metadata: ServiceMetadata;
  instance: any;
  initialize?: () => Promise<void>;
  start?: () => Promise<void>;
  stop?: () => Promise<void>;
  destroy?: () => Promise<void>;
}

// 服务注册选项
export interface ServiceRegistrationOptions {
  name: string;
  version?: string;
  description?: string;
  dependencies?: string[];
  priority?: number;
  isOptional?: boolean;
  tags?: string[];
  factory: () => any | Promise<any>;
  initialize?: (instance: any) => Promise<void>;
  start?: (instance: any) => Promise<void>;
  stop?: (instance: any) => Promise<void>;
  destroy?: (instance: any) => Promise<void>;
}

// 服务依赖图
export interface DependencyGraph {
  nodes: Map<string, ServiceMetadata>;
  edges: Map<string, Set<string>>;
  reverseEdges: Map<string, Set<string>>;
}

// 服务管理器配置
export interface ServiceManagerConfig {
  // 是否启用循环依赖检测
  enableCircularDependencyDetection: boolean;
  
  // 是否启用并行初始化
  enableParallelInitialization: boolean;
  
  // 初始化超时时间
  initializationTimeout: number;
  
  // 启动超时时间
  startupTimeout: number;
  
  // 停止超时时间
  shutdownTimeout: number;
  
  // 是否启用自动重试
  enableAutoRetry: boolean;
  
  // 最大重试次数
  maxRetries: number;
  
  // 重试延迟
  retryDelay: number;
}

// 默认配置
const DEFAULT_MANAGER_CONFIG: ServiceManagerConfig = {
  enableCircularDependencyDetection: true,
  enableParallelInitialization: true,
  initializationTimeout: 30000,
  startupTimeout: 60000,
  shutdownTimeout: 30000,
  enableAutoRetry: true,
  maxRetries: 3,
  retryDelay: 1000
};

// 服务依赖管理器类
export class ServiceDependencyManager {
  private config: ServiceManagerConfig;
  private services: Map<string, ServiceInstance> = new Map();
  private dependencyGraph: DependencyGraph;
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private initializationPromises: Map<string, Promise<any>> = new Map();

  constructor(config: Partial<ServiceManagerConfig> = {}) {
    this.config = { ...DEFAULT_MANAGER_CONFIG, ...config };
    this.dependencyGraph = {
      nodes: new Map(),
      edges: new Map(),
      reverseEdges: new Map()
    };
    
    logger.info('服务依赖管理器初始化', { config: this.config });
  }

  /**
   * 注册服务
   */
  async registerService(options: ServiceRegistrationOptions): Promise<void> {
    try {
      // 检查服务是否已注册
      if (this.services.has(options.name)) {
        throw new EnhancedError(`服务 ${options.name} 已注册`, {
          code: 'SERVICE_ALREADY_REGISTERED'
        });
      }

      // 创建服务元数据
      const metadata: ServiceMetadata = {
        name: options.name,
        version: options.version || '1.0.0',
        description: options.description || '',
        dependencies: options.dependencies || [],
        lifecycle: ServiceLifecycle.CREATED,
        priority: options.priority || 0,
        isOptional: options.isOptional || false,
        tags: options.tags || [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 检查循环依赖
      if (this.config.enableCircularDependencyDetection) {
        this.checkCircularDependencies(options.name, metadata.dependencies);
      }

      // 更新依赖图
      this.updateDependencyGraph(metadata);

      // 创建服务实例
      const instance = await options.factory();
      
      const serviceInstance: ServiceInstance = {
        metadata,
        instance,
        initialize: options.initialize ? () => options.initialize!(instance) : undefined,
        start: options.start ? () => options.start!(instance) : undefined,
        stop: options.stop ? () => options.stop!(instance) : undefined,
        destroy: options.destroy ? () => options.destroy!(instance) : undefined
      };

      this.services.set(options.name, serviceInstance);
      
      logger.info('服务注册成功', {
        name: options.name,
        version: metadata.version,
        dependencies: metadata.dependencies,
        priority: metadata.priority
      });

    } catch (error) {
      logger.error('服务注册失败', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : String(error),
        serviceName: options.name
      });
      throw error;
    }
  }

  /**
   * 初始化所有服务
   */
  async initializeServices(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('服务已经初始化');
      return;
    }

    try {
      logger.info('开始初始化服务');
      
      // 按优先级排序
      const sortedServices = this.getSortedServices();
      
      if (this.config.enableParallelInitialization) {
        // 并行初始化
        await this.initializeServicesParallel(sortedServices);
      } else {
        // 串行初始化
        await this.initializeServicesSerial(sortedServices);
      }
      
      this.isInitialized = true;
      logger.info('服务初始化完成');
      
    } catch (error) {
      logger.error('服务初始化失败', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 启动所有服务
   */
  async startServices(): Promise<void> {
    if (this.isRunning) {
      logger.warn('服务已经启动');
      return;
    }

    try {
      logger.info('开始启动服务');
      
      const sortedServices = this.getSortedServices();
      
      for (const service of sortedServices) {
        await this.startService(service.name);
      }
      
      this.isRunning = true;
      logger.info('服务启动完成');
      
    } catch (error) {
      logger.error('服务启动失败', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 停止所有服务
   */
  async stopServices(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('服务未运行');
      return;
    }

    try {
      logger.info('开始停止服务');
      
      // 按相反顺序停止服务
      const sortedServices = this.getSortedServices().reverse();
      
      for (const service of sortedServices) {
        await this.stopService(service.name);
      }
      
      this.isRunning = false;
      logger.info('服务停止完成');
      
    } catch (error) {
      logger.error('服务停止失败', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 销毁所有服务
   */
  async destroyServices(): Promise<void> {
    try {
      logger.info('开始销毁服务');
      
      // 按相反顺序销毁服务
      const sortedServices = this.getSortedServices().reverse();
      
      for (const service of sortedServices) {
        await this.destroyService(service.name);
      }
      
      this.services.clear();
      this.dependencyGraph.nodes.clear();
      this.dependencyGraph.edges.clear();
      this.dependencyGraph.reverseEdges.clear();
      this.initializationPromises.clear();
      
      this.isInitialized = false;
      this.isRunning = false;
      
      logger.info('服务销毁完成');
      
    } catch (error) {
      logger.error('服务销毁失败', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 获取服务实例
   */
  getService<T = any>(name: string): T | null {
    const service = this.services.get(name);
    return service ? service.instance as T : null;
  }

  /**
   * 检查服务是否存在
   */
  hasService(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * 获取服务元数据
   */
  getServiceMetadata(name: string): ServiceMetadata | null {
    const service = this.services.get(name);
    return service ? service.metadata : null;
  }

  /**
   * 获取所有服务状态
   */
  getAllServicesStatus(): any {
    const services: any[] = [];
    
    for (const [name, service] of this.services) {
      services.push({
        name,
        metadata: service.metadata,
        hasInstance: service.instance !== null,
        hasInitialize: service.initialize !== undefined,
        hasStart: service.start !== undefined,
        hasStop: service.stop !== undefined,
        hasDestroy: service.destroy !== undefined
      });
    }
    
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      serviceCount: this.services.size,
      services
    };
  }

  /**
   * 获取依赖图
   */
  getDependencyGraph(): DependencyGraph {
    return {
      nodes: new Map(this.dependencyGraph.nodes),
      edges: new Map(this.dependencyGraph.edges),
      reverseEdges: new Map(this.dependencyGraph.reverseEdges)
    };
  }

  /**
   * 检查循环依赖
   */
  private checkCircularDependencies(serviceName: string, dependencies: string[]): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (node: string): boolean => {
      if (recursionStack.has(node)) {
        return true;
      }
      
      if (visited.has(node)) {
        return false;
      }
      
      visited.add(node);
      recursionStack.add(node);
      
      const neighbors = this.dependencyGraph.edges.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) {
          return true;
        }
      }
      
      recursionStack.delete(node);
      return false;
    };
    
    // 临时添加边进行检查
    this.dependencyGraph.edges.set(serviceName, new Set(dependencies));
    
    try {
      if (hasCycle(serviceName)) {
        throw new EnhancedError(`检测到循环依赖涉及服务 ${serviceName}`, {
          code: 'CIRCULAR_DEPENDENCY_DETECTED',
          details: { serviceName, dependencies }
        });
      }
    } finally {
      // 移除临时边
      this.dependencyGraph.edges.delete(serviceName);
    }
  }

  /**
   * 更新依赖图
   */
  private updateDependencyGraph(metadata: ServiceMetadata): void {
    // 添加节点
    this.dependencyGraph.nodes.set(metadata.name, metadata);
    
    // 添加边
    this.dependencyGraph.edges.set(metadata.name, new Set(metadata.dependencies));
    
    // 添加反向边
    for (const dep of metadata.dependencies) {
      if (!this.dependencyGraph.reverseEdges.has(dep)) {
        this.dependencyGraph.reverseEdges.set(dep, new Set());
      }
      this.dependencyGraph.reverseEdges.get(dep)!.add(metadata.name);
    }
  }

  /**
   * 获取排序后的服务列表
   */
  private getSortedServices(): ServiceMetadata[] {
    const services = Array.from(this.services.values())?.filter(Boolean)?.map((s: any) => s.metadata);
    
    // 拓扑排序
    const sorted: ServiceMetadata[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (serviceName: string): void => {
      if (visited.has(serviceName)) {
        return;
      }
      
      if (visiting.has(serviceName)) {
        throw new EnhancedError(`检测到循环依赖: ${serviceName}`, {
          code: 'CIRCULAR_DEPENDENCY_DETECTED'
        });
      }
      
      visiting.add(serviceName);
      
      const service = this.services.get(serviceName);
      if (service) {
        for (const dep of service.metadata.dependencies) {
          visit(dep);
        }
      }
      
      visiting.delete(serviceName);
      visited.add(serviceName);
      
      if (service) {
        sorted.push(service.metadata);
      }
    };
    
    // 按优先级分组
    const priorityGroups = new Map<number, string[]>();
    for (const service of services) {
      if (!priorityGroups.has(service.priority)) {
        priorityGroups.set(service.priority, []);
      }
      priorityGroups.get(service.priority)!.push(service.name);
    }
    
    // 按优先级从高到低访问
    const sortedPriorities = Array.from(priorityGroups.keys()).sort((a, b) => b - a);
    for (const priority of sortedPriorities) {
      const serviceNames = priorityGroups.get(priority)!;
      for (const serviceName of serviceNames) {
        visit(serviceName);
      }
    }
    
    return sorted;
  }

  /**
   * 串行初始化服务
   */
  private async initializeServicesSerial(sortedServices: ServiceMetadata[]): Promise<void> {
    for (const metadata of sortedServices) {
      await this.initializeService(metadata.name);
    }
  }

  /**
   * 并行初始化服务
   */
  private async initializeServicesParallel(sortedServices: ServiceMetadata[]): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const metadata of sortedServices) {
      promises.push(this.initializeService(metadata.name));
    }
    
    await Promise.all(promises);
  }

  /**
   * 初始化单个服务
   */
  private async initializeService(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new EnhancedError(`服务 ${serviceName} 不存在`, {
        code: 'SERVICE_NOT_FOUND'
      });
    }

    if (service.metadata.lifecycle === ServiceLifecycle.INITIALIZED) {
      return;
    }

    if (service.metadata.lifecycle === ServiceLifecycle.INITIALIZING) {
      // 如果已经在初始化中，等待初始化完成
      const promise = this.initializationPromises.get(serviceName);
      if (promise) {
        await promise;
        return;
      }
    }

    // 设置初始化状态
    service.metadata.lifecycle = ServiceLifecycle.INITIALIZING;
    service.metadata.updatedAt = new Date();

    const initializationPromise = this.performServiceInitialization(service);
    this.initializationPromises.set(serviceName, initializationPromise);

    try {
      await initializationPromise;
    } finally {
      this.initializationPromises.delete(serviceName);
    }
  }

  /**
   * 执行服务初始化
   */
  private async performServiceInitialization(service: ServiceInstance): Promise<void> {
    const maxRetries = this.config.enableAutoRetry ? this.config.maxRetries : 0;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        // 初始化依赖
        for (const depName of service.metadata.dependencies) {
          await this.initializeService(depName);
        }

        // 调用初始化方法
        if (service.initialize) {
          await this.withTimeout(
            service.initialize(),
            this.config.initializationTimeout,
            `服务 ${service.metadata.name} 初始化超时`
          );
        }

        // 更新状态
        service.metadata.lifecycle = ServiceLifecycle.INITIALIZED;
        service.metadata.updatedAt = new Date();

        logger.info('服务初始化完成', {
          name: service.metadata.name,
          attempt,
          duration: Date.now() - service.metadata.updatedAt.getTime()
        });

        return;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt <= maxRetries) {
          logger.warn('服务初始化失败，准备重试', {
            name: service.metadata.name,
            attempt,
            maxRetries,
            error: lastError.message
          });
          
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }

    // 初始化失败
    service.metadata.lifecycle = ServiceLifecycle.ERROR;
    service.metadata.updatedAt = new Date();

    if (service.metadata.isOptional) {
      logger.warn('可选服务初始化失败', {
        name: service.metadata.name,
        error: lastError?.message || '未知错误'
      });
    } else {
      throw new EnhancedError(`服务 ${service.metadata.name} 初始化失败`, {
        code: 'SERVICE_INITIALIZATION_FAILED',
        details: { error: lastError?.message || '未知错误' }
      });
    }
  }

  /**
   * 启动单个服务
   */
  private async startService(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new EnhancedError(`服务 ${serviceName} 不存在`, {
        code: 'SERVICE_NOT_FOUND'
      });
    }

    if (service.metadata.lifecycle === ServiceLifecycle.RUNNING) {
      return;
    }

    try {
      service.metadata.lifecycle = ServiceLifecycle.STARTING;
      service.metadata.updatedAt = new Date();

      if (service.start) {
        await this.withTimeout(
          service.start(),
          this.config.startupTimeout,
          `服务 ${service.metadata.name} 启动超时`
        );
      }

      service.metadata.lifecycle = ServiceLifecycle.RUNNING;
      service.metadata.updatedAt = new Date();

      logger.info('服务启动完成', {
        name: service.metadata.name
      });

    } catch (error) {
      service.metadata.lifecycle = ServiceLifecycle.ERROR;
      service.metadata.updatedAt = new Date();

      throw new EnhancedError(`服务 ${service.metadata.name} 启动失败`, {
        code: 'SERVICE_STARTUP_FAILED',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  /**
   * 停止单个服务
   */
  private async stopService(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      return;
    }

    if (service.metadata.lifecycle !== ServiceLifecycle.RUNNING) {
      return;
    }

    try {
      service.metadata.lifecycle = ServiceLifecycle.STOPPING;
      service.metadata.updatedAt = new Date();

      if (service.stop) {
        await this.withTimeout(
          service.stop(),
          this.config.shutdownTimeout,
          `服务 ${service.metadata.name} 停止超时`
        );
      }

      service.metadata.lifecycle = ServiceLifecycle.STOPPED;
      service.metadata.updatedAt = new Date();

      logger.info('服务停止完成', {
        name: service.metadata.name
      });

    } catch (error) {
      service.metadata.lifecycle = ServiceLifecycle.ERROR;
      service.metadata.updatedAt = new Date();

      logger.error('服务停止失败', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : String(error),
        serviceName
      });
    }
  }

  /**
   * 销毁单个服务
   */
  private async destroyService(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      return;
    }

    try {
      if (service.destroy) {
        await this.withTimeout(
          service.destroy(),
          this.config.shutdownTimeout,
          `服务 ${service.metadata.name} 销毁超时`
        );
      }

      logger.info('服务销毁完成', {
        name: service.metadata.name
      });

    } catch (error) {
      logger.error('服务销毁失败', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : String(error),
        serviceName
      });
    }
  }

  /**
   * 带超时的执行
   */
  private async withTimeout<T>(promise: Promise<T>, timeout: number, errorMessage: string): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }
}

// 创建全局实例
let serviceManagerInstance: ServiceDependencyManager | null = null;

export function getServiceManager(): ServiceDependencyManager {
  if (!serviceManagerInstance) {
    serviceManagerInstance = new ServiceDependencyManager();
  }
  return serviceManagerInstance;
}

export function createServiceManager(config?: Partial<ServiceManagerConfig>): ServiceDependencyManager {
  return new ServiceDependencyManager(config);
}