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
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Calendar,
  Plus,
  Edit,
  Trash2,
  Settings,
  Eye
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  configurationId: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  lastRun?: string;
  nextRun?: string;
  executionHistory: {
    id: string;
    status: 'success' | 'failed' | 'running';
    startTime: string;
    endTime?: string;
    duration?: number;
  }[];
  settings: {
    retryCount: number;
    timeout: number;
    notifications: boolean;
    maxConcurrent: number;
  };
}

export default function SchedulingPage() {
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  useEffect(() => {
    loadScheduledTasks();
  }, []);

  const loadScheduledTasks = async () => {
    try {
      setLoading(true);
      // 模拟API调用
      const mockTasks: ScheduledTask[] = [
        {
          id: '1',
          name: '每日链接更新',
          description: '每天凌晨2点自动更新所有链接',
          cronExpression: '0 2 * * *',
          configurationId: 'config-1',
          status: 'active',
          lastRun: '2024-01-15T02:00:00Z',
          nextRun: '2024-01-16T02:00:00Z',
          executionHistory: [
            {
              id: 'exec-1',
              status: 'success',
              startTime: '2024-01-15T02:00:00Z',
              endTime: '2024-01-15T02:15:00Z',
              duration: 900000
            },
            {
              id: 'exec-2',
              status: 'success',
              startTime: '2024-01-14T02:00:00Z',
              endTime: '2024-01-14T02:18:00Z',
              duration: 1080000
            }
          ],
          settings: {
            retryCount: 3,
            timeout: 3600000,
            notifications: true,
            maxConcurrent: 5
          }
        },
        {
          id: '2',
          name: '每周报告生成',
          description: '每周一生成执行报告',
          cronExpression: '0 9 * * 1',
          configurationId: 'config-2',
          status: 'active',
          lastRun: '2024-01-15T09:00:00Z',
          nextRun: '2024-01-22T09:00:00Z',
          executionHistory: [
            {
              id: 'exec-3',
              status: 'success',
              startTime: '2024-01-15T09:00:00Z',
              endTime: '2024-01-15T09:05:00Z',
              duration: 300000
            }
          ],
          settings: {
            retryCount: 1,
            timeout: 1800000,
            notifications: true,
            maxConcurrent: 1
          }
        },
        {
          id: '3',
          name: '实时监控任务',
          description: '每小时检查系统状态',
          cronExpression: '0 * * * *',
          configurationId: 'config-3',
          status: 'paused',
          lastRun: '2024-01-15T14:00:00Z',
          nextRun: '2024-01-15T15:00:00Z',
          executionHistory: [
            {
              id: 'exec-4',
              status: 'failed',
              startTime: '2024-01-15T14:00:00Z',
              endTime: '2024-01-15T14:05:00Z',
              duration: 300000
            }
          ],
          settings: {
            retryCount: 2,
            timeout: 600000,
            notifications: false,
            maxConcurrent: 3
          }
        }
      ];
      
      setScheduledTasks(mockTasks);
    } catch (error) {
      console.error('加载定时任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      setScheduledTasks(prev => 
        prev?.filter(Boolean)?.map((task: any) => 
          task.id === taskId ? { ...task, status: newStatus as any } : task
        )
      );
    } catch (error) {
      console.error('切换任务状态失败:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('确定要删除这个定时任务吗？')) return;

    try {
      setScheduledTasks(prev => prev.filter((task: any) => task.id !== taskId));
    } catch (error) {
      console.error('删除任务失败:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      paused: 'secondary',
      completed: 'default',
      failed: 'destructive'
    } as const;

    const labels = {
      active: '运行中',
      paused: '已暂停',
      completed: '已完成',
      failed: '失败'
    };

    const icons = {
      active: Play,
      paused: Pause,
      completed: CheckCircle,
      failed: XCircle
    };

    const Icon = icons[status as keyof typeof icons] || Clock;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (duration: number) => {
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

  const TaskCard = ({ task }: { task: ScheduledTask }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{task.name}</CardTitle>
            <CardDescription>{task.description}</CardDescription>
          </div>
          {getStatusBadge(task.status)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Cron表达式:</span>
              <div className="font-mono text-xs bg-gray-100 p-1 rounded mt-1">
                {task.cronExpression}
              </div>
            </div>
            <div>
              <span className="text-gray-600">配置ID:</span>
              <div className="font-mono text-xs">{task.configurationId.slice(-8)}</div>
            </div>
          </div>

          <div className="text-sm">
            {task.lastRun && (
              <div className="flex justify-between">
                <span className="text-gray-600">上次运行:</span>
                <span>{formatDateTime(task.lastRun)}</span>
              </div>
            )}
            {task.nextRun && (
              <div className="flex justify-between">
                <span className="text-gray-600">下次运行:</span>
                <span>{formatDateTime(task.nextRun)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedTask(task);
                setShowDetailDialog(true);
              }}
            >
              <Eye className="h-4 w-4 mr-1" />
              详情
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleToggleTask(task.id, task.status)}
            >
              {task.status === 'active' ? (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  暂停
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  启动
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDeleteTask(task.id)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const TaskDetail = ({ task }: { task: ScheduledTask }) => (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">概览</TabsTrigger>
        <TabsTrigger value="history">执行历史</TabsTrigger>
        <TabsTrigger value="settings">设置</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">任务状态</CardTitle>
            </CardHeader>
            <CardContent>
              {getStatusBadge(task.status)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">执行次数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{task.executionHistory.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">任务信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">任务ID:</span>
              <span className="font-mono">{task.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">配置ID:</span>
              <span className="font-mono">{task.configurationId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Cron表达式:</span>
              <span className="font-mono">{task.cronExpression}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">描述:</span>
              <span>{task.description}</span>
            </div>
            {task.lastRun && (
              <div className="flex justify-between">
                <span className="text-gray-600">上次运行:</span>
                <span>{formatDateTime(task.lastRun)}</span>
              </div>
            )}
            {task.nextRun && (
              <div className="flex justify-between">
                <span className="text-gray-600">下次运行:</span>
                <span>{formatDateTime(task.nextRun)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="history" className="space-y-4">
        {task.executionHistory.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>暂无执行历史</AlertDescription>
          </Alert>
        ) : (
          task.executionHistory.map((execution, index: any) => (
            <Card key={index}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm">执行 #{execution.id.slice(-8)}</CardTitle>
                  <Badge variant={execution.status === 'success' ? 'default' : 'destructive'}>
                    {execution.status === 'success' ? '成功' : '失败'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">开始时间:</span>
                    <span>{formatDateTime(execution.startTime)}</span>
                  </div>
                  {execution.endTime && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">结束时间:</span>
                      <span>{formatDateTime(execution.endTime)}</span>
                    </div>
                  )}
                  {execution.duration && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">持续时间:</span>
                      <span>{formatDuration(execution.duration)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>

      <TabsContent value="settings" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">任务设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">重试次数:</span>
              <span>{task.settings.retryCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">超时时间:</span>
              <span>{formatDuration(task.settings.timeout)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">通知启用:</span>
              <span>{task.settings.notifications ? '是' : '否'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">最大并发数:</span>
              <span>{task.settings.maxConcurrent}</span>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>加载定时任务中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">定时任务</h1>
          <p className="text-gray-600">管理和监控自动化任务的定时执行</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadScheduledTasks} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            创建任务
          </Button>
        </div>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">
            活跃任务 ({scheduledTasks.filter((t: any) => t.status === 'active').length})
          </TabsTrigger>
          <TabsTrigger value="paused">
            已暂停 ({scheduledTasks.filter((t: any) => t.status === 'paused').length})
          </TabsTrigger>
          <TabsTrigger value="all">
            全部任务 ({scheduledTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          {scheduledTasks.filter((t: any) => t.status === 'active').length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">暂无活跃任务</h3>
                <p className="text-gray-600">当前没有正在运行的定时任务</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {scheduledTasks.filter((t: any) => t.status === 'active').map((task: any) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="paused" className="space-y-6">
          {scheduledTasks.filter((t: any) => t.status === 'paused').length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Pause className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">暂无暂停任务</h3>
                <p className="text-gray-600">没有暂停的定时任务</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {scheduledTasks.filter((t: any) => t.status === 'paused').map((task: any) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-6">
          {scheduledTasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">暂无定时任务</h3>
                <p className="text-gray-600">还没有创建任何定时任务</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {scheduledTasks.map((task: any) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>任务详情</DialogTitle>
            <DialogDescription>
              查看定时任务的详细信息和配置
            </DialogDescription>
          </DialogHeader>
          {selectedTask && <TaskDetail task={selectedTask} />}
        </DialogContent>
      </Dialog>

      {/* 创建任务对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>创建定时任务</DialogTitle>
            <DialogDescription>
              配置新的定时执行任务
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                任务创建功能正在开发中，敬请期待！
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
