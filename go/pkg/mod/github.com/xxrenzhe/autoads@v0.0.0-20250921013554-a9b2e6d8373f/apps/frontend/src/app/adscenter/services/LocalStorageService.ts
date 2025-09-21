/**
 * 简化的本地存储服务
 * 使用 localStorage 替代复杂的 IndexedDB，专注于核心功能
 */

export interface SimpleConfig {
  id: string;
  name: string;
  googleAdsAccountId: string;
  affiliateLink: string;
  adsPowerEnvironmentId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleAdsAccount {
  id: string;
  name: string;
  customerId: string;
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdsPowerEnvironment {
  id: string;
  name: string;
  environmentId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionRecord {
  id: string;
  configId: string;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  logs: string[];
  result?: {
    finalUrl?: string;
    finalUrlSuffix?: string;
    error?: string;
  };
}

class LocalStorageService {
  private readonly CONFIGS_KEY = 'adscenter_configs';
  private readonly ACCOUNTS_KEY = 'adscenter_accounts';
  private readonly ENVIRONMENTS_KEY = 'adscenter_environments';
  private readonly EXECUTIONS_KEY = 'adscenter_executions';

  // 配置管理
  getConfigs(): SimpleConfig[] {
    try {
      const data = localStorage.getItem(this.CONFIGS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveConfig(config: Omit<SimpleConfig, 'id' | 'createdAt' | 'updatedAt'>): string {
    const configs = this.getConfigs();
    const newConfig: SimpleConfig = {
      ...config,
      id: `config_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    configs.push(newConfig);
    localStorage.setItem(this.CONFIGS_KEY, JSON.stringify(configs));
    return newConfig.id;
  }

  updateConfig(id: string, updates: Partial<SimpleConfig>): boolean {
    const configs = this.getConfigs();
    const index = configs.findIndex(c => c.id === id);
    
    if (index === -1) return false;
    
    configs[index] = {
      ...configs[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem(this.CONFIGS_KEY, JSON.stringify(configs));
    return true;
  }

  deleteConfig(id: string): boolean {
    const configs = this.getConfigs();
    const filtered = configs.filter((c: any) => c.id !== id);
    
    if (filtered.length === configs.length) return false;
    
    localStorage.setItem(this.CONFIGS_KEY, JSON.stringify(filtered));
    return true;
  }

  // Google Ads 账号管理
  getAccounts(): GoogleAdsAccount[] {
    try {
      const data = localStorage.getItem(this.ACCOUNTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveAccount(account: Omit<GoogleAdsAccount, 'id' | 'createdAt' | 'updatedAt'>): string {
    const accounts = this.getAccounts();
    const newAccount: GoogleAdsAccount = {
      ...account,
      id: `account_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    accounts.push(newAccount);
    localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
    return newAccount.id;
  }

  updateAccount(id: string, updates: Partial<GoogleAdsAccount>): boolean {
    const accounts = this.getAccounts();
    const index = accounts.findIndex(a => a.id === id);
    
    if (index === -1) return false;
    
    accounts[index] = {
      ...accounts[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
    return true;
  }

  deleteAccount(id: string): boolean {
    const accounts = this.getAccounts();
    const filtered = accounts.filter((a: any) => a.id !== id);
    
    if (filtered.length === accounts.length) return false;
    
    localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(filtered));
    return true;
  }

  // AdsPower 环境管理
  getEnvironments(): AdsPowerEnvironment[] {
    try {
      const data = localStorage.getItem(this.ENVIRONMENTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveEnvironment(env: Omit<AdsPowerEnvironment, 'id' | 'createdAt' | 'updatedAt'>): string {
    const environments = this.getEnvironments();
    const newEnv: AdsPowerEnvironment = {
      ...env,
      id: `env_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    environments.push(newEnv);
    localStorage.setItem(this.ENVIRONMENTS_KEY, JSON.stringify(environments));
    return newEnv.id;
  }

  updateEnvironment(id: string, updates: Partial<AdsPowerEnvironment>): boolean {
    const environments = this.getEnvironments();
    const index = environments.findIndex(e => e.id === id);
    
    if (index === -1) return false;
    
    environments[index] = {
      ...environments[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem(this.ENVIRONMENTS_KEY, JSON.stringify(environments));
    return true;
  }

  deleteEnvironment(id: string): boolean {
    const environments = this.getEnvironments();
    const filtered = environments.filter((e: any) => e.id !== id);
    
    if (filtered.length === environments.length) return false;
    
    localStorage.setItem(this.ENVIRONMENTS_KEY, JSON.stringify(filtered));
    return true;
  }

  // 执行记录管理
  getExecutions(): ExecutionRecord[] {
    try {
      const data = localStorage.getItem(this.EXECUTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveExecution(execution: Omit<ExecutionRecord, 'id' | 'startTime'>): string {
    const executions = this.getExecutions();
    const newExecution: ExecutionRecord = {
      ...execution,
      id: `exec_${Date.now()}`,
      startTime: new Date().toISOString()
    };
    
    executions.push(newExecution);
    localStorage.setItem(this.EXECUTIONS_KEY, JSON.stringify(executions));
    return newExecution.id;
  }

  updateExecution(id: string, updates: Partial<ExecutionRecord>): boolean {
    const executions = this.getExecutions();
    const index = executions.findIndex(e => e.id === id);
    
    if (index === -1) return false;
    
    executions[index] = {
      ...executions[index],
      ...updates
    };
    
    localStorage.setItem(this.EXECUTIONS_KEY, JSON.stringify(executions));
    return true;
  }

  // 清理旧数据
  cleanupOldData(daysToKeep: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    // 清理执行记录
    const executions = this.getExecutions();
    const filteredExecutions = executions.filter(
      e => new Date(e.startTime) > cutoffDate
    );
    
    if (filteredExecutions.length !== executions.length) {
      localStorage.setItem(this.EXECUTIONS_KEY, JSON.stringify(filteredExecutions));
    }
  }

  // 获取统计信息
  getStats(): {
    totalConfigs: number;
    activeConfigs: number;
    totalAccounts: number;
    activeAccounts: number;
    totalEnvironments: number;
    activeEnvironments: number;
    recentExecutions: number;
  } {
    const configs = this.getConfigs();
    const accounts = this.getAccounts();
    const environments = this.getEnvironments();
    const executions = this.getExecutions();
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return {
      totalConfigs: configs.length,
      activeConfigs: configs.filter((c: any) => c.isActive).length,
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter((a: any) => a.isActive).length,
      totalEnvironments: environments.length,
      activeEnvironments: environments.filter((e: any) => e.isActive).length,
      recentExecutions: executions.filter((e: any) => new Date(e.startTime) > oneWeekAgo).length
    };
  }

  // 清空所有数据
  clearAll(): void {
    localStorage.removeItem(this.CONFIGS_KEY);
    localStorage.removeItem(this.ACCOUNTS_KEY);
    localStorage.removeItem(this.ENVIRONMENTS_KEY);
    localStorage.removeItem(this.EXECUTIONS_KEY);
  }
}

export const localStorageService = new LocalStorageService();