/**
 * URL输入组件
 * 处理URL输入、解析和显示
 */

import React, { useCallback, useMemo, useState } from 'react';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';
import { createClientLogger } from '@/lib/utils/security/client-secure-logger';

const logger = createClientLogger('UrlInput');

interface UrlInputProps {
  input: string;
  onInputChange: (value: string) => void;
  urls: string[];
  isOpening: boolean;
  getTranslation: (t: (key: string) => string | string[], key: string) => string;
  t: (key: string) => string | string[];
}

// 防抖函数
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export const UrlInput: React.FC<UrlInputProps> = ({
  input,
  onInputChange,
  urls,
  isOpening,
  getTranslation,
  t
}) => {
  // 解析输入的URL
  const parseUrls = useCallback((text: string) => {
    const lines = text.split('\n').filter((line: any) => {
      const trimmed = line.trim();
      return trimmed && (trimmed.startsWith('http://') || trimmed.startsWith('https://'));
    });
    return lines;
  }, []);

  // 稳定parseUrls函数以避免依赖变化
  const stableParseUrls = useCallback(parseUrls, []);

  // 防抖的URL解析
  const debouncedParseUrls = useMemo(
    () => debounce((text: string) => {
      const parsedUrls = stableParseUrls(text);
      logger.debug('解析URLs:', { inputLength: text.length, parsedCount: parsedUrls.length });
    }, 300),
    [stableParseUrls]
  );

  // 输入变化处理
  const handleInputChange = useCallback((value: string) => {
    onInputChange(value);
    debouncedParseUrls(value);
  }, [onInputChange, debouncedParseUrls]);

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium mb-2">
        {getTranslation(t, "batchopen.input.title")}
      </label>
      <textarea
        value={input}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder={getTranslation(t, "batchopen.input.placeholder")}
        className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
        disabled={isOpening}
      />
      <div className="mt-1 text-xs text-gray-500">
        {getTranslation(t, "batchopen.input.urlCount")?.replace("{count}", String(urls.length)) || `已解析 ${urls.length} 个有效URL`}
      </div>
    </div>
  );
};