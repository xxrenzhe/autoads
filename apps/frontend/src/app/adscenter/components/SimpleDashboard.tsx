'use client';

import React, { useState, useEffect } from 'react';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LayoutDashboard, 
  Settings, 
  Activity, 
  BarChart3, 
  Zap,
  Play,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Plus,
  Users,
  Globe,
  Database
} from 'lucide-react';
import { simpleConfigManager } from '../services/SimpleConfigManager';
import { simpleExecutionService } from '../services/SimpleExecutionService';
import { localStorageService } from '../services/LocalStorageService';
import Link from 'next/link';

interface DashboardStats {
  totalAccounts: number;
  activeAccounts: number;
  totalEnvironments: number;
  activeEnvironments: number;
  totalConfigs: number;
  activeConfigs: number;
  recentExecutions: number;
}

export default function SimpleDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<DashboardStats>({
    totalAccounts: 0,
    activeAccounts: 0,
    totalEnvironments: 0,
    activeEnvironments: 0,
    totalConfigs: 0,
    activeConfigs: 0,
    recentExecutions: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const configStats = await simpleConfigManager.getStats();
      setStats(configStats);
      setError(null);
    } catch (err) {
      setError('加载仪表板数据失败');
      console.error('Dashboard loading error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthStatus = () => {
    if (stats.totalAccounts === 0) return { status: 'warning', text: '需要配置账号', color: 'bg-yellow-100 text-yellow-800' };
    if (stats.totalConfigs === 0) return { status: 'warning', text: '需要配置任务', color: 'bg-yellow-100 text-yellow-800' };
    if (stats.activeConfigs > 0) return { status: 'good', text: '运行正常', color: 'bg-green-100 text-green-800' };
    return { status: 'good', text: '系统正常', color: 'bg-blue-100 text-blue-800' };
  };

  const health = getHealthStatus();

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
    <div className={`min-h-screen ${UI_CONSTANTS.gradients.hero}`}>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <LayoutDashboard className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">AdsCenter 自动化平台</h1>
                <p className="text-lg text-gray-600">
                  智能广告链接更新系统
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge className={`${health.color} px-4 py-2 rounded-full text-sm font-medium`}>
                {health.text}
              </Badge>
              <Button className="border-2 border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-xl hover:bg-gray-50 transition-all duration-300 flex items-center gap-2" onClick={loadDashboardData}>
                <RefreshCw className="h-4 w-4" />
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" className="flex items-center space-x-2">
                <LayoutDashboard className="h-4 w-4" />
                <span>概览</span>
              </TabsTrigger>
              <TabsTrigger value="accounts" className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>账号</span>
              </TabsTrigger>
              <TabsTrigger value="configs" className="flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>配置</span>
              </TabsTrigger>
              <TabsTrigger value="executions" className="flex items-center space-x-2">
                <Activity className="h-4 w-4" />
                <span>执行</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className={UI_CONSTANTS.cards.default + " p-6"}>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gray-900">{stats.totalAccounts}</div>
                    <div className="text-sm text-gray-600">{stats.activeAccounts} 个活跃</div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Google Ads 账号</h3>
                <p className="text-sm text-gray-600 mt-1">管理的广告账号总数</p>
              </div>

              <div className={UI_CONSTANTS.cards.default + " p-6"}>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Globe className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gray-900">{stats.totalEnvironments}</div>
                    <div className="text-sm text-gray-600">{stats.activeEnvironments} 个可用</div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">AdsPower 环境</h3>
                <p className="text-sm text-gray-600 mt-1">浏览器自动化环境</p>
              </div>

              <div className={UI_CONSTANTS.cards.default + " p-6"}>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Settings className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gray-900">{stats.totalConfigs}</div>
                    <div className="text-sm text-gray-600">{stats.activeConfigs} 个活跃</div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">自动化配置</h3>
                <p className="text-sm text-gray-600 mt-1">自动化任务配置</p>
              </div>

              <div className={UI_CONSTANTS.cards.default + " p-6"}>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Activity className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gray-900">{stats.recentExecutions}</div>
                    <div className="text-sm text-gray-600">最近执行</div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">执行记录</h3>
                <p className="text-sm text-gray-600 mt-1">过去24小时执行次数</p>
              </div>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>快速操作</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Link href="/adscenter/setup">
                    <Button className="w-full" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      开始配置
                    </Button>
                  </Link>
                  <Link href="/adscenter/configs">
                    <Button className="w-full" variant="outline">
                      <Settings className="h-4 w-4 mr-2" />
                      管理配置
                    </Button>
                  </Link>
                  <Link href="/adscenter/executions">
                    <Button className="w-full" variant="outline">
                      <Activity className="h-4 w-4 mr-2" />
                      执行监控
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Google Ads 账号管理</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">暂无配置的账号</p>
                  <Link href="/adscenter/setup">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      添加账号
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configs Tab */}
          <TabsContent value="configs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>自动化配置</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">暂无自动化配置</p>
                  <Link href="/adscenter/configs">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      创建配置
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Executions Tab */}
          <TabsContent value="executions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>执行监控</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">暂无执行记录</p>
                  <Link href="/adscenter/executions">
                    <Button>
                      <Play className="h-4 w-4 mr-2" />
                      查看详情
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
