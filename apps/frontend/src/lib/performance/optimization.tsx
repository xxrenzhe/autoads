/**
 * Performance Optimization Utilities
 * 性能优化工具，提供各种性能优化功能
 */

import { createLogger } from "@/lib/utils/security/secure-logger";
import React from 'react';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('PerformanceOptimizer');

/**
 * 内存缓存优化器
 */
class PerformanceMemoryCache {
  private cache = new Map<string, { value: unknown; expires: number }>();
  private maxSize: number;
  private ttl: number;
  
  constructor(maxSize = 1000, ttl = 5 * 60 * 1000) { // 默认5分钟
    this.maxSize = maxSize;
    this.ttl = ttl;
  }
  
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null as any;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null as any;
    }
    
    return item.value as T;
  }
  
  set(key: string, value: unknown, ttl?: number): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      value,
      expires: Date.now() + (ttl || this.ttl)
    });
  }
  
  private evictLRU(): void {
    // 简单的LRU策略：删除第一个条目
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
    }
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}

/**
 * 批处理优化器
 */
class BatchProcessor {
  private queue: Array<{ task: () => Promise<unknown>; resolve: (value: unknown) => void; reject: (reason: unknown) => void }> = [];
  private isProcessing = false;
  private batchSize: number;
  private delay: number;
  
  constructor(batchSize = 10, delay = 100) {
    this.batchSize = batchSize;
    this.delay = delay;
  }
  
  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve: resolve as (value: unknown) => void, reject });
      
      if (this.queue.length >= this.batchSize || !this.isProcessing) {
        this.process();
      }
    });
  }
  
  private async process(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);
      
      try {
        const results = await Promise.allSettled(
          batch?.filter(Boolean)?.map(item => item.task())
        );
        
        results.forEach((result, index) => {
          const item = batch[index];
          if (result.status === 'fulfilled') {
            item.resolve(result.value);
          } else {
            item.reject(result.reason);
          }
        });
        
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.delay));
        }
      } catch (error) {
        logger.error('Batch processing error:', error instanceof Error ? error : new Error(String(error)));
        
        // 拒绝当前批次的所有任务
        batch.forEach(item => {
          item.reject(error);
        });
      }
    }
    
    this.isProcessing = false;
  }
}

/**
 * 防抖和节流工具
 */
class DebounceThrottle {
  /**
   * 防抖函数
   */
  static debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }
  
  /**
   * 节流函数
   */
  static throttle<T extends (...args: unknown[]) => unknown>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  /**
   * 带取消功能的防抖
   */
  static debouncedWithCancel<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
  ): { fn: (...args: Parameters<T>) => void; cancel: () => void } {
    let timeout: NodeJS.Timeout;
    
    const fn = (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
    
    const cancel = () => {
      clearTimeout(timeout);
    };
    
    return { fn, cancel };
  }
}

/**
 * 图片优化工具
 */
class ImageOptimizer {
  /**
   * 生成响应式图片srcset
   */
  static generateSrcSet(baseUrl: string, widths: number[] = [320, 640, 960, 1280]): string {
    return widths
      ?.filter(Boolean)?.map(width => `${baseUrl}?w=${width} ${width}w`)
      .join(', ');
  }
  
  /**
   * 生成懒加载图片的Intersection Observer
   */
  static createLazyLoader(): (element: HTMLImageElement) => void {
    if (typeof window === 'undefined') {
      return () => {};
    }
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px',
      threshold: 0.1
    });
    
    return (element: HTMLImageElement) => {
      if (element.dataset.src) {
        imageObserver.observe(element);
      }
    };
  }
}

/**
 * 代码分割优化工具
 */
class CodeSplitOptimizer {
  /**
   * 动态导入组件，带加载状态和错误处理
   */
  static dynamicImport<T>(
    importFn: () => Promise<T>,
    fallback?: () => React.ReactElement,
    loadingComponent?: () => React.ReactElement
  ): () => Promise<T> {
    return async () => {
      try {
        try {

        return await importFn();

        } catch (error) {

          console.error(error);

          return false;

        }
      } catch (error) {
        logger.error('Dynamic import failed:', error instanceof Error ? error : new Error(String(error)));
        if (fallback) {
          return fallback as any;
        }
        throw error;
      }
    };
  }
  
  /**
   * 预加载资源
   */
  static preloadResources(urls: string[]): void {
    if (typeof window === 'undefined') return;
    
    urls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = url;
      
      if (url.endsWith('.js')) {
        link.as = 'script';
      } else if (url.endsWith('.css')) {
        link.as = 'style';
      } else {
        link.as = 'fetch';
      }
      
      document.head.appendChild(link);
    });
  }
}

/**
 * 性能监控工具
 */
class PerformanceMonitor {
  private static metrics = new Map<string, number[]>();
  
  /**
   * 记录性能指标
   */
  static recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // 保持最近100个值
    if (values.length > 100) {
      values.shift();
    }
  }
  
  /**
   * 获取性能统计
   */
  static getStats(name: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null as any;
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const average = sum / count;
    const min = sorted[0];
    const max = sorted[count - 1];
    const p95 = sorted[Math.floor(count * 0.95)];
    
    return { count, average, min, max, p95 };
  }
  
  /**
   * 高阶函数：包装函数以监控性能
   */
  static monitor<T extends (...args: unknown[]) => Promise<unknown>>(
    name: string,
    fn: T
  ): T {
    return (async (...args: Parameters<T>) => {
      const start = performance.now();
      try {
        const result = await fn(...args);
        const duration = performance.now() - start;
        this.recordMetric(`${name}.success`, duration);
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        this.recordMetric(`${name}.error`, duration);
        throw error;
      }
    }) as T;
  }
}

/**
 * 网络优化工具
 */
class NetworkOptimizer {
  /**
   * 带重试的fetch
   */
  static async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    maxRetries = 3,
    delay = 1000
  ): Promise<Response> {
    let lastError: Error;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    }
    
    throw lastError!;
  }
  
  /**
   * 请求缓存
   */
  private static cache = new Map<string, { data: unknown; expires: number }>();
  
  static async cachedFetch<T>(
    url: string,
    options: RequestInit = {},
    ttl = 5 * 60 * 1000
  ): Promise<T> {
    const cacheKey = url + JSON.stringify(options);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() < cached.expires) {
      return cached.data as T;
    }
    
    const response = await this.fetchWithRetry(url, options);
    const data = await response.json();
    
    this.cache.set(cacheKey, {
      data,
      expires: Date.now() + ttl
    });
    
    return data;
  }
  
  /**
   * 批量请求
   */
  static async batchFetch<T>(
    urls: string[],
    options: RequestInit = {},
    batchSize = 5
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch?.filter(Boolean)?.map(url => this.fetchWithRetry(url, options).then(res => res.json()))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
}

/**
 * 渲染优化工具
 */
class RenderOptimizer {
  /**
   * 虚拟滚动列表的简化实现
   */
  static createVirtualList<T>(
    items: T[],
    itemHeight: number,
    containerHeight: number,
    renderItem: (item: T, index: number) => React.ReactElement
  ): React.ReactElement[] {
    const visibleStart = Math.floor(0 / itemHeight);
    const visibleEnd = Math.min(
      Math.ceil(containerHeight / itemHeight) + visibleStart + 2,
      items.length
    );
    
    const visibleItems: React.ReactElement[] = [];
    for (let i = visibleStart; i < visibleEnd; i++) {
      visibleItems.push(
        renderItem(items[i], i)
      );
    }
    
    return visibleItems;
  }
  
  /**
   * 检测是否在视窗内
   */
  static isInViewport(element: HTMLElement): boolean {
    if (typeof window === 'undefined') return false;
    
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  }
}

export {
  PerformanceMemoryCache as MemoryCache,
  BatchProcessor,
  DebounceThrottle,
  ImageOptimizer,
  CodeSplitOptimizer,
  PerformanceMonitor,
  NetworkOptimizer,
  RenderOptimizer
};