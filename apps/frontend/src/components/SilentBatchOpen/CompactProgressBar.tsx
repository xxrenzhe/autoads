/**
 * 紧凑进度条组件 - 专为静默模式设计
 * 显示在静默版本说明下方，与/batchopen页面风格保持一致
 */

import React from 'react';

interface CompactProgressBarProps {
  showProgress: boolean;
  taskId: string | null;
  progress: number;
  successCount: number;
  failCount: number;
  totalVisits: number;
  status: string;
  message: string;
  taskStartTime?: number | null;
  taskEndTime?: number | null;
}

export const CompactProgressBar: React.FC<CompactProgressBarProps> = ({
  showProgress,
  taskId,
  progress,
  successCount,
  failCount,
  totalVisits,
  status,
  message,
  taskStartTime,
  taskEndTime
}) => {


  if (!showProgress) => {
    return null as any;
  }

  // 判断是否显示进度条
  const shouldShowProgressBar = status !== 'idle' && totalVisits > 0;
  
  // 计算处理中的任务数
  const pendingCount = Math.max(0, totalVisits - successCount - failCount);
  
  // 计算耗时
  const calculateDuration = () => {
    // 检查状态消息中是否包含耗时信息
    const extractDurationFromMessage = (msg: string): string | null => {
      const match = msg.match(/耗时:\s*(\d+m)?\d+s/);
      return match ? match[0].replace('耗时: ', '') : null;
    };
    
    // 优先从状态消息中提取耗时
    const durationFromMessage = extractDurationFromMessage(message);
    if (durationFromMessage) => {
      return durationFromMessage;
    }
    
    // 如果消息中没有，则根据时间戳计算
    if (status === 'completed' && taskStartTime && taskEndTime) => {
      // 任务完成时，使用固定的开始和结束时间
      const duration = Math.floor((taskEndTime - taskStartTime) / 1000);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      return minutes > 0 ? `${minutes}m${seconds}s` : `${seconds}s`;
    } else if (taskStartTime) => {
      // 任务进行中，实时计算耗时
      const duration = Math.floor((Date.now() - taskStartTime) / 1000);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      return minutes > 0 ? `${minutes}m${seconds}s` : `${seconds}s`;
    }
    return '0s';
  };
  
  // 获取状态文本
  const getStatusText = () => {
    if (status === 'terminated') return '任务已终止';
    if (status === 'completed') return '任务完成';
    if (status === 'error') return '任务失败';
    if (message) return message;
    return '正在执行...';
  };

  
  // 获取进度条颜色 - 与SimpleProgressBar保持一致
  const getProgressColor = () => {
    if (status === 'terminated') return 'bg-yellow-600';
    if (status === 'completed' || (successCount + failCount >= totalVisits && totalVisits > 0)) return 'bg-green-600';
    if (status === 'error') return 'bg-red-600';
    return 'bg-blue-600';
  };

  
  return (
    <div className="w-full space-y-2 mt-6 mb-2 px-2">
      {/* 状态和进度信息 - 与SimpleProgressBar布局一致 */}
      <div className="flex justify-between items-center text-sm text-gray-600">
        <span>
          {getStatusText()}
        </span>
        <span className="whitespace-nowrap">
          {`${successCount + failCount}/${totalVisits}`}
        </span>
      </div>
      
      {/* 进度条 */}
      {shouldShowProgressBar && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

  
  
      {/* 详细统计信息 - 静默模式特有的增强显示 */}
      <div className="grid grid-cols-5 gap-2 mt-3 text-center">
        <div className="bg-gray-50 rounded-lg px-2 py-2 border border-gray-100">
          <div className="text-xs text-gray-500 mb-1">总计</div>
          <div className="font-semibold text-gray-900">{totalVisits}</div>
        </div>
        {status === 'completed' ? (
          <>
            <div className="bg-blue-50 rounded-lg px-2 py-2 border border-blue-100 col-span-2">
              <div className="text-xs text-blue-600 mb-1">耗时</div>
              <div className="font-semibold text-blue-900">{calculateDuration()}</div>
            </div>
            <div className="bg-green-50 rounded-lg px-2 py-2 border border-green-100">
              <div className="text-xs text-green-600 mb-1">成功</div>
              <div className="font-semibold text-green-900">{successCount}</div>
            </div>
            <div className="bg-gray-50 rounded-lg px-2 py-2 border border-gray-100">
              <div className="text-xs text-gray-500 mb-1">完成</div>
              <div className="font-semibold text-gray-900">
                {totalVisits > 0 ? Math.round(((successCount + failCount) / totalVisits) * 100) : 0}%
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-green-50 rounded-lg px-2 py-2 border border-green-100">
              <div className="text-xs text-green-600 mb-1">成功</div>
              <div className="font-semibold text-green-900">{successCount}</div>
            </div>
            <div className="bg-red-50 rounded-lg px-2 py-2 border border-red-100">
              <div className="text-xs text-red-600 mb-1">失败</div>
              <div className="font-semibold text-red-900">{failCount}</div>
            </div>
            <div className="bg-yellow-50 rounded-lg px-2 py-2 border border-yellow-100">
              <div className="text-xs text-yellow-600 mb-1">处理中</div>
              <div className="font-semibold text-yellow-900">{pendingCount}</div>
            </div>
            <div className="bg-blue-50 rounded-lg px-2 py-2 border border-blue-100">
              <div className="text-xs text-blue-600 mb-1">成功率</div>
              <div className="font-semibold text-blue-900">
                {totalVisits > 0 ? Math.round((successCount / totalVisits) * 100) : 0}%
              </div>
            </div>
          </>
        )}
      </div>

      {/* 任务ID - 仅在开发模式或需要时显示 */}
      {taskId && process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-400 text-center">
          任务ID: {taskId}
        </div>
      )}
    </div>
  );
};