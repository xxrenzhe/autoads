import { Logger } from './Logger';
import { Cache } from './Cache';
import { EventEmitter } from './EventEmitter';
import { Metrics } from './Metrics';
import { EnhancedError } from '@/lib/utils/error-handling';

export interface ServiceConfig {
  name: string;
  version: string;
  enabled: boolean;
  timeout?: number;
  retries?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
}

export interface ServiceContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export abstract class BaseService {
  protected config: ServiceConfig;
  protected logger: Logger;
  protected cache: Cache;
  protected events: EventEmitter;
  protected metrics: Metrics;
  protected isInitialized: boolean = false;
  protected isRunning: boolean = false;

  constructor(config: ServiceConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      cacheEnabled: true,
      cacheTTL: 300,
      ...config
    };

    this.logger = new Logger(this.config.name);
    this.cache = new Cache();
    this.events = new EventEmitter();
    this.metrics = new Metrics(this.config.name);
  }

  // Lifecycle Management
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try { this.logger.info('Initializing service');
      await this.onInitialize();
      this.isInitialized = true;
      this.events.emit('service:initialized', { service: this.config.name });
      this.logger.info('Service initialized successfully');
    } catch (error) { this.logger.error('Failed to initialize service', new EnhancedError('Failed to initialize service', {  
        service: this.config.name, 
        error: error instanceof Error ? error.message : String(error) 
        }));
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isRunning) {
      return;
    }

    try { this.logger.info('Starting service');
      await this.onStart();
      this.isRunning = true;
      this.events.emit('service:started', { service: this.config.name });
      this.logger.info('Service started successfully');
    } catch (error) { this.logger.error('Failed to start service', new EnhancedError('Failed to start service', {  
        service: this.config.name, 
        error: error instanceof Error ? error.message : String(error) 
       }));
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try { this.logger.info('Stopping service');
      await this.onStop();
      this.isRunning = false;
      this.events.emit('service:stopped', { service: this.config.name });
      this.logger.info('Service stopped successfully');
    } catch (error) { this.logger.error('Failed to stop service', new EnhancedError('Failed to stop service', {  
        service: this.config.name, 
        error: error instanceof Error ? error.message : String(error) 
       }));
      throw error;
    }
  }

  async destroy(): Promise<void> { await this.stop();
    
    try {
      this.logger.info('Destroying service');
      await this.onDestroy();
      this.isInitialized = false;
      this.events.emit('service:destroyed', { service: this.config.name });
      this.logger.info('Service destroyed successfully');
    } catch (error) { this.logger.error('Failed to destroy service', new EnhancedError('Failed to destroy service', {  
        service: this.config.name, 
        error: error instanceof Error ? error.message : String(error) 
       }));
      throw error;
    }
  }

  // Abstract lifecycle methods
  protected abstract onInitialize(): Promise<void>;
  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
  protected abstract onDestroy(): Promise<void>;

  // Error Handling
  protected async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: ServiceContext,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Starting operation');

      const result = await this.withRetry(operation, this.config.retries!);
      
      const duration = Date.now() - startTime;
      this.metrics.recordSuccess(operationName, duration);
      
      this.logger.debug('Operation completed successfully');

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.recordError(operationName, duration);
      
      this.logger.error('Operation failed', new EnhancedError('Operation failed', {  
        service: this.config.name, 
        operation: operationName, 
        requestId: context.requestId,
        duration,
        error: error instanceof Error ? error.message : String(error) 
       }));
      this.events.emit('service:error', {
        service: this.config.name, 
        operation: operationName, 
        error: error instanceof Error ? error.message : String(error),
        context 
      });
      throw error;
    }
  }

  // Retry Logic
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          break;
        }

        this.logger.warn('Operation failed, retrying', { service: this.config.name, 
          attempt: attempt + 1, 
          maxRetries,
          error: lastError.message 
        });
        await this.sleep(delay * Math.pow(2, attempt)); // Exponential backoff
      }
    }

    throw lastError!;
  }

  // Caching
  protected async withCache<T>(
    key: string,
    operation: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    if (!this.config.cacheEnabled) {
      return operation();
    }

    const cacheKey = `${this.config.name}:${key}`;
    const cached = await this.cache.get<T>(cacheKey);
    
    if (cached !== null) {
      this.metrics.recordCacheHit(key);
      return cached;
    }

    const result = await operation();
    await this.cache.set(cacheKey, result, ttl || this.config.cacheTTL!);
    this.metrics.recordCacheMiss(key);
    
    return result;
  }

  // Utility Methods
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Getters
  get name(): string {
    return this.config.name;
  }

  get version(): string {
    return this.config.version;
  }

  get enabled(): boolean {
    return this.config.enabled;
  }

  get status(): { initialized: boolean; running: boolean } {
    return {
      initialized: this.isInitialized,
      running: this.isRunning
    };
  }

  // Event Handling
  on(event: string, listener: (...args: unknown[]) => void): void {
    this.events.on(event, listener);
  }

  off(event: string, listener: (...args: unknown[]) => void): void {
    this.events.off(event, listener);
  }

  // Health Check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: unknown }> {
    try {
      const details = await this.onHealthCheck();
      return { status: 'healthy', details };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        details: { error: error instanceof Error ? error.message : String(error) } 
      };
    }
  }

  // Abstract health check method
  protected abstract onHealthCheck(): Promise<unknown>;
} 

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}