/**
 * Hook for managing robust progress polling
 */
import { useEffect, useRef } from 'react';
import { apiClient } from '@/lib/utils/api/robust-client';
import { createClientLogger } from '@/lib/utils/security/client-secure-logger';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('useProgressPolling');

export interface UseProgressPollingOptions {
  taskId: string;
  onProgress: (data: any) => void;
  onError?: (error: any) => void;
  onComplete?: () => void;
  enabled?: boolean;
}

export function useProgressPolling({
  taskId,
  onProgress,
  onError,
  onComplete,
  enabled = true
}: UseProgressPollingOptions) {
  const stopPollingRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    if (!enabled || !taskId) {
      return;
    }
    
    const useGo = process.env.NEXT_PUBLIC_USE_GO_BATCHOPEN === 'true';
    const progressUrl = useGo 
      ? `/go/api/v1/batchopen/tasks/${taskId}`
      : `/api/batchopen/silent-progress?taskId=${taskId}`;
    logger.info('Starting progress polling', { taskId, url: progressUrl });
    
    const pollingClient = apiClient.createProgressPoller(progressUrl, {
      retryConfig: {
        maxRetries: 3,
        baseDelay: 300,  // 减少初始延迟
        maxDelay: 8000,
        timeout: 8000
      },
      onRetry: (attempt, error, delay) => {
        logger.warn('Progress poll retry', { 
          taskId, 
          attempt, 
          error: error.message, 
          delay 
        });
      },
      onFailure: (error) => {
        logger.error('Progress polling failed', new EnhancedError('Progress polling failed', {  
          taskId, 
          error: error.message 
         }));
        // Only trigger error callback after multiple consecutive failures
        // This prevents false positives for temporary network issues
        if (onError) {
          // 对于任务初始化期间的404错误，不显示错误信息
          if (error.message.includes('404') || error.message.includes('任务不存在')) {
            // 检查是否是已完成的任务被清理了
            const taskStartTime = parseInt(taskId.split('_')[1] || '0');
            const taskAge = Date.now() - taskStartTime;
            
            // 如果任务运行时间超过5分钟，可能是已完成并被清理的任务
            if (taskAge > 5 * 60 * 1000) {
              logger.info('Task likely completed and cleaned up, marking as completed', { taskId, taskAge });
              // 触发完成回调，而不是错误回调
              if (onComplete) {
                onComplete();
              }
              return;
            }
            
            logger.warn('Task not found during initialization, ignoring error', { taskId });
            return;
          }
          onError(new Error('网络连接异常，请刷新页面重试'));
        }
      }
    });
    
    // Start polling
    pollingClient.startPolling(
      (data) => {
        logger.debug('Progress poll success', { 
          taskId, 
          status: data.status, 
          progress: data.progress,
          successCount: data.successCount,
          failCount: data.failCount,
          message: data.message 
        });
        
        // 确保进度至少为1%，避免显示0%
        const validatedData = {
          ...data,
          progress: Math.max(1, data.progress || 0)
        };
        
        onProgress(validatedData);
        
        // Check if polling should stop
        if (data.status === 'completed' || 
            data.status === 'error' || 
            data.status === 'terminated') {
          logger.info('Progress polling completed', { taskId, status: data.status });
          
          // For completed tasks, make one final call to ensure we have the latest state
          if (data.status === 'completed') {
            setTimeout(async () => {
              try {
                // Make a final API call to get the absolute latest state
                const finalResponse = await fetch(`/api/batchopen/silent-progress?taskId=${taskId}&t=${Date.now()}`);
                const finalData = await finalResponse.json();
                
                logger.info('Final state check:', { taskId, finalData });
                
                // Update UI with final data
                onProgress(finalData);
                
                // Then stop polling
                if (onComplete) {
                  onComplete();
                }
              } catch (error) {
                logger.warn('Failed to get final state, using last known state', { taskId, error: error instanceof Error ? error.message : String(error) });
                if (onComplete) {
                  onComplete();
                }
              }
            }, 200);
          } else {
            // For error or terminated, stop immediately
            if (onComplete) {
              onComplete();
            }
          }
        }
      },
      (error) => {
        logger.error('Progress poll error callback', new EnhancedError('Progress poll error callback', {  
          taskId, 
          error: error.message,
          stack: error.stack 
         }));
        
        // 检查是否是任务被清理的404错误
        if (error.message.includes('404') || error.message.includes('任务不存在')) {
          const taskStartTime = parseInt(taskId.split('_')[1] || '0');
          const taskAge = Date.now() - taskStartTime;
          
          // 如果任务运行时间超过5分钟，可能是已完成并被清理的任务
          if (taskAge > 5 * 60 * 1000) {
            logger.info('Task likely completed and cleaned up from error callback, marking as completed', { taskId, taskAge });
            // 触发完成回调，而不是错误回调
            if (onComplete) {
              onComplete();
            }
            return;
          }
        }
        
        if (onError) {
          onError(error);
        }
      },
      () => {
        // Polling completed
        logger.info('Progress polling cleanup completed', { taskId });
        if (onComplete) {
          onComplete();
        }
      },
      (error) => {
        // Polling failed after multiple retries
        logger.error('Progress polling failed', new EnhancedError('Progress polling failed', {  
          taskId, 
          error: error.message 
         }));
        // Only trigger error callback after multiple consecutive failures
        // This prevents false positives for temporary network issues
        if (onError) {
          // 对于任务初始化期间的404错误，不显示错误信息
          if (error.message.includes('404') || error.message.includes('任务不存在')) {
            // 检查是否是已完成的任务被清理了
            const taskStartTime = parseInt(taskId.split('_')[1] || '0');
            const taskAge = Date.now() - taskStartTime;
            
            // 如果任务运行时间超过5分钟，可能是已完成并被清理的任务
            if (taskAge > 5 * 60 * 1000) {
              logger.info('Task likely completed and cleaned up from final error handler, marking as completed', { taskId, taskAge });
              // 触发完成回调，而不是错误回调
              if (onComplete) {
                onComplete();
              }
              return;
            }
            
            logger.warn('Task not found during initialization, ignoring error', { taskId });
            return;
          }
          onError(new Error('网络连接异常，请刷新页面重试'));
        }
      }
    ).then(stopPolling => {
      stopPollingRef.current = stopPolling;
      logger.info('Progress polling started successfully', { taskId });
    }).catch(error => {
      logger.error('Failed to start progress polling', new EnhancedError('Failed to start progress polling', {  taskId, error: error.message  }));
    });
    
    // Cleanup
    return () => {
      if (stopPollingRef.current) {
        logger.info('Cleaning up progress polling', { taskId });
        stopPollingRef.current();
        stopPollingRef.current = null;
      }
    };
  }, [taskId, enabled, onProgress, onError, onComplete]);
  
  return {
    stop: () => {
      if (stopPollingRef.current) {
        stopPollingRef.current();
        stopPollingRef.current = null;
      }
    }
  };
}
