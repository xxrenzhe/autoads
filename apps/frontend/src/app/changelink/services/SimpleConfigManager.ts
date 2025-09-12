/**
 * 简化的配置管理服务
 * 专注于核心功能：Google Ads 账号、广告联盟链接、AdsPower 环境配置
 */

import { localStorageService, SimpleConfig, GoogleAdsAccount, AdsPowerEnvironment } from './LocalStorageService';
import { EnhancedError } from '@/lib/utils/error-handling';

// Re-export types for convenience
export type { SimpleConfig, GoogleAdsAccount, AdsPowerEnvironment };

class SimpleConfigManager {
  // Google Ads 账号管理
  async addGoogleAdsAccount(account: Omit<GoogleAdsAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return localStorageService.saveAccount(account);
  }

  async getGoogleAdsAccounts(): Promise<GoogleAdsAccount[]> {
    return localStorageService.getAccounts();
  }

  async updateGoogleAdsAccount(id: string, updates: Partial<GoogleAdsAccount>): Promise<boolean> {
    return localStorageService.updateAccount(id, updates);
  }

  async deleteGoogleAdsAccount(id: string): Promise<boolean> {
    // 检查是否有配置使用此账号
    const configs = localStorageService.getConfigs();
    const hasDependencies = configs.some(c => c.googleAdsAccountId === id);
    
    if (hasDependencies) {
      throw new Error('无法删除：存在配置使用此账号');
    }
    
    return localStorageService.deleteAccount(id);
  }

  // AdsPower 环境管理
  async addAdsPowerEnvironment(environment: Omit<AdsPowerEnvironment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return localStorageService.saveEnvironment(environment);
  }

  async getAdsPowerEnvironments(): Promise<AdsPowerEnvironment[]> {
    return localStorageService.getEnvironments();
  }

  async updateAdsPowerEnvironment(id: string, updates: Partial<AdsPowerEnvironment>): Promise<boolean> {
    return localStorageService.updateEnvironment(id, updates);
  }

  async deleteAdsPowerEnvironment(id: string): Promise<boolean> {
    // 检查是否有配置使用此环境
    const configs = localStorageService.getConfigs();
    const hasDependencies = configs.some(c => c.adsPowerEnvironmentId === id);
    
    if (hasDependencies) {
      throw new Error('无法删除：存在配置使用此环境');
    }
    
    return localStorageService.deleteEnvironment(id);
  }

  // 配置管理
  async addConfig(config: Omit<SimpleConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    // 验证关联的账号和环境存在
    const accounts = localStorageService.getAccounts();
    const environments = localStorageService.getEnvironments();
    
    const accountExists = accounts.some(a => a.id === config.googleAdsAccountId);
    const environmentExists = environments.some(e => e.id === config.adsPowerEnvironmentId);
    
    if (!accountExists) {
      throw new Error('Google Ads 账号不存在');
    }
    
    if (!environmentExists) {
      throw new Error('AdsPower 环境不存在');
    }
    
    return localStorageService.saveConfig(config);
  }

  async getConfigs(): Promise<SimpleConfig[]> {
    return localStorageService.getConfigs();
  }

  async updateConfig(id: string, updates: Partial<SimpleConfig>): Promise<boolean> {
    // 如果更新了关联的账号或环境，验证它们存在
    if (updates.googleAdsAccountId || updates.adsPowerEnvironmentId) {
      const accounts = localStorageService.getAccounts();
      const environments = localStorageService.getEnvironments();
      
      if (updates.googleAdsAccountId) {
        const accountExists = accounts.some(a => a.id === updates.googleAdsAccountId);
        if (!accountExists) {
          throw new Error('Google Ads 账号不存在');
        }
      }
      
      if (updates.adsPowerEnvironmentId) {
        const environmentExists = environments.some(e => e.id === updates.adsPowerEnvironmentId);
        if (!environmentExists) {
          throw new Error('AdsPower 环境不存在');
        }
      }
    }
    
    return localStorageService.updateConfig(id, updates);
  }

  async deleteConfig(id: string): Promise<boolean> {
    return localStorageService.deleteConfig(id);
  }

  // 统计信息
  async getStats(): Promise<{
    totalAccounts: number;
    activeAccounts: number;
    totalEnvironments: number;
    activeEnvironments: number;
    totalConfigs: number;
    activeConfigs: number;
    recentExecutions: number;
  }> {
    const stats = localStorageService.getStats();
    return {
      totalAccounts: stats.totalAccounts,
      activeAccounts: stats.activeAccounts,
      totalEnvironments: stats.totalEnvironments,
      activeEnvironments: stats.activeEnvironments,
      totalConfigs: stats.totalConfigs,
      activeConfigs: stats.activeConfigs,
      recentExecutions: stats.recentExecutions
    };
  }

  // 配置验证
  async validateConfiguration(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const accounts = localStorageService.getAccounts();
      const environments = localStorageService.getEnvironments();
      const configs = localStorageService.getConfigs();

      // 检查账号
      if (accounts.length === 0) {
        warnings.push('没有配置 Google Ads 账号');
      }

      accounts.forEach(account => {
        if (!account.customerId || !account.developerToken || !account.refreshToken) {
          errors.push(`账号 "${account.name}" 缺少必要配置`);
        }
      });

      // 检查环境
      if (environments.length === 0) {
        warnings.push('没有配置 AdsPower 环境');
      }

      // 检查配置
      if (configs.length === 0) {
        warnings.push('没有配置自动化任务');
      }

      // 检查配置完整性
      configs.forEach(config => {
        const accountExists = accounts.some(a => a.id === config.googleAdsAccountId);
        const environmentExists = environments.some(e => e.id === config.adsPowerEnvironmentId);

        if (!accountExists) {
          errors.push(`配置 "${config.name}" 引用的 Google Ads 账号不存在`);
        }

        if (!environmentExists) {
          errors.push(`配置 "${config.name}" 引用的 AdsPower 环境不存在`);
        }

        if (!config.affiliateLink) {
          errors.push(`配置 "${config.name}" 缺少广告联盟链接`);
        }
      });

    } catch (error) {
      errors.push(`配置验证失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // 获取配置详情
  async getConfigDetails(id: string): Promise<SimpleConfig | null> {
    const configs = localStorageService.getConfigs();
    return configs.find(c => c.id === id) || null;
  }

  // 获取账号详情
  async getAccountDetails(id: string): Promise<GoogleAdsAccount | null> {
    const accounts = localStorageService.getAccounts();
    return accounts.find(a => a.id === id) || null;
  }

  // 获取环境详情
  async getEnvironmentDetails(id: string): Promise<AdsPowerEnvironment | null> {
    const environments = localStorageService.getEnvironments();
    return environments.find(e => e.id === id) || null;
  }
}

export const simpleConfigManager = new SimpleConfigManager();