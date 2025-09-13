'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity
} from 'lucide-react';

interface TestResult {
  name: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  data?: unknown;
  timestamp: string;
  duration?: number;
}

export default function TestIntegrationPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTab, setCurrentTab] = useState<'tests' | 'api'>('tests');

  const runAllTests = async () => {
    try {
      setIsRunning(true);
      setTestResults([]);

      const tests = [
        { name: 'Health Check API', fn: testHealthAPI },
        { name: 'Monitoring APIs', fn: testMonitoringAPIs },
        { name: 'Google Ads APIs', fn: testGoogleAdsAPIs },
        { name: 'ChangeLink APIs', fn: testChangeLinkAPIs },
        { name: 'Architecture APIs', fn: testArchitectureAPIs },
        { name: 'Deploy Status API', fn: testDeployStatusAPI }
      ];

      for (const test of tests) {
        const result = await test.fn();
        setTestResults(prev => [...prev, result]);
      }

      setIsRunning(false);
    } catch (error) {
      console.error('Error in runAllTests:', error);
      setIsRunning(false);
    }
  };

  const testHealthAPI = async (): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      const duration = Date.now() - startTime;

      if (response.ok && data.status) {
        return {
          name: 'Health Check API',
          status: 'success',
          message: `Health API responding with status: ${data.status}`,
          data: { status: data.status, uptime: data.uptime },
          timestamp: new Date().toISOString(),
          duration
        };
      } else {
        return {
          name: 'Health Check API',
          status: 'error',
          message: `Health API returned status ${response.status}`,
          timestamp: new Date().toISOString(),
          duration
        };
      }
    } catch (error) {
      return {
        name: 'Health Check API',
        status: 'error',
        message: `Health API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }
  };

  const testMonitoringAPIs = async (): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const [metricsResponse, alertsResponse] = await Promise.all([
        fetch('/api/monitoring/metrics'),
        fetch('/api/monitoring/alerts')
      ]);

      const metricsData = await metricsResponse.json();
      const alertsData = await alertsResponse.json();
      const duration = Date.now() - startTime;

      if (metricsResponse.ok && alertsResponse.ok) {
        return {
          name: 'Monitoring APIs',
          status: 'success',
          message: 'Both metrics and alerts APIs are working',
          data: {
            metrics: metricsData.cpu ? 'Available' : 'Limited',
            alerts: Array.isArray(alertsData.alerts) ? alertsData.alerts.length : 0
          },
          timestamp: new Date().toISOString(),
          duration
        };
      } else {
        return {
          name: 'Monitoring APIs',
          status: 'error',
          message: 'One or more monitoring APIs failed',
          timestamp: new Date().toISOString(),
          duration
        };
      }
    } catch (error) {
      return {
        name: 'Monitoring APIs',
        status: 'error',
        message: `Monitoring APIs error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }
  };

  const testGoogleAdsAPIs = async (): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const [accountsResponse, campaignsResponse] = await Promise.all([
        fetch('/api/google-ads/accounts'),
        fetch('/api/google-ads/campaigns')
      ]);

      const accountsData = await accountsResponse.json();
      const campaignsData = await campaignsResponse.json();
      const duration = Date.now() - startTime;

      if (accountsResponse.ok && campaignsResponse.ok) {
        return {
          name: 'Google Ads APIs',
          status: 'success',
          message: 'Google Ads APIs are responding correctly',
          data: {
            accounts: Array.isArray(accountsData.accounts) ? accountsData.accounts.length : 0,
            campaigns: Array.isArray(campaignsData.campaigns) ? campaignsData.campaigns.length : 0
          },
          timestamp: new Date().toISOString(),
          duration
        };
      } else {
        return {
          name: 'Google Ads APIs',
          status: 'error',
          message: 'Google Ads APIs failed',
          timestamp: new Date().toISOString(),
          duration
        };
      }
    } catch (error) {
      return {
        name: 'Google Ads APIs',
        status: 'error',
        message: `Google Ads APIs error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }
  };

  const testChangeLinkAPIs = async (): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const [configResponse, executeResponse] = await Promise.all([
        fetch('/api/adscenter/configurations'),
        fetch('/api/adscenter/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ configurationId: 'test-config' })
        })
      ]);

      const configData = await configResponse.json();
      const executeData = await executeResponse.json();
      const duration = Date.now() - startTime;

      if (configResponse.ok && executeResponse.ok) {
        return {
          name: 'ChangeLink APIs',
          status: 'success',
          message: 'ChangeLink APIs are working correctly',
          data: {
            configurations: Array.isArray(configData.configurations) ? configData.configurations.length : 0,
            execution: executeData.executionId ? 'Started' : 'Failed'
          },
          timestamp: new Date().toISOString(),
          duration
        };
      } else {
        return {
          name: 'ChangeLink APIs',
          status: 'error',
          message: 'ChangeLink APIs failed',
          timestamp: new Date().toISOString(),
          duration
        };
      }
    } catch (error) {
      return {
        name: 'ChangeLink APIs',
        status: 'error',
        message: `ChangeLink APIs error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }
  };

  const testArchitectureAPIs = async (): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const [statusResponse, servicesResponse, pluginsResponse] = await Promise.all([
        fetch('/api/architecture/status'),
        fetch('/api/architecture/services'),
        fetch('/api/architecture/plugins')
      ]);

      const statusData = await statusResponse.json();
      const servicesData = await servicesResponse.json();
      const pluginsData = await pluginsResponse.json();
      const duration = Date.now() - startTime;

      if (statusResponse.ok && servicesResponse.ok && pluginsResponse.ok) {
        return {
          name: 'Architecture APIs',
          status: 'success',
          message: 'All architecture APIs are working',
          data: {
            version: statusData.version || 'Unknown',
            services: Array.isArray(servicesData.services) ? servicesData.services.length : 0,
            plugins: Array.isArray(pluginsData.plugins) ? pluginsData.plugins.length : 0
          },
          timestamp: new Date().toISOString(),
          duration
        };
      } else {
        return {
          name: 'Architecture APIs',
          status: 'error',
          message: 'Architecture APIs failed',
          timestamp: new Date().toISOString(),
          duration
        };
      }
    } catch (error) {
      return {
        name: 'Architecture APIs',
        status: 'error',
        message: `Architecture APIs error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }
  };

  const testDeployStatusAPI = async (): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const response = await fetch('/api/deploy-status');
      const data = await response.json();
      const duration = Date.now() - startTime;

      if (response.ok && data.environment) {
        return {
          name: 'Deploy Status API',
          status: 'success',
          message: `Deploy status API working - Environment: ${data.environment}`,
          data: {
            environment: data.environment,
            version: data.version,
            uptime: data.uptime
          },
          timestamp: new Date().toISOString(),
          duration
        };
      } else {
        return {
          name: 'Deploy Status API',
          status: 'error',
          message: 'Deploy status API failed',
          timestamp: new Date().toISOString(),
          duration
        };
      }
    } catch (error) {
      return {
        name: 'Deploy Status API',
        status: 'error',
        message: `Deploy status API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800'
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">系统集成测试</h1>
          <p className="text-muted-foreground">验证所有API端点和系统功能</p>
        </div>
        <Button
          onClick={runAllTests}
          disabled={isRunning}
          className="flex items-center gap-2"
        >
          {isRunning ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isRunning ? '运行中...' : '运行所有测试'}
        </Button>
      </div>

      <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as 'tests' | 'api')}>
        <TabsList>
          <TabsTrigger value="tests">测试结果</TabsTrigger>
          <TabsTrigger value="api">API状态</TabsTrigger>
        </TabsList>

        <TabsContent value="tests" className="space-y-4">
          {testResults.length === 0 && !isRunning && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  点击"运行所有测试"开始系统验证
                </p>
              </CardContent>
            </Card>
          )}

          {testResults.map((result, index: any) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    {result.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {result.duration && (
                      <span className="text-sm text-muted-foreground">
                        {result.duration}ms
                      </span>
                    )}
                    <Badge className={getStatusBadge(result.status)}>
                      {result.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-2">{result.message}</p>
                {result.data != null && (
                  <div className="bg-muted p-3 rounded-md">
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(result.timestamp).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">健康检查</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  系统健康状态监控
                </p>
                <Badge className="mt-2">GET /api/health</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">监控系统</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  系统指标和告警管理
                </p>
                <div className="mt-2 space-y-1">
                  <Badge>GET /api/monitoring/metrics</Badge>
                  <Badge>GET /api/monitoring/alerts</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Google Ads</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  广告账户和系列管理
                </p>
                <div className="mt-2 space-y-1">
                  <Badge>GET /api/google-ads/accounts</Badge>
                  <Badge>GET /api/google-ads/campaigns</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">ChangeLink</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  链接变更自动化管理
                </p>
                <div className="mt-2 space-y-1">
                  <Badge>GET /api/adscenter/configurations</Badge>
                  <Badge>POST /api/adscenter/execute</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">系统架构</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  架构信息和服务状态
                </p>
                <div className="mt-2 space-y-1">
                  <Badge>GET /api/architecture/status</Badge>
                  <Badge>GET /api/architecture/services</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">部署状态</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  部署信息和环境状态
                </p>
                <Badge className="mt-2">GET /api/deploy-status</Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
