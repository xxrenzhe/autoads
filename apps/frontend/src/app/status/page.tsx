'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  Server,
  Globe,
  Database,
  Zap
} from 'lucide-react';

interface BuildInfo {
  buildTime: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  environment: string;
  vercelEnv?: string;
  commitSha?: string;
  branch?: string;
  domain: string;
}

interface SystemStatus {
  api: 'online' | 'offline' | 'degraded';
  database: 'online' | 'offline' | 'degraded';
  adspower: 'online' | 'offline' | 'degraded';
  oauth: 'online' | 'offline' | 'degraded';
}

export default function StatusPage() {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    api: 'online',
    database: 'online',
    adspower: 'offline',
    oauth: 'online'
  });
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  useEffect(() => {
    loadBuildInfo();
    checkSystemStatus();
  }, []);

  const loadBuildInfo = async () => {
    try {
      const response = await fetch('/build-info.json');
      if (response.ok) => {
        const info = await response.json();
        setBuildInfo(info);
      }
    } catch (error) {
      console.error('加载构建信息失败:', error);
    }
  };

  const checkSystemStatus = async () => {
    setLoading(true);
    
    try {
      // 检查 API 状态
      const apiResponse = await fetch('/api/adscenter/system?action=health');
      const apiStatus = apiResponse.ok ? 'online' : 'degraded';

      // 检查其他服务状态
      setSystemStatus({
        api: apiStatus,
        database: 'online', // 本地存储，始终在线
        adspower: 'offline', // 需要本地 AdsPower 客户端
        oauth: 'online' // Google OAuth 服务
      });
    } catch (error) {
      setSystemStatus({
        api: 'offline',
        database: 'online',
        adspower: 'offline',
        oauth: 'degraded'
      });
    } finally {
      setLoading(false);
      setLastCheck(new Date());
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      online: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: '在线' },
      offline: { color: 'bg-red-100 text-red-800', icon: XCircle, label: '离线' },
      degraded: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: '降级' }
    };

    const variant = variants[status as keyof typeof variants] || variants.offline;
    const Icon = variant.icon;

    return (
      <Badge className={`${variant.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {variant.label}
      </Badge>
    );
  };

  const getOverallStatus = () => {
    const statuses = Object.values(systemStatus);
    if (statuses.every(s => s === 'online')) return 'online';
    if (statuses.some(s => s === 'offline')) return 'degraded';
    return 'online';
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">系统状态</h1>
          <p className="text-gray-600">AdsCenter 系统运行状态和构建信息</p>
        </div>
        <Button onClick={checkSystemStatus} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新状态
        </Button>
      </div>

      {/* 整体状态 */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>整体状态</CardTitle>
              <CardDescription>系统整体运行状况</CardDescription>
            </div>
            {getStatusBadge(getOverallStatus())}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600">
            最后检查: {lastCheck.toLocaleString()}
          </div>
        </CardContent>
      </Card>

      {/* 服务状态 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API 服务</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {getStatusBadge(systemStatus.api)}
            <p className="text-xs text-muted-foreground mt-2">
              后端 API 服务状态
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">数据存储</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {getStatusBadge(systemStatus.database)}
            <p className="text-xs text-muted-foreground mt-2">
              本地数据存储状态
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AdsPower</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {getStatusBadge(systemStatus.adspower)}
            <p className="text-xs text-muted-foreground mt-2">
              需要本地 AdsPower 客户端
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OAuth 服务</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {getStatusBadge(systemStatus.oauth)}
            <p className="text-xs text-muted-foreground mt-2">
              Google OAuth 授权服务
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 构建信息 */}
      {buildInfo && (
        <Card>
          <CardHeader>
            <CardTitle>构建信息</CardTitle>
            <CardDescription>当前部署版本的构建详情</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">构建时间:</span>
                  <span className="text-sm font-mono">
                    {new Date(buildInfo.buildTime).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">环境:</span>
                  <Badge variant={buildInfo.environment === 'production' ? 'default' : 'secondary'}>
                    {buildInfo.environment}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">域名:</span>
                  <span className="text-sm font-mono">{buildInfo.domain}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Node.js:</span>
                  <span className="text-sm font-mono">{buildInfo.nodeVersion}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">平台:</span>
                  <span className="text-sm font-mono">{buildInfo.platform}-{buildInfo.arch}</span>
                </div>
                {buildInfo.vercelEnv && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Vercel 环境:</span>
                    <span className="text-sm font-mono">{buildInfo.vercelEnv}</span>
                  </div>
                )}
                {buildInfo.branch && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">分支:</span>
                    <span className="text-sm font-mono">{buildInfo.branch}</span>
                  </div>
                )}
                {buildInfo.commitSha && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">提交:</span>
                    <span className="text-sm font-mono">{buildInfo.commitSha.substring(0, 7)}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 快速链接 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>快速链接</CardTitle>
          <CardDescription>常用功能和页面链接</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" asChild>
              <a href="/adscenter">主页面</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/adscenter/accounts">账号管理</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/adscenter/executions">执行监控</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/api/adscenter/system?action=health">API 健康检查</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}