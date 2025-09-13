'use client';

import React, { useState, useEffect } from 'react';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Download, 
  RefreshCw, 
  Calendar,
  Filter,
  PieChart,
  Activity,
  Target,
  Clock,
  DollarSign,
  Users,
  MousePointer,
  FileText
} from 'lucide-react';
// Note: Execution monitor has been removed for performance optimization
import { globalLocalStorageService } from '@/lib/local-storage-service';

interface ExecutionSession {
  id: string;
  name: string;
  type: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  progress: {
    current: number;
    total: number;
  };
  error?: string;
}

interface ReportData {
  sessions: ExecutionSession[];
  timeRange: {
    start: Date;
    end: Date;
  };
  summary: {
    totalSessions: number;
    completedSessions: number;
    failedSessions: number;
    successRate: number;
    averageDuration: number;
    totalExecutionTime: number;
  };
  performance: {
    byType: Record<string, {
      count: number;
      success: number;
      failed: number;
      averageDuration: number;
    }>;
    byStatus: Record<string, number>;
    hourlyDistribution: Array<{
      hour: number;
      count: number;
    }>;
    dailyTrend: Array<{
      date: string;
      sessions: number;
      successRate: number;
    }>;
  };
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('7d');
  const [selectedReport, setSelectedReport] = useState<'overview' | 'performance' | 'executions' | 'analytics'>('overview');

  useEffect(() => {
    loadReportData();
  }, [timeRange]);

  const loadReportData = async () => {
    try {
      setIsLoading(true);
      
      // 获取所有会话 - 简化版本，不使用执行监控器
      const allSessions: ExecutionSession[] = [];
      
      // 根据时间范围过滤
      const now = new Date();
      let startDate = new Date();
      
      switch (timeRange) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
        case 'all':
          startDate = new Date(0); // 从最早开始
          break;
      }
      
      const filteredSessions = allSessions.filter(
        session => session.startTime >= startDate
      );
      
      // 生成报告数据
      const data = generateReportData(filteredSessions, { start: startDate, end: now });
      setReportData(data);
      
    } catch (error) {
      console.error('加载报告数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateReportData = (sessions: ExecutionSession[], timeRange: { start: Date; end: Date }): ReportData => {
    const summary = {
      totalSessions: sessions.length,
      completedSessions: sessions.filter((s: any) => s.status === 'completed').length,
      failedSessions: sessions.filter((s: any) => s.status === 'failed').length,
      successRate: 0,
      averageDuration: 0,
      totalExecutionTime: 0
    };
    
    summary.successRate = summary.totalSessions > 0 
      ? (summary.completedSessions / summary.totalSessions) * 100 
      : 0;
    
    const durations = sessions
      .filter((s: any) => s.duration !== undefined)
      ?.filter(Boolean)?.map((s: any) => s.duration!);
    
    summary.averageDuration = durations.length > 0 
      ? durations.reduce((sum, d: any) => sum + d, 0) / durations.length 
      : 0;
    
    summary.totalExecutionTime = durations.reduce((sum, d: any) => sum + d, 0);

    // 按类型统计
    const byType: Record<string, any> = {};
    sessions.forEach((session: any) => {
      if (!byType[session.type]) {
        byType[session.type] = {
          count: 0,
          success: 0,
          failed: 0,
          averageDuration: 0
        };
      }
      
      byType[session.type].count++;
      if (session.status === 'completed') {
        byType[session.type].success++;
      } else if (session.status === 'failed') {
        byType[session.type].failed++;
      }
    });
    
    // 计算平均时长
    Object.keys(byType).forEach((type: any) => {
      const typeSessions = sessions.filter((s: any) => s.type === type && s.duration);
      const avgDuration = typeSessions.length > 0 
        ? typeSessions.reduce((sum, s: any) => sum + (s.duration || 0), 0) / typeSessions.length 
        : 0;
      byType[type].averageDuration = avgDuration;
    });

    // 按状态统计
    const byStatus: Record<string, number> = {};
    sessions.forEach((session: any) => {
      byStatus[session.status] = (byStatus[session.status] || 0) + 1;
    });

    // 小时分布
    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: sessions.filter((s: any) => s.startTime.getHours() === hour).length
    }));

    // 每日趋势
    const dailyTrend: Array<{ date: string; sessions: number; successRate: number }> = [];
    const dayCount = Math.min(90, Math.ceil((timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24)));
    
    for (let i = dayCount - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const daySessions = sessions.filter((s: any) => 
        s.startTime.toISOString().split('T')[0] === dateStr
      );
      
      const completed = daySessions.filter((s: any) => s.status === 'completed').length;
      const successRate = daySessions.length > 0 ? (completed / daySessions.length) * 100 : 0;
      
      dailyTrend.push({
        date: dateStr,
        sessions: daySessions.length,
        successRate
      });
    }

    return {
      sessions,
      timeRange,
      summary,
      performance: {
        byType,
        byStatus,
        hourlyDistribution,
        dailyTrend
      }
    };
  };

  const exportReport = (format: 'csv' | 'json') => {
    if (!reportData) return;
    
    if (format === 'csv') {
      const csvContent = [
        ['会话ID', '名称', '类型', '状态', '开始时间', '结束时间', '执行时长', '进度', '错误信息'],
        ...reportData.sessions?.filter(Boolean)?.map((session: any) => [
          session.id,
          session.name,
          session.type,
          session.status,
          session.startTime.toISOString(),
          session.endTime?.toISOString() || '',
          session.duration?.toString() || '',
          `${session.progress.current}/${session.progress.total}`,
          session.error || ''
        ])
      ]?.filter(Boolean)?.map((row: any) => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `execution-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const jsonContent = JSON.stringify(reportData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `execution-report-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}min`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleString('zh-CN');
  };

  if (!reportData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">加载报告数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${UI_CONSTANTS.gradients.hero}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className={UI_CONSTANTS.typography.h1}>
              📊 数据分析报告
            </h1>
            <p className={`${UI_CONSTANTS.typography.subtitle} max-w-3xl mx-auto`}>
              全面的执行数据分析，包含成功率、执行时间、性能指标的趋势分析和可视化报告
            </p>
          </div>

          {/* 头部控制 */}
          <div className={`${UI_CONSTANTS.cards.featured} p-6 mb-8`}>
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
              <div className="text-center lg:text-left">
                <h2 className={UI_CONSTANTS.typography.h2 + " flex items-center justify-center lg:justify-start gap-2 mb-2"}>
                  <BarChart3 className="h-6 w-6" />
                  <span>数据分析报告</span>
                </h2>
                <p className={`${UI_CONSTANTS.typography.body} max-w-2xl`}>
                  查看执行统计和性能分析
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="flex bg-gray-100 rounded-lg p-1">
                  {(['7d', '30d', '90d', 'all'] as const).map((range: any) => (
                    <Button
                      key={range}
                      variant={timeRange === range ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTimeRange(range)}
                      className="text-xs"
                    >
                      {range === '7d' ? '7天' : range === '30d' ? '30天' : range === '90d' ? '90天' : '全部'}
                    </Button>
                  ))}
                </div>
                
                <Button variant="outline" onClick={loadReportData} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>

          {/* 概览统计 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className={UI_CONSTANTS.cards.default + " p-6"}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Activity className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">{reportData.summary.totalSessions}</div>
                  <div className="text-sm text-gray-600">总会话数</div>
                </div>
              </div>
              <p className="text-sm text-gray-500">时间范围内总计</p>
            </div>

            <div className={UI_CONSTANTS.cards.default + " p-6"}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Target className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-green-600">{reportData.summary.successRate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">成功率</div>
                </div>
              </div>
              <p className="text-sm text-gray-500">{reportData.summary.completedSessions} 成功 / {reportData.summary.failedSessions} 失败</p>
            </div>

            <div className={UI_CONSTANTS.cards.default + " p-6"}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">{formatDuration(reportData.summary.averageDuration)}</div>
                  <div className="text-sm text-gray-600">平均时长</div>
                </div>
              </div>
              <p className="text-sm text-gray-500">平均执行时间</p>
            </div>

            <div className={UI_CONSTANTS.cards.default + " p-6"}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-orange-600" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">{formatDuration(reportData.summary.totalExecutionTime)}</div>
                  <div className="text-sm text-gray-600">总执行时间</div>
                </div>
              </div>
              <p className="text-sm text-gray-500">累计执行时间</p>
            </div>

            <div className={UI_CONSTANTS.cards.default + " p-6"}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Download className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">导出</div>
                  <div className="text-sm text-gray-600">报告</div>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button size="sm" onClick={() => exportReport('csv')} className={UI_CONSTANTS.buttons.primary}>
                  CSV
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportReport('json')}>
                  JSON
                </Button>
              </div>
            </div>
          </div>

          {/* 详细报告 */}
          <div className={UI_CONSTANTS.cards.default + " p-6"}>
            <Tabs value={selectedReport} onValueChange={(value) => setSelectedReport(value as any)}>
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  <span>概览</span>
                </TabsTrigger>
                <TabsTrigger value="performance" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  <span>性能分析</span>
                </TabsTrigger>
                <TabsTrigger value="executions" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>执行记录</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>趋势分析</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* 按类型统计 */}
                <div className={UI_CONSTANTS.cards.default + " p-6"}>
                  <h3 className={UI_CONSTANTS.typography.h3 + " flex items-center gap-2 mb-6"}>
                    <PieChart className="h-6 w-6" />
                    <span>按类型统计</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(reportData.performance.byType).map(([type, stats]: any) => (
                      <div key={type} className={UI_CONSTANTS.cards.default + " p-4"}>
                        <h4 className="font-semibold mb-4">{type}</h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span>总数量:</span>
                            <span className="font-medium">{stats.count}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>成功:</span>
                            <span className="text-green-600">{stats.success}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>失败:</span>
                            <span className="text-red-600">{stats.failed}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>成功率:</span>
                            <span className="font-medium">
                              {stats.count > 0 ? ((stats.success / stats.count) * 100).toFixed(1) : 0}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>平均时长:</span>
                            <span className="font-medium">{formatDuration(stats.averageDuration)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 按状态统计 */}
                <div className={UI_CONSTANTS.cards.default + " p-6"}>
                  <h3 className={UI_CONSTANTS.typography.h3 + " flex items-center gap-2 mb-6"}>
                    <Activity className="h-6 w-6" />
                    <span>按状态统计</span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {Object.entries(reportData.performance.byStatus).map(([status, count]: any) => (
                      <div key={status} className={UI_CONSTANTS.cards.default + " p-6 text-center"}>
                        <div className="text-3xl font-bold mb-2">{count}</div>
                        <div className="text-sm text-gray-600">{status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="performance" className="space-y-6">
                {/* 小时分布 */}
                <div className={UI_CONSTANTS.cards.default + " p-6"}>
                  <h3 className={UI_CONSTANTS.typography.h3 + " flex items-center gap-2 mb-6"}>
                    <Clock className="h-6 w-6" />
                    <span>小时分布</span>
                  </h3>
                  <p className={`${UI_CONSTANTS.typography.body} mb-6`}>
                    24小时内执行会话分布情况
                  </p>
                  <div className="space-y-3">
                    {reportData.performance.hourlyDistribution.map((hour: any) => (
                      <div key={hour.hour} className="flex items-center space-x-4">
                        <div className="w-16 text-sm font-medium">{hour.hour}:00</div>
                        <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                          <div
                            className="bg-blue-600 h-6 rounded-full transition-all"
                            style={{ 
                              width: `${(hour.count / Math.max(...reportData.performance.hourlyDistribution?.filter(Boolean)?.map((h: any) => h.count))) * 100}%` 
                            }}
                          ></div>
                          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                            {hour.count}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="executions" className="space-y-6">
                {/* 执行记录列表 */}
                <div className={UI_CONSTANTS.cards.default + " p-6"}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className={UI_CONSTANTS.typography.h3 + " flex items-center gap-2"}>
                      <FileText className="h-6 w-6" />
                      <span>执行记录</span>
                    </h3>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      过滤
                    </Button>
                  </div>
                  <p className={`${UI_CONSTANTS.typography.body} mb-6`}>
                    详细的执行会话记录
                  </p>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {reportData.sessions.map((session: any) => (
                      <div key={session.id} className={UI_CONSTANTS.cards.default + " p-4"}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold">{session.name}</h4>
                            <p className="text-sm text-gray-500">{session.type}</p>
                          </div>
                          <Badge className={
                            session.status === 'completed' ? 'bg-green-100 text-green-800' :
                            session.status === 'failed' ? 'bg-red-100 text-red-800' :
                            session.status === 'running' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {session.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="font-medium text-gray-700 mb-1">开始时间</div>
                            <p>{formatTime(session.startTime)}</p>
                          </div>
                          <div>
                            <div className="font-medium text-gray-700 mb-1">执行时长</div>
                            <p>{session.duration ? formatDuration(session.duration) : '-'}</p>
                          </div>
                          <div>
                            <div className="font-medium text-gray-700 mb-1">进度</div>
                            <p>{session.progress.current}/{session.progress.total}</p>
                          </div>
                          <div>
                            <div className="font-medium text-gray-700 mb-1">成功率</div>
                            <p>{session.progress.total > 0 ? ((session.progress.current / session.progress.total) * 100).toFixed(1) : 0}%</p>
                          </div>
                        </div>
                        
                        {session.error && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {session.error}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {reportData.sessions.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg">暂无执行记录</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="analytics" className="space-y-6">
                {/* 每日趋势 */}
                <div className={UI_CONSTANTS.cards.default + " p-6"}>
                  <h3 className={UI_CONSTANTS.typography.h3 + " flex items-center gap-2 mb-6"}>
                    <TrendingUp className="h-6 w-6" />
                    <span>每日趋势</span>
                  </h3>
                  <p className={`${UI_CONSTANTS.typography.body} mb-6`}>
                    执行数量和成功率趋势
                  </p>
                  <div className="space-y-3">
                    {reportData.performance.dailyTrend.map((day, index: number) => (
                      <div key={day.date} className="flex items-center space-x-4">
                        <div className="w-24 text-sm font-medium">{day.date}</div>
                        <div className="flex-1 grid grid-cols-2 gap-4">
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                              <div
                                className="bg-blue-600 h-4 rounded-full"
                                style={{ width: `${Math.min(day.sessions * 10, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-sm w-12">{day.sessions}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                              <div
                                className="bg-green-600 h-4 rounded-full"
                                style={{ width: `${day.successRate}%` }}
                              ></div>
                            </div>
                            <span className="text-sm w-12">{day.successRate.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

// 简单的Label组件
const Label = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`text-sm font-medium text-gray-700 ${className}`}>{children}</div>
);
