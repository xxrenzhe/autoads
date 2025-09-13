/**
 * Shared Infrastructure Services - Retry, Circuit Breaker, Health Checks
 * Provides robust patterns for building resilient services
 */

import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('SharedInfrastructure');

// ==================== Retry Service ==================== //

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition?: (error: any, attempt: number) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: any;
  attempts: number;
  totalTime: number;
}

/**
 * Advanced retry service with exponential backoff and jitter
 */
export class RetryService {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      ...config
    };
  }

  async execute<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const finalConfig = { ...this.config, ...config };
    const startTime = Date.now();
    let lastError: any;

    for (let attempt = 1; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        const totalTime = Date.now() - startTime;
        
        logger.debug('Retry operation succeeded', {
          attempt,
          totalTime,
          maxRetries: finalConfig.maxRetries
        });

        return {
          success: true,
          data: result,
          attempts: attempt,
          totalTime
        };
      } catch (error) {
        lastError = error;
        
        const shouldRetry = !finalConfig.retryCondition || 
          finalConfig.retryCondition(error, attempt);

        if (!shouldRetry || attempt === finalConfig.maxRetries) {
          logger.warn('Retry operation failed, not retrying', {
            attempt,
            error: error instanceof Error ? error.message : String(error),
            shouldRetry,
            isLastAttempt: attempt === finalConfig.maxRetries
          });
          break;
        }

        const delay = this.calculateDelay(attempt, finalConfig);
        
        logger.info('Retrying operation after delay', {
          attempt,
          delay,
          error: error instanceof Error ? error.message : String(error)
        });

        await this.sleep(delay);
      }
    }

    const totalTime = Date.now() - startTime;
    
    return {
      success: false,
      error: lastError,
      attempts: finalConfig.maxRetries,
      totalTime
    };
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, config.maxDelay);
    
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==================== Circuit Breaker ==================== //

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  expectedExceptionPredicate?: (error: any) => boolean;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  lastResetTime?: number;
  nextAttemptTime?: number;
}

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: number;
  private lastResetTime?: number;
  private nextAttemptTime?: number;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 120000,
      ...config
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < (this.nextAttemptTime || 0)) {
        throw new Error('Circuit breaker is OPEN - blocking calls');
      } else {
        this.transitionToHalfOpen();
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.lastResetTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToClosed();
    }

    logger.debug('Circuit breaker success', {
      state: this.state,
      successes: this.successes,
      failures: this.failures
    });
  }

  private onFailure(error: any): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    const shouldCountFailure = !this.config.expectedExceptionPredicate || 
      this.config.expectedExceptionPredicate(error);

    if (shouldCountFailure) {
      if (this.state === CircuitState.CLOSED && 
          this.failures >= this.config.failureThreshold) {
        this.transitionToOpen();
      } else if (this.state === CircuitState.HALF_OPEN) {
        this.transitionToOpen();
      }
    }

    logger.warn('Circuit breaker failure', {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastResetTime = Date.now();
    
    logger.info('Circuit breaker transitioned to CLOSED');
  }

  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.resetTimeout;
    
    logger.info('Circuit breaker transitioned to OPEN', {
      resetTimeout: this.config.resetTimeout,
      nextAttemptTime: this.nextAttemptTime
    });
  }

  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    
    logger.info('Circuit breaker transitioned to HALF_OPEN');
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastResetTime: this.lastResetTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  forceOpen(): void {
    this.transitionToOpen();
  }

  forceClosed(): void {
    this.transitionToClosed();
  }

  reset(): void {
    this.transitionToClosed();
  }
}

// ==================== Health Check Service ==================== //

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, any>;
  timestamp: number;
  uptime: number;
}

export interface HealthCheck {
  name: string;
  check: () => Promise<boolean>;
  timeout?: number;
  critical?: boolean;
}

export interface HealthCheckConfig {
  checkInterval: number;
  timeout: number;
  unhealthyThreshold: number;
  degradedThreshold: number;
}

/**
 * Health check service for monitoring service health
 */
export class HealthCheckService {
  private checks: Map<string, HealthCheck> = new Map();
  private results: Map<string, { success: boolean; timestamp: number; error?: string }> = new Map();
  private config: HealthCheckConfig;
  private startTime: number;
  private intervalId?: NodeJS.Timeout;

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = {
      checkInterval: 30000,
      timeout: 5000,
      unhealthyThreshold: 3,
      degradedThreshold: 1,
      ...config
    };
    
    this.startTime = Date.now();
    
    logger.info('HealthCheckService initialized', {
      config: this.config
    });
  }

  register(check: HealthCheck): void {
    this.checks.set(check.name, check);
    logger.info('Health check registered', { name: check.name, critical: check.critical });
  }

  unregister(name: string): void {
    this.checks.delete(name);
    this.results.delete(name);
    logger.info('Health check unregistered', { name });
  }

  async start(): Promise<void> {
    if (this.intervalId) {
      logger.warn('Health check service already started');
      return;
    }

    logger.info('Starting health check service');
    
    // Run initial checks
    await this.runAllChecks();
    
    // Start periodic checks
    this.intervalId = setInterval(() => {
      this.runAllChecks().catch(error => {
        logger.error('Health check execution failed', new EnhancedError('Health check execution failed', { error: error instanceof Error ? error.message : String(error)
         }));
      });
    }, this.config.checkInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info('Health check service stopped');
    }
  }

  private async runAllChecks(): Promise<void> {
    const promises = Array.from(this.checks.values())?.filter(Boolean)?.map((check: any) => 
      this.runCheck(check)
    );
    
    await Promise.allSettled(promises);
  }

  private async runCheck(check: HealthCheck): Promise<void> {
    const startTime = Date.now();
    
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), check.timeout || this.config.timeout);
      });

      const result = await Promise.race([
        check.check(),
        timeoutPromise
      ]) as boolean;

      this.results.set(check.name, {
        success: result,
        timestamp: Date.now()
      });

      logger.debug('Health check completed', {
        name: check.name,
        success: result,
        duration: Date.now() - startTime
      });

    } catch (error) {
      this.results.set(check.name, {
        success: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      });

      logger.warn('Health check failed', {
        name: check.name,
        error: error instanceof Error ? error.message : String(error),
        critical: check.critical
      });
    }
  }

  getHealthStatus(): HealthStatus {
    const now = Date.now();
    const results = Array.from(this.results.entries());
    
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;
    const details: Record<string, any> = {};

    results.forEach(([name, result]: any) => {
      const check = this.checks.get(name);
      const age = now - result.timestamp;
      
      details[name] = {
        success: result.success,
        age,
        error: result.error,
        critical: check?.critical || false
      };

      if (result.success) {
        healthyCount++;
      } else {
        if (check?.critical) {
          unhealthyCount++;
        } else {
          degradedCount++;
        }
      }
    });

    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (unhealthyCount >= this.config.unhealthyThreshold) {
      status = 'unhealthy';
    } else if (degradedCount >= this.config.degradedThreshold || unhealthyCount > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      details,
      timestamp: now,
      uptime: now - this.startTime
    };
  }

  async isHealthy(): Promise<boolean> {
    const status = await this.getHealthStatus();
    return status.status === 'healthy';
  }

  getCheckResults(): Record<string, any> {
    const results: Record<string, any> = {};
    
    this.results.forEach((result, name: any) => {
      results[name] = result;
    });
    
    return results;
  }
}

// ==================== Service Registry ==================== //

export interface ServiceDescriptor {
  name: string;
  version: string;
  instance: any;
  healthCheck?: () => Promise<boolean>;
  dependencies?: string[];
}

/**
 * Service registry for managing service instances and dependencies
 */
export class ServiceRegistry {
  private services: Map<string, ServiceDescriptor> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();

  register(descriptor: ServiceDescriptor): void {
    this.services.set(descriptor.name, descriptor);
    
    // Build dependency graph
    if (descriptor.dependencies) {
      const dependencies = new Set(descriptor.dependencies);
      this.dependencyGraph.set(descriptor.name, dependencies);
    }

    logger.info('Service registered', {
      name: descriptor.name,
      version: descriptor.version,
      dependencies: descriptor.dependencies
    });
  }

  unregister(name: string): void {
    this.services.delete(name);
    this.dependencyGraph.delete(name);
    
    // Remove from other services' dependencies
    this.dependencyGraph.forEach((deps, serviceName: any) => {
      deps.delete(name);
    });

    logger.info('Service unregistered', { name });
  }

  get<T = any>(name: string): T | null {
    const descriptor = this.services.get(name);
    return descriptor?.instance as T || null;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  list(): ServiceDescriptor[] {
    return Array.from(this.services.values());
  }

  async startAll(): Promise<void> {
    const startOrder = this.resolveDependencies();
    
    for (const serviceName of startOrder) {
      const service = this.services.get(serviceName);
      if (service && typeof service.instance?.start === 'function') {
        try {
          await service.instance.start();
          logger.info('Service started', { name: serviceName });
        } catch (error) {
          logger.error('Service start failed', new EnhancedError('Service start failed', { 
            name: serviceName,
            error: error instanceof Error ? error.message : String(error)
           }));
        }
      }
    }
  }

  async stopAll(): Promise<void> {
    const stopOrder = Array.from(this.services.keys()).reverse();
    
    for (const serviceName of stopOrder) {
      const service = this.services.get(serviceName);
      if (service && typeof service.instance?.stop === 'function') {
        try {
          await service.instance.stop();
          logger.info('Service stopped', { name: serviceName });
        } catch (error) {
          logger.error('Service stop failed', new EnhancedError('Service stop failed', { 
            name: serviceName,
            error: error instanceof Error ? error.message : String(error)
           }));
        }
      }
    }
  }

  private resolveDependencies(): string[] {
    const resolved: string[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (serviceName: string) => {
      if (visited.has(serviceName)) {
        return;
      }
      
      if (visiting.has(serviceName)) {
        throw new Error(`Circular dependency detected involving: ${serviceName}`);
      }
      
      visiting.add(serviceName);
      
      const dependencies = this.dependencyGraph.get(serviceName);
      if (dependencies) {
        dependencies.forEach((dep: any) => visit(dep));
      }
      
      visiting.delete(serviceName);
      visited.add(serviceName);
      resolved.push(serviceName);
    };

    this.services.forEach((_, serviceName: any) => {
      if (!visited.has(serviceName)) {
        visit(serviceName);
      }
    });

    return resolved;
  }
}

// ==================== Factory Functions ==================== //

export function createRetryService(config?: Partial<RetryConfig>): RetryService {
  return new RetryService(config);
}

export function createCircuitBreaker(config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  return new CircuitBreaker(config);
}

export function createHealthCheckService(config?: Partial<HealthCheckConfig>): HealthCheckService {
  return new HealthCheckService(config);
}

export function createServiceRegistry(): ServiceRegistry {
  return new ServiceRegistry();
}

// Default instances
export const retryService = createRetryService();
export const circuitBreaker = createCircuitBreaker();
export const healthCheckService = createHealthCheckService();
export const serviceRegistry = createServiceRegistry();

// ==================== Event Aggregator ==================== //

export type EventHandler<T = any> = (data: T) => void | Promise<void>;

export class EventAggregator {
  private events: Map<string, Set<EventHandler>> = new Map();
  private onceEvents: Map<string, Set<EventHandler>> = new Map();

  on<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    
    this.events.get(event)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.events.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.events.delete(event);
        }
      }
    };
  }

  once<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this.onceEvents.has(event)) {
      this.onceEvents.set(event, new Set());
    }
    
    this.onceEvents.get(event)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.onceEvents.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.onceEvents.delete(event);
        }
      }
    };
  }

  async emit<T = any>(event: string, data?: T): Promise<void> {
    const promises: Promise<void>[] = [];
    
    // Regular handlers
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach((handler: any) => {
        try {
          const result = handler(data);
          if (result instanceof Promise) {
            promises.push(result);
          }
        } catch (error) {
          logger.error('Event handler error', new EnhancedError('Event handler error', { 
            event,
            error: error instanceof Error ? error.message : String(error)
           }));
        }
      });
    }
    
    // Once handlers
    const onceHandlers = this.onceEvents.get(event);
    if (onceHandlers) {
      onceHandlers.forEach((handler: any) => {
        try {
          const result = handler(data);
          if (result instanceof Promise) {
            promises.push(result);
          }
        } catch (error) {
          logger.error('Once event handler error', new EnhancedError('Once event handler error', { 
            event,
            error: error instanceof Error ? error.message : String(error)
           }));
        }
      });
      
      // Clear once handlers
      this.onceEvents.delete(event);
    }
    
    // Wait for all async handlers to complete
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  off(event: string, handler?: EventHandler): void {
    if (handler) {
      // Remove specific handler
      const handlers = this.events.get(event);
      if (handlers) {
        handlers.delete(handler);
      }
      
      const onceHandlers = this.onceEvents.get(event);
      if (onceHandlers) {
        onceHandlers.delete(handler);
      }
    } else {
      // Remove all handlers for event
      this.events.delete(event);
      this.onceEvents.delete(event);
    }
  }

  removeAllListeners(): void {
    this.events.clear();
    this.onceEvents.clear();
  }

  listenerCount(event: string): number {
    const regular = this.events.get(event)?.size || 0;
    const once = this.onceEvents.get(event)?.size || 0;
    return regular + once;
  }
}

export const eventAggregator = new EventAggregator();

// Note: Services are already exported individually above

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}