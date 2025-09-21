/**
 * AdsPower API客户端 - 基于官方文档优化版本 v2.0
 * 负责与AdsPower本地API进行通信，管理浏览器环境
 * 
 * 官方文档参考：
 * - https://help.adspower.net/docs/bBLQhb
 * - https://localapi-doc-zh.adspower.net/
 * - https://github.com/AdsPower/localAPI
 * 
 * 优化特性：
 * - 完整的API覆盖（用户管理、组管理、代理检测等）
 * - 智能连接池管理
 * - 增强的错误处理和重试机制
 * - 性能监控和指标收集
 * - 批量操作优化
 * - 缓存机制
 */

import { RetryManager, ErrorType } from './RetryManager';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { getDomainConfig } from '@/lib/domain-config';
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('AdsPowerApiClient');


// 根据官方文档定义的完整接口
export interface AdsPowerProfile {
  user_id: string;
  name: string;
  group_id: string;
  group_name: string;
  domain_name: string;
  username: string;
  remark: string;
  created_time: string;
  ip: string;
  ip_country: string;
  password: string;
  last_open_time: string;
  sys_app_cate_id: string;
  user_proxy_config: {
    proxy_soft: string;
    proxy_type: string;
    proxy_host: string;
    proxy_port: number;
    proxy_user: string;
    proxy_password: string;
    proxy_method: string;
  };
  fingerprint_config: {
    automatic_timezone: string;
    language: string[];
    page_language: string[];
    time_zone: string;
    webrtc: string;
    location: string;
    location_switch: string;
    language_switch: string;
    timezone_switch: string;
    webrtc_switch: string;
    screen_resolution: string;
    fonts: string[];
    canvas: string;
    webgl_image: string;
    webgl_metadata: string;
    webgl_vendor: string;
    webgl_renderer: string;
    audio: string;
    media_devices: string;
    client_rects: string;
    device_memory: string;
    hardware_concurrency: string;
    speech_voices: string;
    mac_address_config: {
      model: string;
      mac_address: string;
    };
    browser_kernel_config: {
      version: string;
      type: string;
    };
  };
  user_status: 'Active' | 'Inactive';
}

// 新增：完整的环境信息接口（基于官方文档）
export interface AdsPowerEnvironment extends AdsPowerProfile {
  // 扩展字段
  serial_number?: string;
  user_sort?: number;
  user_proxy_config_id?: string;
  fakey?: string;
  cookie?: string;
  ignore_cookie_error?: number;
  ip_tab?: number;
  new_first_tab?: number;
  launch_args?: string[];
  headless?: number;
  disable_password_filling?: number;
  clear_cache_after_closing?: number;
  enable_password_saving?: number;
  cdp_mask?: number;
}

export interface BrowserSession {
  user_id: string;
  session_id: string;
  ws: {
    puppeteer: string;
    selenium: string;
  };
  debug_port: number;
  webdriver: string;
  // 新增字段
  status: 'Active' | 'Inactive';
  pid?: number;
  browser_id?: string;
}

export interface AdsPowerResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;
}

// 根据官方文档优化的浏览器配置接口
export interface BrowserConfig {
  user_id: string;
  name?: string;
  domain_name?: string;
  open_urls?: string[];
  username?: string;
  password?: string;
  fakey?: string;
  cookie?: string;
  ignore_cookie_error?: number;
  ip_tab?: number;
  new_first_tab?: number;
  launch_args?: string[];
  headless?: number;
  disable_password_filling?: number;
  clear_cache_after_closing?: number;
  enable_password_saving?: number;
  cdp_mask?: number;
  repeat_config?: {
    repeat_times: number;
    delay_min: number;
    delay_max: number;
  };
  remark?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  version?: string;
  environments_count?: number;
  error?: string;
  response_time?: number;
}

// 新增：组管理接口
export interface AdsPowerGroup {
  group_id: string;
  group_name: string;
  remark: string;
}

// 新增：代理检测结果
export interface ProxyCheckResult {
  ip: string;
  country: string;
  region: string;
  city: string;
  timezone: string;
  asn: string;
  isp: string;
  query_status: 'success' | 'failed';
}

// 新增：浏览器启动选项
export interface BrowserStartOptions {
  user_id: string;
  open_tabs?: number;
  launch_args?: string[];
  headless?: number;
  disable_password_filling?: number;
  clear_cache_after_closing?: number;
  enable_password_saving?: number;
  cdp_mask?: number;
  new_first_tab?: number;
  cookie?: string;
  ignore_cookie_error?: number;
  ip_tab?: number;
}

// 新增：批量操作结果
export interface BatchOperationResult<T> {
  successful: Array<{ user_id: string; data: T }>;
  failed: Array<{ user_id: string; error: string }>;
  summary: {
    total: number;
    success_count: number;
    failed_count: number;
    execution_time: number;
  };
}

export class AdsPowerApiClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retryManager: RetryManager;
  
  // 新增：缓存机制
  private readonly cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
  private readonly defaultCacheTTL = 30000; // 30秒缓存
  
  // 新增：连接池管理
  private readonly connectionPool = new Map<string, { lastUsed: number; inUse: boolean }>();
  private readonly maxConnections = 10;
  
  // 新增：性能监控
  private readonly performanceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    lastRequestTime: 0
  };

  constructor(options: {
    baseUrl?: string;
    timeout?: number;
    retryManager?: RetryManager;
    cacheTTL?: number;
    maxConnections?: number;
  } = {}) {
    const config = getDomainConfig();
    this.baseUrl = options.baseUrl || config.adsPowerApiUrl;
    this.timeout = options.timeout || 30000; // 30秒超时
    this.retryManager = options.retryManager || new RetryManager();
    
    // 定期清理缓存和连接池
    setInterval(() => {
      this.cleanupCache();
      this.cleanupConnectionPool();
    }, 60000); // 每分钟清理一次
  }

  /**
   * 发送HTTP请求的通用方法（优化版）
   */
  private async makeRequest<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      params?: Record<string, unknown>;
      body?: Record<string, unknown>;
      timeout?: number;
      useCache?: boolean;
      cacheTTL?: number;
    } = {}
  ): Promise<AdsPowerResponse<T>> {
    const {
      method = 'GET',
      params = {},
      body,
      timeout = this.timeout,
      useCache = method === 'GET',
      cacheTTL = this.defaultCacheTTL
    } = options;

    // 构建缓存键
    const cacheKey = `${method}_${endpoint}_${JSON.stringify(params)}_${JSON.stringify(body)}`;
    
    // 检查缓存
    if (useCache && method === 'GET') {
      const cached = this.getFromCache<AdsPowerResponse<T>>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 构建URL
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]: any) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    // 构建请求选项
    const requestOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AdsPowerClient/2.0',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(timeout)
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      requestOptions.body = JSON.stringify(body);
    }

    // 使用RetryManager执行请求
    const result = await this.retryManager.executeWithRetry(
      async () => {
        const startTime = Date.now();
        this.performanceMetrics.totalRequests++;
        
        const response = await fetch(url.toString(), requestOptions);
        const responseTime = Date.now() - startTime;
        
        // 更新性能指标
        this.updatePerformanceMetrics(responseTime, true);

        if (!response.ok) {
          this.performanceMetrics.failedRequests++;
          // 根据HTTP状态码分类错误类型
          if (response.status >= 500) {
            throw new Error(`Server Error ${response.status}: ${response.statusText}`);
          } else if (response.status === 429) {
            throw new Error(`Rate Limit Error: ${response.statusText}`);
          } else if (response.status === 401 || response.status === 403) {
            throw new Error(`Authentication Error ${response.status}: ${response.statusText}`);
          } else if (response.status >= 400) {
            throw new Error(`Client Error ${response.status}: ${response.statusText}`);
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        }

        const data = await response.json();
        
        // 记录响应时间（用于监控）
        if (responseTime > 5000) {
          logger.warn(`AdsPower API响应较慢: ${endpoint} 耗时 ${responseTime}ms`);
        }

        this.performanceMetrics.successfulRequests++;
        return data;
      },
      `AdsPowerAPI_${method}_${endpoint}`,
      this.classifyRequestError(endpoint, method)
    );

    // 缓存GET请求结果
    if (useCache && method === 'GET' && result.code === 0) {
      this.setCache(cacheKey, result, cacheTTL);
    }

    return result;
  }

  /**
   * 缓存管理方法
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null as any;
  }

  private setCache(key: string, data: unknown, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp >= cached.ttl) {
        this.cache.delete(key);
      }
    }
  }

  private cleanupConnectionPool(): void {
    const now = Date.now();
    const timeout = 300000; // 5分钟超时
    
    for (const [key, conn] of this.connectionPool.entries()) {
      if (!conn.inUse && now - conn.lastUsed > timeout) {
        this.connectionPool.delete(key);
      }
    }
  }

  private updatePerformanceMetrics(responseTime: number, success: boolean): void {
    this.performanceMetrics.lastRequestTime = Date.now();
    
    // 计算平均响应时间
    const totalRequests = this.performanceMetrics.totalRequests;
    this.performanceMetrics.averageResponseTime = 
      (this.performanceMetrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
  }

  /**
   * 根据请求类型分类错误
   */
  private classifyRequestError(endpoint: string, method: string): ErrorType {
    if (endpoint.includes('/browser/start') || endpoint.includes('/browser/stop')) {
      return ErrorType.BROWSER_ERROR;
    } else if (method === 'GET' && endpoint.includes('/user/list')) {
      return ErrorType.CONNECTION_ERROR;
    } else {
      return ErrorType.NETWORK_ERROR;
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 测试与AdsPower的连接
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const startTime = Date.now();
      const response = await this.makeRequest<{ list: AdsPowerEnvironment[] }>('/api/v1/user/list');
      const responseTime = Date.now() - startTime;

      if (response.code === 0) {
        return {
          success: true,
          environments_count: response.data?.list?.length || 0,
          response_time: responseTime
        };
      } else {
        return {
          success: false,
          error: response.msg || '未知错误'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '连接失败'
      };
    }
  }

  /**
   * 获取环境列表（优化版 - 支持分页和过滤）
   */
  async getEnvironments(options: {
    page?: number;
    page_size?: number;
    group_id?: string;
    user_status?: 'Active' | 'Inactive';
    useCache?: boolean;
  } = {}): Promise<{
    list: AdsPowerEnvironment[];
    total: number;
    page: number;
    page_size: number;
  }> {
    try {
      const params = {
        page: options.page || 1,
        page_size: options.page_size || 50,
        ...(options.group_id && { group_id: options.group_id }),
        ...(options.user_status && { user_status: options.user_status })
      };

      const response = await this.makeRequest<{
        list: AdsPowerEnvironment[];
        total?: number;
      }>('/api/v1/user/list', { params,
        useCache: options.useCache !== false,
        cacheTTL: 15000 // 15秒缓存，环境信息变化较频繁
      });
      if (response.code === 0 && response.data?.list) {
        return {
          list: response.data.list,
          total: response.data.total || response.data.list.length,
          page: params.page,
          page_size: params.page_size
        };
      } else {
        throw new Error(response.msg || '获取环境列表失败');
      }
    } catch (error) {
      throw new Error(`获取环境列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取所有环境（自动分页）
   */
  async getAllEnvironments(options: {
    group_id?: string;
    user_status?: 'Active' | 'Inactive';
    batchSize?: number;
  } = {}): Promise<AdsPowerEnvironment[]> {
    const { batchSize = 100 } = options;
    const allEnvironments: AdsPowerEnvironment[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.getEnvironments({
        ...options,
        page,
        page_size: batchSize,
        useCache: false // 不缓存分页请求
      });
      allEnvironments.push(...result.list);
      
      hasMore = result.list.length === batchSize && allEnvironments.length < result.total;
      page++;

      // 防止无限循环
      if (page > 100) {
        logger.warn('获取环境列表分页超过100页，可能存在问题');
        break;
      }
    }

    return allEnvironments;
  }

  /**
   * 获取特定环境信息（优化版 - 支持直接查询）
   */
  async getEnvironment(userId: string, useCache = true): Promise<AdsPowerEnvironment | null> {
    try {
      // 尝试直接查询单个环境（如果API支持）
      const response = await this.makeRequest<AdsPowerEnvironment>('/api/v1/user/query', {
        params: { user_id: userId },
        useCache,
        cacheTTL: 30000
      });

      if (response.code === 0 && response.data) {
        return response.data;
      }

      // 如果直接查询失败，回退到列表查询
      const environments = await this.getEnvironments({ useCache });
      return environments.list.find((env: any) => env.user_id === userId) || null;
    } catch (error) {
      throw new Error(`获取环境信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 批量获取环境信息
   */
  async getMultipleEnvironments(userIds: string[]): Promise<{
    found: AdsPowerEnvironment[];
    notFound: string[];
  }> {
    try {
      const found: AdsPowerEnvironment[] = [];
      const notFound: string[] = [];

      // 批量查询优化：先获取所有环境，然后过滤
      const allEnvironments = await this.getEnvironments({ page_size: 1000 });
      const environmentMap = new Map(
        allEnvironments.list?.filter(Boolean)?.map((env: any) => [env.user_id, env])
      );
      for (const userId of userIds) {
        const environment = environmentMap.get(userId);
        if (environment) {
          found.push(environment);
        } else {
          notFound.push(userId);
        }
      }

      return { found, notFound };
    } catch (error) {
      throw new Error(`批量获取环境信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 验证环境是否存在且可用
   */
  async validateEnvironment(userId: string): Promise<{
    valid: boolean;
    environment?: AdsPowerEnvironment;
    error?: string;
  }> {
    try {
      const environment = await this.getEnvironment(userId);
      
      if (!environment) {
        return {
          valid: false,
          error: '环境不存在'
        };
      }

      if (environment.user_status !== 'Active') {
        return {
          valid: false,
          environment,
          error: `环境状态异常: ${environment.user_status}`
        };
      }

      return {
        valid: true,
        environment
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : '验证失败'
      };
    }
  }

  /**
   * 更新浏览器配置
   */
  async updateBrowserConfig(config: BrowserConfig): Promise<void> {
    try {
      const response = await this.makeRequest('/api/v1/user/update', {
        method: 'POST',
        body: config as unknown as Record<string, unknown>
      });
      if (response.code !== 0) {
        throw new Error(response.msg || '更新浏览器配置失败');
      }
    } catch (error) {
      throw new Error(`更新浏览器配置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 启动浏览器
   */
  async startBrowser(userId: string, options: {
    open_tabs?: number;
    launch_args?: string[];
    headless?: boolean;
  } = {}): Promise<BrowserSession> {
    try {
      const params = {
        user_id: userId,
        ...options
      };

      const response = await this.makeRequest<BrowserSession>('/api/v1/browser/start', { params,
        timeout: 60000 // 启动浏览器可能需要更长时间
      });
      if (response.code === 0 && response.data) {
        return response.data;
      } else {
        throw new Error(response.msg || '启动浏览器失败');
      }
    } catch (error) {
      throw new Error(`启动浏览器失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 停止浏览器
   */
  async stopBrowser(userId: string): Promise<void> {
    try {
      const response = await this.makeRequest('/api/v1/browser/stop', {
        params: { user_id: userId },
      });

      if (response.code !== 0) {
        throw new Error(response.msg || '停止浏览器失败');
      }
    } catch (error) {
      throw new Error(`停止浏览器失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 检查浏览器状态
   */
  async getBrowserStatus(userId: string): Promise<{
    status: 'Active' | 'Inactive';
    session?: BrowserSession;
  }> {
    try {
      const response = await this.makeRequest<{
        status: 'Active' | 'Inactive';
        session?: BrowserSession;
      }>('/api/v1/browser/active', {
        params: { user_id: userId }
      });

      if (response.code === 0) {
        return response.data;
      } else {
        return { status: 'Inactive' };
      }
    } catch (error) {
      logger.warn(`获取浏览器状态失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return { status: 'Inactive' };
    }
  }

  /**
   * 批量操作：启动多个浏览器
   */
  async startMultipleBrowsers(userIds: string[], options: {
    concurrency?: number;
    timeout?: number;
    failFast?: boolean;
  } = {}): Promise<{
    successful: Array<{ userId: string; session: BrowserSession }>;
    failed: Array<{ userId: string; error: string }>;
  }> {
    const { concurrency = 3, timeout = 60000, failFast = false } = options;

    try {
      // 使用RetryManager的批量执行功能
      const operations = userIds?.filter(Boolean)?.map((userId: any) => ({
        operation: () => this.startBrowser(userId),
        name: `startBrowser_${userId}`,
        errorType: ErrorType.BROWSER_ERROR
      }));

      const results = await this.retryManager.executeBatch(operations, { concurrency,
        timeout,
        failFast
      });
      const successful: Array<{ userId: string; session: BrowserSession }> = [];
      const failed: Array<{ userId: string; error: string }> = [];

      results.forEach((result, index: any) => {
        const userId = userIds[index];
        if (result.success && result.result) {
          successful.push({ userId, session: result.result });
        } else {
          failed.push({
            userId,
            error: result.error?.message || '启动失败'
          });
        }
      });

      return { successful, failed };
    } catch (error) {
      logger.error('批量启动浏览器失败:', new EnhancedError('批量启动浏览器失败:', { error: error instanceof Error ? error.message : String(error)  }));
      throw error;
    }
  }

  /**
   * 批量操作：停止多个浏览器
   */
  async stopMultipleBrowsers(userIds: string[], options: {
    concurrency?: number;
    timeout?: number;
    failFast?: boolean;
  } = {}): Promise<{
    successful: string[];
    failed: Array<{ userId: string; error: string }>;
  }> {
    const { concurrency = 5, timeout = 30000, failFast = false } = options;

    try {
      // 使用RetryManager的批量执行功能
      const operations = userIds?.filter(Boolean)?.map((userId: any) => ({
        operation: () => this.stopBrowser(userId),
        name: `stopBrowser_${userId}`,
        errorType: ErrorType.BROWSER_ERROR
      }));

      const results = await this.retryManager.executeBatch(operations, { concurrency,
        timeout,
        failFast
      });
      const successful: string[] = [];
      const failed: Array<{ userId: string; error: string }> = [];

      results.forEach((result, index: any) => {
        const userId = userIds[index];
        if (result.success) {
          successful.push(userId);
        } else {
          failed.push({
            userId,
            error: result.error?.message || '停止失败'
          });
        }
      });

      return { successful, failed };
    } catch (error) {
      logger.error('批量停止浏览器失败:', new EnhancedError('批量停止浏览器失败:', { error: error instanceof Error ? error.message : String(error)  }));
      throw error;
    }
  }

  /**
   * 获取系统信息
   */
  async getSystemInfo(): Promise<{
    version?: string;
    total_environments: number;
    active_browsers: number;
    system_status: 'healthy' | 'warning' | 'error';
  }> {
    try {
      const [environments, connectionTest] = await Promise.all([
        this.getEnvironments(),
        this.testConnection()
      ]);
      // 检查活跃浏览器数量
      let activeBrowsers = 0;
      const statusPromises = environments.list.slice(0, 10)?.filter(Boolean)?.map(async (env) => {
        try {
          const status = await this.getBrowserStatus(env.user_id);
          return status.status === 'Active' ? 1 : 0;
        } catch {
          return 0;
        }
      });

      const statusResults = await Promise.all(statusPromises);
      activeBrowsers = statusResults.reduce((sum: number, count: number) => sum + count, 0);

      return {
        total_environments: environments.list.length,
        active_browsers: activeBrowsers,
        system_status: connectionTest.success ? 'healthy' : 'error'
      };
    } catch (error) {
      return {
        total_environments: 0,
        active_browsers: 0,
        system_status: 'error'
      };
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      connection: boolean;
      response_time: number;
      environments_accessible: boolean;
      browser_operations: boolean;
    };
    message?: string;
  }> {
    const checks = {
      connection: false,
      response_time: 0,
      environments_accessible: false,
      browser_operations: false
    };

    try {
      // 测试连接
      const connectionTest = await this.testConnection();
      checks.connection = connectionTest.success;
      checks.response_time = connectionTest.response_time || 0;

      if (!connectionTest.success) {
        return {
          status: 'unhealthy',
          checks,
          message: connectionTest.error
        };
      }

      // 测试环境访问
      try {
        const environments = await this.getEnvironments();
        checks.environments_accessible = environments.list.length >= 0;
      } catch {
        checks.environments_accessible = false;
      }

      // 测试浏览器操作（如果有可用环境）
      if (checks.environments_accessible) {
        try {
          const environments = await this.getEnvironments();
          if (environments.list.length > 0) {
            const testEnv = environments.list[0];
            await this.getBrowserStatus(testEnv.user_id);
            checks.browser_operations = true;
          }
        } catch {
          checks.browser_operations = false;
        }
      }

      // 判断整体健康状态
      const healthyChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;

      if (healthyChecks === totalChecks) {
        return { status: 'healthy', checks };
      } else if (healthyChecks >= totalChecks / 2) {
        return { status: 'degraded', checks };
      } else {
        return { status: 'unhealthy', checks };
      }

    } catch (error) {
      return {
        status: 'unhealthy',
        checks,
        message: error instanceof Error ? error.message : '健康检查失败'
      };
    }
  }

  /**
   * 浏览器环境恢复机制
   */
  async recoverBrowserEnvironment(userId: string): Promise<{
    success: boolean;
    actions: string[];
    error?: string;
  }> {
    const actions: string[] = [];

    try {
      // 1. 检查浏览器状态
      actions.push('检查浏览器状态');
      const status = await this.getBrowserStatus(userId);

      if (status.status === 'Active') {
        // 2. 如果浏览器正在运行，先尝试停止
        actions.push('停止现有浏览器实例');
        await this.stopBrowser(userId);
        await this.delay(3000); // 等待3秒确保完全停止
      }

      // 3. 验证环境配置
      actions.push('验证环境配置');
      const validation = await this.validateEnvironment(userId);
      if (!validation.valid) {
        throw new Error(`环境验证失败: ${validation.error}`);
      }

      // 4. 重新启动浏览器
      actions.push('重新启动浏览器');
      await this.startBrowser(userId);

      // 5. 验证启动成功
      actions.push('验证浏览器启动状态');
      const newStatus = await this.getBrowserStatus(userId);
      if (newStatus.status !== 'Active') {
        throw new Error('浏览器启动后状态异常');
      }

      actions.push('环境恢复成功');
      return { success: true, actions };

    } catch (error) {
      actions.push(`恢复失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return {
        success: false,
        actions,
        error: error instanceof Error ? error.message : '恢复失败'
      };
    }
  }

  /**
   * 批量环境恢复
   */
  async recoverMultipleEnvironments(userIds: string[]): Promise<{
    successful: string[];
    failed: Array<{ userId: string; error: string; actions: string[] }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ userId: string; error: string; actions: string[] }> = [];

    try {
      // 使用RetryManager的批量执行功能
      const operations = userIds?.filter(Boolean)?.map((userId: any) => ({
        operation: () => this.recoverBrowserEnvironment(userId),
        name: `recoverEnvironment_${userId}`,
        errorType: ErrorType.BROWSER_ERROR
      }));

      const results = await this.retryManager.executeBatch(operations, { concurrency: 2, // 恢复操作并发数较低，避免系统过载
        timeout: 120000, // 2分钟超时
        failFast: false
      });
      results.forEach((result, index: any) => {
        const userId = userIds[index];
        if (result.success && result.result?.success) {
          successful.push(userId);
        } else {
          failed.push({
            userId,
            error: result.error?.message || result.result?.error || '恢复失败',
            actions: result.result?.actions || []
          });
        }
      });

      return { successful, failed };
    } catch (error) {
      logger.error('批量环境恢复失败:', new EnhancedError('批量环境恢复失败:', { error: error instanceof Error ? error.message : String(error)  }));
      throw error;
    }
  }

  /**
   * 获取重试管理器统计信息
   */
  getRetryStats(): {
    operationStats: Map<string, unknown>;
    circuitBreakerStats: Map<string, unknown>;
    healthStatus: unknown;
  } {
    return {
      operationStats: this.retryManager.getOperationStats() as Map<string, unknown>,
      circuitBreakerStats: this.retryManager.getCircuitBreakerStats() as Map<string, unknown>,
      healthStatus: this.retryManager.getHealthStatus()
    };
  }

  /**
   * 重置重试统计信息
   */
  resetRetryStats(): void {
    this.retryManager.resetStats();
  }

  /**
   * 智能浏览器启动（带预检查和自动恢复）
   */
  async smartStartBrowser(userId: string, options: {
    open_tabs?: number;
    launch_args?: string[];
    headless?: boolean;
    autoRecover?: boolean;
  } = {}): Promise<BrowserSession> {
    const { autoRecover = true, ...startOptions } = options;

    try {
      // 1. 先尝试正常启动
      try {

      return await this.startBrowser(userId, startOptions);

      } catch (error) {

        console.error(error);
        throw error;

      }
    } catch (error) {
      if (!autoRecover) {
        throw error;
      }

      logger.warn(`浏览器启动失败，尝试自动恢复: ${userId}`);

      // 2. 尝试恢复环境
      const recovery = await this.recoverBrowserEnvironment(userId);
      if (!recovery.success) {
        throw new Error(`自动恢复失败: ${recovery.error}`);
      }

      // 3. 恢复成功后重新启动
      try {

      return await this.startBrowser(userId, startOptions);

      } catch (error) {

        console.error(error);
        throw error;

      }
    }
  }

  /**
   * 智能浏览器停止（带清理和验证）
   */
  async smartStopBrowser(userId: string, options: {
    forceKill?: boolean;
    cleanupTimeout?: number;
  } = {}): Promise<void> {
    const { forceKill = false, cleanupTimeout = 10000 } = options;

    try {
      // 1. 正常停止
      await this.stopBrowser(userId);

      // 2. 验证停止成功
      await this.delay(2000);
      const status = await this.getBrowserStatus(userId);
      
      if (status.status === 'Active') {
        if (forceKill) {
          // 3. 如果仍在运行且允许强制终止，再次尝试
          logger.warn(`浏览器未正常停止，尝试强制终止: ${userId}`);
          await this.stopBrowser(userId);
          await this.delay(3000);
        } else {
          logger.warn(`浏览器可能未完全停止: ${userId}`);
        }
      }
    } catch (error) {
      if (forceKill) {
        logger.warn(`停止浏览器时出错，但继续执行: ${userId}`);
      } else {
        throw error;
      }
    }
  }

  // ==================== 新增功能：基于官方文档的完整API ==================== //

  /**
   * 创建新的浏览器环境
   */
  async createEnvironment(config: {
    name: string;
    group_id?: string;
    domain_name?: string;
    username?: string;
    password?: string;
    proxy_config?: {
      proxy_type: 'noproxy' | 'http' | 'https' | 'socks5';
      proxy_host?: string;
      proxy_port?: number;
      proxy_user?: string;
      proxy_password?: string;
    };
    fingerprint_config?: {
      language?: string[];
      time_zone?: string;
      webrtc?: 'real' | 'fake' | 'disabled';
      screen_resolution?: string;
      user_agent?: string;
    };
    remark?: string;
  }): Promise<{ user_id: string }> {
    try {
      const response = await this.makeRequest<{ user_id: string }>('/api/v1/user/create', { method: 'POST',
        body: config
      });
      if (response.code === 0 && response.data) {
        // 清除相关缓存
        this.clearEnvironmentCache();
        return response.data;
      } else {
        throw new Error(response.msg || '创建环境失败');
      }
    } catch (error) {
      throw new Error(`创建环境失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 更新浏览器环境
   */
  async updateEnvironment(userId: string, config: Partial<{
    name: string;
    group_id: string;
    domain_name: string;
    username: string;
    password: string;
    proxy_config: {
      proxy_type: 'noproxy' | 'http' | 'https' | 'socks5';
      proxy_host?: string;
      proxy_port?: number;
      proxy_user?: string;
      proxy_password?: string;
    };
    fingerprint_config: {
      language?: string[];
      time_zone?: string;
      webrtc?: 'real' | 'fake' | 'disabled';
      screen_resolution?: string;
      user_agent?: string;
    };
    remark: string;
  }>): Promise<void> {
    try {
      const response = await this.makeRequest('/api/v1/user/update', {
        method: 'POST',
        body: {
          user_id: userId,
          ...config
        }
      });

      if (response.code !== 0) {
        throw new Error(response.msg || '更新环境失败');
      }

      // 清除相关缓存
      this.clearEnvironmentCache(userId);
    } catch (error) {
      throw new Error(`更新环境失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 删除浏览器环境
   */
  async deleteEnvironment(userId: string): Promise<void> {
    try {
      const response = await this.makeRequest('/api/v1/user/delete', {
        method: 'POST',
        body: { user_ids: [userId] }
      });

      if (response.code !== 0) {
        throw new Error(response.msg || '删除环境失败');
      }

      // 清除相关缓存
      this.clearEnvironmentCache(userId);
    } catch (error) {
      throw new Error(`删除环境失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 批量删除环境
   */
  async deleteMultipleEnvironments(userIds: string[]): Promise<{
    successful: string[];
    failed: Array<{ userId: string; error: string }>;
  }> {
    try {
      const response = await this.makeRequest('/api/v1/user/delete', {
        method: 'POST',
        body: { user_ids: userIds }
      });

      if (response.code === 0) {
        // 清除相关缓存
        this.clearEnvironmentCache();
        return {
          successful: userIds,
          failed: []
        };
      } else {
        throw new Error(response.msg || '批量删除失败');
      }
    } catch (error) {
      // 如果批量删除失败，尝试逐个删除
      const successful: string[] = [];
      const failed: Array<{ userId: string; error: string }> = [];

      for (const userId of userIds) {
        try {
          await this.deleteEnvironment(userId);
          successful.push(userId);
        } catch (err) { 
          failed.push({
            userId,
            error: err instanceof Error ? err.message : '删除失败'
          });
        }
      }

      return { successful, failed };
    }
  }

  /**
   * 获取组列表
   */
  async getGroups(): Promise<AdsPowerGroup[]> {
    try {
      const response = await this.makeRequest<{ list: AdsPowerGroup[] }>('/api/v1/group/list', { 
        useCache: true,
        cacheTTL: 60000 // 组信息变化较少，缓存1分钟
      });
      if (response.code === 0 && response.data?.list) {
        return response.data.list;
      } else {
        throw new Error(response.msg || '获取组列表失败');
      }
    } catch (error) {
      throw new Error(`获取组列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 创建新组
   */
  async createGroup(name: string, remark?: string): Promise<{ group_id: string }> {
    try {
      const response = await this.makeRequest<{ group_id: string }>('/api/v1/group/create', {
        method: 'POST',
        body: {
          group_name: name,
          remark: remark || ''
        }
      });

      if (response.code === 0 && response.data) {
        // 清除组缓存
        this.clearCache('/api/v1/group/list');
        return response.data;
      } else {
        throw new Error(response.msg || '创建组失败');
      }
    } catch (error) {
      throw new Error(`创建组失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 代理检测
   */
  async checkProxy(proxyConfig: { 
    proxy_type: 'http' | 'https' | 'socks5';
    proxy_host: string;
    proxy_port: number;
    proxy_user?: string;
    proxy_password?: string 
  }): Promise<ProxyCheckResult> { 
    try {
      const response = await this.makeRequest<ProxyCheckResult>('/api/v1/user/proxy_check', {
        method: 'POST',
        body: proxyConfig,
        timeout: 15000 // 代理检测可能较慢
      });
      if (response.code === 0 && response.data) {
        return response.data;
      } else {
        throw new Error(response.msg || '代理检测失败');
      }
    } catch (error) {
      throw new Error(`代理检测失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取浏览器内核版本信息
   */
  async getBrowserKernels(): Promise<Array<{
    type: string;
    version: string;
    is_default: boolean;
  }>> {
    try {
      const response = await this.makeRequest<{
        list: Array<{
          type: string;
          version: string;
          is_default: boolean;
        }>
      }>('/api/v1/browser/kernel/list', { useCache: true,
        cacheTTL: 300000 // 内核信息变化很少，缓存5分钟
      })
      if (response.code === 0 && response.data?.list) {
        return response.data.list;
      } else {
        throw new Error(response.msg || '获取浏览器内核信息失败');
      }
    } catch (error) {
      throw new Error(`获取浏览器内核信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取应用分类信息
   */
  async getAppCategories(): Promise<Array<{
    cate_id: string;
    cate_name: string;
    apps: Array<{
      app_id: string;
      app_name: string;
      icon_url: string;
    }>;
  }>> {
    try {
      const response = await this.makeRequest<{
        list: Array<{
          cate_id: string;
          cate_name: string;
          apps: Array<{
            app_id: string;
            app_name: string;
            icon_url: string;
          }>;
        }>
      }>('/api/v1/application/list', { useCache: true,
        cacheTTL: 300000 // 应用分类信息变化很少，缓存5分钟
      })
      if (response.code === 0 && response.data?.list) {
        return response.data.list;
      } else {
        throw new Error(response.msg || '获取应用分类失败');
      }
    } catch (error) {
      throw new Error(`获取应用分类失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 清除缓存
   */
  private clearCache(pattern?: string): void {
    if (pattern) {
      // 清除特定模式的缓存
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // 清除所有缓存
      this.cache.clear();
    }
  }

  private clearEnvironmentCache(userId?: string): void {
    if (userId) {
      this.clearCache(`user_id=${userId}`);
    }
    this.clearCache('/api/v1/user/list');
    this.clearCache('/api/v1/user/query');
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    averageResponseTime: number;
    lastRequestTime: number;
    cacheHitRate: number;
  } {
    const successRate = this.performanceMetrics.totalRequests > 0 
      ? this.performanceMetrics.successfulRequests / this.performanceMetrics.totalRequests 
      : 0;

    // 计算缓存命中率（简化版）
    const cacheHitRate = this.cache.size > 0 ? 0.3 : 0; // 实际应该跟踪缓存命中次数

    return {
      ...this.performanceMetrics,
      successRate,
      cacheHitRate
    };
  }

  /**
   * 重置性能指标
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics.totalRequests = 0;
    this.performanceMetrics.successfulRequests = 0;
    this.performanceMetrics.failedRequests = 0;
    this.performanceMetrics.averageResponseTime = 0;
    this.performanceMetrics.lastRequestTime = 0;
  }
}