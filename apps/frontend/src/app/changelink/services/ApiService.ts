import { EnhancedError } from '@/lib/utils/error-handling';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { useApiUrl } from '@/hooks/useConfig';
const logger = createClientLogger('ApiService');

/**
 * Google Ads自动化平台 API 服务层
 * 统一处理所有后端API调用和数据处理
 */

import { 
  TrackingConfiguration, 
  ExecutionResult, 
  ExecutionStatus,
  PerformanceMetrics,
  ScheduledTask,
  User,
  UserRole,
  Permission,
  AuditEvent,
  Integration,
  IntegrationConfig,
  EmailNotificationConfig,
  SystemStatus,
  ExportJob,
  ApiResponse,
  PaginatedResponse
} from '../types';

// API 基础配置
const API_TIMEOUT = 30000; // 30秒超时

// 获取API URL的函数
const getApiBaseUrl = () => {
  // 在客户端使用 hook，在服务器端使用环境变量
  if (typeof window === 'undefined') {
    return process.env.API_URL || process.env.API_BASE_URL || '/api';
  }
  
  // 为了避免在服务器端渲染时使用 hook，我们直接读取全局配置
  if ((window as any).__RUNTIME_CONFIG__) {
    return (window as any).__RUNTIME_CONFIG__.API_BASE_URL || 
           (window as any).__RUNTIME_CONFIG__.API_URL || 
           '/api';
  }
  
  return '/api';
};

// 请求拦截器
const createRequest = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const API_BASE_URL = getApiBaseUrl();
  const url = `${API_BASE_URL}${endpoint}`;
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...config,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// 响应处理
const handleResponse = async <T>(response: Response): Promise<ApiResponse<T>> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
};

// 通用API方法
const api = {
  get: async <T>(endpoint: string): Promise<ApiResponse<T>> => {
    const response = await createRequest(endpoint);
    return handleResponse<T>(response);
  },

  post: async <T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> => {
    const response = await createRequest(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },

  put: async <T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> => {
    const response = await createRequest(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },

  delete: async <T>(endpoint: string): Promise<ApiResponse<T>> => {
    const response = await createRequest(endpoint, {
      method: 'DELETE',
    });
    return handleResponse<T>(response);
  },

  patch: async <T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> => {
    const response = await createRequest(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },
};

// 配置管理 API
export const ConfigurationAPI = {
  // 获取所有配置
  getAll: async (): Promise<TrackingConfiguration[]> => {
    try {
        const response = await api.get<TrackingConfiguration[]>('/configurations');
        return response.data || [];
    } catch (error) {
      console.error('Error in getAll:', error);
      throw error; // Re-throw to maintain error propagation
    }
  },

  // 获取分页配置
  getPaginated: async (page: number, pageSize: number): Promise<PaginatedResponse<TrackingConfiguration>> => {
    try {
        const response = await api.get<PaginatedResponse<TrackingConfiguration>>(
          `/configurations?page=${page}&pageSize=${pageSize}`
        );
        return response.data || { items: [], total: 0, page, pageSize, hasNext: false, hasPrev: false };
    } catch (error) {
      console.error('Error in getPaginated:', error);
      throw error; // Re-throw to maintain error propagation
    }
  },

  // 获取单个配置
  getById: async (id: string): Promise<TrackingConfiguration | null> => {
    try {
        const response = await api.get<TrackingConfiguration>(`/configurations/${id}`);
        return response.data || null;
    } catch (error) {
      console.error('Error in getById:', error);
      throw error; // Re-throw to maintain error propagation
    }
  },

  // 创建配置
  create: async (configuration: Partial<TrackingConfiguration>): Promise<TrackingConfiguration> => {
    try {
      const response = await api.post<TrackingConfiguration>('/configurations', configuration);
      return response.data!;
    } catch (error) {
      console.error('Error in create:', error);
      throw error;
    }
  },

  // 更新配置
  update: async (id: string, configuration: Partial<TrackingConfiguration>): Promise<TrackingConfiguration> => {
    try {
      const response = await api.put<TrackingConfiguration>(`/configurations/${id}`, configuration);
      return response.data!;
    } catch (error) {
      console.error('Error in update:', error);
      throw error;
    }
  },

  // 删除配置
  delete: async (id: string): Promise<boolean> => {
    try {
      const response = await api.delete<{ success: boolean }>(`/configurations/${id}`);
      return response.data?.success || false;
    } catch (error) {
      console.error('Error in delete:', error);
      throw error;
    }
  },

  // 验证配置
  validate: async (configuration: Partial<TrackingConfiguration>): Promise<{ isValid: boolean; errors: string[] }> => {
    try {
      const response = await api.post<{ isValid: boolean; errors: string[] }>('/configurations/validate', configuration);
      return response.data || { isValid: false, errors: [] };
    } catch (error) {
      console.error('Error in validate:', error);
      throw error;
    }
  },

  // 复制配置
  duplicate: async (id: string, newName: string): Promise<TrackingConfiguration> => {
    try {
      const response = await api.post<TrackingConfiguration>(`/configurations/${id}/duplicate`, { name: newName });
      return response.data!;
    } catch (error) {
      console.error('Error in duplicate:', error);
      throw error;
    }
  },

  // 启用/禁用配置
  toggleStatus: async (id: string, status: 'active' | 'inactive'): Promise<TrackingConfiguration> => {
    try {
      const response = await api.patch<TrackingConfiguration>(`/configurations/${id}/status`, { status });
      return response.data!;
    } catch (error) {
      console.error('Error in toggleStatus:', error);
      throw error;
    }
  },
};

// 执行管理 API
export const ExecutionAPI = {
  // 获取所有执行结果
  getAll: async (): Promise<ExecutionResult[]> => {
    try {
      const response = await api.get<ExecutionResult[]>('/executions');
      return response.data || [];
    } catch (error) {
      console.error('Error in getAll:', error);
      throw error;
    }
  },

  // 获取分页执行结果
  getPaginated: async (page: number, pageSize: number): Promise<PaginatedResponse<ExecutionResult>> => {
    try {
      const response = await api.get<PaginatedResponse<ExecutionResult>>(
        `/executions?page=${page}&pageSize=${pageSize}`
      );
      return response.data || { items: [], total: 0, page, pageSize, hasNext: false, hasPrev: false };
    } catch (error) {
      console.error('Error in getPaginated:', error);
      throw error;
    }
  },

  // 获取单个执行结果
  getById: async (id: string): Promise<ExecutionResult | null> => {
    try {
      const response = await api.get<ExecutionResult>(`/executions/${id}`);
      return response.data || null;
    } catch (error) {
      console.error('Error in getById:', error);
      throw error;
    }
  },

  // 根据配置ID获取执行结果
  getByConfiguration: async (configurationId: string, limit: number): Promise<ExecutionResult[]> => {
    try {
      const response = await api.get<ExecutionResult[]>(
        `/executions/by-configuration/${configurationId}?limit=${limit}`
      );
      return response.data || [];
    } catch (error) {
      console.error('Error in getByConfiguration:', error);
      throw error;
    }
  },

  // 获取最近的执行结果
  getRecent: async (limit: number): Promise<ExecutionResult[]> => {
    try {
      const response = await api.get<ExecutionResult[]>(`/executions/recent?limit=${limit}`);
      return response.data || [];
    } catch (error) {
      console.error('Error in getRecent:', error);
      throw error;
    }
  },

  // 获取运行中的执行
  getRunning: async (): Promise<ExecutionResult[]> => {
    try {
      const response = await api.get<ExecutionResult[]>('/executions/running');
      return response.data || [];
    } catch (error) {
      console.error('Error in getRunning:', error);
      throw error;
    }
  },

  // 开始执行
  start: async (configurationId: string, options?: Record<string, unknown>): Promise<ExecutionResult> => {
    try {
      const response = await api.post<ExecutionResult>('/executions/start', {
        configurationId,
        ...options,
      });
      return response.data!;
    } catch (error) {
      console.error('Error in start:', error);
      throw error;
    }
  },

  // 停止执行
  stop: async (executionId: string): Promise<boolean> => {
    try {
      const response = await api.post<{ success: boolean }>(`/executions/${executionId}/stop`);
      return response.data?.success || false;
    } catch (error) {
      console.error('Error in stop:', error);
      throw error;
    }
  },

  // 删除执行结果
  delete: async (id: string): Promise<boolean> => {
    try {
      const response = await api.delete<{ success: boolean }>(`/executions/${id}`);
      return response.data?.success || false;
    } catch (error) {
      console.error('Error in delete:', error);
      throw error;
    }
  },

  // 批量删除执行结果
  deleteMultiple: async (ids: string[]): Promise<{ success: boolean; deletedCount: number }> => {
    try {
      const response = await api.post<{ success: boolean; deletedCount: number }>('/executions/batch-delete', { ids });
      return response.data || { success: false, deletedCount: 0 };
    } catch (error) {
      console.error('Error in deleteMultiple:', error);
      throw error;
    }
  },

  // 获取执行统计
  getStatistics: async (configurationId?: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    running: number;
    pending: number;
    successRate: number;
    avgExecutionTime: number;
  }> => {
    try {
      const endpoint = configurationId 
        ? `/executions/statistics?configurationId=${configurationId}`
        : '/executions/statistics';
      const response = await api.get<{
        total: number; completed: number; failed: number; running: number; pending: number; successRate: number; avgExecutionTime: number;
      }>(endpoint);
      return response.data || {
        total: 0,
        completed: 0,
        failed: 0,
        running: 0,
        pending: 0,
        successRate: 0,
        avgExecutionTime: 0,
      };
    } catch (error) {
      console.error('Error in getStatistics:', error);
      throw error;
    }
  },
};

// 性能分析 API
export const AnalyticsAPI = {
  // 获取性能指标
  getMetrics: async (startDate?: Date, endDate?: Date): Promise<PerformanceMetrics[]> => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      
      const response = await api.get<PerformanceMetrics[]>(`/analytics/metrics?${params}`);
      return response.data || [];
    } catch (error) {
      console.error('Error in getMetrics:', error);
      throw error;
    }
  },

  // 获取趋势分析
  getTrends: async (period: 'day' | 'week' | 'month' | 'year'): Promise<{
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
    }>;
  }> => {
    try {
      const response = await api.get<{ labels: string[]; datasets: { label: string; data: number[] }[] }>(`/analytics/trends?period=${period}`);
      return response.data || { labels: [], datasets: [] };
    } catch (error) {
      console.error('Error in getTrends:', error);
      throw error;
    }
  },

  // 获取瓶颈分析
  getBottlenecks: async (): Promise<Array<{
    type: string;
    description: string;
    impact: number;
    suggestions: string[];
  }>> => {
    try {
      const response = await api.get<Array<{ type: string; description: string; impact: number; suggestions: string[] }>>('/analytics/bottlenecks');
      return response.data || [];
    } catch (error) {
      console.error('Error in getBottlenecks:', error);
      throw error;
    }
  },

  // 获取推荐
  getRecommendations: async (): Promise<Array<{
    category: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    estimatedImpact: string;
  }>> => {
    try {
      const response = await api.get<Array<{ category: string; title: string; description: string; priority: 'low'|'medium'|'high'; estimatedImpact: string }>>('/analytics/recommendations');
      return response.data || [];
    } catch (error) {
      console.error('Error in getRecommendations:', error);
      throw error;
    }
  },
};

// 调度管理 API
export const SchedulingAPI = {
  // 获取所有调度任务
  getAll: async (): Promise<ScheduledTask[]> => {
    try {
      const response = await api.get<ScheduledTask[]>('/scheduling/tasks');
      return response.data || [];
    } catch (error) {
      console.error('Error in getAll:', error);
      throw error;
    }
  },

  // 创建调度任务
  create: async (task: Partial<ScheduledTask>): Promise<ScheduledTask> => {
    try {
      const response = await api.post<ScheduledTask>('/scheduling/tasks', task);
      return response.data!;
    } catch (error) {
      console.error('Error in create:', error);
      throw error;
    }
  },

  // 更新调度任务
  update: async (id: string, task: Partial<ScheduledTask>): Promise<ScheduledTask> => {
    try {
      const response = await api.put<ScheduledTask>(`/scheduling/tasks/${id}`, task);
      return response.data!;
    } catch (error) {
      console.error('Error in update:', error);
      throw error;
    }
  },

  // 删除调度任务
  delete: async (id: string): Promise<boolean> => {
    try {
      const response = await api.delete<{ success: boolean }>(`/scheduling/tasks/${id}`);
      return response.data?.success || false;
    } catch (error) {
      console.error('Error in delete:', error);
      throw error;
    }
  },

  // 启用/禁用调度任务
  toggleStatus: async (id: string, enabled: boolean): Promise<ScheduledTask> => {
    try {
      const response = await api.patch<ScheduledTask>(`/scheduling/tasks/${id}/status`, { enabled });
      return response.data!;
    } catch (error) {
      console.error('Error in toggleStatus:', error);
      throw error;
    }
  },

  // 立即执行调度任务
  executeNow: async (id: string): Promise<ExecutionResult> => {
    try {
      const response = await api.post<ExecutionResult>(`/scheduling/tasks/${id}/execute`);
      return response.data!;
    } catch (error) {
      console.error('Error in executeNow:', error);
      throw error;
    }
  },
};

// 通知管理 API
export const NotificationAPI = {
  // 获取通知配置
  getConfig: async (): Promise<EmailNotificationConfig> => {
    try {
      const response = await api.get<EmailNotificationConfig>('/notifications/config');
      return response.data!;
    } catch (error) {
      console.error('Error in getConfig:', error);
      throw error;
    }
  },

  // 更新通知配置
  updateConfig: async (config: Partial<EmailNotificationConfig>): Promise<EmailNotificationConfig> => {
    try {
      const response = await api.put<EmailNotificationConfig>('/notifications/config', config);
      return response.data!;
    } catch (error) {
      console.error('Error in updateConfig:', error);
      throw error;
    }
  },

  // 发送测试通知
  sendTest: async (recipients: string[]): Promise<boolean> => {
    try {
      const response = await api.post<{ success: boolean }>('/notifications/test', { recipients });
      return response.data?.success || false;
    } catch (error) {
      console.error('Error in sendTest:', error);
      throw error;
    }
  },

  // 获取通知历史
  getHistory: async (page: number, pageSize: number): Promise<PaginatedResponse<{
    id: string;
    type: string;
    recipient: string;
    subject: string;
    status: 'sent' | 'failed';
    sentAt: Date;
  }>> => {
    try {
      const response = await api.get<PaginatedResponse<{ id: string; type: string; recipient: string; subject: string; status: 'sent'|'failed'; sentAt: Date }>>(`/notifications/history?page=${page}&pageSize=${pageSize}`);
      return response.data || { items: [], total: 0, page, pageSize, hasNext: false, hasPrev: false };
    } catch (error) {
      console.error('Error in getHistory:', error);
      throw error;
    }
  },
};

// 用户管理 API
export const UserAPI = {
  // 获取所有用户
  getAll: async (): Promise<User[]> => {
    try {
      const response = await api.get<User[]>('/users');
      return response.data || [];
    } catch (error) {
      console.error('Error in getAll:', error);
      throw error;
    }
  },

  // 获取分页用户
  getPaginated: async (page: number, pageSize: number): Promise<PaginatedResponse<User>> => {
    try {
      const response = await api.get<PaginatedResponse<User>>(`/users?page=${page}&pageSize=${pageSize}`);
      return response.data || { items: [], total: 0, page, pageSize, hasNext: false, hasPrev: false };
    } catch (error) {
      console.error('Error in getPaginated:', error);
      throw error;
    }
  },

  // 获取单个用户
  getById: async (id: string): Promise<User | null> => {
    try {
      const response = await api.get<User>(`/users/${id}`);
      return response.data || null;
    } catch (error) {
      console.error('Error in getById:', error);
      throw error;
    }
  },

  // 创建用户
  create: async (user: Partial<User>): Promise<User> => {
    try {
      const response = await api.post<User>('/users', user);
      return response.data!;
    } catch (error) {
      console.error('Error in create:', error);
      throw error;
    }
  },

  // 更新用户
  update: async (id: string, user: Partial<User>): Promise<User> => {
    try {
      const response = await api.put<User>(`/users/${id}`, user);
      return response.data!;
    } catch (error) {
      console.error('Error in update:', error);
      throw error;
    }
  },

  // 删除用户
  delete: async (id: string): Promise<boolean> => {
    try {
      const response = await api.delete<{ success: boolean }>(`/users/${id}`);
      return response.data?.success || false;
    } catch (error) {
      console.error('Error in delete:', error);
      throw error;
    }
  },

  // 获取角色
  getRoles: async (): Promise<UserRole[]> => {
    try {
      const response = await api.get<UserRole[]>('/users/roles');
      return response.data || [];
    } catch (error) {
      console.error('Error in getRoles:', error);
      throw error;
    }
  },

  // 获取权限
  getPermissions: async (): Promise<Permission[]> => {
    try {
      const response = await api.get<Permission[]>('/users/permissions');
      return response.data || [];
    } catch (error) {
      console.error('Error in getPermissions:', error);
      throw error;
    }
  },
};

// 审计日志 API
export const AuditAPI = {
  // 获取审计日志
  async getLogs(
    page: number,
    pageSize: number,
    filters?: {
      userId?: string;
      action?: string;
      resource?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<PaginatedResponse<AuditEvent>> {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());
        
        if (filters?.userId) params.append('userId', filters.userId);
        if (filters?.action) params.append('action', filters.action);
        if (filters?.resource) params.append('resource', filters.resource);
        if (filters?.startDate) params.append('startDate', filters.startDate.toISOString());
        if (filters?.endDate) params.append('endDate', filters.endDate.toISOString());
    
        const response = await api.get<PaginatedResponse<AuditEvent>>(`/audit/logs?${params}`);
        return response.data || { items: [], total: 0, page, pageSize, hasNext: false, hasPrev: false };
    } catch (error) {
      console.error('Error in getLogs:', error);
      throw error; // Re-throw to maintain error propagation
    }
  },

  // 导出审计日志
  async exportLogs(filters?: {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ downloadUrl: string }> {
    try {
      const response = await api.post<{ downloadUrl: string }>('/audit/export', filters);
      return response.data!;
    } catch (error) {
      console.error('Error in exportLogs:', error);
      throw error;
    }
  },
};

// 集成管理 API
export const IntegrationAPI = {
  // 获取所有集成
  getAll: async (): Promise<Integration[]> => {
    try {
      const response = await api.get<Integration[]>('/integrations');
      return response.data || [];
    } catch (error) {
      console.error('Error in getAll:', error);
      throw error;
    }
  },

  // 获取单个集成
  getById: async (id: string): Promise<Integration | null> => {
    try {
      const response = await api.get<Integration>(`/integrations/${id}`);
      return response.data || null;
    } catch (error) {
      console.error('Error in getById:', error);
      throw error;
    }
  },

  // 创建集成
  create: async (integration: Partial<Integration>): Promise<Integration> => {
    try {
      const response = await api.post<Integration>('/integrations', integration);
      return response.data!;
    } catch (error) {
      console.error('Error in create:', error);
      throw error;
    }
  },

  // 更新集成
  update: async (id: string, integration: Partial<Integration>): Promise<Integration> => {
    try {
      const response = await api.put<Integration>(`/integrations/${id}`, integration);
      return response.data!;
    } catch (error) {
      console.error('Error in update:', error);
      throw error;
    }
  },

  // 删除集成
  delete: async (id: string): Promise<boolean> => {
    try {
      const response = await api.delete<{ success: boolean }>(`/integrations/${id}`);
      return response.data?.success || false;
    } catch (error) {
      console.error('Error in delete:', error);
      throw error;
    }
  },

  // 测试集成连接
  testConnection: async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.post<{ success: boolean; message: string }>(`/integrations/${id}/test`);
      return response.data!;
    } catch (error) {
      console.error('Error in testConnection:', error);
      throw error;
    }
  },

  // 同步集成数据
  syncData: async (id: string): Promise<{ success: boolean; syncedCount: number }> => {
    try {
      const response = await api.post<{ success: boolean; syncedCount: number }>(`/integrations/${id}/sync`);
      return response.data!;
    } catch (error) {
      console.error('Error in syncData:', error);
      throw error;
    }
  },
};

// 系统管理 API
export const SystemAPI = {
  // 获取系统状态
  getStatus: async (): Promise<SystemStatus> => {
    try {
      const response = await api.get<SystemStatus>('/system/status');
      return response.data!;
    } catch (error) {
      console.error('Error in getStatus:', error);
      throw error;
    }
  },

  // 获取系统设置
  getSettings: async (): Promise<Record<string, unknown>> => {
    try {
      const response = await api.get<Record<string, unknown>>('/system/settings');
      return response.data || {};
    } catch (error) {
      console.error('Error in getSettings:', error);
      throw error;
    }
  },

  // 更新系统设置
  updateSettings: async (settings: Record<string, unknown>): Promise<Record<string, unknown>> => {
    try {
      const response = await api.put<Record<string, unknown>>('/system/settings', settings);
      return response.data!;
    } catch (error) {
      console.error('Error in updateSettings:', error);
      throw error;
    }
  },

  // 创建备份
  createBackup: async (description?: string): Promise<{ backupId: string; downloadUrl: string }> => {
    try {
      const response = await api.post<{ backupId: string; downloadUrl: string }>('/system/backup', { description });
      return response.data!;
    } catch (error) {
      console.error('Error in createBackup:', error);
      throw error;
    }
  },

  // 恢复备份
  restoreBackup: async (backupId: string): Promise<boolean> => {
    try {
      const response = await api.post<{ success: boolean }>(`/system/backup/${backupId}/restore`);
      return response.data?.success || false;
    } catch (error) {
      console.error('Error in restoreBackup:', error);
      throw error;
    }
  },

  // 获取备份列表
  getBackups: async (): Promise<Array<{
    id: string;
    description: string;
    createdAt: Date;
    size: number;
  }>> => {
    try {
      const response = await api.get<Array<{ id: string; description: string; createdAt: Date; size: number }>>('/system/backups');
      return (response && (response as any).data) || [];
    } catch (error) {
      console.error('Error in getBackups:', error);
      throw error;
    }
  },
};

// 数据导出/导入 API
export const DataAPI = {
  // 创建导出任务
  createExport: async (options: {
    type: 'configurations' | 'executions' | 'all';
    format: 'json' | 'csv' | 'excel';
    dateRange?: { start: Date; end: Date };
    includeMetadata?: boolean;
  }): Promise<ExportJob> => {
    try {
      const response = await api.post<ExportJob>('/data/export', options);
      return response.data!;
    } catch (error) {
      console.error('Error in createExport:', error);
      throw error;
    }
  },

  // 获取导出任务状态
  getExportStatus: async (jobId: string): Promise<ExportJob> => {
    try {
      const response = await api.get<ExportJob>(`/data/export/${jobId}`);
      return response.data!;
    } catch (error) {
      console.error('Error in getExportStatus:', error);
      throw error;
    }
  },

  // 获取导出任务列表
  getExports: async (): Promise<ExportJob[]> => {
    try {
      const response = await api.get<ExportJob[]>('/data/exports');
      return response.data || [];
    } catch (error) {
      console.error('Error in getExports:', error);
      throw error;
    }
  },

  // 导入数据
  importData: async (file: File, options: {
    type: 'configurations' | 'executions' | 'all';
    overwrite?: boolean;
  }): Promise<{ success: boolean; importedCount: number; errors: string[] }> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', options.type);
      formData.append('overwrite', options.overwrite?.toString() || 'false');
  
      const API_BASE_URL = getApiBaseUrl();
      const response = await fetch(`${API_BASE_URL}/data/import`, {
        method: 'POST',
        body: formData,
      });
  
      const data: any = await response.json();
      return (data && data.data) || { success: false, importedCount: 0, errors: [] };
    } catch (error) {
      console.error('Error in importData:', error);
      throw error;
    }
  },
};

// 实时更新 API
export const RealtimeAPI = {
  // 建立WebSocket连接
  connect: (onMessage: (data: any) => void): WebSocket => {
    const API_BASE_URL = getApiBaseUrl();
    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/realtime`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        logger.error('WebSocket message parsing error:', new EnhancedError('WebSocket message parsing error:', { error: error instanceof Error ? error.message : String(error)  }));
      }
    };

    return ws;
  },

  // 订阅执行更新
  subscribeToExecution: (executionId: string, onUpdate: (execution: ExecutionResult) => void): () => void => {
    const ws = RealtimeAPI.connect((data: any) => {
      if (data && data.type === 'execution_update' && data.executionId === executionId) {
        onUpdate(data.execution as ExecutionResult);
      }
    });

    ws.onopen = () => {
      const subscriptionMessage = {
        type: 'subscribe',
        channel: 'execution',
        executionId,
      };
      ws.send(JSON.stringify(subscriptionMessage));
    };

    return () => ws.close();
  },

  // 订阅系统状态更新
  subscribeToSystemStatus: (onUpdate: (status: SystemStatus) => void): () => void => {
    const ws = RealtimeAPI.connect((data: any) => {
      if (data && data.type === 'system_status_update') {
        onUpdate(data.status as SystemStatus);
      }
    });

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'system_status'
      }));
    };

    return () => ws.close();
  },
};

// 导出所有API
export const API = {
  configurations: ConfigurationAPI,
  executions: ExecutionAPI,
  analytics: AnalyticsAPI,
  scheduling: SchedulingAPI,
  notifications: NotificationAPI,
  users: UserAPI,
  audit: AuditAPI,
  integrations: IntegrationAPI,
  system: SystemAPI,
  data: DataAPI,
  realtime: RealtimeAPI,
};

export default API; 
