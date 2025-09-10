import { createCategoryLogger } from '@/lib/utils/centralized-logging';

const serviceLogger = createCategoryLogger('ServiceOperations');

/**
 * 为服务操作添加日志记录的装饰器
 */
export function logServiceOperation(category: string = 'Service') {
  const logger = createCategoryLogger(category);
  
  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<any>
  ) {
    const method = descriptor.value!;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const operationId = crypto.randomUUID();
      
      // 获取用户信息（如果有）
      const userId = args.find(arg => arg?.user?.id)?.user?.id || 'system';
      
      logger.info(`Operation Started: ${propertyName}`, {
        operation: propertyName,
        operationId,
        userId,
        argsCount: args.length,
        timestamp: new Date().toISOString(),
        // 记录参数摘要（避免敏感信息）
        argsSummary: args.map((arg, index) => ({
          index,
          type: typeof arg,
          hasValue: arg !== undefined && arg !== null,
          isObject: typeof arg === 'object' && arg !== null,
        }))
      });

      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;

        logger.info(`Operation Completed: ${propertyName}`, {
          operation: propertyName,
          operationId,
          userId,
          duration: `${duration}ms`,
          status: 'success',
          timestamp: new Date().toISOString(),
          // 记录结果摘要
          resultSummary: {
            hasResult: result !== undefined,
            type: typeof result,
            isArray: Array.isArray(result),
            isObject: typeof result === 'object' && result !== null && !Array.isArray(result),
          }
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error(`Operation Failed: ${propertyName}`, error instanceof Error ? error : new Error(String(error)), {
          operation: propertyName,
          operationId,
          userId,
          duration: `${duration}ms`,
          status: 'error',
          timestamp: new Date().toISOString(),
          errorDetails: {
            name: error instanceof Error ? error.name : 'UnknownError',
            message: error instanceof Error ? error.message : String(error),
          }
        });

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 手动记录服务操作的辅助函数
 */
export async function logOperation<T>(
  operation: string,
  fn: () => Promise<T>,
  context: {
    userId?: string;
    category?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<T> {
  const logger = createCategoryLogger(context.category || 'Service');
  const startTime = Date.now();
  const operationId = crypto.randomUUID();
  
  logger.info(`Operation Started: ${operation}`, {
    operation,
    operationId,
    userId: context.userId || 'system',
    timestamp: new Date().toISOString(),
    metadata: context.metadata,
  });

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    logger.info(`Operation Completed: ${operation}`, {
      operation,
      operationId,
      userId: context.userId || 'system',
      duration: `${duration}ms`,
      status: 'success',
      timestamp: new Date().toISOString(),
      metadata: context.metadata,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error(`Operation Failed: ${operation}`, error instanceof Error ? error : new Error(String(error)), {
      operation,
      operationId,
      userId: context.userId || 'system',
      duration: `${duration}ms`,
      status: 'error',
      timestamp: new Date().toISOString(),
      metadata: context.metadata,
    });

    throw error;
  }
}

/**
 * 记录数据库操作的辅助函数
 */
export async function logDatabaseOperation<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>,
  context: {
    userId?: string;
    operationType?: 'create' | 'read' | 'update' | 'delete';
    metadata?: Record<string, any>;
  } = {}
): Promise<T> {
  return logOperation(
    `DB:${operation}`,
    fn,
    {
      userId: context.userId,
      category: 'Database',
      metadata: {
        table,
        operationType: context.operationType,
        ...context.metadata,
      },
    }
  );
}

/**
 * 记录外部API调用的辅助函数
 */
export async function logExternalApiCall<T>(
  service: string,
  endpoint: string,
  fn: () => Promise<T>,
  context: {
    userId?: string;
    method?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<T> {
  return logOperation(
    `ExternalAPI:${service}`,
    fn,
    {
      userId: context.userId,
      category: 'ExternalAPI',
      metadata: {
        service,
        endpoint,
        method: context.method || 'GET',
        ...context.metadata,
      },
    }
  );
}