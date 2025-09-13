/**
 * 本地数据库服务
 * 使用IndexedDB进行本地数据存储，不依赖后端服务器
 * 
 * 核心功能：
 * 1. 广告数据存储和查询
 * 2. 配置信息管理
 * 3. 邮件订阅管理
 * 4. 系统监控数据存储
 * 5. 数据备份和恢复
 */
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('LocalDatabaseService');

export interface DatabaseConfig {
  name: string;
  version: number;
  stores: {
    [key: string]: {
      keyPath: string;
      indexes?: { [key: string]: string | string[] };
    };
  };
}

export interface AdPerformanceRecord {
  id: string;
  accountId: string;
  accountName: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  adId: string;
  adName: string;
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cost: number;
  conversions: number;
  conversionRate: number;
  costPerConversion: number;
  averagePosition: number;
  qualityScore: number;
  searchImpressionShare: number;
  displayImpressionShare: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: any;
  category: 'google_ads' | 'email' | 'system' | 'user' | 'associations' | 'tasks' | 'executions';
  encrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailSubscriptionRecord {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  reportTypes: string[];
  includeCharts: boolean;
  includeInsights: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSentAt?: Date;
}

export interface SystemMetricsRecord {
  id: string;
  timestamp: Date;
  metricType: string;
  metricName: string;
  value: number;
  metadata: Record<string, any>;
}

export class LocalDatabaseService {
  private db: IDBDatabase | null = null;
  private dbName = 'ChangeLink_LocalDB';
  private dbVersion = 1;
  private isInitialized = false;

  private readonly dbConfig: DatabaseConfig = {
    name: this.dbName,
    version: this.dbVersion,
    stores: {
      adPerformance: {
        keyPath: 'id',
        indexes: {
          accountId: 'accountId',
          date: 'date',
          campaignId: 'campaignId',
          adId: 'adId',
          dateAccount: ['date', 'accountId']
        }
      },
      systemConfig: {
        keyPath: 'id',
        indexes: {
          key: 'key',
          category: 'category'
        }
      },
      emailSubscriptions: {
        keyPath: 'id',
        indexes: {
          email: 'email',
          isActive: 'isActive'
        }
      },
      systemMetrics: {
        keyPath: 'id',
        indexes: {
          timestamp: 'timestamp',
          metricType: 'metricType',
          metricName: 'metricName'
        }
      },
      executionHistory: {
        keyPath: 'id',
        indexes: {
          timestamp: 'timestamp',
          status: 'status',
          type: 'type'
        }
      }
    }
  };

  constructor() {
    this.initialize();
  }

  /**
   * 获取所有键 - 用于构建过程
   */
  async getAllKeys(namespace?: string): Promise<string[]> {
    await this.ensureInitialized();
    
    const transaction = this.db!.transaction(['systemConfig'], 'readonly');
    const store = transaction.objectStore('systemConfig');
    const allConfigs = await this.promisifyRequest(store.getAll()) as SystemConfig[];
    
    return allConfigs?.filter(Boolean)?.map((config: any) => config.key);
  }

  /**
   * 获取项目 - 用于构建过程
   */
  async getItem(key: string, defaultValue?: any, options?: { namespace?: string }): Promise<any> {
    await this.ensureInitialized();
    
    const transaction = this.db!.transaction(['systemConfig'], 'readonly');
    const store = transaction.objectStore('systemConfig');
    const config = await this.promisifyRequest(store.get(`config_${key}`)) as SystemConfig;
    
    return config ? config.value : (defaultValue || null);
  }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // 检查是否在浏览器环境中
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      logger.debug('非浏览器环境，跳过数据库初始化');
      this.isInitialized = true;
      return;
    }

    try {
      this.db = await this.openDatabase();
      this.isInitialized = true;
      logger.info('本地数据库初始化完成', { 
        name: this.dbName, 
        version: this.dbVersion 
      });
    } catch (error) {
      logger.error('数据库初始化失败', new EnhancedError('数据库初始化失败', { error: error instanceof Error ? error.message : String(error)  }));
      throw error;
    }
  }

  /**
   * 打开数据库连接
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('无法打开数据库'));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createStores(db);
      };
    });
  }

  /**
   * 创建数据存储
   */
  private createStores(db: IDBDatabase): void {
    Object.entries(this.dbConfig.stores).forEach(([storeName, config]: any) => {
      if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, { keyPath: config.keyPath });
        // 创建索引
        if (config.indexes) {
          Object.entries(config.indexes).forEach(([indexName, keyPath]: any) => {
            store.createIndex(indexName, keyPath, { unique: false });
          });
        }
        
        logger.debug(`创建数据存储: ${storeName}`);
      }
    });
  }

  /**
   * 广告数据相关操作
   */
  async saveAdPerformanceData(records: AdPerformanceRecord[]): Promise<void> {
    await this.ensureInitialized();
    
    const transaction = this.db!.transaction(['adPerformance'], 'readwrite');
    const store = transaction.objectStore('adPerformance');
    
    const promises = records?.filter(Boolean)?.map((record: any) => {
      const recordWithTimestamp = {
        ...record,
        updatedAt: new Date()
      };
      return this.promisifyRequest(store.put(recordWithTimestamp));
    });
    
    await Promise.all(promises);
    logger.info(`保存广告数据: ${records.length} 条记录`);
  }

  async getAdPerformanceData(
    startDate: string, 
    endDate: string, 
    accountIds?: string[]
  ): Promise<AdPerformanceRecord[]> {
    await this.ensureInitialized();
    
    const transaction = this.db!.transaction(['adPerformance'], 'readonly');
    const store = transaction.objectStore('adPerformance');
    const index = store.index('date');
    
    const range = IDBKeyRange.bound(startDate, endDate);
    const request = index.getAll(range);
    
    const allRecords = await this.promisifyRequest(request) as AdPerformanceRecord[];
    
    // 如果指定了账户ID，进行过滤
    if (accountIds && accountIds.length > 0) {
      return allRecords.filter((record: any) => accountIds.includes(record.accountId));
    }
    
    return allRecords;
  }

  async getLatestDataDate(): Promise<string | null> {
    await this.ensureInitialized();
    
    const transaction = this.db!.transaction(['adPerformance'], 'readonly');
    const store = transaction.objectStore('adPerformance');
    const index = store.index('date');
    
    const request = index.openCursor(null, 'prev');
    const cursor = await this.promisifyRequest(request);
    
    return cursor ? cursor.value.date : null;
  }

  /**
   * 系统配置相关操作
   */
  async saveConfig(key: string, value: any, category: SystemConfig['category'] = 'system'): Promise<void> {
    await this.ensureInitialized();
    
    const config: SystemConfig = {
      id: `config_${key}`,
      key,
      value,
      category,
      encrypted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const transaction = this.db!.transaction(['systemConfig'], 'readwrite');
    const store = transaction.objectStore('systemConfig');
    
    await this.promisifyRequest(store.put(config));
    logger.debug(`保存配置: ${key}`);
  }

  async getConfig(key: string): Promise<any> {
    await this.ensureInitialized();
    
    const transaction = this.db!.transaction(['systemConfig'], 'readonly');
    const store = transaction.objectStore('systemConfig');
    
    const config = await this.promisifyRequest(store.get(`config_${key}`)) as SystemConfig;
    return config ? config.value : null;
  }

  async getAllConfigs(category?: SystemConfig['category']): Promise<SystemConfig[]> {
    await this.ensureInitialized();
    
    const transaction = this.db!.transaction(['systemConfig'], 'readonly');
    const store = transaction.objectStore('systemConfig');
    
    if (category) {
      const index = store.index('category');
      try {

      return await this.promisifyRequest(index.getAll(category)) as SystemConfig[];

      } catch (error) {

        console.error(error);

        return [];

      }
    } else {
      try {

      return await this.promisifyRequest(store.getAll()) as SystemConfig[];

      } catch (error) {

        console.error(error);

        return [];

      }
    }
  }

  /**
   * 邮件订阅相关操作
   */
  async saveEmailSubscription(subscription: Omit<EmailSubscriptionRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    await this.ensureInitialized();
    
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const record: EmailSubscriptionRecord = {
      ...subscription,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const transaction = this.db!.transaction(['emailSubscriptions'], 'readwrite');
    const store = transaction.objectStore('emailSubscriptions');
    
    await this.promisifyRequest(store.put(record));
    logger.info(`保存邮件订阅: ${subscription.email}`);
    
    return id;
  }

  async getEmailSubscriptions(): Promise<EmailSubscriptionRecord[]> {
    await this.ensureInitialized();
    
    const transaction = this.db!.transaction(['emailSubscriptions'], 'readonly');
    const store = transaction.objectStore('emailSubscriptions');
    
    try {

    
    return await this.promisifyRequest(store.getAll()) as EmailSubscriptionRecord[];

    
    } catch (error) {

    
      console.error(error);

    
      return [];

    
    }
  }

  async updateEmailSubscription(id: string, updates: Partial<EmailSubscriptionRecord>): Promise<boolean> {
    await this.ensureInitialized();
    
    const transaction = this.db!.transaction(['emailSubscriptions'], 'readwrite');
    const store = transaction.objectStore('emailSubscriptions');
    
    const existing = await this.promisifyRequest(store.get(id)) as EmailSubscriptionRecord;
    if (!existing) return Promise.resolve(false);
    
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    
    await this.promisifyRequest(store.put(updated));
    return Promise.resolve(true);
  }

  async deleteEmailSubscription(id: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const transaction = this.db!.transaction(['emailSubscriptions'], 'readwrite');
    const store = transaction.objectStore('emailSubscriptions');
    
    const existing = await this.promisifyRequest(store.get(id));
    if (!existing) return Promise.resolve(false);
    
    await this.promisifyRequest(store.delete(id));
    return Promise.resolve(true);
  }

  /**
   * 删除配置项
   */
  async deleteConfig(key: string): Promise<void> {
    await this.ensureInitialized();
    
    const transaction = this.db!.transaction(['systemConfig'], 'readwrite');
    const store = transaction.objectStore('systemConfig');
    
    await this.promisifyRequest(store.delete(`config_${key}`));
    logger.debug(`删除配置: ${key}`);
  }

  /**
   * 系统监控数据相关操作
   */
  async saveSystemMetrics(metrics: Omit<SystemMetricsRecord, 'id'>[]): Promise<void> {
    await this.ensureInitialized();
    
    const transaction = this.db!.transaction(['systemMetrics'], 'readwrite');
    const store = transaction.objectStore('systemMetrics');
    
    const promises = metrics?.filter(Boolean)?.map((metric: any) => {
      const record: SystemMetricsRecord = {
        ...metric,
        id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      return this.promisifyRequest(store.put(record));
    });
    
    await Promise.all(promises);
  }

  async getSystemMetrics(
    metricType?: string, 
    startTime?: Date, 
    endTime?: Date
  ): Promise<SystemMetricsRecord[]> {
    await this.ensureInitialized();
    
    const transaction = this.db!.transaction(['systemMetrics'], 'readonly');
    const store = transaction.objectStore('systemMetrics');
    
    let request: IDBRequest;
    
    if (metricType) {
      const index = store.index('metricType');
      request = index.getAll(metricType);
    } else {
      request = store.getAll();
    }
    
    const allMetrics = await this.promisifyRequest(request) as SystemMetricsRecord[];
    
    // 时间范围过滤
    if (startTime || endTime) {
      return allMetrics.filter((metric: any) => {
        const timestamp = new Date(metric.timestamp);
        if (startTime && timestamp < startTime) return Promise.resolve(false);
        if (endTime && timestamp > endTime) return Promise.resolve(false);
        return Promise.resolve(true);
      });
    }
    
    return allMetrics;
  }

  /**
   * 数据清理和维护
   */
  async cleanupOldData(daysToKeep: number = 90): Promise<void> {
    await this.ensureInitialized();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    // 清理旧的广告数据
    const adTransaction = this.db!.transaction(['adPerformance'], 'readwrite');
    const adStore = adTransaction.objectStore('adPerformance');
    const adIndex = adStore.index('date');
    
    const adRange = IDBKeyRange.upperBound(cutoffDate.toISOString().split('T')[0]);
    const adRequest = adIndex.openCursor(adRange);
    
    let deletedAdRecords = 0;
    adRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        deletedAdRecords++;
        cursor.continue();
      }
    };
    
    // 清理旧的系统监控数据
    const metricsTransaction = this.db!.transaction(['systemMetrics'], 'readwrite');
    const metricsStore = metricsTransaction.objectStore('systemMetrics');
    const metricsIndex = metricsStore.index('timestamp');
    
    const metricsRange = IDBKeyRange.upperBound(cutoffDate);
    const metricsRequest = metricsIndex.openCursor(metricsRange);
    
    let deletedMetricsRecords = 0;
    metricsRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        deletedMetricsRecords++;
        cursor.continue();
      }
    };
    
    logger.info(`数据清理完成`, { deletedAdRecords, 
      deletedMetricsRecords, 
      daysToKeep 
    });
  }

  /**
   * 数据导出
   */
  async exportData(): Promise<{
    adPerformance: AdPerformanceRecord[];
    systemConfig: SystemConfig[];
    emailSubscriptions: EmailSubscriptionRecord[];
    exportTime: Date;
  }> {
    await this.ensureInitialized();
    
    const [adPerformance, systemConfig, emailSubscriptions] = await Promise.all([
      this.promisifyRequest(this.db!.transaction(['adPerformance'], 'readonly').objectStore('adPerformance').getAll()),
      this.promisifyRequest(this.db!.transaction(['systemConfig'], 'readonly').objectStore('systemConfig').getAll()),
      this.promisifyRequest(this.db!.transaction(['emailSubscriptions'], 'readonly').objectStore('emailSubscriptions').getAll())
    ]);
    
    return {
      adPerformance: adPerformance as AdPerformanceRecord[],
      systemConfig: systemConfig as SystemConfig[],
      emailSubscriptions: emailSubscriptions as EmailSubscriptionRecord[],
      exportTime: new Date()
    };
  }

  /**
   * 数据导入
   */
  async importData(data: { adPerformance?: AdPerformanceRecord[];
    systemConfig?: SystemConfig[];
    emailSubscriptions?: EmailSubscriptionRecord[] }): Promise<void> {
    await this.ensureInitialized();
    
    const promises: Promise<any>[] = [];
    
    if (data.adPerformance) {
      promises.push(this.saveAdPerformanceData(data.adPerformance));
    }
    
    if (data.systemConfig) {
      const configTransaction = this.db!.transaction(['systemConfig'], 'readwrite');
      const configStore = configTransaction.objectStore('systemConfig');
      data.systemConfig.forEach((config: any) => {
        promises.push(this.promisifyRequest(configStore.put(config)));
      });
    }
    
    if (data.emailSubscriptions) {
      const subTransaction = this.db!.transaction(['emailSubscriptions'], 'readwrite');
      const subStore = subTransaction.objectStore('emailSubscriptions');
      data.emailSubscriptions.forEach((sub: any) => {
        promises.push(this.promisifyRequest(subStore.put(sub)));
      });
    }
    
    await Promise.all(promises);
    logger.info('数据导入完成');
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<{
    adPerformanceCount: number;
    systemConfigCount: number;
    emailSubscriptionsCount: number;
    systemMetricsCount: number;
    databaseSize: number;
  }> {
    await this.ensureInitialized();
    
    const [adPerformanceCount, systemConfigCount, emailSubscriptionsCount, systemMetricsCount] = await Promise.all([
      this.getRecordCount('adPerformance'),
      this.getRecordCount('systemConfig'),
      this.getRecordCount('emailSubscriptions'),
      this.getRecordCount('systemMetrics')
    ]);
    // 估算数据库大小（简化计算）
    const databaseSize = (adPerformanceCount * 500) + (systemConfigCount * 200) + 
                        (emailSubscriptionsCount * 300) + (systemMetricsCount * 150);
    
    return {
      adPerformanceCount,
      systemConfigCount,
      emailSubscriptionsCount,
      systemMetricsCount,
      databaseSize
    };
  }

  /**
   * 辅助方法
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // 检查是否在浏览器环境中
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined' || !this.db) {
      throw new Error('数据库服务仅在浏览器环境中可用');
    }
  }

  private promisifyRequest<T = any>(request: IDBRequest): Promise<T> { return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getRecordCount(storeName: string): Promise<number> {
    const transaction = this.db!.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    try {

    return await this.promisifyRequest(store.count());

    } catch (error) {

      console.error(error);

      return 0;

    }
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      logger.info('数据库连接已关闭');
    }
  }
}

// 全局数据库服务实例
export const globalDatabaseService = new LocalDatabaseService();