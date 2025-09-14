/**
 * AdsPower API 客户端
 * 基于 AdsPower Local API 文档实现
 * 参考: https://localapi-doc-zh.adspower.net/
 */

import axios, { AxiosInstance } from 'axios';
import { getCachedRemoteConfig } from '@/lib/config/remote-config';
import { getConfigValue } from '@/lib/config/remote-config';
import { v4 as uuidv4 } from 'uuid';
import { EnhancedError } from '@/lib/utils/error-handling';

export interface AdsPowerProfile {
  id: string;
  name: string;
  group_id?: string;
  status: 'Active' | 'Offline' | 'Error';
  created_time: string;
  last_open_time?: string;
  chrome_version?: string;
  proxy?: {
    type: 'http' | 'https' | 'socks5';
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
}

export interface AdsPowerBrowserConfig {
  profile_id: string;
  headless?: boolean;
  window_size?: {
    width: number;
    height: number;
  };
  position?: {
    x: number;
    y: number;
  };
  language?: string;
  user_agent?: string;
}

export interface BrowserResponse {
  code: number;
  msg: string;
  data: {
    ws?: string;
    port?: number;
    selenium_port?: number;
    chrome_port?: number;
    debug_port?: number;
    profile_id: string;
    status: string;
  };
}

export interface CreateProfileResponse {
  code: number;
  msg: string;
  data: {
    profile_id: string;
    name: string;
    group_id?: string;
    serial_number: string;
    created_time: string;
  };
}

export interface BrowserTab {
  id: number;
  url: string;
  title: string;
  active: boolean;
}

export class AdsPowerApiClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else {
      const snap = getCachedRemoteConfig();
      const remote = snap ? (getConfigValue<string>('integrations.adsPower.apiUrl', snap) || getConfigValue<string>('Integrations.AdsPower.BaseURL', snap)) : undefined;
      this.baseUrl = remote || process.env.NEXT_PUBLIC_ADSPOWER_API_URL || 'http://local.adspower.net:50325';
    }
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        console.log(`AdsPower API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('AdsPower API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => {
        const { data } = response;
        if (data.code !== 0) {
          console.warn(`AdsPower API Warning: ${data.msg} (Code: ${data.code})`);
        }
        return response;
      },
      (error) => {
        console.error('AdsPower API Response Error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * 检查服务状态
   */
  async checkStatus(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v1/user/status');
      return response.data.code === 0;
    } catch (error) {
      console.error('AdsPower status check failed:', error);
      return false;
    }
  }

  /**
   * 获取所有浏览器配置文件
   */
  async getProfiles(): Promise<AdsPowerProfile[]> {
    try {
      const response = await this.client.get('/api/v1/user/list');
      if (response.data.code === 0) {
        return response.data.data.list || [];
      }
      throw new Error(response.data.msg);
    } catch (error) {
      console.error('Failed to get AdsPower profiles:', error);
      throw error;
    }
  }

  /**
   * 创建新的浏览器配置文件
   */
  async createProfile(name: string, groupId?: string): Promise<CreateProfileResponse> {
    try {
      const response = await this.client.post('/api/v1/user/create', {
        name,
        group_id: groupId,
      });
      
      if (response.data.code === 0) {
        return response.data;
      }
      throw new Error(response.data.msg);
    } catch (error) {
      console.error('Failed to create AdsPower profile:', error);
      throw error;
    }
  }

  /**
   * 启动浏览器
   */
  async startBrowser(profileId: string, config?: Partial<AdsPowerBrowserConfig>): Promise<BrowserResponse> {
    try {
      const response = await this.client.post('/api/v1/browser/start', {
        profile_id: profileId,
        ...config,
      });

      if (response.data.code === 0) {
        return response.data;
      }
      throw new Error(response.data.msg);
    } catch (error) {
      console.error('Failed to start AdsPower browser:', error);
      throw error;
    }
  }

  /**
   * 关闭浏览器
   */
  async closeBrowser(profileId: string): Promise<boolean> {
    try {
      const response = await this.client.post('/api/v1/browser/stop', {
        profile_id: profileId,
      });

      return response.data.code === 0;
    } catch (error) {
      console.error('Failed to close AdsPower browser:', error);
      return false;
    }
  }

  /**
   * 重新启动浏览器
   */
  async restartBrowser(profileId: string): Promise<BrowserResponse> {
    try {
      await this.closeBrowser(profileId);
      // 等待2秒确保浏览器完全关闭
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        return await this.startBrowser(profileId);
      } catch (error) {
        console.error(error);
        return {
          code: 500,
          msg: error instanceof Error ? error.message : 'Unknown error',
          data: {
            profile_id: profileId,
            status: 'error'
          }
        };
      }
    } catch (error) {
      console.error('Failed to restart AdsPower browser:', error);
      throw error;
    }
  }

  /**
   * 获取浏览器状态
   */
  async getBrowserStatus(profileId: string): Promise<BrowserResponse> {
    try {
      const response = await this.client.get('/api/v1/browser/active', {
        params: { profile_id: profileId },
      });

      if (response.data.code === 0) {
        return response.data;
      }
      throw new Error(response.data.msg);
    } catch (error) {
      console.error('Failed to get AdsPower browser status:', error);
      throw error;
    }
  }

  /**
   * 打开新标签页
   */
  async openTab(profileId: string, url: string, active: boolean = true): Promise<{ tab_id: number }> {
    try {
      const response = await this.client.post('/api/v1/browser/new-tab', {
        profile_id: profileId,
        url,
        active,
      });

      if (response.data.code === 0) {
        return { tab_id: response.data.data.tab_id };
      }
      throw new Error(response.data.msg);
    } catch (error) {
      console.error('Failed to open tab in AdsPower browser:', error);
      throw error;
    }
  }

  /**
   * 关闭标签页
   */
  async closeTab(profileId: string, tabId: number): Promise<boolean> {
    try {
      const response = await this.client.post('/api/v1/browser/close-tab', {
        profile_id: profileId,
        tab_id: tabId,
      });

      return response.data.code === 0;
    } catch (error) {
      console.error('Failed to close tab in AdsPower browser:', error);
      return false;
    }
  }

  /**
   * 获取所有标签页
   */
  async getTabs(profileId: string): Promise<BrowserTab[]> {
    try {
      const response = await this.client.get('/api/v1/browser/tabs', {
        params: { profile_id: profileId },
      });

      if (response.data.code === 0) {
        return response.data.data.tabs || [];
      }
      throw new Error(response.data.msg);
    } catch (error) {
      console.error('Failed to get tabs from AdsPower browser:', error);
      throw error;
    }
  }

  /**
   * 获取当前活动标签页
   */
  async getActiveTab(profileId: string): Promise<BrowserTab | null> {
    try {
      const tabs = await this.getTabs(profileId);
      return tabs.find((tab: any) => tab.active) || null;
    } catch (error) {
      console.error('Failed to get active tab from AdsPower browser:', error);
      return null;
    }
  }

  /**
   * 导航到指定URL
   */
  async navigateTo(profileId: string, url: string): Promise<boolean> {
    try {
      const response = await this.client.post('/api/v1/browser/navigate', {
        profile_id: profileId,
        url,
      });

      return response.data.code === 0;
    } catch (error) {
      console.error('Failed to navigate in AdsPower browser:', error);
      return false;
    }
  }

  /**
   * 获取当前页面URL
   */
  async getCurrentUrl(profileId: string): Promise<string> {
    try {
      const response = await this.client.get('/api/v1/browser/current-url', {
        params: { profile_id: profileId },
      });

      if (response.data.code === 0) {
        return response.data.data.url;
      }
      throw new Error(response.data.msg);
    } catch (error) {
      console.error('Failed to get current URL from AdsPower browser:', error);
      throw error;
    }
  }

  /**
   * 等待页面加载完成
   */
  async waitForPageLoad(profileId: string, timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await this.client.get('/api/v1/browser/page-ready', {
          params: { profile_id: profileId },
        });

        if (response.data.code === 0 && response.data.data.ready) {
          return true;
        }
      } catch (error) {
        // 继续等待
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return false;
  }

  /**
   * 执行JavaScript代码
   */
  async executeScript(profileId: string, script: string): Promise<any> {
    try {
      const response = await this.client.post('/api/v1/browser/run-js', {
        profile_id: profileId,
        script,
      });

      if (response.data.code === 0) {
        return response.data.data.result;
      }
      throw new Error(response.data.msg);
    } catch (error) {
      console.error('Failed to execute script in AdsPower browser:', error);
      throw error;
    }
  }

  /**
   * 获取页面标题
   */
  async getPageTitle(profileId: string): Promise<string> {
    try {
      const response = await this.client.get('/api/v1/browser/title', {
        params: { profile_id: profileId },
      });

      if (response.data.code === 0) {
        return response.data.data.title;
      }
      throw new Error(response.data.msg);
    } catch (error) {
      console.error('Failed to get page title from AdsPower browser:', error);
      throw error;
    }
  }

  /**
   * 截图
   */
  async screenshot(profileId: string, savePath?: string): Promise<string> {
    try {
      const response = await this.client.post('/api/v1/browser/screenshot', {
        profile_id: profileId,
        save_path: savePath,
      });

      if (response.data.code === 0) {
        return response.data.data.image_path;
      }
      throw new Error(response.data.msg);
    } catch (error) {
      console.error('Failed to take screenshot in AdsPower browser:', error);
      throw error;
    }
  }

  /**
   * 清理浏览器缓存
   */
  async clearCache(profileId: string): Promise<boolean> {
    try {
      const response = await this.client.post('/api/v1/browser/clear-cache', {
        profile_id: profileId,
      });

      return response.data.code === 0;
    } catch (error) {
      console.error('Failed to clear cache in AdsPower browser:', error);
      return false;
    }
  }

  /**
   * 设置浏览器代理
   */
  async setProxy(profileId: string, proxy: {
    type: 'http' | 'https' | 'socks5';
    host: string;
    port: number;
    username?: string;
    password?: string;
  }): Promise<boolean> {
    try {
      const response = await this.client.post('/api/v1/browser/set-proxy', {
        profile_id: profileId,
        proxy_type: proxy.type,
        proxy_host: proxy.host,
        proxy_port: proxy.port,
        proxy_user: proxy.username,
        proxy_password: proxy.password,
      });

      return response.data.code === 0;
    } catch (error) {
      console.error('Failed to set proxy in AdsPower browser:', error);
      return false;
    }
  }

  /**
   * 获取浏览器版本信息
   */
  async getBrowserVersion(profileId: string): Promise<string> {
    try {
      const response = await this.client.get('/api/v1/browser/version', {
        params: { profile_id: profileId },
      });

      if (response.data.code === 0) {
        return response.data.data.version;
      }
      throw new Error(response.data.msg);
    } catch (error) {
      console.error('Failed to get browser version from AdsPower browser:', error);
      throw error;
    }
  }

  /**
   * 获取浏览器配置文件信息
   */
  async getProfileInfo(profileId: string): Promise<AdsPowerProfile> {
    try {
      const response = await this.client.get('/api/v1/user/profile', {
        params: { profile_id: profileId },
      });

      if (response.data.code === 0) {
        return response.data.data;
      }
      throw new Error(response.data.msg);
    } catch (error) {
      console.error('Failed to get profile info from AdsPower:', error);
      throw error;
    }
  }

  /**
   * 更新浏览器配置文件
   */
  async updateProfile(profileId: string, updates: {
    name?: string;
    group_id?: string;
    remark?: string;
  }): Promise<boolean> {
    try {
      const response = await this.client.post('/api/v1/user/update', {
        profile_id: profileId,
        ...updates,
      });

      return response.data.code === 0;
    } catch (error) {
      console.error('Failed to update AdsPower profile:', error);
      return false;
    }
  }

  /**
   * 删除浏览器配置文件
   */
  async deleteProfile(profileId: string): Promise<boolean> {
    try {
      const response = await this.client.post('/api/v1/user/delete', {
        profile_id: profileId,
      });

      return response.data.code === 0;
    } catch (error) {
      console.error('Failed to delete AdsPower profile:', error);
      return false;
    }
  }
}

// 导出单例实例
export const adsPowerClient = new AdsPowerApiClient();
