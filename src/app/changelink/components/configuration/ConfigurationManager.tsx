'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { TrackingConfiguration, ExecutionResult, ScheduleConfig } from '../../types';
// import { ConfigurationStorage } from '../../models/ConfigurationStorage';
import { ConfigurationValidator } from '../../models/ConfigurationValidator';
import AdsPowerConfigForm from './AdsPowerConfigForm';
import ConfigurationList from './ConfigurationList';
import ConfigurationPreview from './ConfigurationPreview';
import StatusMonitoringDashboard from '../StatusMonitoringDashboard';
import SchedulingManager from '../SchedulingManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('ConfigurationManager');

interface ConfigurationManagerProps {
  onConfigurationSelect?: (config: TrackingConfiguration) => void;
}

export default function ConfigurationManager({ onConfigurationSelect }: ConfigurationManagerProps) {
  const [configurations, setConfigurations] = useState<TrackingConfiguration[]>([]);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingConfig, setEditingConfig] = useState<TrackingConfiguration | null>(null);
  const [previewConfig, setPreviewConfig] = useState<Partial<TrackingConfiguration> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('configurations');

  // 临时的配置存储实现
  const configStorage = {
    async getAllConfigurations(): Promise<TrackingConfiguration[]> {
      return [];
    },
    async saveConfiguration(config: TrackingConfiguration): Promise<void> {
      console.log('保存配置:', config);
    }
  };
  const configValidator = new ConfigurationValidator();

  // 加载配置列表
  const loadConfigurations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const configs = await configStorage.getAllConfigurations();
      setConfigurations(configs);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载配置失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    loadConfigurations();
  }, [loadConfigurations]);
  // 处理新建配置
  const handleAddNew = () => {
    setEditingConfig(null);
    setShowForm(true);
  };

  // 处理编辑配置
  const handleEdit = (config: TrackingConfiguration) => {
    setEditingConfig({
      ...config,
      adMappingConfig: config.adMappingConfig || [],
    });
    setShowForm(true);
  };

  // 处理复制配置
  const handleDuplicate = async (config: TrackingConfiguration) => {
    try {
      const duplicatedConfig: TrackingConfiguration = {
        ...config,
        id: `config_${Date.now()}`,
        name: `${config.name} (副本)`,
        status: 'stopped',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastExecuted: undefined,
        adMappingConfig: config.adMappingConfig || [],
      };

      await configStorage.saveConfiguration(duplicatedConfig);
      await loadConfigurations();
    } catch (err) {
      setError(err instanceof Error ? err.message : '复制配置失败');
    }
  };

  // 处理删除配置
  const handleDelete = (config: TrackingConfiguration) => {
    setConfigurations((prev) =>
      prev.filter((c) => c !== config)
    );
  };

  // 处理执行配置
  const handleExecute = (config: TrackingConfiguration) => {
    if (onConfigurationSelect) {
      onConfigurationSelect(config);
    }
  };

  // 处理表单提交
  const handleFormSubmit = async (configData: TrackingConfiguration) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // 构建完整的配置对象
      const completeConfig: TrackingConfiguration = {
        ...configData,
        id: editingConfig?.id || `config_${Date.now()}`,
        status: editingConfig?.status || 'stopped',
        createdAt: editingConfig?.createdAt || new Date(),
        updatedAt: new Date(),
        lastExecuted: editingConfig?.lastExecuted,
        googleAdsAccounts: editingConfig?.googleAdsAccounts || [],
        adMappingConfig: editingConfig?.adMappingConfig || [],
      };

      await configStorage.saveConfiguration(completeConfig);
      await loadConfigurations();
      
      setShowForm(false);
      setEditingConfig(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存配置失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理配置预览
  const handlePreview = (configData: TrackingConfiguration) => {
    setPreviewConfig(configData);
    setShowPreview(true);
  };

  // 处理环境验证
  const handleValidateEnvironment = async (environmentId: string): Promise<boolean> => {
    try {
      const result = await configValidator.validateEnvironment(environmentId);
      return result.valid;
    } catch (error) { 
      logger.error('Environment validation failed:', new EnhancedError('Environment validation failed:', { error: error instanceof Error ? error.message : String(error)  }));
      return false;
    }
  };

  // 处理链接测试
  const handleTestLinks = async (links: string[]) => {
    try {
      try {

      return await configValidator.testLinks(links);

      } catch (error) {

        console.error(error);

        return links?.filter(Boolean)?.map(url => ({ url, valid: false, error: '测试失败' }));

      }
    } catch (error) { 
      logger.error('Link testing failed:', new EnhancedError('Link testing failed:', { error: error instanceof Error ? error.message : String(error)  }));
      return links?.filter(Boolean)?.map(url => ({ url, valid: false, error: '测试失败' }));
    }
  };

  // 处理表单取消
  const handleFormCancel = () => {
    setShowForm(false);
    setEditingConfig(null);
  };

  // 处理预览关闭
  const handlePreviewClose = () => {
    setShowPreview(false);
    setPreviewConfig(null);
  };

  // 处理从预览编辑
  const handlePreviewEdit = () => {
    setShowPreview(false);
    setShowForm(true);
  };

  // 处理从预览保存
  const handlePreviewSubmit = async () => {
    if (previewConfig) {
      await handleFormSubmit(previewConfig as TrackingConfiguration);
      setShowPreview(false);
      setPreviewConfig(null);
    }
  };

  // 处理刷新
  const handleRefresh = () => {
    loadConfigurations();
  };

  // 状态监控相关处理函数
  const handleStartExecution = async (configId: string) => {
    try {
      // 更新配置状态为运行中
      const config = configurations.find(c => c.id === configId);
      if (config) {
        const updatedConfig = { ...config, status: 'active' as const };
        await configStorage.saveConfiguration(updatedConfig);
        await loadConfigurations();
      }
    } catch (error) {
      setError('启动执行失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  const handlePauseExecution = async (configId: string) => {
    try {
      const config = configurations.find(c => c.id === configId);
      if (config) {
        const updatedConfig = { ...config, status: 'stopped' as const };
        await configStorage.saveConfiguration(updatedConfig);
        await loadConfigurations();
      }
    } catch (error) {
      setError('暂停执行失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  const handleStopExecution = async (configId: string) => {
    try {
      const config = configurations.find(c => c.id === configId);
      if (config) {
        const updatedConfig = { ...config, status: 'stopped' as const };
        await configStorage.saveConfiguration(updatedConfig);
        await loadConfigurations();
      }
    } catch (error) {
      setError('停止执行失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  // 定时执行相关处理函数
  const handleUpdateScheduling = async (configId: string, scheduling: ScheduleConfig) => {
    try {
      const config = configurations.find(c => c.id === configId);
      if (config) {
        const updatedConfig = { 
          ...config, 
          schedulingConfig: {
            enabled: true,
            frequency: (scheduling.type === 'DAILY' ? 'daily' : scheduling.type === 'WEEKLY' ? 'weekly' : 'custom') as 'daily' | 'weekly' | 'custom',
            time: scheduling.time,
            schedule: scheduling
          },
          status: 'active' as const,
          updatedAt: new Date()
        };
        await configStorage.saveConfiguration(updatedConfig);
        await loadConfigurations();
      }
    } catch (error) {
      setError('更新定时设置失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  const handleManualExecute = async (configId: string) => {
    try {
      // 手动执行配置
      const config = configurations.find(c => c.id === configId);
      if (config) {
        const updatedConfig = { 
          ...config, 
          status: 'active' as const,
          lastExecuted: new Date(),
          updatedAt: new Date()
        };
        await configStorage.saveConfiguration(updatedConfig);
        await loadConfigurations();
        
        // 如果有回调函数，也调用它
        if (onConfigurationSelect) {
          onConfigurationSelect(config);
        }
      }
    } catch (error) {
      setError('手动执行失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Google Ads自动化系统</h1>
          <p className="text-gray-600 mt-1">管理配置和监控执行状态</p>
        </div>
        
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          新建配置
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 主要内容区域 - 标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="configurations">配置管理</TabsTrigger>
          <TabsTrigger value="monitoring">状态监控</TabsTrigger>
          <TabsTrigger value="scheduling">定时执行</TabsTrigger>
        </TabsList>

        {/* 配置管理标签页 */}
        <TabsContent value="configurations" className="space-y-6">
          {/* 统计卡片 */}
          {!isLoading && configurations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">总配置数</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{configurations.length}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">运行中</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {configurations.filter(c => c.status === 'active').length}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">已调度</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {configurations.filter(c => c.status === 'active').length}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">错误状态</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {configurations.filter(c => c.status === 'stopped').length}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 配置列表 */}
          <ConfigurationList
            configurations={configurations}
            isLoading={isLoading}
            onAddNew={handleAddNew}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onExecute={handleExecute}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        {/* 状态监控标签页 */}
        <TabsContent value="monitoring" className="space-y-6">
          {/* <StatusMonitoringDashboard
            configurations={configurations}
            executionResults={executionResults}
            onStartExecution={handleStartExecution}
            onPauseExecution={handlePauseExecution}
            onStopExecution={handleStopExecution}
            onRefreshData={handleRefresh}
            isRefreshing={isLoading}
          /> */}
        </TabsContent>

        {/* 定时执行标签页 */}
        <TabsContent value="scheduling" className="space-y-6">
          {/* <SchedulingManager
            configurations={configurations}
            executionHistory={executionResults}
            onUpdateScheduling={handleUpdateScheduling}
            onManualExecute={handleManualExecute}
            onRefreshData={handleRefresh}
            isRefreshing={isLoading}
          /> */}
        </TabsContent>
      </Tabs>

      {/* 配置表单对话框 */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? '编辑配置' : '新建配置'}
            </DialogTitle>
          </DialogHeader>
          
          <AdsPowerConfigForm
            initialData={editingConfig ? {
              ...editingConfig,
              adMappingConfig: (editingConfig.adMappingConfig || [])?.filter(Boolean)?.map(m => ({
                originalUrl: m.originalUrl,
                adMappings: Array.isArray(m.adMappings)
                  ? m.adMappings?.filter(Boolean)?.map(ad => ({
                      adId: ad.adId,
                      finalUrl: ad.finalUrl || '',
                      finalUrlSuffix: ad.finalUrlSuffix,
                      executionNumber: ad.executionNumber || 1,
                      campaignId: ad.campaignId,
                      adGroupId: ad.adGroupId
                    }))
                  : [],
              })),
            } : undefined}
            googleAdsAccounts={editingConfig?.googleAdsAccounts || []}
            onSubmit={(formData) => {
              const configData: TrackingConfiguration = {
                id: editingConfig?.id || '',
                ...formData,
                adsPowerConfigId: editingConfig?.adsPowerConfigId || '',
                googleAdsConfigId: editingConfig?.googleAdsConfigId || '',
                googleAdsAccounts: editingConfig?.googleAdsAccounts || [],
                linkMappings: editingConfig?.linkMappings || [],
                status: editingConfig?.status || 'stopped',
                isActive: editingConfig?.isActive ?? true,
                createdAt: editingConfig?.createdAt || new Date(),
                updatedAt: new Date(),
                adMappingConfig: editingConfig?.adMappingConfig || [],
              };
              handleFormSubmit(configData);
            }}
            onCancel={handleFormCancel}
            onPreview={(formData) => {
              const configData: TrackingConfiguration = {
                id: editingConfig?.id || '',
                ...formData,
                adsPowerConfigId: editingConfig?.adsPowerConfigId || '',
                googleAdsConfigId: editingConfig?.googleAdsConfigId || '',
                googleAdsAccounts: editingConfig?.googleAdsAccounts || [],
                linkMappings: editingConfig?.linkMappings || [],
                status: editingConfig?.status || 'stopped',
                isActive: editingConfig?.isActive ?? true,
                createdAt: editingConfig?.createdAt || new Date(),
                updatedAt: new Date(),
                adMappingConfig: editingConfig?.adMappingConfig || [],
              };
              handlePreview(configData);
            }}
            onValidateEnvironment={handleValidateEnvironment}
            onTestLinks={handleTestLinks}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* 配置预览 */}
      <ConfigurationPreview
        configuration={previewConfig || {}}
        googleAdsAccounts={editingConfig?.googleAdsAccounts || []}
        isOpen={showPreview}
        onClose={handlePreviewClose}
        onEdit={handlePreviewEdit}
        onSave={handlePreviewSubmit}
      />
    </div>
  );
}