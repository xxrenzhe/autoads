/**
 * Enhanced Progress Hook
 * 增强的进度钩子 - 提供更好的前端进度管理
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { enhancedProgressManager, ProgressData, TaskState, ProgressObserver } from '@/lib/utils/enhanced-progress-manager';
import { createClientLogger } from '@/lib/utils/security/client-secure-logger';

const logger = createClientLogger('useEnhancedProgress');

interface UseEnhancedProgressOptions {
  taskId?: string;
  totalItems?: number;
  autoStart?: boolean;
  enableSimulation?: boolean;
  onStateChange?: (state: TaskState) => void;
  onProgressUpdate?: (data: ProgressData) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
  onTerminate?: () => void;
}

interface EnhancedProgressReturn {
  // 进度数据
  progressData: ProgressData | null;
  
  // 状态
  isActive: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isTerminated: boolean;
  
  // 控制方法
  startTask: (taskId: string, totalItems: number) => void;
  updateProgress: (progress: number, stageProgress?: number, message?: string) => void;
  updateItemProgress: (processed: number, success?: number, failed?: number) => void;
  setError: (error: string) => void;
  completeTask: (message?: string) => void;
  terminateTask: (message?: string) => void;
  reset: () => void;
  
  // 获取详细信息
  getProgressPercentage: () => number;
  getStageProgress: () => number;
  getTimeRemaining: () => number | null;
  getSuccessRate: () => number;
}

/**
 * 增强的进度钩子
 */
export function useEnhancedProgress(
  options: UseEnhancedProgressOptions = {}
): EnhancedProgressReturn {
  const {
    taskId: initialTaskId,
    totalItems: initialTotalItems,
    autoStart = false,
    enableSimulation = true,
    onStateChange,
    onProgressUpdate,
    onError,
    onComplete,
    onTerminate
  } = options;
  
  // 状态管理
  const [taskId, setTaskId] = useState<string | null>(initialTaskId || null);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [isActive, setIsActive] = useState(false);
  const observerRef = useRef<ProgressObserver | null>(null);
  
  /**
   * 创建观察者
   */
  const createObserver = useCallback((): ProgressObserver => ({
    onProgressUpdate: (data: ProgressData) => {
      setProgressData(data);
      onProgressUpdate?.(data);
      
      // 更新活动状态
      setIsActive(data.state !== 'completed' && data.state !== 'failed' && data.state !== 'terminated');
    },
    
    onStateChange: (state: TaskState) => {
      if (progressData) {
        setProgressData({ ...progressData, state });
      }
      onStateChange?.(state);
      
      // 更新活动状态
      setIsActive(state !== 'completed' && state !== 'failed' && state !== 'terminated');
      
      // 启动进度模拟
      if (enableSimulation && taskId && 
          (state === 'proxy_fetching' || state === 'proxy_validating' || state === 'batch_preparing')) {
        enhancedProgressManager.startProgressSimulation(taskId, state);
      }
    },
    
    onError: (error: string) => {
      if (progressData) {
        setProgressData({ 
          ...progressData, 
          state: 'failed', 
          error,
          message: `任务失败: ${error}`
        });
      }
      onError?.(error);
      setIsActive(false);
    },
    
    onComplete: () => {
      if (progressData) {
        setProgressData({ 
          ...progressData, 
          state: 'completed', 
          progress: 100,
          stageProgress: 100
        });
      }
      onComplete?.();
      setIsActive(false);
    },
    
    onTerminate: () => {
      if (progressData) {
        setProgressData({ 
          ...progressData, 
          state: 'terminated'
        });
      }
      onTerminate?.();
      setIsActive(false);
    }
  }), [progressData, onProgressUpdate, onStateChange, onError, onComplete, onTerminate, enableSimulation, taskId]);
  
  /**
   * 启动任务
   */
  const startTask = useCallback((newTaskId: string, totalItems: number) => {
    // 清理现有任务
    if (taskId && observerRef.current) {
      enhancedProgressManager.removeObserver(taskId, observerRef.current);
    }
    
    // 创建新任务
    const taskData = enhancedProgressManager.createTask(newTaskId, totalItems);
    setTaskId(newTaskId);
    setProgressData(taskData);
    setIsActive(true);
    
    // 创建并注册观察者
    observerRef.current = createObserver();
    enhancedProgressManager.addObserver(newTaskId, observerRef.current);
    
    // 自动开始初始化
    enhancedProgressManager.updateTaskState(newTaskId, 'initializing', '正在初始化任务...');
    
    logger.info('启动进度任务', { taskId: newTaskId, totalItems });
  }, [taskId, createObserver]);
  
  /**
   * 更新进度
   */
  const updateProgress = useCallback((
    progress: number, 
    stageProgress?: number, 
    message?: string
  ) => {
    if (!taskId) return;
    
    enhancedProgressManager.updateProgress(taskId, progress, stageProgress, message);
  }, [taskId]);
  
  /**
   * 更新项目进度
   */
  const updateItemProgress = useCallback((
    processed: number, 
    success?: number, 
    failed?: number
  ) => {
    if (!taskId) return;
    
    enhancedProgressManager.updateItemProgress(taskId, processed, success, failed);
  }, [taskId]);
  
  /**
   * 设置错误
   */
  const setError = useCallback((error: string) => {
    if (!taskId) return;
    
    enhancedProgressManager.setError(taskId, error);
  }, [taskId]);
  
  /**
   * 完成任务
   */
  const completeTask = useCallback((message?: string) => {
    if (!taskId) return;
    
    enhancedProgressManager.completeTask(taskId, message);
  }, [taskId]);
  
  /**
   * 终止任务
   */
  const terminateTask = useCallback((message?: string) => {
    if (!taskId) return;
    
    enhancedProgressManager.terminateTask(taskId, message);
  }, [taskId]);
  
  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    if (taskId && observerRef.current) {
      enhancedProgressManager.removeObserver(taskId, observerRef.current);
    }
    
    setTaskId(null);
    setProgressData(null);
    setIsActive(false);
    observerRef.current = null;
  }, [taskId]);
  
  /**
   * 获取进度百分比
   */
  const getProgressPercentage = useCallback((): number => {
    return progressData?.progress || 0;
  }, [progressData]);
  
  /**
   * 获取阶段进度
   */
  const getStageProgress = useCallback((): number => {
    return progressData?.stageProgress || 0;
  }, [progressData]);
  
  /**
   * 获取剩余时间
   */
  const getTimeRemaining = useCallback((): number | null => {
    if (!progressData || !progressData.estimatedEndTime) {
      return null as any;
    }
    
    return Math.max(0, progressData.estimatedEndTime - Date.now());
  }, [progressData]);
  
  /**
   * 获取成功率
   */
  const getSuccessRate = useCallback((): number => {
    if (!progressData || progressData.totalItems === 0) {
      return 0;
    }
    
    return (progressData.successCount / progressData.totalItems) * 100;
  }, [progressData]);
  
  // 自动启动逻辑
  useEffect(() => {
    if (autoStart && initialTaskId && initialTotalItems) {
      startTask(initialTaskId, initialTotalItems);
    }
  }, [autoStart, initialTaskId, initialTotalItems, startTask]);
  
  // 清理逻辑
  useEffect(() => {
    return () => {
      if (taskId && observerRef.current) {
        enhancedProgressManager.removeObserver(taskId, observerRef.current);
      }
    };
  }, [taskId]);
  
  return {
    progressData,
    isActive,
    isCompleted: progressData?.state === 'completed',
    isFailed: progressData?.state === 'failed',
    isTerminated: progressData?.state === 'terminated',
    startTask,
    updateProgress,
    updateItemProgress,
    setError,
    completeTask,
    terminateTask,
    reset,
    getProgressPercentage,
    getStageProgress,
    getTimeRemaining,
    getSuccessRate
  };
}