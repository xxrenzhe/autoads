/**
 * Progress Tracking Component
 * 专门处理进度显示和状态管理
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useEnhancedProgress } from '@/hooks/useEnhancedProgress';
import { ProgressData } from '@/types/progress';
import { EnhancedError } from '@/lib/utils/error-handling';

interface ProgressTrackerProps {
  taskId: string;
  onProgress?: (data: ProgressData) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
  enabled?: boolean;
  showDetailedStats?: boolean;
  height?: number;
  className?: string;
}

interface ProgressStats {
  completed: number;
  failed: number;
  total: number;
  percentage: number;
  estimatedTimeRemaining?: number;
  speed?: number; // requests per minute
}

export function ProgressTracker({
  taskId,
  onProgress,
  onError,
  onComplete,
  enabled = true,
  showDetailedStats = false,
  height = 8,
  className = ''
}: ProgressTrackerProps) {
  const [stats, setStats] = useState<ProgressStats>({
    completed: 0,
    failed: 0,
    total: 0,
    percentage: 0
  });
  
  const [connectionInfo, setConnectionInfo] = useState({
    connected: false,
    connectionType: 'none' as 'websocket' | 'polling' | 'none',
    lastUpdate: 0,
    errorCount: 0
  });

  // 处理进度更新
  const handleProgressUpdate = useCallback((data: any) => {
    const completed = data.successCount || 0;
    const failed = data.failCount || 0;
    const total = data.total || 0;
    const percentage = Math.max(1, Math.min(100, data.progress || 0));
    
    const newStats: ProgressStats = {
      completed,
      failed,
      total,
      percentage
    };
    
    // 计算速度和预估时间
    if (connectionInfo.lastUpdate > 0 && completed > 0) {
      const timeDiff = (Date.now() - connectionInfo.lastUpdate) / 1000 / 60; // 分钟
      if (timeDiff > 0) {
        const speed = completed / timeDiff;
        const remaining = total - completed;
        const estimatedTime = remaining / speed;
        
        newStats.speed = speed;
        newStats.estimatedTimeRemaining = estimatedTime;
      }
    }
    
    setStats(newStats);
    setConnectionInfo(prev => ({
      ...prev,
      lastUpdate: Date.now()
    }));
    
    // 调用外部回调
    if (onProgress) {
      onProgress({
        taskId,
        status: data.status,
        progress: percentage,
        completed,
        failed,
        total,
        message: data.message,
        timestamp: Date.now()
      });
    }
  }, [onProgress, taskId, connectionInfo.lastUpdate]);

  // 处理错误
  const handleError = useCallback((error: any) => {
    setConnectionInfo(prev => ({
      ...prev,
      errorCount: prev.errorCount + 1
    }));
    
    if (onError) {
      onError(new Error(error.message || 'Progress tracking error'));
    }
  }, [onError]);

  // 处理完成
  const handleComplete = useCallback(() => {
    if (onComplete) {
      onComplete();
    }
  }, [onComplete]);

  // 使用简化的进度更新
  useEffect(() => {
    if (!enabled || !taskId) return;
    
    // 设置默认的连接信息
    setConnectionInfo({
      connected: true,
      connectionType: 'polling',
      lastUpdate: Date.now(),
      errorCount: 0
    });
  }, [enabled, taskId]);

  // 进度条颜色计算
  const getProgressColor = useCallback(() => {
    if (stats.failed > stats.completed * 0.5) {
      return 'bg-red-500';
    }
    if (stats.failed > stats.completed * 0.2) {
      return 'bg-yellow-500';
    }
    return 'bg-green-500';
  }, [stats.failed, stats.completed]);

  // 格式化时间
  const formatTime = useCallback((minutes: number) => {
    if (minutes < 1) {
      return `${Math.round(minutes * 60)}秒`;
    }
    if (minutes < 60) {
      return `${Math.round(minutes)}分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}小时${remainingMinutes}分钟`;
  }, []);

  if (!enabled || !taskId) {
    return null as any;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 主要进度条 */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium">
            进度: {stats.completed}/{stats.total} ({stats.percentage}%)
          </span>
          {showDetailedStats && stats.failed > 0 && (
            <span className="text-red-600">
              失败: {stats.failed}
            </span>
          )}
        </div>
        
        <div className="w-full bg-gray-200 rounded-full overflow-hidden" style={{ height: `${height}px` }}>
          <div
            className={`h-full transition-all duration-300 ease-out ${getProgressColor()}`}
            style={{ width: `${stats.percentage}%` }}
          />
        </div>
        
        {/* 状态信息 */}
        <div className="flex justify-between items-center text-xs text-gray-600">
          <span className="flex items-center space-x-2">
            <span className={`inline-block w-2 h-2 rounded-full ${
              connectionInfo.connected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span>
              {connectionInfo.connectionType === 'websocket' ? '实时' : 
               connectionInfo.connectionType === 'polling' ? '轮询' : '未连接'}
            </span>
          </span>
          
          {showDetailedStats && stats.speed && (
            <span>
              速度: {stats.speed.toFixed(1)}/分钟
            </span>
          )}
          
          {showDetailedStats && stats.estimatedTimeRemaining && (
            <span>
              预计剩余: {formatTime(stats.estimatedTimeRemaining)}
            </span>
          )}
        </div>
      </div>
      
      {/* 连接诊断信息 */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 font-mono">
          <div>连接类型: {connectionInfo.connectionType}</div>
          <div>错误计数: {connectionInfo.errorCount}</div>
          <div>最后更新: {new Date(connectionInfo.lastUpdate).toLocaleTimeString()}</div>
        </div>
      )}
    </div>
  );
}