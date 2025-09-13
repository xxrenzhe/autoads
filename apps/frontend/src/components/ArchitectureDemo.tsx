'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Server, 
  Database, 
  Zap, 
  Shield, 
  Activity, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Users,
  Settings,
  BarChart3,
  Workflow
} from 'lucide-react';

interface SystemStatus {
  services: {
    workflowOrchestrator: boolean;
    googleAdsService: boolean;
    adspowerService: boolean;
    emailService: boolean;
    loggingService: boolean;
    securityService: boolean;
  };
  metrics: {
    activeConnections: number;
    memoryUsage: number;
    cpuUsage: number;
    responseTime: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
    status: 'success' | 'warning' | 'error';
  }>;
}

export function ArchitectureDemo() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    services: {
      workflowOrchestrator: true,
      googleAdsService: true,
      adspowerService: true,
      emailService: true,
      loggingService: true,
      securityService: true,
    },
    metrics: {
      activeConnections: 12,
      memoryUsage: 45.2,
      cpuUsage: 23.8,
      responseTime: 125,
    },
    recentActivity: [
      {
        id: '1',
        type: 'workflow',
        message: 'Workflow execution completed successfully',
        timestamp: '2024-01-01T10:30:00Z',
        status: 'success',
      },
      {
        id: '2',
        type: 'google-ads',
        message: 'Google Ads API connection established',
        timestamp: '2024-01-01T10:25:00Z',
        status: 'success',
      },
      {
        id: '3',
        type: 'adspower',
        message: 'AdsPower browser session started',
        timestamp: '2024-01-01T10:20:00Z',
        status: 'success',
      },
    ],
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) => {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg">Loading Architecture Demo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">系统架构演示</h1>
          <p className="text-gray-600">Google Ads 自动化平台的系统架构和组件状态</p>
        </div>

        {/* System Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Server className="w-5 h-5 mr-2 text-blue-600" />
                系统状态
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">整体健康度</span>
                  <Badge className="bg-green-100 text-green-800">健康</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">活跃连接</span>
                  <span className="font-medium">{systemStatus.metrics.activeConnections}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">响应时间</span>
                  <span className="font-medium">{systemStatus.metrics.responseTime}ms</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2 text-green-600" />
                性能指标
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>内存使用</span>
                    <span>{systemStatus.metrics.memoryUsage}%</span>
                  </div>
                  <Progress value={systemStatus.metrics.memoryUsage} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>CPU 使用</span>
                    <span>{systemStatus.metrics.cpuUsage}%</span>
                  </div>
                  <Progress value={systemStatus.metrics.cpuUsage} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2 text-purple-600" />
                安全状态
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">加密状态</span>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">访问控制</span>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">审计日志</span>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Service Status */}
        <Card className="border-0 shadow-sm mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="w-5 h-5 mr-2 text-gray-600" />
              服务状态
            </CardTitle>
            <CardDescription>各个核心服务的运行状态</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(systemStatus.services).map(([service, isRunning]: any) => (
                <div key={service} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="font-medium capitalize">
                      {service.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </div>
                  <Badge variant={isRunning ? 'default' : 'destructive'}>
                    {isRunning ? '运行中' : '已停止'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2 text-gray-600" />
              最近活动
            </CardTitle>
            <CardDescription>系统最近的操作记录</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {systemStatus.recentActivity.map((activity: any) => (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.status === 'success' ? 'bg-green-500' :
                      activity.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <div>
                      <div className="font-medium capitalize">
                        {activity.type.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="text-sm text-gray-600">{activity.message}</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Architecture Diagram */}
        <Card className="border-0 shadow-sm mt-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Workflow className="w-5 h-5 mr-2 text-gray-600" />
              系统架构图
            </CardTitle>
            <CardDescription>Google Ads 自动化平台的系统架构</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 rounded-lg p-6">
              <div className="text-center text-gray-500">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p>系统架构图将在这里显示</p>
                <p className="text-sm">包含所有组件和它们之间的连接关系</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 