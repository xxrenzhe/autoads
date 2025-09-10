// 存储管理器 - 负责浏览器存储的统一管理

import { safeJsonParse } from '../utils';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { securityService } from './SimpleSecurityService';
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('StorageManager');


export interface StorageOptions {
  encrypt?: boolean;
  compress?: boolean;
  ttl?: number; // 生存时间（毫秒）
  namespace?: string; // 命名空间
}

export interface StorageItem<T = unknown> {
  data: T;
  timestamp: number;
  ttl?: number;
  encrypted?: boolean;
  compressed?: boolean;
}

export interface StorageQuota {
  used: number; // 已使用字节数
  available: number; // 可用字节数
  total: number; // 总容量字节数
  percentage: number; // 使用百分比
}

export interface QuotaCheckResult {
  canStore: boolean;
  needed: number;
  available: number;
}

export interface ImportDataRequest { data: Record<string, unknown>;
  options?: StorageOptions & { overwrite?: boolean  };
}

export interface ImportDataResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

export class StorageManager {
  private static readonly DEFAULT_NAMESPACE = 'google_ads_automation';
  private static readonly ENCRYPTION_KEY = 'gaa_storage_key_2024';
  private namespace: string;

  constructor(namespace: string = StorageManager.DEFAULT_NAMESPACE) {
    this.namespace = namespace;
  }

  /**
   * 初始化加密服务
   */
  async initializeEncryption(password?: string): Promise<void> {
    const encryptionPassword = password || StorageManager.ENCRYPTION_KEY;
    await securityService.initializeKey(encryptionPassword);
    logger.info('加密服务已初始化');
  }

  /**
   * 获取完整的存储键名
   */
  private getFullKey(key: string, namespace?: string): string {
    const targetNamespace = namespace || this.namespace;
    return `${targetNamespace}:${key}`;
  }

  /**
   * 压缩数据
   */
  private async compressData(data: string): Promise<string> {
    try {
      // 简单的压缩模拟（实际应用中可使用LZ-string等库）
      const compressed = data.replace(/\s+/g, ' ').trim();
      return `compressed:${compressed}`;
    } catch (error) {
      logger.warn('数据压缩失败，使用原始数据:', { data: error instanceof Error ? error.message : String(error) });
      return data;
    }
  }

  /**
   * 解压数据
   */
  private async decompressData(compressedData: string): Promise<string> {
    try {
      if (!compressedData.startsWith('compressed:')) {
        return compressedData;
      }
      
      return compressedData.substring('compressed:'.length);
    } catch (error) {
      logger.warn('数据解压失败');
      throw new Error('数据解压失败');
    }
  }

  /**
   * 加密数据
   */
  private async encryptData(data: string): Promise<string> {
    try {
      // 使用安全加密服务
      const encrypted = await securityService.encryptSensitiveData(data);
      return `secure:${JSON.stringify(encrypted)}`;
    } catch (error) {
      logger.warn('数据加密失败，使用原始数据:');
      return data;
    }
  }

  /**
   * 解密数据
   */
  private async decryptData(encryptedData: string): Promise<string> {
    try {
      // 兼容旧的Base64格式
      if (encryptedData.startsWith('encrypted:')) {
        const encoded = encryptedData.substring('encrypted:'.length);
        return decodeURIComponent(escape(atob(encoded)));
      }
      
      // 新的安全加密格式
      if (encryptedData.startsWith('secure:')) {
        const encryptedObj = JSON.parse(encryptedData.substring('secure:'.length));
        try {

        return await securityService.decryptSensitiveData(encryptedObj);

        } catch (error) {

          console.error(error);
          return ""; // Return empty string instead of false

        }
      }
      
      // 未加密的数据直接返回
      return encryptedData;
    } catch (error) {
      logger.warn('数据解密失败:');
      throw new Error('数据解密失败');
    }
  }

  /**
   * 获取存储配额信息
   */
  async getStorageQuota(): Promise<StorageQuota> {
    try {
      // 估算localStorage使用量
      let used = 0;
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }

      // localStorage通常限制为5-10MB，这里假设5MB
      const total = 5 * 1024 * 1024; // 5MB in bytes
      const available = total - used;
      const percentage = Math.round((used / total) * 100);

      return {
        used,
        available: Math.max(0, available),
        total,
        percentage: Math.min(100, percentage)
      };
    } catch (error) {
      logger.error('获取存储配额失败:', new EnhancedError('获取存储配额失败:', { error: error instanceof Error ? error.message : String(error)  }));
      return {
        used: 0,
        available: 5 * 1024 * 1024,
        total: 5 * 1024 * 1024,
        percentage: 0
      };
    }
  }

  /**
   * 检查存储配额
   */
  async checkStorageQuota(dataSize: number): Promise<QuotaCheckResult> { try {
      const quota = await this.getStorageQuota();
      
      return {
        canStore: quota.available >= dataSize,
        needed: dataSize,
        available: quota.available
      };
    } catch (error) {
      console.error('Error in checkStorageQuota:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  /**
   * 删除数据项
   */
  async removeItem(key: string, options: Pick<StorageOptions, 'namespace'> = {}): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key, options.namespace);
      localStorage.removeItem(fullKey);
      return Promise.resolve(true);
    } catch (error) {
      logger.error('删除数据失败:', new EnhancedError('删除数据失败:', { error: error instanceof Error ? error.message : String(error)  }));
      return Promise.resolve(false);
    }
  }

  /**
   * 存储数据
   */
  async setItem<T>(
    key: string, 
    value: T, 
    options: StorageOptions = {}
  ): Promise<{
    success: boolean;
    error?: string;
  }> { try {
      const fullKey = this.getFullKey(key, options.namespace);
      
      const storageItem: StorageItem<T> = {
        data: value,
        timestamp: Date.now(),
        ttl: options.ttl,
        encrypted: options.encrypt,
        compressed: options.compress
       };

      let serializedData = JSON.stringify(storageItem);

      // 压缩数据
      if (options.compress) {
        serializedData = await this.compressData(serializedData);
      }

      // 加密数据
      if (options.encrypt) {
        serializedData = await this.encryptData(serializedData);
      }

      // 检查存储配额
      const quotaCheck = await this.checkStorageQuota(serializedData.length);
      if (!quotaCheck.canStore) {
        return {
          success: false,
          error: `存储空间不足，需要 ${quotaCheck.needed} 字节，可用 ${quotaCheck.available} 字节`
        };
      }

      localStorage.setItem(fullKey, serializedData);
      
      return { success: true  };
    } catch (error) { return {
        success: false,
        error: error instanceof Error ? error.message : '存储失败'
      };
    }
  }

  /**
   * 获取数据
   */
  async getItem<T>(
    key: string, 
    defaultValue?: T,
    options: Pick<StorageOptions, 'namespace'> = {}
  ): Promise<T | undefined> {
    try {
      const fullKey = this.getFullKey(key, options.namespace);
      let serializedData = localStorage.getItem(fullKey);
      
      if (!serializedData) {
        return defaultValue;
      }

      // 尝试解析为StorageItem
      let storageItem: StorageItem<T>;
      
      try {
        // 先尝试直接解析（兼容旧数据）
        const directParse = safeJsonParse(serializedData, null);
        if (directParse && typeof directParse === 'object' && 'data' in directParse) {
          storageItem = directParse;
        } else {
          // 可能是加密或压缩的数据
          if (serializedData.startsWith('encrypted:')) {
            serializedData = await this.decryptData(serializedData);
          }
          
          if (serializedData.startsWith('compressed:')) {
            serializedData = await this.decompressData(serializedData);
          }
          
          const parsed = safeJsonParse(serializedData, null);
          storageItem = parsed as unknown as StorageItem<T>;
          if (!storageItem || typeof storageItem !== 'object' || !('data' in storageItem)) {
            // 兼容旧格式数据
            return safeJsonParse(serializedData, defaultValue);
          }
        }
      } catch (error) {
        logger.warn(`解析存储数据失败 (${key}); // SECURITY: Sensitive data filtered`);
        return defaultValue;
      }

      // 检查TTL
      if (storageItem.ttl && storageItem.timestamp) {
        const now = Date.now();
        const expirationTime = storageItem.timestamp + storageItem.ttl;
        
        if (now > expirationTime) {
          // 数据已过期，删除并返回默认值
          await this.removeItem(key, options);
          return defaultValue;
        }
      }

      return storageItem.data;
    } catch (error) {
      logger.error('获取存储数据失败 (${key}): // SECURITY: Sensitive data filtered', new EnhancedError('获取存储数据失败 (${key}): // SECURITY: Sensitive data filtered', { error: error instanceof Error ? error.message : String(error)  }));
      return defaultValue;
    }
  }

  /**
   * 删除数据
   */
  async deleteData(key: string, options: Pick<StorageOptions, 'namespace'> = {}): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key, options.namespace);
      localStorage.removeItem(fullKey);
      return Promise.resolve(true);
    } catch (error) {
      logger.error('删除存储数据失败 (${key}):', new EnhancedError('删除存储数据失败 (${key}):', { error: error instanceof Error ? error.message : String(error)  }));
      return Promise.resolve(false);
    }
  }

  /**
   * 检查键是否存在
   */
  async keyExists(
    key: string,
    options: Pick<StorageOptions, 'namespace'> = {}
  ): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key, options.namespace);
      const item = localStorage.getItem(fullKey);
      
      if (!item) return Promise.resolve(false);

      // 检查是否过期
      try {
        let serializedData = item;
        
        if (serializedData.startsWith('encrypted:')) {
          serializedData = await this.decryptData(serializedData);
        }
        
        if (serializedData.startsWith('compressed:')) {
          serializedData = await this.decompressData(serializedData);
        }
        
        const storageItem = safeJsonParse<{
          ttl?: number;
          timestamp?: number;
          data: unknown;
        } | null>(serializedData, null);
        
        if (storageItem && storageItem.ttl && storageItem.timestamp) {
          const now = Date.now();
          const expirationTime = storageItem.timestamp + storageItem.ttl;
          
          if (now > expirationTime) {
            await this.removeItem(key, options);
            return Promise.resolve(false);
          }
        }
      } catch (error: unknown) {
        // 如果解析失败，假设数据存在但可能损坏
        logger.warn(`检查存储项时解析失败 (${key}); // SECURITY: Sensitive data filtered`);
      }

      return Promise.resolve(true);
    } catch (error: unknown) {
      logger.error('检查存储项失败 (${key}); // SECURITY: Sensitive data filtered:', new EnhancedError('检查存储项失败 (${key}); // SECURITY: Sensitive data filtered:', { error: error instanceof Error ? error.message : String(error)  }));
      return Promise.resolve(false);
    }
  }

  /**
   * 获取所有键
   */
  async getAllKeys(namespace?: string): Promise<string[]> {
    try {
      const targetNamespace = namespace || this.namespace;
      const prefix = `${targetNamespace}:`;
      const keys: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keys.push(key.substring(prefix.length));
        }
      }

      return keys;
    } catch (error) { logger.error('获取所有键失败:', new EnhancedError('获取所有键失败:', { error: error instanceof Error ? error.message : String(error)  }));
      return [];
    }
  }

  /**
   * 清空命名空间下的所有数据
   */
  async clear(namespace?: string): Promise<{
    success: boolean;
    clearedCount: number;
    error?: string;
  }> { try {
      const keys = await this.getAllKeys(namespace);
      let clearedCount = 0;

      for (const key of keys) {
        const success = await this.removeItem(key, { namespace });
        if (success) {
          clearedCount++;
        }
      }

      return {
        success: true,
        clearedCount
      };
    } catch (error) { return {
        success: false,
        clearedCount: 0,
        error: error instanceof Error ? error.message : '清空失败'
      };
    }
  }





  /**
   * 清理过期数据
   */
  async cleanupExpiredItems(namespace?: string): Promise<{
    success: boolean;
    cleanedCount: number;
    freedBytes: number;
    error?: string;
  }> {
    try {
      const keys = await this.getAllKeys(namespace);
      let cleanedCount = 0;
      let freedBytes = 0;

      for (const key of keys) {
        try {
          const fullKey = this.getFullKey(key, namespace);
          const serializedData = localStorage.getItem(fullKey);
          
          if (!serializedData) continue;

          let data = serializedData;
          
          if (data.startsWith('encrypted:')) {
            data = await this.decryptData(data);
          }
          
          if (data.startsWith('compressed:')) {
            data = await this.decompressData(data);
          }
          
          const storageItem = safeJsonParse<{
            ttl?: number;
            timestamp?: number;
            data: unknown;
          } | null>(data, null);
          
          if (storageItem && storageItem.ttl && storageItem.timestamp) { const now = Date.now();
            const expirationTime = storageItem.timestamp + storageItem.ttl;
            
            if (now > expirationTime) {
              freedBytes += serializedData.length + fullKey.length;
              await this.removeItem(key, { namespace });
              cleanedCount++;
            }
          }
        } catch (error) {
          logger.warn(`清理过期项时出错 (${key}); // SECURITY: Sensitive data filtered:`);
        }
      }

      return {
        success: true,
        cleanedCount,
        freedBytes
      };
    } catch (error) { return {
        success: false,
        cleanedCount: 0,
        freedBytes: 0,
        error: error instanceof Error ? error.message : '清理失败'
      };
    }
  }

  /**
   * 批量操作
   */
  async batchSet<T>(
    items: Array<{ key: string; value: T; options?: StorageOptions }>,
    namespace?: string
  ): Promise<{
    success: boolean;
    successCount: number;
    failedItems: Array<{ key: string; error: string }>;
  }> {
    let successCount = 0;
    const failedItems: Array<{ key: string; error: string }> = [];

    for (const item of items) { try {
        const options = { ...item.options, namespace  };
        const result = await this.setItem(item.key, item.value, options);
        
        if (result.success) {
          successCount++;
        } else { 
          failedItems.push({
            key: item.key,
            error: result.error || '未知错误'
          });
        }
      } catch (error) { 
        failedItems.push({
          key: item.key,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }

    return {
        success: failedItems.length === 0,
      successCount,
      failedItems
      };
  }

  /**
   * 批量获取
   */
  async batchGet<T>(
    keys: string[],
    defaultValue?: T,
    namespace?: string
  ): Promise<Record<string, T | undefined>> { 
    const results: Record<string, T | undefined> = {};

    for (const key of keys) { 
      try {
        results[key] = await this.getItem<T>(key, defaultValue, { namespace });
      } catch (error) {
        logger.warn(`批量获取时出错 (${key}); // SECURITY: Sensitive data filtered:`);
        results[key] = defaultValue;
      }
    }

    return results;
  }

  /**
   * 导出数据
   */
  async exportData(namespace?: string): Promise<{
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }> { try {
      const keys = await this.getAllKeys(namespace);
      const data: Record<string, unknown> = { };

      for (const key of keys) { try {
          data[key] = await this.getItem(key, undefined, { namespace });
        } catch (error) {
          logger.warn(`导出数据时跳过项 (${key}); // SECURITY: Sensitive data filtered:`);
        }
      }

      return {
        success: true,
        data
      };
    } catch (error) { return {
        success: false,
        error: error instanceof Error ? error.message : '导出失败'
      };
    }
  }

  /**
   * 导入数据
   */
  async importData(importData: ImportDataRequest): Promise<ImportDataResult> { try {
      const data = importData.data;
      const options = (importData as any).options || { };
      let importedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];
    
      for (const [key, value] of Object.entries(data)) {
        try {
          // 检查是否已存在
          if (!options.overwrite && await this.keyExists(key, options)) {
            skippedCount++;
            continue;
          }
    
          const result = await this.setItem(key, value, options);
          if (result.success) {
            importedCount++;
          } else {
            errors.push(`${key}: ${result.error}`);
          }
        } catch (error) {
          errors.push(`${key}: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
    
      return {
        success: errors.length === 0,
        importedCount,
        skippedCount,
        errors
      };
    } catch (error) {
      console.error('Error in importData:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }
}