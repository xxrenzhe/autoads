'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { EnhancedError } from '@/lib/utils/error-handling';

interface PerformanceMetrics {
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  errorRate: number;
  p95Duration: number;
  p99Duration: number;
}

interface HealthStatus {
  api: { successRate: number; avgResponseTime: number };
  database: { successRate: number; avgQueryTime: number };
  external: { successRate: number; avgResponseTime: number };
  business: { successRate: number; avgOperationTime: number };
}

interface Alert {
  id: string;
  ruleName: string;
  severity: string;
  message: string;
  timestamp: string;
  metricValue: number;
  threshold: number;
  acknowledged: boolean;
}

interface AlertStats {
  totalAlerts: number;
  unacknowledgedAlerts: number;
  alertsBySeverity: Record<string, number>;
  recentAlerts: number;
}

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 30000); // 30秒更新一次
    return () => clearInterval(interval);
  }, []);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      
      // 获取性能指标
      const metricsResponse = await fetch('/api/monitoring/metrics');
      const metricsData = await metricsResponse.json();
      
      if (metricsData.success) {
        setMetrics(metricsData.data.aggregated);
        setHealth(metricsData.data.health);
      }

      // 获取告警数据
      const alertsResponse = await fetch('/api/monitoring/alerts');
      const alertsData = await alertsResponse.json();
      
      if (alertsData.success) {
        setAlerts(alertsData.data.alerts);
        setAlertStats(alertsData.data.stats);
      }
    } catch (err) {
      setError('Failed to fetch monitoring data');
      console.error('Error fetching monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/monitoring/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'acknowledge',
          data: { alertId, acknowledgedBy: 'dashboard-user' }
        })
      });

      if (response.ok) {
        setAlerts(prev => prev?.filter(Boolean)?.map(alert => 
          alert.id === alertId ? { ...alert, acknowledged: true } : alert
        ));
      }
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatDuration = (value: number) => {
    if (value < 1000) return `${value}ms`;
    if (value < 60000) return `${(value / 1000).toFixed(1)}s`;
    return `${(value / 60000).toFixed(1)}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg">加载监控数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 font-bold text-xl">!</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-900">加载错误</h3>
                <p className="text-red-800">{error}</p>
              </div>
            </div>
            <Button 
              onClick={fetchMonitoringData}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              重试
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">系统监控仪表板</h1>
            <p className="text-gray-600">
              实时监控系统性能、健康状态和服务可用性
            </p>
          </div>
          <Button 
            onClick={fetchMonitoringData}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="text-lg animate-spin">⏳</span>
                刷新中...
              </>
            ) : (
              <>
                <span className="text-lg">🔄</span>
                刷新数据
              </>
            )}
          </Button>
        </div>

        {/* 健康状态概览 */}
        {health && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API 健康度</CardTitle>
                <Badge variant={health.api.successRate > 0.95 ? 'default' : 'destructive'}>
                  {formatPercentage(health.api.successRate)}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(health.api.avgResponseTime)}</div>
                <p className="text-xs text-muted-foreground">平均响应时间</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">数据库健康度</CardTitle>
                <Badge variant={health.database.successRate > 0.98 ? 'default' : 'destructive'}>
                  {formatPercentage(health.database.successRate)}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(health.database.avgQueryTime)}</div>
                <p className="text-xs text-muted-foreground">平均查询时间</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">外部服务健康度</CardTitle>
                <Badge variant={health.external.successRate > 0.9 ? 'default' : 'destructive'}>
                  {formatPercentage(health.external.successRate)}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(health.external.avgResponseTime)}</div>
                <p className="text-xs text-muted-foreground">平均响应时间</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">业务操作健康度</CardTitle>
                <Badge variant={health.business.successRate > 0.95 ? 'default' : 'destructive'}>
                  {formatPercentage(health.business.successRate)}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(health.business.avgOperationTime)}</div>
                <p className="text-xs text-muted-foreground">平均操作时间</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="metrics" className="space-y-4">
          <TabsList>
            <TabsTrigger value="metrics">性能指标</TabsTrigger>
            <TabsTrigger value="alerts">告警</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="space-y-4">
            {metrics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>请求统计</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>总请求数</span>
                      <span className="font-medium">{metrics.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>成功率</span>
                      <span className="font-medium text-green-600">{formatPercentage(metrics.successRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>错误率</span>
                      <span className="font-medium text-red-600">{formatPercentage(metrics.errorRate)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>响应时间</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>平均</span>
                      <span className="font-medium">{formatDuration(metrics.avgDuration)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>最小</span>
                      <span className="font-medium">{formatDuration(metrics.minDuration)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>最大</span>
                      <span className="font-medium">{formatDuration(metrics.maxDuration)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>百分位响应时间</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>P95</span>
                      <span className="font-medium">{formatDuration(metrics.p95Duration)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>P99</span>
                      <span className="font-medium">{formatDuration(metrics.p99Duration)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            {alertStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">总告警数</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{alertStats.totalAlerts}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">未确认告警</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">{alertStats.unacknowledgedAlerts}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">严重告警</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{alertStats.alertsBySeverity?.critical || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">最近告警</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{alertStats.recentAlerts}</div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">最近告警</h3>
              {alerts.length === 0 ? (
                <Alert>
                  <AlertDescription>暂无告警</AlertDescription>
                </Alert>
              ) : (
                alerts.map((alert) => (
                  <Alert key={alert.id}>
                    <div className="flex items-center justify-between">
                      <div>
                        <AlertTitle className="flex items-center gap-2">
                          <Badge variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                            {alert.severity}
                          </Badge>
                          {alert.ruleName}
                        </AlertTitle>
                        <AlertDescription>
                          {alert.message}
                        </AlertDescription>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(alert.timestamp).toLocaleString()}
                        </div>
                      </div>
                      {!alert.acknowledged && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          确认
                        </Button>
                      )}
                    </div>
                  </Alert>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}