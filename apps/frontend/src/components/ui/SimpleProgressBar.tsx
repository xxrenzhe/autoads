/**
 * Simple Progress Component
 * 简单进度条组件 - 用于初级和高级版本的URL打开进度显示
 */

import React from 'react';

interface SimpleProgressBarProps {
  progress: number;
  total: number;
  isOpening: boolean;
  isTerminated: boolean;
  className?: string;
}

/**
 * 简单进度条组件
 * 显示URL打开进度，格式：已打开x/y，显示百分比
 */
export const SimpleProgressBar: React.FC<SimpleProgressBarProps> = ({
  progress,
  total,
  isOpening,
  isTerminated,
  className = ''
}) => {
  // 计算进度百分比
  const progressPercent = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 0;
  
  // 确定状态文本
  const getStatusText = () => {
    if (isTerminated) return '批量打开已终止';
    if (progress >= total && total > 0) return '批量打开完成';
    if (isOpening) return '正在打开...';
    return '';
  };

  // 进度条颜色
  const getProgressColor = () => {
    if (isTerminated) return 'bg-yellow-600';
    if (progress >= total && total > 0) return 'bg-green-600';
    return 'bg-blue-600';
  };

  // 如果没有进度数据，不显示进度条
  if (progress === 0 && !isOpening && !isTerminated) {
    return null as any;
  }

  return (
    <div className={`w-full space-y-2 ${className}`}>
      <div className="flex justify-between items-center text-sm text-gray-600">
        <span>
          {getStatusText()}
        </span>
        <span className="whitespace-nowrap">
          {progress}/{total} ({progressPercent}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};