/**
 * Performance Optimization Utilities
 * Provides common optimization patterns and utilities
 */

import { performance } from 'perf_hooks';

/**
 * Query result caching with TTL
 */
export class QueryCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null as any;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null as any;
    }
    
    return item.data;
  }
  
  set(key: string, data: any, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }
  
  invalidate(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Global query cache instance
export const queryCache = new QueryCache();

/**
 * Performance monitoring decorator
 */
export function measurePerformance(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    const methodName = `${target.constructor.name}.${propertyKey}`;
    
    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;
      
      // Log slow operations (> 100ms)
      if (duration > 100) {
        console.warn(`[PERF] Slow operation: ${methodName} took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`[PERF] Failed operation: ${methodName} failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  };
}

/**
 * Batch processor for bulk operations
 */
export class BatchProcessor<T, R> {
  private queue: Array<{
    item: T;
    resolve: (value: R | PromiseLike<R>) => void;
    reject: (reason?: any) => void;
  }> = [];
  private timeout: NodeJS.Timeout | null = null;
  private processing = false;
  
  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private options: {
      batchSize?: number;
      batchDelay?: number;
      maxQueueSize?: number;
    } = {}
  ) {
    this.options = {
      batchSize: options.batchSize || 10,
      batchDelay: options.batchDelay || 100,
      maxQueueSize: options.maxQueueSize || 1000,
      ...options
    };
  }
  
  add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });
      
      if (this.queue.length >= this.options.batchSize!) {
        this.flush();
      } else if (!this.timeout) {
        this.timeout = setTimeout(() => this.flush(), this.options.batchDelay);
      }
      
      // Prevent queue from growing too large
      if (this.queue.length > this.options.maxQueueSize!) {
        console.warn('[PERF] Batch queue exceeding max size, flushing immediately');
        this.flush();
      }
    });
  }
  
  private async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    const batch = this.queue.splice(0, this.options.batchSize!);
    const items = batch.map((b: any) => b.item);
    
    try {
      const results = await this.processor(items);
      
      // Match results to their promises
      results.forEach((result, index: any) => {
        if (index < batch.length) {
          batch[index].resolve(result);
        }
      });
    } catch (error) {
      batch.forEach((b: any) => b.reject(error));
    } finally {
      this.processing = false;
      
      // Process remaining items if any
      if (this.queue.length > 0) {
        setImmediate(() => this.flush());
      }
    }
  }
}

/**
 * Memory usage monitor
 */
export class MemoryMonitor {
  private warnings: number = 0;
  private threshold: number;
  
  constructor(threshold: number = 0.8) {
    this.threshold = threshold;
  }
  
  check(): void {
    const usage = process.memoryUsage();
    const heapUsed = usage.heapUsed / usage.heapTotal;
    
    if (heapUsed > this.threshold) {
      this.warnings++;
      console.warn(`[MEMORY] High heap usage: ${(heapUsed * 100).toFixed(1)}% (${this.formatBytes(usage.heapUsed)})`);
      
      if (this.warnings > 3) {
        console.error('[MEMORY] Critical memory usage detected, consider restarting');
      }
    } else {
      this.warnings = Math.max(0, this.warnings - 1);
    }
  }
  
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Global memory monitor instance
export const memoryMonitor = new MemoryMonitor();

/**
 * Request deduplication utility
 */
export class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();
  
  async get<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.pending.has(key)) {
      return this.pending.get(key) as Promise<T>;
    }
    
    const promise = fn();
    this.pending.set(key, promise);
    
    try {
      const result = await promise;
      return result;
    } finally {
      this.pending.delete(key);
    }
  }
}

// Global request deduplicator instance
export const requestDeduplicator = new RequestDeduplicator();

/**
 * Circuit breaker for external services
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60 * 1000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      console.warn(`[CIRCUIT] Circuit breaker OPEN after ${this.failures} failures`);
    }
  }
}

/**
 * Connection pool manager
 */
export class ConnectionPool<T> {
  private pool: T[] = [];
  private available: T[] = [];
  private waiting: Array<{ resolve: (value: T) => void; reject: (reason?: any) => void }> = [];
  
  constructor(
    private creator: () => Promise<T>,
    private destroyer: (item: T) => Promise<void>,
    private options: {
      max?: number;
      min?: number;
      idleTimeout?: number;
    } = {}
  ) {
    this.options = {
      max: options.max || 10,
      min: options.min || 2,
      idleTimeout: options.idleTimeout || 5 * 60 * 1000,
      ...options
    };
    
    this.initialize();
  }
  
  private async initialize(): Promise<void> {
    for (let i = 0; i < this.options.min!; i++) {
      const item = await this.creator();
      this.pool.push(item);
      this.available.push(item);
    }
  }
  
  async acquire(): Promise<T> {
    if (this.available.length > 0) {
      const item = this.available.pop()!;
      return item;
    }
    
    if (this.pool.length < this.options.max!) {
      const item = await this.creator();
      this.pool.push(item);
      return item;
    }
    
    return new Promise((resolve, reject) => {
      this.waiting.push({ resolve, reject });
    });
  }
  
  async release(item: T): Promise<void> {
    if (this.waiting.length > 0) {
      const waiter = this.waiting.shift()!;
      waiter.resolve(item);
    } else {
      this.available.push(item);
    }
  }
  
  async destroy(): Promise<void> {
    await Promise.all(this.pool.map((item: any) => this.destroyer(item)));
    this.pool = [];
    this.available = [];
    this.waiting.forEach((w: any) => w.reject(new Error('Pool destroyed')));
    this.waiting = [];
  }
}