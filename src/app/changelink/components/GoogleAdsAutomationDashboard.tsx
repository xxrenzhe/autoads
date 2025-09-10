'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings, 
  Activity, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Zap,
  Play,
  Pause,
  Square,
  RefreshCw,
  Users,
  Database,
  Network,
  Calendar,
  Bell,
  TrendingUp,
  TrendingDown,
  Target
} from 'lucide-react';
import ConfigurationManager from './ConfigurationManager';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('GoogleAdsAutomationDashboard');

interface SystemOverview {
  totalConfigurations: number;
  activeConfigurations: number;
  runningExecutions: number;
  scheduledTasks: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  lastExecutionTime: string;
  nextScheduledExecution: string;
  totalAdsUpdated: number;
  successRate: number;
  averageExecutionTime: number;
}

interface GoogleAdsAutomationDashboardProps {
  onExportData?: (data: unknown) => void;
  onRefresh?: () => void;
}

export default function GoogleAdsAutomationDashboard({
  onExportData,
  onRefresh
}: GoogleAdsAutomationDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [systemOverview, setSystemOverview] = useState<SystemOverview>({
    totalConfigurations: 12,
    activeConfigurations: 8,
    runningExecutions: 3,
    scheduledTasks: 15,
    systemHealth: 'healthy',
    lastExecutionTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    nextScheduledExecution: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    totalAdsUpdated: 2456,
    successRate: 94.2,
    averageExecutionTime: 28000,
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Simulate refresh
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update system overview with mock data
      setSystemOverview(prev => ({
        ...prev,
        runningExecutions: Math.floor(Math.random() * 5) + 1,
        totalAdsUpdated: prev.totalAdsUpdated + Math.floor(Math.random() * 50),
        successRate: 90 + Math.random() * 8,
        averageExecutionTime: 25000 + Math.floor(Math.random() * 10000)
      }));
      
      onRefresh?.();
    } catch (error) {
      logger.error('Error refreshing dashboard:', new EnhancedError('Error refreshing dashboard:', { error: error instanceof Error ? error.message : String(error)  }));
    } finally {
      setIsRefreshing(false);
    }
  }, [logger, onRefresh]);

  const handleExportData = useCallback((data: unknown) => {
    onExportData?.(data);
  }, [onExportData]);

  const getSystemHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600 bg-green-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSystemHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'critical': return <XCircle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    return `${diffDays}天前`;
  };

  return (
    <div className="space-y-6">
      {/* 系统概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">配置总数</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemOverview.totalConfigurations}</div>
            <p className="text-xs text-muted-foreground">
              {systemOverview.activeConfigurations} 个活跃配置
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">运行中任务</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemOverview.runningExecutions}</div>
            <p className="text-xs text-muted-foreground">
              {systemOverview.scheduledTasks} 个计划任务
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">系统健康度</CardTitle>
            {getSystemHealthIcon(systemOverview.systemHealth)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge className={getSystemHealthColor(systemOverview.systemHealth)}>
                {systemOverview.systemHealth === 'healthy' ? '健康' : 
                 systemOverview.systemHealth === 'warning' ? '警告' : '严重'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              成功率: {systemOverview.successRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">广告更新</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemOverview.totalAdsUpdated}</div>
            <p className="text-xs text-muted-foreground">
              平均耗时: {formatDuration(systemOverview.averageExecutionTime)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容区域 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="configurations">配置</TabsTrigger>
          <TabsTrigger value="monitoring">监控</TabsTrigger>
          <TabsTrigger value="logs">日志</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* 快速操作 */}
          <Card>
            <CardHeader>
              <CardTitle>快速操作</CardTitle>
              <CardDescription>常用功能快速访问</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-start space-y-2"
                  onClick={() => setActiveTab('configurations')}
                >
                  <Settings className="h-4 w-4" />
                  <span className="font-medium">管理配置</span>
                  <p className="text-xs text-muted-foreground text-left">
                    查看和编辑自动化配置
                  </p>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-start space-y-2"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="font-medium">刷新状态</span>
                  <p className="text-xs text-muted-foreground text-left">
                    更新系统状态信息
                  </p>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-start space-y-2"
                  onClick={() => {}}
                >
                  <Play className="h-4 w-4" />
                  <span className="font-medium">执行任务</span>
                  <p className="text-xs text-muted-foreground text-left">
                    立即执行自动化任务
                  </p>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-start space-y-2"
                  onClick={() => handleExportData(systemOverview)}
                >
                  <Database className="h-4 w-4" />
                  <span className="font-medium">导出数据</span>
                  <p className="text-xs text-muted-foreground text-left">
                    导出系统数据报告
                  </p>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 最近活动 */}
          <Card>
            <CardHeader>
              <CardTitle>最近活动</CardTitle>
              <CardDescription>系统最近的执行活动</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">配置"电商推广"执行完成</p>
                      <p className="text-sm text-gray-600">
                        成功更新 45 个广告，失败 2 个
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatRelativeTime(systemOverview.lastExecutionTime)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="font-medium">配置"品牌推广"执行警告</p>
                      <p className="text-sm text-gray-600">
                        部分广告更新超时，成功率 85%
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatRelativeTime(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Activity className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">系统维护完成</p>
                      <p className="text-sm text-gray-600">
                        数据库优化和缓存清理已完成
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatRelativeTime(new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configurations">
          <ConfigurationManager 
  configurations={[]}
  onSave={async () => {}}
  onDelete={async () => {}}
  onTest={async () => {}}
  onExecute={async () => {}}
  onStop={async () => {}}
  activeExecutions={[]}
  selectedConfiguration={null}
  onConfigurationSelect={() => {}}
  isExecuting={false}
  executionProgress={{}}
/>
        </TabsContent>

        <TabsContent value="monitoring">
          <Card>
            <CardHeader>
              <CardTitle>执行监控</CardTitle>
              <CardDescription>实时监控系统执行状态</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">当前执行</span>
                      <Badge className="bg-blue-100 text-blue-800">
                        {systemOverview.runningExecutions}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">正在运行的任务数</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">成功率</span>
                      <Badge className="bg-green-100 text-green-800">
                        {systemOverview.successRate.toFixed(1)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">最近24小时成功率</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">平均耗时</span>
                      <Badge className="bg-purple-100 text-purple-800">
                        {formatDuration(systemOverview.averageExecutionTime)}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">平均执行时间</p>
                  </div>
                </div>
                
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-16 w-16 mx-auto mb-4" />
                  <p>详细的执行监控功能正在开发中</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>系统日志</CardTitle>
              <CardDescription>查看系统运行日志</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="p-3 bg-gray-50 rounded text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">[INFO] 系统启动完成</span>
                    <span className="text-xs text-gray-500">
                      {new Date().toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                
                <div className="p-3 bg-green-50 rounded text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-green-800">[SUCCESS] 配置加载成功</span>
                    <span className="text-xs text-green-600">
                      {new Date(Date.now() - 5 * 60 * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                
                <div className="p-3 bg-blue-50 rounded text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-blue-800">[INFO] 定时任务检查</span>
                    <span className="text-xs text-blue-600">
                      {new Date(Date.now() - 10 * 60 * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}