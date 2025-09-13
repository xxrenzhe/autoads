/**
 * Task Control Component
 * 专门处理任务控制操作（开始、暂停、终止等）
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Play, Pause, Square, RotateCcw, AlertTriangle } from 'lucide-react';
import { silentBatchTaskManager } from '@/lib/silent-batch-task-manager';
import { TaskStatus, TaskStatusType } from '@/types/task';

interface TaskControlProps {
  taskId: string;
  taskStatus?: TaskStatusType;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  disabled?: boolean;
  showStats?: boolean;
  className?: string;
}

interface TaskStats {
  completed: number;
  failed: number;
  total: number;
  duration?: number;
  speed?: number;
}

export function TaskControl({
  taskId,
  taskStatus,
  onStart,
  onPause,
  onResume,
  onStop,
  onRestart,
  disabled = false,
  showStats = false,
  className = ''
}: TaskControlProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<TaskStats>({
    completed: 0,
    failed: 0,
    total: 0
  });

  // 计算任务统计信息
  React.useEffect(() => {
    if (taskStatus) {
      const completed = taskStatus.successCount || 0;
      const failed = taskStatus.failCount || 0;
      const total = taskStatus.total || 0;
      
      const newStats: TaskStats = {
        completed,
        failed,
        total
      };
      
      // 计算运行时间和速度
      if (taskStatus.startTime) {
        const duration = Date.now() - taskStatus.startTime;
        newStats.duration = duration;
        
        if (completed > 0 && duration > 0) {
          const speed = (completed / duration) * 1000 * 60; // per minute
          newStats.speed = speed;
        }
      }
      
      setStats(newStats);
    }
  }, [taskStatus]);

  // 终止任务
  const handleTerminate = useCallback(async () => {
    if (!taskId || disabled) return;
    
    setActionLoading('terminate');
    try {
      const success = await silentBatchTaskManager.terminateTask(taskId);
      if (success) {
        onStop?.();
      }
    } catch (error) {
      console.error('Failed to terminate task:', error);
    } finally {
      setActionLoading(null);
    }
  }, [taskId, disabled, onStop]);

  // 获取状态显示信息
  const getStatusInfo = useCallback(() => {
    switch (taskStatus?.status) {
      case 'running':
        return {
          label: '运行中',
          variant: 'default' as const,
          color: 'text-blue-600 bg-blue-100'
        };
      case 'completed':
        return {
          label: '已完成',
          variant: 'default' as const,
          color: 'text-green-600 bg-green-100'
        };
      case 'failed':
        return {
          label: '失败',
          variant: 'destructive' as const,
          color: 'text-red-600 bg-red-100'
        };
      case 'terminated':
        return {
          label: '已终止',
          variant: 'secondary' as const,
          color: 'text-gray-600 bg-gray-100'
        };
      default:
        return {
          label: '未开始',
          variant: 'outline' as const,
          color: 'text-gray-500 bg-gray-50'
        };
    }
  }, [taskStatus?.status]);

  // 判断是否可以执行操作
  const canStart = !taskStatus || taskStatus.status === 'terminated';
  const canPause = taskStatus?.status === 'running';
  const canStop = taskStatus?.status === 'running';
  const canRestart = taskStatus?.status === 'completed' || taskStatus?.status === 'failed';

  const statusInfo = getStatusInfo();

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>任务控制</span>
          <Badge className={statusInfo.color}>
            {statusInfo.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 控制按钮 */}
        <div className="flex flex-wrap gap-2">
          {canStart && (
            <Button
              onClick={onStart}
              disabled={disabled || actionLoading !== null}
              size="sm"
            >
              {actionLoading === 'start' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              开始任务
            </Button>
          )}
          
          {canPause && (
            <Button
              onClick={onPause}
              disabled={disabled || actionLoading !== null}
              variant="outline"
              size="sm"
            >
              {actionLoading === 'pause' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
              暂停
            </Button>
          )}
          
          {canStop && (
            <Button
              onClick={handleTerminate}
              disabled={disabled || actionLoading !== null}
              variant="destructive"
              size="sm"
            >
              {actionLoading === 'terminate' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              终止
            </Button>
          )}
          
          {canRestart && (
            <Button
              onClick={onRestart}
              disabled={disabled || actionLoading !== null}
              variant="outline"
              size="sm"
            >
              {actionLoading === 'restart' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              重新开始
            </Button>
          )}
        </div>
        
        {/* 任务统计信息 */}
        {showStats && (stats.completed > 0 || stats.failed > 0) && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">已完成:</span>
              <span className="ml-2 font-medium">{stats.completed}</span>
            </div>
            <div>
              <span className="text-gray-600">失败:</span>
              <span className="ml-2 font-medium text-red-600">{stats.failed}</span>
            </div>
            <div>
              <span className="text-gray-600">总计:</span>
              <span className="ml-2 font-medium">{stats.total}</span>
            </div>
            {stats.speed && (
              <div>
                <span className="text-gray-600">速度:</span>
                <span className="ml-2 font-medium">
                  {stats.speed.toFixed(1)}/分钟
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* 警告信息 */}
        {taskStatus?.message && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {taskStatus.message}
            </AlertDescription>
          </Alert>
        )}
        
        {/* 开发模式调试信息 */}
        {process.env.NODE_ENV === 'development' && taskStatus && (
          <div className="text-xs text-gray-500 font-mono space-y-1">
            <div>任务ID: {taskId}</div>
            <div>状态: {taskStatus.status}</div>
            <div>进度: {taskStatus.progress}%</div>
            <div>开始时间: {taskStatus.startTime ? new Date(taskStatus.startTime).toLocaleString() : 'N/A'}</div>
            {taskStatus.endTime && (
              <div>结束时间: {new Date(taskStatus.endTime).toLocaleString()}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}