// 配置存储管理器
// 提供跟踪配置的存储、检索和管理功能

import { TrackingConfiguration } from '../types';
import { StorageManager } from './StorageManager';

export interface ConfigurationStorageOptions {
  encrypt?: boolean;
  backup?: boolean;
  namespace?: string;
  maxConfigurations?: number;
  autoCleanup?: boolean;
}

export interface ConfigurationStats {
  count: number;
  size: number;
  backupCount: number;
  activeCount: number;
  pausedCount: number;
}

export class ConfigurationStorage {
  private storageManager: StorageManager;
  private options: Required<ConfigurationStorageOptions>;

  constructor(options: ConfigurationStorageOptions = {}) {
    this.options = {
      encrypt: options.encrypt ?? true,
      backup: options.backup ?? true,
      namespace: options.namespace || 'tracking-configurations',
      maxConfigurations: options.maxConfigurations || 100,
      autoCleanup: options.autoCleanup ?? false
    };

    this.storageManager = new StorageManager();
  }

  /**
   * 保存配置
   */
  async saveConfiguration(configuration: TrackingConfiguration): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const key = `config:${configuration.id}`;
      
      // 设置更新时间
      configuration.updatedAt = new Date();
      
      const storageResult = await this.storageManager.setItem(
        key,
        configuration,
        { namespace: this.options.namespace,
          encrypt: this.options.encrypt
        });
      // 如果启用备份，创建备份副本
      if (this.options.backup && storageResult.success) {
        const backupKey = `backup:${configuration.id}:${Date.now()}`;
        await this.storageManager.setItem(
          backupKey,
          configuration,
          { namespace: this.options.namespace,
            encrypt: this.options.encrypt
          });
      }

      return {
        success: storageResult.success,
        error: storageResult.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" as any
      };
    }
  }

  /**
   * 获取配置
   */
  async getConfiguration(id: string): Promise<{
    success: boolean;
    configuration?: TrackingConfiguration;
    error?: string;
  }> {
    try {
      const key = `config:${id}`;
      const configuration = await this.storageManager.getItem<TrackingConfiguration>(
        key,
        undefined,
        { namespace: this.options.namespace });
      if (configuration) {
        return {
          success: true,
          configuration
        };
      } else {
        return {
          success: false,
          error: 'Configuration not found'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" as any
      };
    }
  }

  /**
   * 获取所有配置
   */
  async getAllConfigurations(): Promise<{
    success: boolean;
    configurations?: TrackingConfiguration[];
    error?: string;
  }> { try {
      const keys = await this.storageManager.getAllKeys(this.options.namespace);
      const configurations: TrackingConfiguration[] = [];

      for (const key of keys) {
        if (key.startsWith('config:')) {
          const config = await this.storageManager.getItem<TrackingConfiguration>(
            key,
            undefined,
            { namespace: this.options.namespace });
          if (config) {
            configurations.push(config);
          }
        }
      }

      // 按更新时间排序
      configurations.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      return {
        success: true,
        configurations
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" as any
      };
    }
  }

  /**
   * 删除配置
   */
  async deleteConfiguration(id: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const key = `config:${id}`;
      const result = await this.storageManager.deleteData(
        key,
        { namespace: this.options.namespace });
      // 同时删除相关的备份
      if (result && this.options.backup) {
        await this.deleteConfigurationBackups(id);
      }

      return {
        success: result,
        error: result ? undefined : 'Failed to delete configuration'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" as any
      };
    }
  }

  /**
   * 删除配置的所有备份
   */
  private async deleteConfigurationBackups(configId: string): Promise<void> {
    try {
      const keys = await this.storageManager.getAllKeys(this.options.namespace);
      
      for (const key of keys) {
        if (key.startsWith(`backup:${configId}:`)) { await this.storageManager.deleteData(
            key,
            { namespace: this.options.namespace });
        }
      }
    } catch (error) {
      console.error('Failed to delete configuration backups:', error);
    }
  }

  /**
   * 获取配置备份
   */
  async getConfigurationBackups(configId: string): Promise<{
    success: boolean;
    backups?: Array<{
      timestamp: number;
      configuration: TrackingConfiguration;
    }>;
    error?: string;
  }> {
    try {
      const keys = await this.storageManager.getAllKeys(this.options.namespace);
      const backups: Array<{
        timestamp: number;
        configuration: TrackingConfiguration;
      }> = [];

      for (const key of keys) {
        if (key.startsWith(`backup:${configId}:`)) { const timestampStr = key.split(':')[2];
          const timestamp = parseInt(timestampStr, 10);
          
          const configuration = await this.storageManager.getItem<TrackingConfiguration>(
            key,
            undefined,
            { namespace: this.options.namespace });
          if (configuration && !isNaN(timestamp)) { backups.push({
              timestamp,
              configuration
            });
          }
        }
      }

      // 按时间戳排序（最新的在前）
      backups.sort((a, b) => b.timestamp - a.timestamp);

      return {
        success: true,
        backups
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" as any
      };
    }
  }

  /**
   * 恢复配置备份
   */
  async restoreConfigurationBackup(configId: string, timestamp: number): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const backupKey = `backup:${configId}:${timestamp}`;
      const configuration = await this.storageManager.getItem<TrackingConfiguration>(
        backupKey,
        undefined,
        { namespace: this.options.namespace });
      if (configuration) {
        // 保存为当前配置
        const result = await this.saveConfiguration(configuration);
        return result;
      } else {
        return {
          success: false,
          error: 'Backup not found'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" as any
      };
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<ConfigurationStats> {
    try {
      const allConfigs = await this.getAllConfigurations();
      const configurations = allConfigs.configurations || [];

      const activeCount = configurations.filter(c => c.status === 'active').length;
      const pausedCount = configurations.filter(c => c.status === 'paused').length;

      // 计算备份数量
      const keys = await this.storageManager.getAllKeys(this.options.namespace);
      const backupCount = keys.filter(key => key.startsWith('backup:')).length;

      // 计算总大小（近似值）
      let totalSize = 0;
      for (const config of configurations) {
        totalSize += JSON.stringify(config).length;
      }

      return {
        count: configurations.length,
        size: totalSize,
        backupCount,
        activeCount,
        pausedCount
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        count: 0,
        size: 0,
        backupCount: 0,
        activeCount: 0,
        pausedCount: 0
      };
    }
  }

  /**
   * 批量保存配置
   */
  async saveConfigurations(configurations: TrackingConfiguration[]): Promise<{
    success: boolean;
    savedCount: number;
    errors: string[];
  }> {
    let savedCount = 0;
    const errors: string[] = [];

    for (const config of configurations) {
      try {
        const result = await this.saveConfiguration(config);
        if (result.success) {
          savedCount++;
        } else {
          errors.push(`${config.id}: ${result.error}`);
        }
      } catch (error) {
        errors.push(`${config.id}: ${error instanceof Error ? error.message : "Unknown error" as any}`);
      }
    }

    return {
      success: errors.length === 0,
      savedCount,
      errors
    };
  }

  /**
   * 清空所有配置
   */
  async clearAllConfigurations(): Promise<{
    success: boolean;
    deletedCount: number;
    error?: string;
  }> {
    try {
      const allConfigs = await this.getAllConfigurations();
      const configurations = allConfigs.configurations || [];
      let deletedCount = 0;

      for (const config of configurations) {
        const deleteResult = await this.deleteConfiguration(config.id);
        if (deleteResult.success) {
          deletedCount++;
        }
      }

      return {
        success: true,
        deletedCount
      };
    } catch (error) {
      return {
        success: false,
        deletedCount: 0,
        error: error instanceof Error ? error.message : "Unknown error" as any
      };
    }
  }

  /**
   * 搜索配置
   */
  async searchConfigurations(searchTerm: string): Promise<{
    success: boolean;
    configurations?: TrackingConfiguration[];
    error?: string;
  }> {
    try {
      const allConfigs = await this.getAllConfigurations();
      const configurations = allConfigs.configurations || [];

      const filtered = configurations.filter(config => 
        config.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        config.originalLinks.some(link => link.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (config.notificationEmail && config.notificationEmail.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      return {
        success: true,
        configurations: filtered
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" as any
      };
    }
  }
} 