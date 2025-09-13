'use client';

import { Loader2, AlertCircle, CheckCircle, Clock, Pause } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// 基础加载组件
export const LoadingSpinner: React.FC<{ 
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${className}`} />
  );
};

// 页面级加载状态
export const PageLoading: React.FC<{ 
  message?: string;
  showProgress?: boolean;
  progress?: number;
}> = ({ 
  message = '加载中...', 
  showProgress = false, 
  progress = 0 
}) => {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md">
        <LoadingSpinner size="lg" className="text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600 mb-4">{message}</p>
        
        {showProgress && (
          <div className="w-full">
            <Progress value={progress} className="mb-2" />
            <p className="text-sm text-gray-500">{progress}% 完成</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 卡片加载状态
export const CardLoading: React.FC<{ 
  rows?: number;
  showHeader?: boolean;
}> = ({ rows = 3, showHeader = true }) => {
  return (
    <Card>
      <CardContent className="p-6">
        {showHeader && (
          <div className="mb-4">
            <div className="h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
          </div>
        )}
        
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index: any) => (
            <div key={index} className="flex items-center space-x-3">
              <div className="h-4 bg-gray-200 rounded animate-pulse flex-1"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// 表格加载状态
export const TableLoading: React.FC<{ 
  columns?: number;
  rows?: number;
}> = ({ columns = 4, rows = 5 }) => {
  return (
    <div className="bg-white rounded-lg border">
      {/* 表头 */}
      <div className="border-b p-4">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, index: any) => (
            <div key={index} className="h-4 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
      
      {/* 表格行 */}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIndex: any) => (
          <div key={rowIndex} className="p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIndex: any) => (
                <div key={colIndex} className="h-4 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 执行状态指示器
export const ExecutionStatusIndicator: React.FC<{
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}> = ({ status, showLabel = true, size = 'md' }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: Clock,
          textColor: 'text-gray-500',
          bgColor: 'bg-gray-100',
          label: '等待中',
          animate: false
        };
      case 'running':
        return {
          icon: Loader2,
          textColor: 'text-blue-600',
          bgColor: 'bg-blue-100',
          label: '运行中',
          animate: true
        };
      case 'completed':
        return {
          icon: CheckCircle,
          textColor: 'text-green-600',
          bgColor: 'bg-green-100',
          label: '已完成',
          animate: false
        };
      case 'failed':
        return {
          icon: AlertCircle,
          textColor: 'text-red-600',
          bgColor: 'bg-red-100',
          label: '失败',
          animate: false
        };
      case 'paused':
        return {
          icon: Pause,
          textColor: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          label: '已暂停',
          animate: false
        };
      default:
        return {
          icon: Clock,
          textColor: 'text-gray-500',
          bgColor: 'bg-gray-100',
          label: '未知',
          animate: false
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  return (
    <div className="flex items-center space-x-2">
      <div className={`p-1 rounded-full ${config.bgColor}`}>
        <Icon 
          className={`${sizeClasses[size]} ${config.textColor} ${config.animate ? 'animate-spin' : ''}`} 
        />
      </div>
      {showLabel && (
        <span className={`text-sm font-medium ${config.textColor}`}>
          {config.label}
        </span>
      )}
    </div>
  );
};

// 进度条组件
export const ProgressIndicator: React.FC<{
  current: number;
  total: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
}> = ({ 
  current, 
  total, 
  label, 
  showPercentage = true,
  variant = 'default'
}) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  
  const getVariantClasses = () => {
    switch (variant) {
      case 'success':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="space-y-2">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center text-sm">
          {label && <span className="text-gray-700">{label}</span>}
          {showPercentage && (
            <span className="text-gray-500">
              {current}/{total} ({percentage}%)
            </span>
          )}
        </div>
      )}
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${getVariantClasses()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// 批量操作加载状态
export const BatchOperationLoading: React.FC<{
  operations: Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number;
  }>;
}> = ({ operations }) => {
  const completedCount = operations.filter((op: any) => op.status === 'completed').length;
  const failedCount = operations.filter((op: any) => op.status === 'failed').length;
  const runningCount = operations.filter((op: any) => op.status === 'running').length;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">批量操作进度</h3>
          <ProgressIndicator 
            current={completedCount + failedCount}
            total={operations.length}
            label="总体进度"
          />
        </div>

        <div className="flex items-center space-x-4 mb-4">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            运行中: {runningCount}
          </Badge>
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            已完成: {completedCount}
          </Badge>
          {failedCount > 0 && (
            <Badge variant="secondary" className="bg-red-100 text-red-800">
              失败: {failedCount}
            </Badge>
          )}
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {operations.map((operation: any) => (
            <div key={operation.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm text-gray-700 truncate flex-1 mr-2">
                {operation.name}
              </span>
              <div className="flex items-center space-x-2">
                {operation.progress !== undefined && operation.status === 'running' && (
                  <div className="w-20">
                    <Progress value={operation.progress} className="h-1" />
                  </div>
                )}
                <ExecutionStatusIndicator 
                  status={operation.status} 
                  showLabel={false}
                  size="sm"
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// 实时状态更新组件
export const LiveStatusUpdater: React.FC<{
  lastUpdate: Date;
  isUpdating?: boolean;
  onRefresh?: () => void;
}> = ({ lastUpdate, isUpdating = false, onRefresh }) => {
  return (
    <div className="flex items-center space-x-2 text-sm text-gray-500">
      <span>最后更新: {lastUpdate.toLocaleTimeString()}</span>
      {isUpdating ? (
        <div className="flex items-center space-x-1">
          <LoadingSpinner size="sm" />
          <span>更新中...</span>
        </div>
      ) : (
        onRefresh && (
          <button 
            onClick={onRefresh}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            刷新
          </button>
        )
      )}
    </div>
  );
};