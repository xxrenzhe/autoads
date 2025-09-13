/**
 * Enhanced Progress Component
 * 增强的进度条组件 - 提供更好的视觉体验
 */

import React, { useState, useEffect } from 'react';
import { PROGRESS_STAGES, TaskState } from '@/lib/utils/enhanced-progress-manager';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';

interface EnhancedProgressBarProps {
  taskId?: string;
  totalItems?: number;
  height?: string;
  showDetails?: boolean;
  showStats?: boolean;
  className?: string;
  autoStart?: boolean;
  // 直接接收后端进度数据
  progress?: number;
  successCount?: number;
  failCount?: number;
  pendingCount?: number;
  status?: string;
  message?: string;
}

interface StageInfo {
  key: string;
  name: string;
  description: string;
  color: string;
  icon: string;
}

const STAGE_INFO: Record<string, StageInfo> = {
  initializing: {
    key: 'initializing',
    name: '任务初始化',
    description: '正在初始化任务...',
    color: 'bg-blue-500',
    icon: '🚀'
  },
  proxy_validating: {
    key: 'proxy_validating',
    name: '代理验证中',
    description: '正在验证代理...',
    color: 'bg-indigo-500',
    icon: '✅'
  },
  proxy_fetching: {
    key: 'proxy_fetching',
    name: '代理IP获取中',
    description: '正在获取代理IP...',
    color: 'bg-purple-500',
    icon: '🌐'
  },
  url_processing: {
    key: 'url_processing',
    name: '批量访问中',
    description: '正在批量访问URL...',
    color: 'bg-green-500',
    icon: '🌍'
  },
  completing: {
    key: 'completing',
    name: '完成',
    description: '批量访问完成',
    color: 'bg-emerald-500',
    icon: '🎉'
  }
};

/**
 * 增强的进度条组件
 */
export const EnhancedProgressBar: React.FC<EnhancedProgressBarProps> = ({
  taskId,
  totalItems = 0,
  height = 'h-3',
  showDetails = true,
  showStats = true,
  className = '',
  autoStart = false,
  progress = 0,
  successCount = 0,
  failCount = 0,
  pendingCount,
  status = 'idle',
  message = ''
}) => {
  // 直接使用传入的后端数据
  const isActive = status === 'running';
  const isCompleted = status === 'completed';
  const isFailed = status === 'error';
  const isTerminated = status === 'terminated';
  
  // 计算实际的处理中任务数
  const actualPendingCount = pendingCount ?? Math.max(0, totalItems - successCount - failCount);
  const totalProcessed = successCount + failCount;
  const successRate = totalProcessed > 0 ? (successCount / totalProcessed) * 100 : 0;
  
  // 根据消息内容推断当前阶段
  const getCurrentStage = () => {
    if (!message) return 'initializing';
    
    // 精确的阶段检测，按执行流程匹配
    if (message.includes('任务初始化...')) return 'initializing';
    if (message.includes('代理验证中...')) return 'proxy_validating';
    if (message.includes('代理IP获取中...')) return 'proxy_fetching';
    if (message.includes('批量访问中...')) return 'url_processing';
    
    // 只有在状态为completed且没有pending任务时才显示完成
    if (status === 'completed' && actualPendingCount === 0 && (message.includes('批量访问完成') || message.includes('完成！成功'))) {
      return 'completing';
    }
    
    // 根据进度推断阶段（当消息不明确时）
    if (status === 'running') {
      if (progress <= 15) return 'initializing';
      if (progress <= 25) return 'proxy_validating';
      if (progress <= 45) return 'proxy_fetching';
      return 'url_processing';
    }
    
    // 完成状态
    if (status === 'completed' && actualPendingCount === 0) return 'completing';
    if (status === 'error' || status === 'terminated') return 'completing';
    
    return 'initializing';
  };
  
  const currentStageKey = getCurrentStage();
  const currentStage = STAGE_INFO[currentStageKey];
  
  // 计算阶段进度（基于总进度）
  const stageProgress = Math.min(100, Math.max(0, progress));
  
  // 判断当前阶段是否显示百分比 - 静默模式下获取代理IP阶段不显示百分比
  const shouldShowPercentage = getCurrentStage() === 'url_processing' && totalItems > 0;
  
  // 确保进度条不会在状态切换时闪烁
  const shouldShowProgressBar = getCurrentStage() === 'url_processing' && progress > 0 && progress < 100;
  
  // 格式化进度显示
  const formatProgressDisplay = (): string => {
    const currentStage = getCurrentStage();
    
    if (currentStage === 'proxy_fetching') {
      // 代理获取阶段显示 x/y 格式
      // 从消息中提取代理数量信息，格式如 "代理IP获取中 (5/10)"
      const proxyMatch = message.match(/代理IP获取中\s*\((\d+)\/(\d+)\)/);
      if (proxyMatch) {
        const current = proxyMatch[1];
        const total = proxyMatch[2];
        return `${current}/${total}`;
      }
      // 如果无法解析，显示阶段名称
      return STAGE_INFO[currentStage].name;
    } else if (currentStage === 'url_processing') {
      // 批量访问阶段显示 x/y 格式
      const processed = successCount + failCount;
      
      // 显示实际处理的数量，即使任务已完成
      return `${processed}/${totalItems}`;
    } else {
      // 其他阶段显示阶段名称
      return STAGE_INFO[currentStage].name;
    }
  };
  
  // 剩余时间估算状态
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [estimatedSpeed, setEstimatedSpeed] = useState<number>(0);
  
  // 动画相关状态
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // 平滑进度动画
  useEffect(() => {
    // 直接使用传入的 progress 值，这是后端计算的实际进度
    // 后端进度已经考虑了所有任务状态（成功、失败、处理中）
    let targetProgress = progress;
    
    // 在批量访问阶段，如果后端进度为0但有成功/失败计数，使用计数计算
    const currentStage = getCurrentStage();
    if (currentStage === 'url_processing' && progress === 0 && totalItems > 0 && (successCount > 0 || failCount > 0)) {
      targetProgress = Math.round((successCount + failCount) / totalItems * 100);
    }
    
    if (Math.abs(displayProgress - targetProgress) > 0.5) {
      setIsAnimating(true);
      
      // 使用requestAnimationFrame实现平滑动画
      const startTime = Date.now();
      const startProgress = displayProgress;
      const duration = 500; // 500ms动画时间
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 使用缓动函数
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentProgress = startProgress + (targetProgress - startProgress) * easeOut;
        
        setDisplayProgress(currentProgress);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
        }
      };
      
      requestAnimationFrame(animate);
    }
  }, [progress, successCount, failCount, totalItems, displayProgress]);
  
  // 智能剩余时间计算
  useEffect(() => {
    if (isCompleted || isFailed || isTerminated) {
      setTimeRemaining(0);
      return;
    }
    
    if (progress <= 0 || progress >= 100) {
      setTimeRemaining(null);
      return;
    }
    
    // 计算处理速度
    const now = Date.now();
    const processed = successCount + failCount;
    
    if (processed > 0) {
      // 基于实际处理速度计算
      const speed = processed / (now - (now - 30000)); // 假设30秒内处理了processed个
      setEstimatedSpeed(speed);
      
      // 计算剩余时间
      const remainingItems = totalItems - processed;
      const remainingTime = remainingItems / speed * 1000; // 转换为毫秒
      
      setTimeRemaining(Math.min(remainingTime, 2 * 60 * 60 * 1000)); // 最大2小时
    }
  }, [progress, successCount, failCount, totalItems, isCompleted, isFailed, isTerminated]);

  // 格式化时间
  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  // 格式化剩余时间
  const formatTimeRemaining = (ms: number | null): string => {
    if (ms === null) return '计算中...';
    if (ms <= 0) return '已完成';
    return `剩余 ${formatTime(ms)}`;
  };

  // 计算进度条颜色
  const getProgressColor = (): string => {
    if (isFailed) return 'bg-red-500';
    if (isTerminated) return 'bg-yellow-500';
    if (isCompleted) return 'bg-green-500';
    return currentStage.color;
  };

  // 计算阶段进度条颜色
  const getStageProgressColor = (): string => {
    return currentStage.color;
  };

  // 如果没有进度数据且任务未开始，不显示进度条
  if (totalItems === 0 && progress === 0 && status === 'idle') {
    return null as any;
  }

  // 计算处理速度显示
  const getSpeedDisplay = (): string => {
    if (estimatedSpeed === 0) return '';
    const speedPerMinute = estimatedSpeed * 60;
    if (speedPerMinute >= 1) {
      return `${speedPerMinute.toFixed(1)}/分钟`;
    }
    return `${estimatedSpeed.toFixed(2)}/秒`;
  };

  return (
    <div className={`w-full space-y-4 ${className}`}>
      {/* 速度指示器 */}
      {estimatedSpeed > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>处理速度</span>
          <span className="text-blue-600 font-medium">{getSpeedDisplay()}</span>
        </div>
      )}
      {/* 主要进度条 */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">{currentStage.icon}</span>
            <span className="font-medium text-gray-700">
              {formatProgressDisplay()}
            </span>
            {shouldShowPercentage && (
              <span className="text-xs text-gray-500">
                ({Math.round(displayProgress)}%)
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {formatTimeRemaining(timeRemaining)}
          </div>
        </div>
        
        {/* 只在批量访问阶段显示进度条 */}
        {shouldShowProgressBar && (
          <div className={`w-full bg-gray-200 rounded-full ${height} overflow-hidden`}>
            <div
              className={`${height} ${getProgressColor()} rounded-full transition-all duration-300 ease-out ${isAnimating ? 'animate-pulse' : ''}`}
              style={{ 
                width: `${displayProgress}%`,
                boxShadow: isAnimating ? '0 0 8px rgba(59, 130, 246, 0.5)' : 'none'
              }}
            />
          </div>
        )}
        
        <p className="text-xs text-gray-600">
          {message || currentStage.description}
        </p>
      </div>

      {/* 阶段进度条 */}
      {showDetails && !isCompleted && !isFailed && shouldShowPercentage && getCurrentStage() === 'url_processing' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs text-gray-600">
            <span>阶段进度</span>
            <span>{Math.round(displayProgress)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 ${getStageProgressColor()} rounded-full transition-all duration-300 ease-out ${isAnimating ? 'animate-pulse' : ''}`}
              style={{ 
                width: `${displayProgress}%`,
                boxShadow: isAnimating ? '0 0 6px rgba(34, 197, 94, 0.4)' : 'none'
              }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {currentStage.description}
          </p>
        </div>
      )}

      {/* 详细统计信息 */}
      {showStats && totalItems > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-600 text-xs">总打开次数</div>
              <div className="font-semibold text-gray-900">
                {totalItems}
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-green-600 text-xs">成功</div>
              <div className="font-semibold text-green-900">
                {successCount}
              </div>
            </div>
            
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-red-600 text-xs">失败</div>
              <div className="font-semibold text-red-900">
                {failCount}
              </div>
            </div>
            
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="text-yellow-600 text-xs">处理中</div>
              <div className="font-semibold text-yellow-900">
                {actualPendingCount}
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-blue-600 text-xs">成功率</div>
              <div className="font-semibold text-blue-900">
                {successRate.toFixed(1)}%
              </div>
            </div>
          </div>
          
          {/* 进度说明 */}
          <div className="text-xs text-gray-500 mt-2 text-center">
            {successCount + failCount >= totalItems ? (
              <span>任务已完成</span>
            ) : (
              <span>进度包含 {successCount} 成功 + {failCount} 失败 + {actualPendingCount} 处理中</span>
            )}
          </div>
        </>
      )}

      {/* 阶段指示器 */}
      {showDetails && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          {Object.values(STAGE_INFO).map((stage, index: any) => {
            const currentStageKey = getCurrentStage();
            const isCurrentStage = stage.key === currentStageKey;
            const isCompleted = progress >= ((index + 1) * (100 / Object.keys(STAGE_INFO).length));
            
            return (
              <div
                key={stage.key}
                className={`flex items-center gap-1 ${
                  isCurrentStage ? 'text-blue-600 font-medium' : 
                  isCompleted ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                <span>{stage.icon}</span>
                <span>{stage.name}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 任务状态指示器 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>任务ID: {taskId || 'unknown'}</span>
        <span>
          状态: {
            isCompleted ? '已完成' :
            isFailed ? '失败' :
            isTerminated ? '已终止' :
            isActive ? '进行中' : '未知'
          }
        </span>
      </div>
    </div>
  );
};