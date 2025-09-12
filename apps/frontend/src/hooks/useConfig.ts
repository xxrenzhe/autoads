'use client';

import { useState, useEffect, useCallback } from 'react';
import { RuntimeConfig, ConfigValidationResult, ConfigMetadata } from '@/lib/config/runtime';

interface UseConfigReturn {
  config: RuntimeConfig | null;
  loading: boolean;
  error: string | null;
  validation: ConfigValidationResult | null;
  metadata: ConfigMetadata | null;
  refresh: () => Promise<void>;
  getConfigValue: <T extends keyof RuntimeConfig>(key: T) => RuntimeConfig[T] | undefined;
  isFeatureEnabled: (feature: keyof RuntimeConfig) => boolean;
}

export function useConfig(): UseConfigReturn {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ConfigValidationResult | null>(null);
  const [metadata, setMetadata] = useState<ConfigMetadata | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // 提取配置、验证和元数据
      const { _meta, _validation, ...configData } = data;
      
      setConfig(configData);
      setValidation(_validation || null);
      setMetadata(_meta || null);

      // 在开发环境下，如果有验证错误，记录到控制台
      if (process.env.NODE_ENV === 'development' && _validation && !_validation.isValid) {
        console.warn('Configuration validation warnings:', _validation.warnings);
        if (_validation.errors.length > 0) {
          console.error('Configuration validation errors:', _validation.errors);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch configuration';
      setError(errorMessage);
      console.error('Failed to fetch runtime config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载配置
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // 获取特定配置值的辅助函数
  const getConfigValue = useCallback(<T extends keyof RuntimeConfig>(key: T): RuntimeConfig[T] | undefined => {
    return config?.[key];
  }, [config]);

  // 检查功能是否启用的辅助函数
  const isFeatureEnabled = useCallback((feature: keyof RuntimeConfig): boolean => {
    const value = getConfigValue(feature);
    return value === true || value === 'true';
  }, [getConfigValue]);

  return {
    config,
    loading,
    error,
    validation,
    metadata,
    refresh: fetchConfig,
    getConfigValue,
    isFeatureEnabled,
  };
}

// 便捷的功能检查 hooks
export function useFeatureEnabled(feature: keyof RuntimeConfig): boolean {
  const { isFeatureEnabled, loading } = useConfig();
  
  // 为了避免闪烁，在加载期间返回 false
  if (loading) {
    return false;
  }
  
  return isFeatureEnabled(feature);
}

// 特定功能的 hooks
export function useAnalyticsEnabled(): boolean {
  return useFeatureEnabled('ENABLE_ANALYTICS');
}

export function useDebugMode(): boolean {
  return useFeatureEnabled('DEBUG_MODE');
}

export function useMaintenanceMode(): boolean {
  return useFeatureEnabled('MAINTENANCE_MODE');
}

export function useGoogleAdsAutomationEnabled(): boolean {
  return useFeatureEnabled('GOOGLE_ADS_AUTOMATION_ENABLED');
}

// 获取 API URL 的 hook
export function useApiUrl(): string {
  const { getConfigValue } = useConfig();
  return getConfigValue('API_BASE_URL') || '/api';
}