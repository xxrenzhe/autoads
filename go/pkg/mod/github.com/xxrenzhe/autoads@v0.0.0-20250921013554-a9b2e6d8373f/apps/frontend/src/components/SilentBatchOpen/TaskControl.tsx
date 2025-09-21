/**
 * 任务控制组件
 * 处理任务启动、终止、清空等操作
 */

import React, { useCallback } from 'react';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';
import { createClientLogger } from '@/lib/utils/security/client-secure-logger';
import { ProtectedButton } from '@/components/auth/ProtectedButton';

const logger = createClientLogger('TaskControl');

interface TaskControlProps {
  urls: string[];
  paramErrors: Record<string, string>;
  isOpening: boolean;
  isTaskRunning: boolean;
  isPolling: boolean;
  isValidatingProxy: boolean;
  isFetchingProxies: boolean;
  proxyValidationSuccess: boolean;
  error: string;
  onStartTask: () => void;
  onTerminateTask: () => void;
  getTranslation: (t: (key: string) => string | string[], key: string) => string;
  t: (key: string) => string | string[];
}

export const TaskControl: React.FC<TaskControlProps> = ({
  urls,
  paramErrors,
  isOpening,
  isTaskRunning,
  isPolling,
  isValidatingProxy,
  isFetchingProxies,
  proxyValidationSuccess,
  error,
  onStartTask,
  onTerminateTask,
  getTranslation,
  t
}) => {
  // 计算启动按钮是否禁用
  const isStartDisabled = useCallback(() => {
    return (
      urls.length === 0 || 
      Object.keys(paramErrors).length > 0 || 
      isOpening || 
      isTaskRunning || 
      isPolling ||
      isValidatingProxy ||
      isFetchingProxies ||
      !proxyValidationSuccess
    );
  }, [urls, paramErrors, isOpening, isTaskRunning, isPolling, isValidatingProxy, isFetchingProxies, proxyValidationSuccess]);

  // 计算终止按钮是否禁用
  const isTerminateDisabled = useCallback(() => {
    return !isTaskRunning && !isPolling;
  }, [isTaskRunning, isPolling]);

  // 处理启动任务
  const handleStartTask = useCallback(() => {
    logger.info('启动任务按钮被点击', {
      urlsCount: urls.length,
      hasErrors: Object.keys(paramErrors).length > 0,
      proxyValidated: proxyValidationSuccess
    });
    onStartTask();
  }, [onStartTask, urls, paramErrors, proxyValidationSuccess]);

  // 处理终止任务
  const handleTerminateTask = useCallback(() => {
    logger.info('终止任务按钮被点击', {
      isTaskRunning,
      isPolling
    });
    onTerminateTask();
  }, [onTerminateTask, isTaskRunning, isPolling]);

  
  return (
    <>
      {/* 操作按钮 */}
      <div className="flex gap-4 mb-6">
        <ProtectedButton
          featureName="batchopen"
          onClick={handleStartTask}
          className={`${UI_CONSTANTS.buttons.primary} flex-1 disabled:opacity-50 disabled:cursor-not-allowed`}
          disabled={isStartDisabled()}
        >
          {getTranslation(t, "batchopen.btn.open")}
        </ProtectedButton>
        <button
          onClick={handleTerminateTask}
          className={`${UI_CONSTANTS.buttons.secondary} flex-1 disabled:opacity-50 disabled:cursor-not-allowed`}
          disabled={isTerminateDisabled()}
        >
          {getTranslation(t, "batchopen.btn.terminate")}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      </>
  );
};