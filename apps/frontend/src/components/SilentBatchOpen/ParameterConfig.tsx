/**
 * 参数配置组件
 * 处理循环次数、打开间隔、随机化等参数配置
 */

import React, { useCallback, useState } from 'react';
import { createClientLogger } from '@/lib/utils/security/client-secure-logger';

const logger = createClientLogger('ParameterConfig');

interface ParameterConfigProps {
  cycleCountInput: string;
  cycleCount: number;
  isOpening: boolean;
  accessMode: "http" | "puppeteer";
  proxyUrl: string;
  refererOption: string;
  customReferer: string;
  paramErrors: {
    cycleCount?: string;
  };
  onCycleCountInputChange: (value: string) => void;
  onCycleCountChange: (value: number) => void;
  onAccessModeChange: (value: "http" | "puppeteer") => void;
  getTranslation: (t: (key: string) => string | string[], key: string) => string;
  t: (key: string) => string | string[];
}

export const ParameterConfig: React.FC<ParameterConfigProps> = ({
  cycleCountInput,
  cycleCount,
  isOpening,
  accessMode,
  proxyUrl,
  refererOption,
  customReferer,
  paramErrors,
  onCycleCountInputChange,
  onCycleCountChange,
  onAccessModeChange,
    getTranslation,
  t
}) => {
  // 处理循环次数输入变化
  const handleCycleCountInputChange = useCallback((value: string) => {
    // 只允许输入数字
    if (value === '' || /^\d+$/.test(value)) {
      onCycleCountInputChange(value);
      
      // 如果输入不为空，更新实际值
      if (value.trim() !== '') {
        const val = parseInt(value) || 5;
        onCycleCountChange(Math.min(1000, Math.max(1, val)));
      }
    }
  }, [onCycleCountInputChange, onCycleCountChange]);

  // 处理循环次数失去焦点
  const handleCycleCountBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value.trim() === '') {
      onCycleCountInputChange('5');
      onCycleCountChange(5);
    } else {
      // 确保值在有效范围内
      const val = parseInt(e.target.value) || 5;
      const clampedVal = Math.min(1000, Math.max(1, val));
      onCycleCountInputChange(clampedVal.toString());
      onCycleCountChange(clampedVal);
    }
  }, [onCycleCountInputChange, onCycleCountChange]);


  return (
    <div className="mb-6">
      {/* 访问模式选择 */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          访问模式
        </label>
        <div className="flex items-center space-x-6">
          <label className="flex items-center">
            <input
              type="radio"
              name="accessMode"
              value="http"
              checked={accessMode === "http"}
              onChange={(e) => onAccessModeChange(e.target.value as "http" | "puppeteer")}
              disabled={isOpening}
              className="mr-2"
            />
            <span className="text-sm">简单HTTP访问</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="accessMode"
              value="puppeteer"
              checked={accessMode === "puppeteer"}
              onChange={(e) => onAccessModeChange(e.target.value as "http" | "puppeteer")}
              disabled={isOpening}
              className="mr-2"
            />
            <span className="text-sm">高级浏览器访问</span>
          </label>
        </div>
      </div>

      <div className="mb-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            {getTranslation(t, "batchopen.advancedVersion.cycleCount")}
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-full border rounded px-2 py-1"
            placeholder="1-1000"
            value={cycleCountInput}
            onChange={(e) => handleCycleCountInputChange(e.target.value)}
            onBlur={handleCycleCountBlur}
            disabled={isOpening}
          />
          {paramErrors.cycleCount && (
            <p className="text-red-500 text-sm mt-1">{paramErrors.cycleCount}</p>
          )}
        </div>
      </div>
    </div>
  );
};