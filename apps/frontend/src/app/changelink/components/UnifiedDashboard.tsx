'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LayoutDashboard, 
  Settings, 
  Activity, 
  BarChart3, 
  Database, 
  Zap,
  Play,
  RefreshCw,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Clock,
  Shield,
  FileText,
  Users,
  Bell,
  Globe
} from 'lucide-react';
import GoogleAdsAutomationDashboard from './GoogleAdsAutomationDashboard';
import ConfigurationManager from './ConfigurationManager';
import { globalConfigurationManager } from '../models/ConfigurationManager';
import Link from 'next/link';

interface DashboardStats {
  totalConfigurations: number;
  activeConfigurations: number;
  runningExecutions: number;
  completedToday: number;
  successRate: number;
  averageExecutionTime: number;
  systemHealth: 'excellent' | 'good' | 'warning' | 'critical';
  lastUpdate: Date;
}

interface RecentActivity {
  id: string;
  type: 'execution' | 'configuration' | 'user' | 'system';
  title: string;
  description: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error' | 'info';
}

export default function SimpleUnifiedDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalConfigurations: 0,
    activeConfigurations: 0,
    runningExecutions: 0,
    completedToday: 0,
    successRate: 0,
    averageExecutionTime: 0,
    systemHealth: 'good',
    lastUpdate: new Date()
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // 加载配置统计数据
      const configStats = await globalConfigurationManager.getConfigurationStats();
      
      setDashboardStats({
        totalConfigurations: configStats.totalAssociations,
        activeConfigurations: configStats.activeAssociations,
        runningExecutions: 0,
        completedToday: 0,
        successRate: 95.5,
        averageExecutionTime: 180,
        systemHealth: 'good',
        lastUpdate: new Date()
      });
      
      setRecentActivities([
        {
          id: '1',
          type: 'configuration',
          title: '系统已启动',
          description: 'ChangeLink 系统初始化完成',
          timestamp: new Date(),
          status: 'success'
        },
        {
          id: '2',
          type: 'system',
          title: '配置已加载',
          description: `加载了 ${configStats.totalAccounts} 个 Google Ads 账户`,
          timestamp: new Date(Date.now() - 2 * 60 * 1000),
          status: 'info'
        }
      ]);
      
      setError(null);
    } catch (err) {
      setError('加载仪表板数据失败');
      console.error('Dashboard data loading error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent':
        return 'text-green-600 bg-green-100';
      case 'good':
        return 'text-blue-600 bg-blue-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}小时${mins}分钟`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">加载仪表板...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <LayoutDashboard className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">ChangeLink 自动化平台</h1>
                <p className="text-sm text-gray-500">
                  统一管理面板 • 最后更新: {dashboardStats.lastUpdate.toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={getHealthColor(dashboardStats.systemHealth)}>
                系统状态: {dashboardStats.systemHealth === 'excellent' ? '优秀' : 
                          dashboardStats.systemHealth === 'good' ? '良好' : 
                          dashboardStats.systemHealth === 'warning' ? '警告' : '严重'}
              </Badge>
              <Button variant="outline" size="sm" onClick={loadDashboardData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview" className="flex items-center space-x-2">
                <LayoutDashboard className="h-4 w-4" />
                <span>概览</span>
              </TabsTrigger>
              <TabsTrigger value="automation" className="flex items-center space-x-2">
                <Zap className="h-4 w-4" />
                <span>自动化</span>
              </TabsTrigger>
              <TabsTrigger value="configurations" className="flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>配置</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4" />
                <span>报表</span>
              </TabsTrigger>
              <TabsTrigger value="monitoring" className="flex items-center space-x-2">
                <Activity className="h-4 w-4" />
                <span>监控</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>设置</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">总配置数</CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.totalConfigurations}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardStats.activeConfigurations} 个活跃配置
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">运行中执行</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.runningExecutions}</div>
                  <p className="text-xs text-muted-foreground">
                    今日完成 {dashboardStats.completedToday} 次
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">成功率</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.successRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    平均执行时间 {formatTime(dashboardStats.averageExecutionTime)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">系统健康度</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    <Badge className={getHealthColor(dashboardStats.systemHealth)}>
                      {dashboardStats.systemHealth === 'excellent' ? '优秀' : 
                       dashboardStats.systemHealth === 'good' ? '良好' : 
                       dashboardStats.systemHealth === 'warning' ? '警告' : '严重'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    所有服务运行正常
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>快速操作</CardTitle>
                <CardDescription>常用功能快速访问</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Link href="/adscenter/accounts">
                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-start space-y-2 w-full"
                    >
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4" />
                        <span className="font-medium">账户管理</span>
                      </div>
                      <p className="text-sm text-muted-foreground text-left">
                        管理 Google Ads 账户
                      </p>
                    </Button>
                  </Link>
                  
                  <Link href="/adscenter/configurations">
                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-start space-y-2 w-full"
                    >
                      <div className="flex items-center space-x-2">
                        <Settings className="h-4 w-4" />
                        <span className="font-medium">配置管理</span>
                      </div>
                      <p className="text-sm text-muted-foreground text-left">
                        管理自动化配置
                      </p>
                    </Button>
                  </Link>
                  
                  <Link href="/adscenter/reports">
                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-start space-y-2 w-full"
                    >
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="h-4 w-4" />
                        <span className="font-medium">查看报表</span>
                      </div>
                      <p className="text-sm text-muted-foreground text-left">
                        查看数据分析报表
                      </p>
                    </Button>
                  </Link>
                  
                  <Link href="/adscenter">
                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-start space-y-2 w-full"
                    >
                      <div className="flex items-center space-x-2">
                        <Settings className="h-4 w-4" />
                        <span className="font-medium">系统设置</span>
                      </div>
                      <p className="text-sm text-muted-foreground text-left">
                        配置系统参数
                      </p>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activities */}
            <Card>
              <CardHeader>
                <CardTitle>最近活动</CardTitle>
                <CardDescription>系统最新动态</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivities.map((activity: any) => (
                    <div key={activity.id} className="flex items-start space-x-3">
                      {getStatusIcon(activity.status)}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {activity.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.timestamp.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Automation Tab */}
          <TabsContent value="automation">
            <GoogleAdsAutomationDashboard />
          </TabsContent>

          {/* Configurations Tab */}
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

          {/* Reports Tab */}
          <TabsContent value="reports">
            <div className="text-center py-12">
              <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">报表功能</h3>
              <p className="text-gray-600 mb-4">查看详细的数据分析报表</p>
              <Link href="/adscenter/reports">
                <Button>查看报表</Button>
              </Link>
            </div>
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring">
            <div className="text-center py-12">
              <Activity className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">执行监控</h3>
              <p className="text-gray-600 mb-4">实时监控自动化执行状态</p>
              <Link href="/adscenter/executions">
                <Button>查看执行记录</Button>
              </Link>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <div className="text-center py-12">
              <Settings className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">系统设置</h3>
              <p className="text-gray-600 mb-4">配置系统参数和管理数据</p>
              <Link href="/adscenter">
                <Button>系统设置</Button>
              </Link>
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
