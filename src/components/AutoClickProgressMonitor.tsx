"use client";

import React from 'react';
import { useAutoClickLiveProgress } from '@/hooks/useAutoClickLiveProgress';
import { SimpleProgressBar } from '@/components/ui/SimpleProgressBar';
import { 
  Activity, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Wifi, 
  WifiOff,
  Target,
  TrendingUp,
  Zap
} from 'lucide-react';

interface AutoClickProgressMonitorProps {
  taskId: string;
  className?: string;
}

export default function AutoClickProgressMonitor({ 
  taskId, 
  className = "" 
}: AutoClickProgressMonitorProps) {
  const { data, isConnected, error, lastUpdate } = useAutoClickLiveProgress(taskId);

  if (!data) {
    return (
      <div className={`p-6 bg-gray-50 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-gray-500">
          <Activity className="w-4 h-4 animate-pulse" />
          <span>连接中...</span>
        </div>
      </div>
    );
  }

  const getStatusInfo = () => {
    switch (data.status) {
      case 'running':
        return {
          icon: <Zap className="w-5 h-5 text-green-600" />,
          color: 'text-green-600 bg-green-50',
          text: '运行中'
        };
      case 'pending':
        return {
          icon: <Clock className="w-5 h-5 text-yellow-600" />,
          color: 'text-yellow-600 bg-yellow-50',
          text: '未启动'
        };
      case 'terminated':
        return {
          icon: <AlertCircle className="w-5 h-5 text-red-600" />,
          color: 'text-red-600 bg-red-50',
          text: '已终止'
        };
      default:
        return {
          icon: <Activity className="w-5 h-5 text-gray-600" />,
          color: 'text-gray-600 bg-gray-50',
          text: data.status
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 状态栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.icon}
            {statusInfo.text}
          </span>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span>实时更新</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span>连接断开</span>
              </>
            )}
          </div>
        </div>
        {lastUpdate && (
          <span className="text-xs text-gray-500">
            更新于 {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {data.progress && (
        <>
          {/* 总体进度 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-blue-600" />
              <h4 className="font-medium text-gray-900">今日总进度</h4>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">完成进度</span>
                <span className="font-medium">
                  {data.progress.total.completed.toLocaleString()} / {data.progress.total.target.toLocaleString()} 
                  ({data.progress.total.percentage}%)
                </span>
              </div>
              
              <SimpleProgressBar 
                progress={data.progress.total.completed}
                total={data.progress.total.target}
                isOpening={data.status === 'running'}
                isTerminated={data.status === 'terminated'}
                className="h-3"
              />
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-2 bg-blue-50 rounded">
                  <p className="text-xs text-gray-600">目标</p>
                  <p className="font-semibold text-blue-600">
                    {data.progress.total.target.toLocaleString()}
                  </p>
                </div>
                <div className="p-2 bg-green-50 rounded">
                  <p className="text-xs text-gray-600">已完成</p>
                  <p className="font-semibold text-green-600">
                    {data.progress.total.completed.toLocaleString()}
                  </p>
                </div>
                <div className="p-2 bg-purple-50 rounded">
                  <p className="text-xs text-gray-600">完成率</p>
                  <p className="font-semibold text-purple-600">
                    {data.progress.total.percentage}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 当前小时进度 */}
          {data.progress.hourly && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                <h4 className="font-medium text-gray-900">
                  当前小时 ({new Date().getHours()}:00-{new Date().getHours() + 1}:00)
                </h4>
                {data.progress.hourly.isRunning && (
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                    执行中
                  </span>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">小时进度</span>
                  <span className="font-medium">
                    {data.progress.hourly.completed} / {data.progress.hourly.target}
                  </span>
                </div>
                
                <SimpleProgressBar 
                  progress={data.progress.hourly.completed}
                  total={data.progress.hourly.target}
                  isOpening={data.progress.hourly.isRunning}
                  isTerminated={data.status === 'terminated'}
                  className="h-2"
                />
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-2 bg-orange-50 rounded">
                    <p className="text-xs text-gray-600">目标</p>
                    <p className="font-semibold text-orange-600">
                      {data.progress.hourly.target}
                    </p>
                  </div>
                  <div className="p-2 bg-green-50 rounded">
                    <p className="text-xs text-gray-600">成功</p>
                    <p className="font-semibold text-green-600">
                      {data.progress.hourly.completed}
                    </p>
                  </div>
                  <div className="p-2 bg-red-50 rounded">
                    <p className="text-xs text-gray-600">失败</p>
                    <p className="font-semibold text-red-600">
                      {data.progress.hourly.failed}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 预计完成时间 */}
          {data.progress.total.percentage > 0 && data.progress.total.percentage < 100 && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-700">
                预计完成时间: {new Date(
                  Date.now() + 
                  Math.ceil((data.progress.total.target - data.progress.total.completed) / 
                  (data.progress.total.completed / (Date.now() - new Date().setHours(0, 0, 0, 0))) * 
                  24 * 60 * 60 * 1000)
                ).toLocaleString()}
              </span>
            </div>
          )}

          {/* 完成提示 */}
          {data.progress.total.percentage >= 100 && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                今日任务已完成！
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}