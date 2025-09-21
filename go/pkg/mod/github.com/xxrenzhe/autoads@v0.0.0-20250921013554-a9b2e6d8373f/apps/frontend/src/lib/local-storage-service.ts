/**
 * 本地存储服务
 * 提供统一的本地存储接口，支持类型安全的操作
 */

import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('local-storage-service');

export interface StorageItem<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
}

export interface StorageOptions {
  ttl?: number; // 过期时间（毫秒）
  namespace?: string; // 命名空间
}

export class LocalStorageService {
  private namespace: string;

  constructor(namespace: string = 'adscenter') {
    this.namespace = namespace;
  }

  /**
   * 获取完整的存储键名
   */
  private getFullKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  /**
   * 检查项目是否过期
   */
  private isExpired(item: StorageItem): boolean {
    if (!item.ttl) return false;
    return Date.now() - item.timestamp > item.ttl;
  }

  /**
   * 存储数据
   */
  set<T>(key: string, value: T, options?: StorageOptions): void {
    const fullKey = this.getFullKey(key);
    const item: StorageItem<T> = {
      key: fullKey,
      value,
      timestamp: Date.now(),
      ttl: options?.ttl
    };

    try {
      localStorage.setItem(fullKey, JSON.stringify(item));
    } catch (error) {
      logger.error('存储数据失败:', new EnhancedError('存储数据失败:', { error: error instanceof Error ? error.message : String(error)  }));
      // 如果存储失败，尝试清理旧数据
      this.cleanup();
      try {
        localStorage.setItem(fullKey, JSON.stringify(item));
      } catch (retryError) {
        logger.error('重试存储失败:', new EnhancedError('重试存储失败:', { error: retryError instanceof Error ? retryError.message : String(retryError)  }));
      }
    }
  }

  /**
   * 获取数据
   */
  get<T>(key: string, defaultValue?: T): T | null {
    const fullKey = this.getFullKey(key);
    
    try {
      const item = localStorage.getItem(fullKey);
      if (!item) return defaultValue ?? null;

      const parsed: StorageItem<T> = JSON.parse(item);
      
      // 检查是否过期
      if (this.isExpired(parsed)) {
        this.remove(key);
        return defaultValue ?? null;
      }

      return parsed.value;
    } catch (error) {
      logger.error('获取数据失败:', new EnhancedError('获取数据失败:', { error: error instanceof Error ? error.message : String(error)  }));
      return defaultValue ?? null;
    }
  }

  /**
   * 删除数据
   */
  remove(key: string): void {
    const fullKey = this.getFullKey(key);
    try {
      localStorage.removeItem(fullKey);
    } catch (error) {
      logger.error('删除数据失败:', new EnhancedError('删除数据失败:', { error: error instanceof Error ? error.message : String(error)  }));
    }
  }

  /**
   * 检查数据是否存在
   */
  has(key: string): boolean {
    const fullKey = this.getFullKey(key);
    try {
      const item = localStorage.getItem(fullKey);
      if (!item) return false;

      const parsed: StorageItem<any> = JSON.parse(item);
      if (this.isExpired(parsed)) {
        this.remove(key);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('检查数据存在性失败:', new EnhancedError('检查数据存在性失败:', { error: error instanceof Error ? error.message : String(error)  }));
      return false;
    }
  }

  /**
   * 获取所有键
   */
  keys(): string[] {
    const prefix = `${this.namespace}:`;
    const keys: string[] = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const fullKey = key;
          // 检查是否过期
          try {
            const item = JSON.parse(localStorage.getItem(fullKey)!);
            if (this.isExpired(item)) {
              this.remove(key.substring(prefix.length));
              continue;
            }
          } catch (error) {
            // 如果解析失败，删除损坏的数据
            this.remove(key.substring(prefix.length));
            continue;
          }
          keys.push(key.substring(prefix.length));
        }
      }
    } catch (error) {
      logger.error('获取键列表失败:', new EnhancedError('获取键列表失败:', { error: error instanceof Error ? error.message : String(error)  }));
    }

    return keys;
  }

  /**
   * 获取所有数据
   */
  getAll<T = any>(): Record<string, T> {
    const keys = this.keys();
    const result: Record<string, T> = {};

    keys.forEach((key: any) => {
      const value = this.get<T>(key);
      if (value !== null) {
        result[key] = value;
      }
    });

    return result;
  }

  /**
   * 清空当前命名空间的所有数据
   */
  clear(): void {
    const keys = this.keys();
    keys.forEach((key: any) => this.remove(key));
  }

  /**
   * 清理过期数据
   */
  private cleanup(): void {
    try {
      const prefix = `${this.namespace}:`;
      const now = Date.now();

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          try {
            const item = JSON.parse(localStorage.getItem(key)!);
            if (item.ttl && now - item.timestamp > item.ttl) {
              localStorage.removeItem(key);
            }
          } catch (error) {
            // 删除损坏的数据
            localStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      logger.error('清理过期数据失败:', new EnhancedError('清理过期数据失败:', { error: error instanceof Error ? error.message : String(error)  }));
    }
  }

  /**
   * 获取存储使用情况
   */
  getStorageInfo(): {
    totalKeys: number;
    totalSize: number;
    namespaceKeys: number;
    namespaceSize: number;
  } {
    let totalSize = 0;
    let namespaceSize = 0;
    let namespaceKeys = 0;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) {
            const size = (key.length + value.length) * 2; // UTF-16 编码
            totalSize += size;

            if (key.startsWith(`${this.namespace}:`)) {
              namespaceSize += size;
              namespaceKeys++;
            }
          }
        }
      }
    } catch (error) {
      logger.error('获取存储信息失败:', new EnhancedError('获取存储信息失败:', { error: error instanceof Error ? error.message : String(error)  }));
    }

    return {
      totalKeys: localStorage.length,
      totalSize,
      namespaceKeys,
      namespaceSize
    };
  }

  /**
   * 批量操作
   */
  batchSet<T>(items: Record<string, T>, options?: StorageOptions): void {
    Object.entries(items).forEach(([key, value]: any) => {
      this.set(key, value, options);
    });
  }

  batchGet<T>(keys: string[]): Record<string, T | null> {
    const result: Record<string, T | null> = {};
    
    keys.forEach((key: any) => {
      result[key] = this.get<T>(key);
    });

    return result;
  }

  batchRemove(keys: string[]): void {
    keys.forEach((key: any) => this.remove(key));
  }
}

// 创建默认实例
export const globalLocalStorageService = new LocalStorageService();

// 便捷方法
export const storage = {
  set: <T>(key: string, value: T, options?: StorageOptions) => 
    globalLocalStorageService.set(key, value, options),
  get: <T>(key: string, defaultValue?: T) => 
    globalLocalStorageService.get(key, defaultValue),
  remove: (key: string) => globalLocalStorageService.remove(key),
  has: (key: string) => globalLocalStorageService.has(key),
  keys: () => globalLocalStorageService.keys(),
  getAll: <T>() => globalLocalStorageService.getAll<T>(),
  clear: () => globalLocalStorageService.clear(),
  batchSet: <T>(items: Record<string, T>, options?: StorageOptions) => 
    globalLocalStorageService.batchSet(items, options),
  batchGet: <T>(keys: string[]) => globalLocalStorageService.batchGet<T>(keys),
  batchRemove: (keys: string[]) => globalLocalStorageService.batchRemove(keys),
  getStorageInfo: () => globalLocalStorageService.getStorageInfo()
};