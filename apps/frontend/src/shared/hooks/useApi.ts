"use client";

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';

// API response wrapper
export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

// API error type
export interface ApiError {
  message: string;
  status?: number;
  errors?: Record<string, string[]>;
}

// HTTP methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Request configuration
export interface ApiRequestConfig {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, any>;
}

// Base API client
class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseURL: string = '/api', defaultHeaders: Record<string, string> = {}) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...defaultHeaders
    };
  }

  private buildURL(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(endpoint, window.location.origin + this.baseURL);
    
    if (params) {
      Object.entries(params).forEach(([key, value]: any) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    return url.toString();
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    
    let data: any;
    if (isJson) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const error: ApiError = {
        message: data.message || `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
        errors: data.errors
      };
      throw error;
    }

    return data;
  }

  async request<T = any>(
    endpoint: string, 
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', headers = {}, body, params } = config;
    
    const url = this.buildURL(endpoint, method === 'GET' ? params : undefined);
    
    const requestHeaders = {
      ...this.defaultHeaders,
      ...headers
    };

    // Add auth token if available
    const token = localStorage.getItem('auth-token');
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }

    const requestConfig: RequestInit = {
      method,
      headers: requestHeaders,
      credentials: 'include'
    };

    if (body && method !== 'GET') {
      if (body instanceof FormData) {
        // Remove Content-Type header for FormData (browser will set it with boundary)
        delete requestHeaders['Content-Type'];
        requestConfig.body = body;
      } else {
        requestConfig.body = JSON.stringify(body);
      }
    }

    const response = await fetch(url, requestConfig);
    return this.handleResponse<T>(response);
  }

  // Convenience methods
  get<T = any>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  post<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  put<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body });
  }

  patch<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PATCH', body });
  }

  delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Global API client instance
export const apiClient = new ApiClient();

// useApi hook for queries
export function useApi<T = any>(
  key: string | string[],
  endpoint: string,
  params?: Record<string, any>,
  options?: Omit<UseQueryOptions<ApiResponse<T>, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ApiResponse<T>, ApiError>({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: () => apiClient.get<T>(endpoint, params),
    ...options
  });
}

// useApiMutation hook for mutations
export function useApiMutation<TData = any, TVariables = any>(
  endpoint: string,
  method: HttpMethod = 'POST',
  options?: UseMutationOptions<ApiResponse<TData>, ApiError, TVariables>
) {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<TData>, ApiError, TVariables>({
    mutationFn: (variables: TVariables) => {
      switch (method) {
        case 'POST':
          return apiClient.post<TData>(endpoint, variables);
        case 'PUT':
          return apiClient.put<TData>(endpoint, variables);
        case 'PATCH':
          return apiClient.patch<TData>(endpoint, variables);
        case 'DELETE':
          return apiClient.delete<TData>(endpoint);
        default:
          throw new Error(`Unsupported mutation method: ${method}`);
      }
    },
    onSuccess: (data, variables, context) => {
      // Invalidate related queries on successful mutation
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      options?.onSuccess?.(data, variables, context);
    },
    ...options
  });
}

// useApiState hook for manual API calls with loading state
export function useApiState<T = any>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const execute = useCallback(async (
    endpoint: string,
    config?: ApiRequestConfig
  ): Promise<ApiResponse<T> | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.request<T>(endpoint, config);
      setData(response.data);
      
      return response;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      return null as any;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset
  };
}

// Pagination hook
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function useApiPagination<T = any>(
  key: string,
  endpoint: string,
  initialParams: PaginationParams = {}
) {
  const [params, setParams] = useState<PaginationParams>({
    page: 1,
    limit: 10,
    ...initialParams
  });

  const query = useApi<PaginatedResponse<T>>(
    [key, JSON.stringify(params)],
    endpoint,
    params
  );

  const setPage = useCallback((page: number) => {
    setParams(prev => ({ ...prev, page }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setParams(prev => ({ ...prev, limit, page: 1 }));
  }, []);

  const setSort = useCallback((sortBy: string, sortOrder: 'asc' | 'desc' = 'asc') => {
    setParams(prev => ({ ...prev, sortBy, sortOrder, page: 1 }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setParams(prev => ({ ...prev, search, page: 1 }));
  }, []);

  const resetParams = useCallback(() => {
    setParams(initialParams);
  }, [initialParams]);

  return {
    ...query,
    params,
    setPage,
    setLimit,
    setSort,
    setSearch,
    resetParams,
    pagination: query.data?.data.pagination
  };
}