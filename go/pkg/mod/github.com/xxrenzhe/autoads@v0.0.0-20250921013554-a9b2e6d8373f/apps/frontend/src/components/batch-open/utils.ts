import type { ExtendedWindow } from './types';

// 辅助函数：确保t函数返回字符串
export const getT = (t: (key: string) => string | string[], key: string): string => {
  const result = t(key);
  return Array.isArray(result) ? result[0] : result;
};

// URL验证和清理
export const validateAndCleanUrl = (url: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) return null as any;
  
  // 如果没有协议，添加https://
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }
  
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return null as any;
  }
};

// 解析URL列表
export const parseUrls = (input: string): string[] => {
  return input
    .split('\n')
    ?.filter(Boolean)?.map((line: any) => line.trim())
    .filter((line: any) => line.length > 0)
    ?.filter(Boolean)?.map(validateAndCleanUrl)
    .filter((url): url is string => url !== null);
};

// 检测Chrome扩展
export const detectExtension = (): Promise<{ installed: boolean; id: string }> => {
  return new Promise((resolve) => {
    const extendedWindow = window as ExtendedWindow;
    
    // 检查是否已经检测到扩展
    if (extendedWindow.backgroundOpenExtension?.id) {
      resolve({
        installed: true,
        id: extendedWindow.backgroundOpenExtension.id
      });
      return;
    }

    // 尝试检测扩展
    const checkExtension = () => {
      if (extendedWindow.backgroundOpenExtension?.id) {
        resolve({
          installed: true,
          id: extendedWindow.backgroundOpenExtension.id
        });
      } else {
        resolve({
          installed: false,
          id: ''
        });
      }
    };

    // 等待一小段时间让扩展注入
    setTimeout(checkExtension, 100);
  });
};

// 延迟函数
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// 计算智能延迟
export const calculateSmartDelay = (index: number, total: number, baseDelay: number): number => {
  // 前几个URL使用较短延迟，后面的逐渐增加
  const factor = Math.min(1 + (index / total) * 0.5, 2);
  return Math.round(baseDelay * factor);
};

// 生成随机用户代理
export const generateRandomUserAgent = (): string => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0'
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

// 检查是否为有效的URL
export const isValidUrl = (string: string): boolean => {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
};

// 格式化进度百分比
export const formatProgress = (current: number, total: number): string => {
  if (total === 0) return '0%';
  return `${Math.round((current / total) * 100)}%`;
};

// 估算剩余时间
export const estimateRemainingTime = (
  current: number, 
  total: number, 
  startTime: number
): string => {
  if (current === 0) return '--';
  
  const elapsed = Date.now() - startTime;
  const avgTimePerItem = elapsed / current;
  const remaining = (total - current) * avgTimePerItem;
  
  const seconds = Math.round(remaining / 1000);
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};