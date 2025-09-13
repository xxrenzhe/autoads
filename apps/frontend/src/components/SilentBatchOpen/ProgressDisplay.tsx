/**
 * 进度显示组件
 * 显示任务进度、连接状态和实时更新
 */

import React from 'react';
import { EnhancedProgressBar } from '@/components/ui/EnhancedProgressBar';
import { createClientLogger } from '@/lib/utils/security/client-secure-logger';

const logger = createClientLogger('ProgressDisplay');

interface ProgressDisplayProps {
  showProgress: boolean;
  taskId: string | null;
  progress: number;
  successCount: number;
  failCount: number;
  pendingCount?: number;
  totalVisits: number;
  status: string;
  realtimeProgress: {
    connected: boolean;
    connectionType: 'websocket' | 'polling' | 'none';
    lastUpdate: number;
    errorCount: number;
  };
  // 新增代理相关属性
  proxyStats?: {
    currentProxyCount?: number;
    targetCount?: number;
    acquisitionProgress?: number;
    source?: 'cache' | 'batch' | 'individual';
    strategy?: 'optimized' | 'fifo' | 'round-robin';
    hasShortage?: boolean;
    usingFallback?: boolean;
    currentCount?: number;
  };
  proxyPhase?: string;
  requiredProxyCount?: number;
}

// 辅助函数：将状态消息转换为标准化的状态
const getEnhancedStatus = (message: string): 'idle' | 'running' | 'completed' | 'error' | 'terminated' => {
  if (!message) return 'idle';
  
  if (message.includes('完成') || message.includes('成功')) return 'completed';
  if (message.includes('失败') || message.includes('错误')) return 'error';
  if (message.includes('终止') || message.includes('取消')) return 'terminated';
  if (message.includes('正在') || message.includes('处理') || message.includes('初始化') || message.includes('获取')) return 'running';
  
  return 'idle';
};

export const ProgressDisplay: React.FC<ProgressDisplayProps> = ({
  showProgress,
  taskId,
  progress,
  successCount,
  failCount,
  pendingCount,
  totalVisits,
  status,
  realtimeProgress,
  proxyStats,
  proxyPhase,
  requiredProxyCount
}) => {
  if (!showProgress) => {
    return null as any;
  }

  // 格式化最后更新时间
  const formatLastUpdate = (timestamp: number) => {
    if (timestamp === 0) return '';
    return new Date(timestamp).toLocaleTimeString();
  };

  // 获取连接状态文本
  const getConnectionStatusText = () => {
    if (realtimeProgress.connectionType === 'websocket') => {
      return realtimeProgress.connected ? 'WebSocket实时连接' : 'WebSocket连接中...';
    }
    if (realtimeProgress.connectionType === 'polling') => {
      return '轮询模式（备用）';
    }
    return '';
  };

  // 获取连接状态指示器颜色
  const getConnectionIndicatorColor = () => {
    if (realtimeProgress.connected) => {
      return 'bg-green-500';
    }
    if (realtimeProgress.connectionType === 'websocket') => {
      return 'bg-yellow-500';
    }
    if (realtimeProgress.connectionType === 'polling') => {
      return 'bg-blue-500';
    }
    return 'bg-gray-500';
  };

  // 获取代理阶段显示文本
  const getProxyPhaseText = (phase: string) => {
    return phase;
  };

  // 获取代理策略显示文本
  const getProxyStrategyText = (strategy?: string) => {
    const strategyMap: Record<string, string> = {
      'optimized': '智能优化',
      'fifo': '先进先出',
      'round-robin': '轮询分配'
    };
    return strategy ? strategyMap[strategy] || strategy : '';
  };

  // 获取代理来源显示文本
  const getProxySourceText = (source?: string) => {
    const sourceMap: Record<string, string> = {
      'cache': '缓存',
      'batch': '批量获取',
      'individual': '个别获取'
    };
    return source ? sourceMap[source] || source : '';
  };

  // 判断是否显示代理信息
  const shouldShowProxyInfo = () => {
    return proxyPhase && ['proxy-validation', 'proxy-acquisition', 'proxy-distribution', 'proxy-caching'].includes(proxyPhase);
  };

  logger.debug('ProgressDisplay渲染:', {
    showProgress,
    progress,
    status,
    connectionType: realtimeProgress.connectionType,
    connected: realtimeProgress.connected
  });

  return (
    <div className="mt-2 mb-2 px-2">
      {/* 连接状态指示器 */}
      {realtimeProgress.connectionType !== 'none' && (
        <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getConnectionIndicatorColor()}`} />
            <span>{getConnectionStatusText()}</span>
            {realtimeProgress.errorCount > 0 && (
              <span className="text-yellow-600">
                连接错误: {realtimeProgress.errorCount}
              </span>
            )}
          </div>
          <div className="text-xs">
            {realtimeProgress.lastUpdate > 0 && (
              <span>最后更新: {formatLastUpdate(realtimeProgress.lastUpdate)}</span>
            )}
          </div>
        </div>
      )}
      
      {/* 代理操作信息显示 */}
      {shouldShowProxyInfo() && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full animate-pulse bg-blue-500"
              />
              <span className="text-sm font-medium text-blue-700">
                {getProxyPhaseText(proxyPhase!)}
              </span>
            </div>
            {proxyStats?.strategy && (
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                {getProxyStrategyText(proxyStats.strategy)}
              </span>
            )}
          </div>
          
          {/* 代理获取进度 */}
          {proxyStats?.acquisitionProgress !== undefined && (
            <div className="mb-2">
              <div className="flex justify-between text-xs text-blue-700 mb-1">
                <span>代理获取进度</span>
                <span>{proxyStats.currentCount || 0}/{proxyStats.targetCount || requiredProxyCount || 0}</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(proxyStats.acquisitionProgress, 100)}%` }}
                />
              </div>
            </div>
          )}
          
          {/* 代理统计信息 */}
          <div className="flex flex-wrap gap-3 text-xs text-blue-700">
            {proxyStats?.currentProxyCount !== undefined && (
              <span>当前: {proxyStats.currentProxyCount}个</span>
            )}
            {requiredProxyCount && (
              <span>需要: {requiredProxyCount}个</span>
            )}
            {proxyStats?.source && (
              <span>来源: {getProxySourceText(proxyStats.source)}</span>
            )}
          </div>
          
          {/* 警告信息 */}
          {(proxyStats?.hasShortage || proxyStats?.usingFallback) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {proxyStats.hasShortage && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  ⚠️ 代理不足
                </span>
              )}
              {proxyStats.usingFallback && (
                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                  🔄 使用备用方案
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 增强进度条 */}
      <EnhancedProgressBar 
        taskId={taskId || undefined}
        progress={progress}
        successCount={successCount}
        failCount={failCount}
        pendingCount={pendingCount}
        totalItems={totalVisits}
        message={status}
        status={getEnhancedStatus(status)}
        className="w-full"
      />
    </div>
  );
};