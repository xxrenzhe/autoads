// 依赖注入容器实现

export interface ServiceContainer {
  // 核心服务
  register<T>(token: string | symbol, factory: () => T): void
  register<T>(token: string | symbol, instance: T): void
  resolve<T>(token: string | symbol): T

  // 单例管理
  registerSingleton<T>(token: string | symbol, factory: () => T): void

  // 作用域管理
  createScope(): ServiceContainer
  dispose(): void
}

class Container implements ServiceContainer {
  private services = new Map<string | symbol, any>()
  private singletons = new Map<string | symbol, any>()
  private factories = new Map<string | symbol, () => any>()
  private parent?: Container

  constructor(parent?: Container) {
    this.parent = parent
  }

  register<T>(token: string | symbol, factoryOrInstance: (() => T) | T): void {
    if (typeof factoryOrInstance === 'function') {
      this.factories.set(token, factoryOrInstance as () => T)
    } else {
      this.services.set(token, factoryOrInstance)
    }
  }

  registerSingleton<T>(token: string | symbol, factory: () => T): void {
    this.factories.set(token, factory)
    // 标记为单例
    this.singletons.set(token, null)
  }

  resolve<T>(token: string | symbol): T {
    // 检查是否已有实例
    if (this.services.has(token)) {
      return this.services.get(token)
    }

    // 检查是否为单例且已创建
    if (this.singletons.has(token) && this.singletons.get(token) !== null) {
      return this.singletons.get(token)
    }

    // 检查是否有工厂函数
    if (this.factories.has(token)) {
      const factory = this.factories.get(token)!
      const instance = factory()

      // 如果是单例，缓存实例
      if (this.singletons.has(token)) {
        this.singletons.set(token, instance)
      }

      return instance
    }

    // 检查父容器
    if (this.parent) {
      return this.parent.resolve<T>(token)
    }

    throw new Error(`Service not found: ${String(token)}`)
  }

  createScope(): ServiceContainer {
    return new Container(this)
  }

  dispose(): void {
    this.services.clear()
    this.singletons.clear()
    this.factories.clear()
  }
}

// 导出Container类供测试使用
export { Container }

// 全局容器实例
export const container = new Container()

// 服务令牌
export const SERVICE_TOKENS = {
  // 数据库服务
  DATABASE_SERVICE: Symbol('DatabaseService'),
  CACHE_SERVICE: Symbol('CacheService'),
  QUEUE_SERVICE: Symbol('QueueService'),

  // 业务服务
  SITERANK_SERVICE: Symbol('SiteRankService'),
  BATCHOPEN_SERVICE: Symbol('BatchOpenService'),
  ADSCENTER_SERVICE: Symbol('AdsCenterService'),

  // 基础设施服务
  LOGGER_SERVICE: Symbol('LoggerService'),
  NOTIFICATION_SERVICE: Symbol('NotificationService'),
  PERMISSION_SERVICE: Symbol('PermissionService'),

  // 外部API客户端
  SIMILARWEB_CLIENT: Symbol('SimilarWebClient'),
  GOOGLE_ADS_CLIENT: Symbol('GoogleAdsClient'),
  ADSPOWER_CLIENT: Symbol('AdsPowerClient'),
} as const

// 装饰器支持
export function Injectable(token?: string | symbol) {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    const serviceToken = token || constructor.name
    container.registerSingleton(serviceToken, () => new constructor())
    return constructor
  }
}

export function Inject(token: string | symbol) {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    // 参数装饰器实现
    // 这里可以添加元数据存储逻辑
  }
}
