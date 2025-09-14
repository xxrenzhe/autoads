/**
 * 安全配置管理器
 * 提供加密配置存储、用户认证和安全管理的统一接口
 */

import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('SecureConfigurationManager');

// 懒加载数据库服务以避免服务器端执行
let globalDatabaseService: any = null;

async function getDatabaseService() {
  if (!globalDatabaseService) {
    if (typeof window !== 'undefined') {
      const { globalDatabaseService: dbService } = await import('./LocalDatabaseService');
      globalDatabaseService = dbService;
    } else {
      throw new Error('数据库服务仅在浏览器环境中可用');
    }
  }
  return globalDatabaseService;
}

// 用户配置接口
export interface UserConfig {
  userId: string;
  username?: string;
  email?: string;
  setupCompleted: boolean;
  createdAt: Date;
  updatedAt?: Date;
  adsPowerConfig?: any;
  googleAdsConfig?: any;
  notificationSettings?: any;
  [key: string]: any;
}

// 单例类
export class SecureConfigurationManager {
  private static instance: SecureConfigurationManager;
  private currentUser: UserConfig | null = null;
  private isAuthenticated = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): SecureConfigurationManager {
    if (!SecureConfigurationManager.instance) {
      SecureConfigurationManager.instance = new SecureConfigurationManager();
    }
    return SecureConfigurationManager.instance;
  }

  private async initialize(): Promise<void> {
    try {
      logger.info('初始化安全配置管理器');
      // 尝试加载现有用户配置
      await this.loadUserConfig();
    } catch (error) {
      logger.error('安全配置管理器初始化失败:', new EnhancedError('安全配置管理器初始化失败:', { error: error instanceof Error ? error.message : String(error) 
       }));
    }
  }

  /**
   * 获取安全配置
   */
  async getSecureConfig(): Promise<UserConfig | null> {
    try {
      if (!this.currentUser) {
        await this.loadUserConfig();
      }
      return this.currentUser;
    } catch (error) {
      logger.error('获取安全配置失败:', new EnhancedError('获取安全配置失败:', { error: error instanceof Error ? error.message : String(error) 
       }));
      return null as any;
    }
  }

  /**
   * 保存安全配置
   */
  async saveSecureConfig(config: Partial<UserConfig>): Promise<boolean> {
    try {
      if (!this.currentUser) {
        this.currentUser = {
          userId: config.userId || `user_${Date.now()}`,
          setupCompleted: false,
          createdAt: new Date(),
          ...config
        };
      } else {
        this.currentUser = {
          ...this.currentUser,
          ...config,
          updatedAt: new Date()
        };
      }

      await (await getDatabaseService()).saveConfig('user_secure_config', this.currentUser, 'system');
      logger.info('安全配置保存成功', { userId: this.currentUser.userId });
      return Promise.resolve(true);
    } catch (error) {
      logger.error('保存安全配置失败:', new EnhancedError('保存安全配置失败:', { error: error instanceof Error ? error.message : String(error) 
       }));
      return Promise.resolve(false);
    }
  }

  /**
   * 用户认证
   */
  async authenticate(credentials: { password: string; username?: string }): Promise<boolean> {
    try {
      // 简化的认证逻辑 - 在实际应用中应该使用更安全的方式
      if (credentials.password) {
        this.isAuthenticated = true;
        logger.info('用户认证成功', { username: credentials.username });
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    } catch (error) {
      logger.error('用户认证失败:', new EnhancedError('用户认证失败:', { error: error instanceof Error ? error.message : String(error) 
       }));
      return Promise.resolve(false);
    }
  }

  /**
   * 检查认证状态
   */
  isUserAuthenticated(): Promise<boolean> {
    return Promise.resolve(this.isAuthenticated);
  }

  /**
   * 加载用户配置
   */
  private async loadUserConfig(): Promise<void> {
    try {
      const config = await (await getDatabaseService()).getConfig('user_secure_config');
      if (config) {
        this.currentUser = config as UserConfig;
        logger.info('用户配置加载成功', { userId: this.currentUser.userId });
      }
    } catch (error) {
      logger.error('加载用户配置失败:', new EnhancedError('加载用户配置失败:', { error: error instanceof Error ? error.message : String(error) 
       }));
    }
  }

  /**
   * 更新配置项
   */
  async updateConfig(key: string, value: any): Promise<boolean> {
    try {
      if (!this.currentUser) {
        logger.error('无法更新配置：用户未初始化');
        return Promise.resolve(false);
      }

      this.currentUser = {
        ...this.currentUser,
        [key]: value
      };

      try {


      return await this.saveSecureConfig(this.currentUser);


      } catch (error) {


        console.error(error);


        return false;


      }
    } catch (error) {
      logger.error('更新配置失败:', new EnhancedError('更新配置失败:', { error: error instanceof Error ? error.message : String(error) 
       }));
      return Promise.resolve(false);
    }
  }

  /**
   * 获取配置项
   */
  async getConfig(key: string): Promise<any> {
    try {
      const config = await this.getSecureConfig();
      return config ? config[key] : null;
    } catch (error) {
      logger.error('获取配置项失败:', new EnhancedError('获取配置项失败:', { error: error instanceof Error ? error.message : String(error) 
       }));
      return null as any;
    }
  }

  /**
   * 清除用户配置
   */
  async clearConfig(): Promise<boolean> {
    try {
      this.currentUser = null;
      this.isAuthenticated = false;
      await (await getDatabaseService()).deleteConfig('user_secure_config');
      logger.info('用户配置已清除');
      return Promise.resolve(true);
    } catch (error) {
      logger.error('清除用户配置失败:', new EnhancedError('清除用户配置失败:', { error: error instanceof Error ? error.message : String(error) 
       }));
      return Promise.resolve(false);
    }
  }
}

// 导出全局实例
export const secureConfigManager = SecureConfigurationManager.getInstance();