'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  Square, 
  Eye, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Activity,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ExecutionContext {
  id: string;
  configurationId: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  totalSteps: number;
  currentStep: string;
  startTime: string;
  endTime?: string;
  results: ExecutionStepResult[];
  errors: ExecutionError[];
  metadata: {
    totalLinks: number;
    processedLinks: number;
    successfulUpdates: number;
    failedUpdates: number;
  };
}

interface ExecutionStepResult {
  step: string;
  status: 'success' | 'failed' | 'skipped';
  startTime: string;
  endTime: string;
  duration: number;
  data?: unknown;
  error?: string;
}

interface ExecutionError {
  step: string;
  error: string;
  timestamp: string;
  recoverable: boolean;
  retryCount: number;
}

export default function ExecutionsPage() {
  const [activeExecutions, setActiveExecutions] = useState<ExecutionContext[]>([]);
  const [historyExecutions, setHistoryExecutions] = useState<ExecutionContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionContext | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadExecutions();
    
    // 设置自动刷新
    const interval = setInterval(() => {
      loadActiveExecutions();
    }, 30000); // 每30秒刷新活跃执行（减少频繁请求）
    
    setRefreshInterval(interval);

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);
  
  // 页面不可见时暂停轮询，可见时恢复
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面隐藏时暂停轮询
        if (refreshInterval) {
          clearInterval(refreshInterval);
          setRefreshInterval(null);
        }
      } else {
        // 页面可见时恢复轮询
        const interval = setInterval(() => {
          loadActiveExecutions();
        }, 30000);
        setRefreshInterval(interval);
        // 立即加载一次最新数据
        loadActiveExecutions();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshInterval]);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadActiveExecutions(),
        loadHistoryExecutions()
      ]);
    } catch (error) {
      console.error('加载执行记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveExecutions = async () => {
    try {
      const response = await fetch('/api/adscenter/execute?action=list&userId=current_user');
      const result = await response.json();
      
      if (result.success) {
        setActiveExecutions(result.data.executions);
      }
    } catch (error) {
      console.error('加载活跃执行失败:', error);
    }
  };

  const loadHistoryExecutions = async () => {
    try {
      const response = await fetch('/api/adscenter/execute?action=history&userId=current_user&limit=20');
      const result = await response.json();
      
      if (result.success) {
        setHistoryExecutions(result.data.executions);
      }
    } catch (error) {
      console.error('加载历史执行失败:', error);
    }
  };

  const handleCancelExecution = async (executionId: string) => {
    if (!confirm('确定要取消这个执行吗？')) return;

    try {
      const response = await fetch('/api/adscenter/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          executionId
        })
      });

      const result = await response.json();
      
      if (result.success) {
        loadActiveExecutions();
      } else {
        alert('取消执行失败: ' + result.error);
      }
    } catch (error) {
      console.error('取消执行失败:', error);
      alert('取消执行失败');
    }
  };

  const openDetailDialog = async (executionId: string) => {
    try {
      const response = await fetch(`/api/adscenter/execute?action=status&executionId=${executionId}`);
      const result = await response.json();
      
      if (result.success) {
        setSelectedExecution(result.data);
        setShowDetailDialog(true);
      } else {
        alert('获取执行详情失败: ' + result.error);
      }
    } catch (error) {
      console.error('获取执行详情失败:', error);
      alert('获取执行详情失败');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'secondary',
      running: 'default',
      completed: 'default',
      failed: 'destructive',
      cancelled: 'secondary'
    } as const;

    const labels = {
      pending: '等待中',
      running: '执行中',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消'
    };

    const icons = {
      pending: Clock,
      running: Activity,
      completed: CheckCircle,
      failed: XCircle,
      cancelled: AlertCircle
    };

    const Icon = icons[status as keyof typeof icons] || Clock;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = end.getTime() - start.getTime();
    
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  };

  const ExecutionCard = ({ execution, isActive = false }: { execution: ExecutionContext; isActive?: boolean }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">执行 #{execution.id.slice(-8)}</CardTitle>
            <CardDescription>
              配置ID: {execution.configurationId.slice(-8)}
            </CardDescription>
          </div>
          {getStatusBadge(execution.status)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isActive && execution.status === 'running' && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>进度</span>
                <span>{execution.progress}%</span>
              </div>
              <Progress value={execution.progress} className="h-2" />
              <p className="text-sm text-gray-600 mt-1">{execution.currentStep}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">总链接数:</span>
              <span className="ml-2">{execution.metadata.totalLinks}</span>
            </div>
            <div>
              <span className="text-gray-600">已处理:</span>
              <span className="ml-2">{execution.metadata.processedLinks}</span>
            </div>
            <div>
              <span className="text-gray-600">成功更新:</span>
              <span className="ml-2 text-green-600">{execution.metadata.successfulUpdates}</span>
            </div>
            <div>
              <span className="text-gray-600">失败更新:</span>
              <span className="ml-2 text-red-600">{execution.metadata.failedUpdates}</span>
            </div>
          </div>

          <div className="text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">开始时间:</span>
              <span>{new Date(execution.startTime).toLocaleString()}</span>
            </div>
            {execution.endTime && (
              <div className="flex justify-between">
                <span className="text-gray-600">结束时间:</span>
                <span>{new Date(execution.endTime).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">持续时间:</span>
              <span>{formatDuration(execution.startTime, execution.endTime)}</span>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openDetailDialog(execution.id)}
            >
              <Eye className="h-4 w-4 mr-1" />
              详情
            </Button>
            {isActive && execution.status === 'running' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCancelExecution(execution.id)}
              >
                <Square className="h-4 w-4 mr-1" />
                取消
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const ExecutionDetail = ({ execution }: { execution: ExecutionContext }) => (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">概览</TabsTrigger>
        <TabsTrigger value="steps">执行步骤</TabsTrigger>
        <TabsTrigger value="errors">错误信息</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">执行状态</CardTitle>
            </CardHeader>
            <CardContent>
              {getStatusBadge(execution.status)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">进度</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{execution.progress}%</div>
              <Progress value={execution.progress} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">成功更新</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {execution.metadata.successfulUpdates}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">失败更新</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {execution.metadata.failedUpdates}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">执行信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">执行ID:</span>
              <span className="font-mono">{execution.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">配置ID:</span>
              <span className="font-mono">{execution.configurationId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">当前步骤:</span>
              <span>{execution.currentStep}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">总步骤数:</span>
              <span>{execution.totalSteps}</span>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="steps" className="space-y-4">
        {execution.results.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>暂无执行步骤记录</AlertDescription>
          </Alert>
        ) : (
          execution.results.map((step, index: any) => (
            <Card key={index}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm">{step.step}</CardTitle>
                  <Badge variant={step.status === 'success' ? 'default' : 'destructive'}>
                    {step.status === 'success' ? '成功' : '失败'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">开始时间:</span>
                    <span>{new Date(step.startTime).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">结束时间:</span>
                    <span>{new Date(step.endTime).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">耗时:</span>
                    <span>{step.duration}ms</span>
                  </div>
                  {step.error && (
                    <div className="mt-2">
                      <span className="text-gray-600">错误信息:</span>
                      <p className="text-red-600 text-xs mt-1">{step.error}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>

      <TabsContent value="errors" className="space-y-4">
        {execution.errors.length === 0 ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>无错误记录</AlertDescription>
          </Alert>
        ) : (
          execution.errors.map((error, index: any) => (
            <Alert key={index} variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div><strong>步骤:</strong> {error.step}</div>
                  <div><strong>错误:</strong> {error.error}</div>
                  <div><strong>时间:</strong> {new Date(error.timestamp).toLocaleString()}</div>
                  <div><strong>可恢复:</strong> {error.recoverable ? '是' : '否'}</div>
                  <div><strong>重试次数:</strong> {error.retryCount}</div>
                </div>
              </AlertDescription>
            </Alert>
          ))
        )}
      </TabsContent>
    </Tabs>
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>加载执行记录中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">执行记录</h1>
          <p className="text-gray-600">查看自动化执行的历史记录和实时状态</p>
        </div>
        <Button onClick={loadExecutions} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">
            活跃执行 ({activeExecutions.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            历史记录 ({historyExecutions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          {activeExecutions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">暂无活跃执行</h3>
                <p className="text-gray-600">当前没有正在执行的任务</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeExecutions.map((execution: any) => (
                <ExecutionCard key={execution.id} execution={execution} isActive={true} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          {historyExecutions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">暂无历史记录</h3>
                <p className="text-gray-600">还没有执行过任何任务</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {historyExecutions.map((execution: any) => (
                <ExecutionCard key={execution.id} execution={execution} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>执行详情</DialogTitle>
            <DialogDescription>
              查看执行的详细信息和步骤
            </DialogDescription>
          </DialogHeader>
          {selectedExecution && <ExecutionDetail execution={selectedExecution} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
