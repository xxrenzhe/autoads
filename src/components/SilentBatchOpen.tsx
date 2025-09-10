"use client";

import { EnhancedError } from '@/lib/utils/error-handling';
import { useLanguage  } from "@/contexts/LanguageContext";
import React from "react";
import { useCallback, useEffect, useRef, useState, useMemo, useReducer } from "react";
import { useTokenConsumption } from "@/hooks/useTokenConsumption";
// Simple debounce implementation
const debounce = <T extends (...args: any[]) => void>(func: T, wait: number): T => {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
};
import { UI_CONSTANTS } from "@/components/ui/ui-constants";
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { getT } from "@/lib/utils/translation-helpers";

import { ErrorBoundary, useErrorHandler } from "@/components/ui/ErrorBoundary";
import { retryService } from "@/lib/services/retry-service";
import { UrlInput } from "@/components/SilentBatchOpen/UrlInput";
import { ParameterConfig } from "@/components/SilentBatchOpen/ParameterConfig";
import { ProxyConfig } from "@/components/SilentBatchOpen/ProxyConfig";
import { TaskControl } from "@/components/SilentBatchOpen/TaskControl";
import { ProgressDisplay } from "@/components/SilentBatchOpen/ProgressDisplay";
import { CompactProgressBar } from "@/components/SilentBatchOpen/CompactProgressBar";
import { FeatureDescription } from "@/components/SilentBatchOpen/FeatureDescription";

const logger = createClientLogger('SilentBatchOpen');

// 默认翻译值
const DEFAULT_TRANSLATIONS: Record<string, string> = {
  "batchopen.basicVersion.title": "初级版本",
  "batchopen.advancedVersion.title": "高级版本",
  "batchopen.silentVersion.title": "静默版本",
  "batchopen.title": "批量打开URL",
  "batchopen.desc": "后台批量访问URL，动态代理IP，自定义Referer",
  "batchopen.advancedVersion.cycleCount": "每个URL访问次数",
      "batchopen.input.title": "输入URL",
  "batchopen.input.description": "请输入要打开的URL，每行一个",
  "batchopen.input.placeholder": "请输入要批量打开的URL，每行一个...",
  "batchopen.input.urlCount": "已解析 {count} 个有效URL",
  "batchopen.btn.opening": "正在打开...",
  "batchopen.btn.open": "批量打开",
  "batchopen.btn.terminate": "终止",
  "batchopen.status.popup_blocked_tip": "弹窗被阻止！请允许弹窗后重试",
  "batchopen.status.opening": "正在打开...",
  "batchopen.status.popup_blocked": "弹窗被阻止",
  "batchopen.status.success": "成功打开{count}个URL",
  "batchopen.status.terminated": "正在终止批量打开...",
  "batchopen.error.no_urls": "请输入至少一个URL",
  "batchopen.error.invalid_cycle_count": "每个URL打开次数必须在1-1000之间",
  "batchopen.error.invalid_open_count": "打开次数必须在1-1000之间",
    "batchOpenSection.silentVersion.title": "静默版本说明",
  "batchOpenSection.silentVersion.tip": "无需安装任何插件，通过后端Chromium浏览器实现真实的浏览器访问，支持代理IP、自定义Referer等功能",
  "batchOpenSection.featureDescription.featuresTitle": "功能说明",
  "batchOpenSection.featureDescription.technicalTitle": "技术特点",
  "batchOpenSection.featureDescription.notesTitle": "注意事项",
  "batchopen.pluginDetection.title": "插件检测",
  "batchopen.pluginDetection.detected": "已检测到 Background Open 插件",
  "batchopen.pluginDetection.notDetected": "未检测到 Background Open 插件",
  "batchopen.pluginDetection.tip": "使用高级版本需要安装插件",
  "batchopen.pluginDetection.installLink": "点击安装",
  "batchopen.pluginDetection.installing": "安装中...",
  "batchopen.pluginDetection.installed": "已安装"
};

// 辅助函数：获取翻译文本
const getTranslation = (t: (key: string) => string | string[], key: string): string => {
  return getT(t, key, DEFAULT_TRANSLATIONS[key]);
};

// 辅助函数：将状态消息转换为标准化的状态
const getEnhancedStatus = (message: string): 'idle' | 'running' | 'completed' | 'error' | 'terminated' => {
  if (!message) return 'idle';
  
  if (message.includes('完成') || message.includes('成功')) return 'completed';
  if (message.includes('失败') || message.includes('错误')) return 'error';
  if (message.includes('终止') || message.includes('取消')) return 'terminated';
  if (message.includes('正在') || message.includes('处理') || message.includes('初始化') || message.includes('获取')) return 'running';
  
  return 'idle';
};

// 状态管理接口
interface SilentBatchOpenState {
  // URL相关
  input: string;
  urls: string[];
  
  // 进度相关
  progress: number;
  successCount: number;
  failCount: number;
  pendingCount: number;
  status: string;
  error: string;
  
  // 任务状态
  isOpening: boolean;
  isTaskRunning: boolean;
  isPolling: boolean;
  showProgress: boolean;
  hasTaskRun: boolean;
  
  // 参数配置
  cycleCount: number;
  cycleCountInput: string;
  accessMode: "http" | "puppeteer"; // 访问模式（HTTP或Puppeteer）
  
  // 代理配置
  proxyUrl: string;
  refererOption: "social" | "custom";
  selectedSocialMedia: string;
  customReferer: string;
  
  // 任务相关
  taskId: string | null;
  isValidatingProxy: boolean;
  proxyValidationSuccess: boolean;
  lastValidatedProxyUrl: string | null;
  isFetchingProxies: boolean;
  requiredProxyCount: number;
  totalVisits: number;
  taskStartTime: number | null;
  taskEndTime: number | null;
  
  // 验证配置
  validationConfig: {
    enabled: boolean;
    testUrls: string[];
    timeout: number;
    maxConcurrentValidations: number;
    retryAttempts: number;
    healthCheckInterval: number;
  } | null;
  
  // 错误状态
  paramErrors: {
    cycleCount?: string;
        proxyUrl?: string;
    customReferer?: string;
  };
  
  // 代理操作状态
  proxyPhase?: string;
  proxyStats?: {
    currentProxyCount?: number;
    targetCount?: number;
    acquisitionProgress?: number;
    source?: 'cache' | 'batch' | 'individual';
    strategy?: 'optimized' | 'fifo' | 'round-robin';
    hasShortage?: boolean;
    usingFallback?: boolean;
  };
  // validationConfig is already defined above
  phaseStatus?: 'running' | 'completed' | 'failed';
  completedPhases?: string[];
  phaseProgress?: Record<string, any>;
}

// 状态操作类型
type SilentBatchOpenAction = 
  | { type: 'SET_INPUT'; payload: string }
  | { type: 'SET_URLS'; payload: string[] }
  | { type: 'SET_PROGRESS'; payload: number }
  | { type: 'SET_SUCCESS_COUNT'; payload: number }
  | { type: 'SET_FAIL_COUNT'; payload: number }
  | { type: 'SET_PENDING_COUNT'; payload: number }
  | { type: 'SET_STATUS'; payload: string }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_IS_OPENING'; payload: boolean }
  | { type: 'SET_IS_TASK_RUNNING'; payload: boolean }
  | { type: 'SET_IS_POLLING'; payload: boolean }
  | { type: 'SET_SHOW_PROGRESS'; payload: boolean }
  | { type: 'SET_HAS_TASK_RUN'; payload: boolean }
  | { type: 'SET_CYCLE_COUNT'; payload: number }
  | { type: 'SET_CYCLE_COUNT_INPUT'; payload: string }
  | { type: 'SET_ACCESS_MODE'; payload: "http" | "puppeteer" }
  | { type: 'SET_PROXY_URL'; payload: string }
    | { type: 'SET_REFERER_OPTION'; payload: "social" | "custom" }
  | { type: 'SET_SELECTED_SOCIAL_MEDIA'; payload: string }
  | { type: 'SET_CUSTOM_REFERER'; payload: string }
  | { type: 'SET_TASK_ID'; payload: string | null }
  | { type: 'SET_IS_VALIDATING_PROXY'; payload: boolean }
  | { type: 'SET_PROXY_VALIDATION_SUCCESS'; payload: boolean }
  | { type: 'SET_LAST_VALIDATED_PROXY_URL'; payload: string | null }
  | { type: 'SET_IS_FETCHING_PROXIES'; payload: boolean }
  | { type: 'SET_REQUIRED_PROXY_COUNT'; payload: number }
  | { type: 'SET_TOTAL_VISITS'; payload: number }
  | { type: 'SET_TASK_START_TIME'; payload: number | null }
  | { type: 'SET_TASK_END_TIME'; payload: number | null }
  | { type: 'SET_PARAM_ERRORS'; payload: SilentBatchOpenState['paramErrors'] }
  | { type: 'SET_PROXY_PHASE'; payload: string }
  | { type: 'SET_PROXY_STATS'; payload: SilentBatchOpenState['proxyStats'] }
  | { type: 'SET_VALIDATION_CONFIG'; payload: SilentBatchOpenState['validationConfig'] }
  | { type: 'SET_PHASE_STATUS'; payload: 'running' | 'completed' | 'failed' }
  | { type: 'SET_COMPLETED_PHASES'; payload: string[] }
  | { type: 'SET_PHASE_PROGRESS'; payload: Record<string, any> }
  | { type: 'RESET_PROGRESS' }
  | { type: 'RESET_FOR_NEW_TASK' }
  | { type: 'UPDATE_FROM_PROGRESS_DATA'; payload: any }
  | { type: 'NOOP' };

// 初始状态
const initialState: SilentBatchOpenState = {
  input: "",
  urls: [],
  progress: 0,
  successCount: 0,
  failCount: 0,
  pendingCount: 0,
  status: "",
  error: "",
  isOpening: false,
  isTaskRunning: false,
  isPolling: false,
  showProgress: false,
  hasTaskRun: false,
  cycleCount: 5,
  cycleCountInput: '5',
  accessMode: "http", // 默认使用 HTTP 访问模式
  proxyUrl: "",
    refererOption: "social",
  selectedSocialMedia: "https://www.facebook.com/",
  customReferer: "",
  taskId: null,
  isValidatingProxy: false,
  proxyValidationSuccess: false,
  lastValidatedProxyUrl: null,
  isFetchingProxies: false,
  requiredProxyCount: 0,
  totalVisits: 0,
  taskStartTime: null,
    taskEndTime: null,
  paramErrors: {},
  proxyPhase: undefined,
  proxyStats: undefined,
  validationConfig: null,
  phaseStatus: undefined,
  completedPhases: undefined,
  phaseProgress: undefined
};

// 状态reducer
function stateReducer(state: SilentBatchOpenState, action: SilentBatchOpenAction): SilentBatchOpenState {
  switch (action.type) {
    case 'SET_INPUT':
      return { ...state, input: action.payload };
    case 'SET_URLS':
      return { ...state, urls: action.payload };
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload };
    case 'SET_SUCCESS_COUNT':
      return { ...state, successCount: action.payload };
    case 'SET_FAIL_COUNT':
      return { ...state, failCount: action.payload };
    case 'SET_PENDING_COUNT':
      return { ...state, pendingCount: action.payload };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_IS_OPENING':
      return { ...state, isOpening: action.payload };
    case 'SET_IS_TASK_RUNNING':
      return { ...state, isTaskRunning: action.payload };
    case 'SET_IS_POLLING':
      return { ...state, isPolling: action.payload };
    case 'SET_SHOW_PROGRESS':
      return { ...state, showProgress: action.payload };
    case 'SET_HAS_TASK_RUN':
      return { ...state, hasTaskRun: action.payload };
    case 'SET_CYCLE_COUNT':
      return { ...state, cycleCount: action.payload };
    case 'SET_CYCLE_COUNT_INPUT':
      return { ...state, cycleCountInput: action.payload };
    case 'SET_ACCESS_MODE':
      logger.info('SET_ACCESS_MODE action:', { from: state.accessMode, to: action.payload });
      return { ...state, accessMode: action.payload };
    case 'SET_PROXY_URL':
      return { ...state, proxyUrl: action.payload };
    case 'SET_REFERER_OPTION':
      return { ...state, refererOption: action.payload };
    case 'SET_SELECTED_SOCIAL_MEDIA':
      return { ...state, selectedSocialMedia: action.payload };
    case 'SET_CUSTOM_REFERER':
      return { ...state, customReferer: action.payload };
    case 'SET_TASK_ID':
      return { ...state, taskId: action.payload };
    case 'SET_IS_VALIDATING_PROXY':
      return { ...state, isValidatingProxy: action.payload };
    case 'SET_PROXY_VALIDATION_SUCCESS':
      return { ...state, proxyValidationSuccess: action.payload };
    case 'SET_LAST_VALIDATED_PROXY_URL':
      return { ...state, lastValidatedProxyUrl: action.payload };
    case 'SET_IS_FETCHING_PROXIES':
      return { ...state, isFetchingProxies: action.payload };
    case 'SET_REQUIRED_PROXY_COUNT':
      return { ...state, requiredProxyCount: action.payload };
    case 'SET_TOTAL_VISITS':
      return { ...state, totalVisits: action.payload };
    case 'SET_TASK_START_TIME':
      return { ...state, taskStartTime: action.payload };
    case 'SET_TASK_END_TIME':
      return { ...state, taskEndTime: action.payload };
    case 'SET_PARAM_ERRORS':
      return { ...state, paramErrors: action.payload };
    case 'SET_PROXY_PHASE':
      return { ...state, proxyPhase: action.payload };
    case 'SET_PROXY_STATS':
      return { ...state, proxyStats: action.payload };
    case 'SET_VALIDATION_CONFIG':
      return { ...state, validationConfig: action.payload };
    case 'SET_PHASE_STATUS':
      return { ...state, phaseStatus: action.payload };
    case 'SET_COMPLETED_PHASES':
      return { ...state, completedPhases: action.payload };
    case 'SET_PHASE_PROGRESS':
      return { ...state, phaseProgress: action.payload };
    case 'RESET_PROGRESS':
      return {
        ...state,
        progress: 0,
        successCount: 0,
        failCount: 0,
        pendingCount: 0,
        status: "",
        error: "",
        proxyPhase: undefined,
        phaseStatus: undefined,
        completedPhases: undefined,
        phaseProgress: undefined
      };
    case 'RESET_FOR_NEW_TASK':
      return {
        ...state,
        progress: 0,
        successCount: 0,
        failCount: 0,
        pendingCount: 0,
        status: "",
        error: "",
        taskId: null,
        isPolling: false,
        urls: [],
        proxyPhase: undefined,
        phaseStatus: undefined,
        completedPhases: undefined,
        phaseProgress: undefined,
        taskStartTime: null,
        taskEndTime: null
      };
    case 'UPDATE_FROM_PROGRESS_DATA':
      const { progress, successCount, failCount, message, status: taskStatus } = action.payload;
      
      // 提取代理阶段信息
      const extractProxyPhase = (msg: string): string => {
        const lowerMsg = msg.toLowerCase();
        if (lowerMsg.includes('代理验证') || lowerMsg.includes('验证代理')) return 'proxy-validation';
        if (lowerMsg.includes('代理ip获取') || lowerMsg.includes('获取代理')) return 'proxy-acquisition';
        if (lowerMsg.includes('代理分配') || lowerMsg.includes('分配代理')) return 'proxy-distribution';
        if (lowerMsg.includes('代理缓存') || lowerMsg.includes('缓存代理')) return 'proxy-caching';
        if (lowerMsg.includes('代理补充') || lowerMsg.includes('补充代理')) return 'proxy-replenishment';
        if (lowerMsg.includes('批量访问') || lowerMsg.includes('正在访问')) return 'batch-execution';
        return 'unknown';
      };
      
      // 提取代理统计信息
      const extractProxyStats = (msg: string) => {
        const stats: any = {};
        
        // 提取代理数量 (例如: "5个代理")
        const proxyCountMatch = msg.match(/(\d+)\s*个?\s*代理/);
        if (proxyCountMatch) {
          stats.currentProxyCount = parseInt(proxyCountMatch[1]);
        }
        
        // 提取获取进度 (例如: "(5/10)")
        const progressMatch = msg.match(/\((\d+)\/(\d+)\)/);
        if (progressMatch) {
          stats.currentCount = parseInt(progressMatch[1]);
          stats.targetCount = parseInt(progressMatch[2]);
          stats.acquisitionProgress = Math.round((stats.currentCount / stats.targetCount) * 100);
        }
        
        // 提取来源信息
        if (msg.includes('缓存')) stats.source = 'cache';
        else if (msg.includes('批量')) stats.source = 'batch';
        else if (msg.includes('个别')) stats.source = 'individual';
        
        // 提取策略信息
        if (msg.includes('智能') || msg.includes('优化')) stats.strategy = 'optimized';
        else if (msg.includes('FIFO') || msg.includes('先进先出')) stats.strategy = 'fifo';
        else if (msg.includes('轮询')) stats.strategy = 'round-robin';
        
        // 检查警告
        if (msg.includes('不足') || msg.includes('shortage')) stats.hasShortage = true;
        if (msg.includes('降级') || msg.includes('fallback')) stats.usingFallback = true;
        
        return Object.keys(stats).length > 0 ? stats : undefined;
      };
      
      const currentMessage = message || '正在处理...';
      const proxyPhase = extractProxyPhase(currentMessage);
      const proxyStats = extractProxyStats(currentMessage);
      
      return {
        ...state,
        progress: Math.max(1, progress || 0),
        successCount: successCount || 0,
        failCount: failCount || 0,
        status: currentMessage,
        isFetchingProxies: currentMessage && (currentMessage.includes('正在获取代理IP') || currentMessage.includes('正在准备获取代理IP')),
        proxyPhase,
        proxyStats: proxyStats ? { ...state.proxyStats, ...proxyStats } : state.proxyStats,
        ...(taskStatus === 'completed' && {
          status: '批量访问完成！',
          isPolling: false,
          isOpening: false,
          isTaskRunning: false,
          isFetchingProxies: false,
          taskId: null,
          progress: 100,
          showProgress: true,
          hasTaskRun: true
        }),
        ...(taskStatus === 'error' && {
          error: message,
          isPolling: false,
          isOpening: false,
          isTaskRunning: false,
          isFetchingProxies: false,
          taskId: null,
          showProgress: true,
          hasTaskRun: true
        }),
        ...(taskStatus === 'failed' && {
          error: message,
          isPolling: false,
          isOpening: false,
          isTaskRunning: false,
          isFetchingProxies: false,
          taskId: null,
          showProgress: true,
          hasTaskRun: true
        }),
        ...(taskStatus === 'terminated' && {
          status: "任务已终止",
          isPolling: false,
          isOpening: false,
          isTaskRunning: false,
          isFetchingProxies: false,
          taskId: null,
          showProgress: true,
          hasTaskRun: true
        })
      };
    case 'NOOP':
      return state;
    default:
      return state;
  }
}

interface SilentBatchOpenProps {
  locale: string;
  t: (key: string) => string | string[];
}

export const SilentBatchOpen: React.FC<SilentBatchOpenProps> = React.memo((props) => {
  const { t: contextT, locale: contextLocale, isLoading } = useLanguage();
  
  const t = isLoading ? props.t : contextT;
  const locale = isLoading ? props.locale : contextLocale;

  const [state, dispatch] = useReducer(stateReducer, initialState);
  const { consumeTokens } = useTokenConsumption();
  
  // 解构状态以便于使用
  const {
    input,
    urls,
    progress,
    successCount,
    failCount,
    status,
    error,
    isOpening,
    isTaskRunning,
    isPolling,
    showProgress,
    hasTaskRun,
    cycleCount,
    cycleCountInput,
    accessMode,
    proxyUrl,
    refererOption,
    selectedSocialMedia,
    customReferer,
    taskId,
    isValidatingProxy,
    proxyValidationSuccess,
    lastValidatedProxyUrl,
    isFetchingProxies,
    requiredProxyCount,
    totalVisits,
    taskStartTime,
    taskEndTime,
    paramErrors,
    proxyPhase,
    proxyStats,
    validationConfig,
    phaseStatus,
    completedPhases,
    phaseProgress
  } = state;
  
  // 使用 ref 来跟踪最新的 accessMode
  const accessModeRef = useRef<"http" | "puppeteer">(accessMode);
  
  // 当 accessMode 变化时更新 ref
  useEffect(() => {
    accessModeRef.current = accessMode;
  }, [accessMode]);
  
  // 使用useCallback稳定计算函数 - 新算法：所需代理数量 = 每个URL打开次数
  const calculateProxyRequirements = useCallback(async () => {
    if (urls.length === 0) return;
    
    const currentCycleCount = parseInt(cycleCountInput) || 5;
    
    // 简化的代理需求计算
    const calculatedTotalVisits = urls.length * currentCycleCount;
    
    // 简化算法：所需代理数量 = cycleCount
    const requiredProxyCount = currentCycleCount;
    
    logger.info('代理需求计算完成:', {
      urls: urls.length,
      cycleCount: currentCycleCount,
      totalVisits: calculatedTotalVisits,
      requiredProxies: requiredProxyCount
    });
    
    dispatch({ type: 'SET_REQUIRED_PROXY_COUNT', payload: requiredProxyCount });
    dispatch({ type: 'SET_TOTAL_VISITS', payload: calculatedTotalVisits });
  }, [urls.length, cycleCountInput]);

  // 当智能策略开关或URL数量变化时，重新计算代理数量
  useEffect(() => {
    calculateProxyRequirements();
  }, [calculateProxyRequirements]);
  // 终止标志
  const abortRef = useRef(false);
  // 轮询间隔引用（保持兼容性）
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 计算当前应打开的总数
  const calcTotalToOpen = () => {
    const currentCycleCount = parseInt(cycleCountInput) || 5;
    return urls.length * currentCycleCount;
  };

  // 参数校验函数
  const validateParams = useCallback(() => {
    const errors: typeof paramErrors = {};
    const currentCycleCount = parseInt(cycleCountInput) || 5;
        
    if (currentCycleCount < 1 || currentCycleCount > 1000) {
      errors.cycleCount = "每个URL打开次数必须在1-1000之间";
    }

    
    if (!proxyUrl.trim()) {
      // 移除"代理API地址不能为空"的提示文案
      // errors.proxyUrl = "代理API地址不能为空";
    } else if (!proxyUrl.startsWith('http')) {
      errors.proxyUrl = "代理API地址必须以http开头";
    }

    if (refererOption === "custom") {
      // 自定义模式下，允许空referer（不发送Referer头）
      if (customReferer.trim()) {
        if (!customReferer.trim().startsWith('http://') && !customReferer.trim().startsWith('https://')) {
          errors.customReferer = "自定义Referer必须以http://或https://开头";
        } else if (!customReferer.trim().match(/^https?:\/\/[^\s/$.?#].[^\s]*$/i)) {
          errors.customReferer = "请输入有效的URL格式";
        }
      }
    }

    dispatch({ type: 'SET_PARAM_ERRORS', payload: errors });
    return Object.keys(errors).length === 0;
  }, [cycleCountInput, proxyUrl, refererOption, customReferer]);

  // 解析输入的URL
  const parseUrls = useCallback((text: string) => {
    const lines = text.split('\n').filter(line => {
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
      dispatch({ type: 'SET_URLS', payload: parsedUrls });
    }, 300),
    [stableParseUrls]
  );

  // 输入变化时解析URL（带防抖）
  useEffect(() => {
    debouncedParseUrls(input);
  }, [input, debouncedParseUrls]);

  // 验证代理URL
  const validateProxyUrl = useCallback(async (url: string): Promise<boolean> => {
    logger.info('validateProxyUrl 被调用:', { 
      url, 
      currentProxyUrl: proxyUrl,
      proxyValidationSuccess,
      lastValidatedProxyUrl,
      validationEnabled: validationConfig?.enabled 
    });
    
    // 检查是否提供了代理URL
    if (!url || !url.trim()) {
      dispatch({ type: 'SET_ERROR', payload: "" });
      dispatch({ type: 'SET_PROXY_VALIDATION_SUCCESS', payload: false });
      dispatch({ type: 'SET_LAST_VALIDATED_PROXY_URL', payload: null });
      return false;
    }
    
    // 检查验证是否已禁用
    if (validationConfig && !validationConfig.enabled) {
      logger.info('代理验证已禁用，跳过验证');
      dispatch({ type: 'SET_PROXY_VALIDATION_SUCCESS', payload: true });
      dispatch({ type: 'SET_LAST_VALIDATED_PROXY_URL', payload: url.trim() });
      dispatch({ type: 'SET_ERROR', payload: "" });
      return true;
    }
    
    // 检查是否已经验证过相同的URL
    if (proxyValidationSuccess && lastValidatedProxyUrl === url.trim()) {
      logger.info('URL已验证过，跳过重复验证');
      return true;
    }
    
    dispatch({ type: 'SET_IS_VALIDATING_PROXY', payload: true });
    dispatch({ type: 'SET_PROXY_VALIDATION_SUCCESS', payload: false });
    dispatch({ type: 'SET_ERROR', payload: "" });
    dispatch({ type: 'SET_STATUS', payload: "正在验证代理URL..." });
    
    try {
      // 设置较短的的超时时间（15秒），因为只验证URL格式和IP获取
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch('/api/batchopen/proxy-url-validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proxyUrl: url.trim() }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      const result = await response.json();
      
      if (result.success) {
        logger.info('代理URL验证成功:', result.proxy);
        dispatch({ type: 'SET_STATUS', payload: "代理URL格式正确，成功获取代理IP！" });
        dispatch({ type: 'SET_PROXY_VALIDATION_SUCCESS', payload: true });
        dispatch({ type: 'SET_LAST_VALIDATED_PROXY_URL', payload: url.trim() });
        setTimeout(() => dispatch({ type: 'SET_STATUS', payload: "" }), 3000);
        return true;
      } else {
        const friendlyErrorMessage = `代理URL验证失败：${result.message}`;
        dispatch({ type: 'SET_ERROR', payload: friendlyErrorMessage });
        dispatch({ type: 'SET_PROXY_VALIDATION_SUCCESS', payload: false });
        dispatch({ type: 'SET_LAST_VALIDATED_PROXY_URL', payload: null });
        return false;
      }
    } catch (error) {
      logger.error('验证代理URL时发生错误:', new EnhancedError('验证代理URL时发生错误:', { error: error instanceof Error ? error.message : String(error)  }));
      
      if (error instanceof Error && error.name === 'AbortError') {
        dispatch({ type: 'SET_ERROR', payload: '代理URL验证超时，请检查网络连接或稍后重试' });
      } else {
        dispatch({ type: 'SET_ERROR', payload: '代理URL验证网络错误，请检查网络连接' });
      }
      
      dispatch({ type: 'SET_PROXY_VALIDATION_SUCCESS', payload: false });
      dispatch({ type: 'SET_LAST_VALIDATED_PROXY_URL', payload: null });
      return false;
    } finally {
      dispatch({ type: 'SET_IS_VALIDATING_PROXY', payload: false });
    }
  }, [lastValidatedProxyUrl, proxyValidationSuccess, validationConfig]);

  // 开始批量打开
  const startBatchOpen = useCallback(async () => {
    // 如果已经有任务运行过，重置所有状态（除了 hasTaskRun 和 showProgress）
    if (hasTaskRun) {
      dispatch({ type: 'SET_PROGRESS', payload: 0 });
      dispatch({ type: 'SET_SUCCESS_COUNT', payload: 0 });
      dispatch({ type: 'SET_FAIL_COUNT', payload: 0 });
      dispatch({ type: 'SET_STATUS', payload: "" });
      dispatch({ type: 'SET_ERROR', payload: "" });
      dispatch({ type: 'SET_TASK_ID', payload: null });
      dispatch({ type: 'SET_IS_POLLING', payload: false });
      dispatch({ type: 'SET_TASK_START_TIME', payload: null }); // 重置任务开始时间
      dispatch({ type: 'SET_TASK_END_TIME', payload: null }); // 重置任务结束时间
      // 保持 hasTaskRun 为 true，showProgress 继续显示
    }
    
    // 确保进度条会显示
    dispatch({ type: 'SET_SHOW_PROGRESS', payload: true });
    dispatch({ type: 'SET_HAS_TASK_RUN', payload: true });
    // 设置任务开始时间 - 在用户点击按钮时立即记录
    // 注意：必须在重置为null之后设置
    dispatch({ type: 'SET_TASK_START_TIME', payload: Date.now() });
    
    // 重置看门狗计时器
    // Note: 移除复杂的进度监控逻辑
    
    // 获取最新的参数值 - 使用 ref 获取最新状态
    const currentCycleCount = parseInt(cycleCountInput) || 5;
    const currentProxyUrl = proxyUrl;
    const currentRefererOption = refererOption;
    const currentCustomReferer = customReferer;
    const currentAccessMode = accessModeRef.current;
    
        
    logger.info('使用当前参数启动任务:', {
      cycleCount: currentCycleCount,
      proxyUrl: currentProxyUrl,
      refererOption: currentRefererOption,
      accessMode: currentAccessMode,
      accessModeSource: accessModeRef.current === currentAccessMode ? 'ref' : 'state'
    });
    
        
    if (!validateParams()) {
      return;
    }

    const parsedUrls = parseUrls(input);
    if (parsedUrls.length === 0) {
      dispatch({ type: 'SET_ERROR', payload: "请输入至少一个URL" });
      return;
    }

    // 调试：打印当前验证状态
    logger.info('startBatchOpen - 当前验证状态:', {
      proxyValidationSuccess,
      proxyUrl: currentProxyUrl,
      lastValidationTime: 'N/A'
    });

    // 检查代理验证状态
    if (!proxyValidationSuccess) {
      // 如果验证已禁用，直接允许启动
      if (validationConfig && !validationConfig.enabled) {
        logger.info('代理验证已禁用，允许启动任务');
      } else {
        // 验证启用但未通过验证
        if (!proxyUrl.trim()) {
          dispatch({ type: 'SET_ERROR', payload: "请先配置代理API地址并验证" });
        } else {
          dispatch({ type: 'SET_ERROR', payload: "代理验证失败，请先验证代理配置" });
        }
        return;
      }
    }

    // 代理已验证成功，继续执行任务
    logger.info('代理已验证，正在启动批量打开...');
    dispatch({ type: 'SET_STATUS', payload: "代理已验证，正在启动批量打开..." });
    dispatch({ type: 'SET_ERROR', payload: "" }); // 清除错误信息

    // 批量更新状态以减少渲染次数
    dispatch({ type: 'SET_IS_OPENING', payload: true });
    dispatch({ type: 'SET_IS_TASK_RUNNING', payload: true });
    dispatch({ type: 'SET_SHOW_PROGRESS', payload: true });
    dispatch({ type: 'SET_HAS_TASK_RUN', payload: true });
    abortRef.current = false;
    
    // 使用一个状态更新来设置多个值
    dispatch({ type: 'SET_PROGRESS', payload: 0 });
    dispatch({ type: 'SET_SUCCESS_COUNT', payload: 0 });
    dispatch({ type: 'SET_FAIL_COUNT', payload: 0 });
    dispatch({ type: 'SET_ERROR', payload: "" });
    dispatch({ type: 'SET_STATUS', payload: "正在初始化任务..." });

    try {
      // 生成任务ID
      const newTaskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      dispatch({ type: 'SET_TASK_ID', payload: newTaskId });

      // 计算总访问次数
      const urlVisits = parsedUrls.map(() => currentCycleCount);
      const actualTotalVisits = parsedUrls.length * currentCycleCount;
      
      // 检查并消费 token
      const tokenResult = await consumeTokens(
        'batchopen',
        'silent_batch_open',
        actualTotalVisits,
        {
          itemCount: actualTotalVisits,
          description: `静默批量打开 - ${parsedUrls.length}个URL x ${currentCycleCount}次`,
          onInsufficientBalance: () => {
            dispatch({ type: 'SET_ERROR', payload: 'Token余额不足，请充值后重试' });
            dispatch({ type: 'SET_IS_OPENING', payload: false });
            dispatch({ type: 'SET_IS_TASK_RUNNING', payload: false });
            dispatch({ type: 'SET_IS_POLLING', payload: false });
          }
        }
      );
      
      if (!tokenResult.success) {
        return;
      }
      
      // 计算需要的代理数量（与后端保持一致）
      const calculateRequiredProxyCount = (totalVisits: number): number => {
        // 使用当前策略
        if (totalVisits < 20) {
          return totalVisits + 5;
        } else if (totalVisits < 50) {
          return Math.ceil(totalVisits * 1.3);
        } else if (totalVisits < 100) {
          return Math.ceil(totalVisits * 1.2);
        } else {
          return Math.ceil(totalVisits * 1.1);
        }
      };
      
      const calculatedRequiredProxyCount = calculateRequiredProxyCount(actualTotalVisits);
      dispatch({ type: 'SET_REQUIRED_PROXY_COUNT', payload: calculatedRequiredProxyCount });
      dispatch({ type: 'SET_TOTAL_VISITS', payload: actualTotalVisits });

      // 准备请求数据
      const requestData = {
        taskId: newTaskId,
        urls: parsedUrls,
        cycleCount: currentCycleCount,
                proxyUrl: currentProxyUrl.trim(),
        refererOption: currentRefererOption,
        selectedSocialMedia: currentRefererOption === "social" ? selectedSocialMedia : undefined,
        customReferer: currentRefererOption === "custom" ? currentCustomReferer.trim() : undefined,
        proxyValidated: true, // 代理已在前端验证成功
        actualTotalVisits, // 传递实际总访问次数
        accessMode: currentAccessMode, // 传递访问模式
      };

      logger.info('启动静默批量打开:', requestData);
      
      // 先启动轮询，确保能接收到所有状态更新
      dispatch({ type: 'SET_IS_POLLING', payload: true });
      
      // 设置初始进度状态，防止卡在0%
      dispatch({ type: 'SET_PROGRESS', payload: 1 }); // 设置为1%而不是0%
      dispatch({ type: 'SET_STATUS', payload: "任务初始化..." });
      
      // 等待轮询启动并确保状态更新
      await new Promise(resolve => setTimeout(resolve, 200));

      // 发送启动请求
      const response = await fetch('/api/batchopen/silent-start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`启动失败: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || '启动失败');
      }

      logger.info('任务启动成功，开始轮询进度:', { taskId: newTaskId });

    } catch (err) {
      logger.error('启动失败:', new EnhancedError('启动失败:', { error: err instanceof Error ? err.message : String(err)  }));
      
      let errorMessage = err instanceof Error ? err.message : '未知错误';
      
      // 针对代理相关错误提供更友好的提示
      if (errorMessage.includes('代理验证失败')) {
        errorMessage = '代理验证失败，请检查代理配置后重试';
      } else if (errorMessage.includes('代理API返回了无效的代理配置')) {
        errorMessage = '用户提供的代理API无法提供可用的代理IP！\n\n可能的原因：\n1. 代理API地址不正确\n2. 代理API服务不可用\n3. 代理账号余额不足\n\n请检查代理配置后，点击"验证代理"按钮重新验证。';
      } else if (errorMessage.includes('代理URL验证失败')) {
        errorMessage = '代理URL验证失败！\n\n请检查代理API地址是否正确，然后点击"验证代理"按钮重新验证。';
      } else if (errorMessage.includes('未能获取到任何有效的代理配置')) {
        errorMessage = '用户提供的代理API未能返回任何有效的代理配置！\n\n请检查您的代理API地址和服务状态，然后重新验证。';
      } else if (errorMessage.includes('代理')) {
        errorMessage = `代理服务异常：${errorMessage}\n\n请检查代理配置或尝试稍后重试。`;
      }
      
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      dispatch({ type: 'SET_IS_OPENING', payload: false });
      dispatch({ type: 'SET_IS_TASK_RUNNING', payload: false }); // 重置任务运行状态
      dispatch({ type: 'SET_IS_POLLING', payload: false }); // 停止轮询
    }
  }, [validateParams, stableParseUrls, validateProxyUrl, hasTaskRun, cycleCountInput, proxyUrl, refererOption, customReferer, input, proxyValidationSuccess, consumeTokens]);

  // 终止批量打开
  const terminateBatchOpen = useCallback(async () => {
    if (!taskId || (!isTaskRunning && !isPolling)) return;

    logger.info('开始终止任务:', { taskId, isOpening });

    try {
      abortRef.current = true;
      dispatch({ type: 'SET_STATUS', payload: "正在终止..." });

      // 尝试多次发送终止请求，确保服务器收到
      let terminateSuccess = false;
      let lastError: string | null = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          logger.info(`终止请求尝试 ${attempt}/3`);
          
          // 使用 fetch 但不设置 signal，避免 abort 错误
          const response = await fetch('/api/batchopen/silent-terminate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ taskId })
          });

          if (response.ok) {
            const result = await response.json();
            logger.info('终止请求成功:', result);
            terminateSuccess = true;
            break;
          } else {
            const errorResult = await response.json();
            lastError = errorResult.message || '未知错误';
            logger.error(`终止请求失败 (尝试 ${attempt}):`, errorResult);
          }
        } catch (attemptError) {
          // 忽略网络错误，直接记录并继续重试
          lastError = attemptError instanceof Error ? attemptError.message : String(attemptError);
          logger.warn(`终止请求异常 (尝试 ${attempt}):`, { error: lastError });
        }
        
        // 如果不是最后一次尝试，等待一段时间再重试
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 缩短重试间隔
        }
      }

      if (terminateSuccess) {
        // 设置状态为已终止，但保持轮询以获取最终状态
        dispatch({ type: 'SET_STATUS', payload: "任务已终止" });
        dispatch({ type: 'SET_ERROR', payload: "" });
        
        // 不立即停止轮询，让最后一次请求获取实际终止状态
        // 不立即设置setIsFetchingProxies(false)，让轮询机制处理
        
        // 延迟再关闭任务状态，但保持进度显示
        setTimeout(() => {
          dispatch({ type: 'SET_IS_OPENING', payload: false });
          dispatch({ type: 'SET_IS_TASK_RUNNING', payload: false }); // 重置任务运行状态
          // 注意：不在这里设置setIsFetchingProxies(false)
          // 让轮询机制根据后端返回的状态来决定
        }, 1500);
      } else {
        dispatch({ type: 'SET_ERROR', payload: `终止失败: ${lastError || '请求失败'}` });
        // 即使终止失败，也关闭界面状态，但保持进度显示
        setTimeout(() => {
          dispatch({ type: 'SET_IS_OPENING', payload: false });
          dispatch({ type: 'SET_IS_TASK_RUNNING', payload: false }); // 重置任务运行状态
          // 注意：不在这里设置setIsFetchingProxies(false)
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }, 2000);
      }
    } catch (err) {
      // 特殊处理：如果是超时导致的abort，显示更友好的错误信息
      if (err instanceof Error && err.name === 'AbortError' && err.message === 'signal is aborted without reason') {
        logger.warn('终止请求超时');
        dispatch({ type: 'SET_ERROR', payload: '终止请求超时，请重试' });
      } else {
        logger.error('终止请求异常:', new EnhancedError('终止请求异常:', { error: err instanceof Error ? err.message : String(err)  }));
        dispatch({ type: 'SET_ERROR', payload: '终止失败，请检查网络连接' });
      }
      
      // 确保界面状态被重置，但保持进度显示
      setTimeout(() => {
        dispatch({ type: 'SET_IS_OPENING', payload: false });
        dispatch({ type: 'SET_IS_TASK_RUNNING', payload: false }); // 重置任务运行状态
        // 注意：不在这里设置setIsFetchingProxies(false)
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }, 2000);
    }
  }, [taskId, isTaskRunning, isPolling]);

  
  // 参数变更时校验
  useEffect(() => {
    validateParams();
    // 如果进度条正在显示且用户修改了参数，不重置状态
  }, [validateParams]);

  
  // 稳定的进度处理回调
  const handleProgressUpdate = useCallback((data: any) => {
    // 确保进度至少为1%，避免显示0%
    const validatedProgress = Math.max(1, data.progress || 0);
    
    dispatch({ type: 'SET_PROGRESS', payload: validatedProgress });
    dispatch({ type: 'SET_SUCCESS_COUNT', payload: data.successCount || 0 });
    dispatch({ type: 'SET_FAIL_COUNT', payload: data.failCount || 0 });
    dispatch({ type: 'SET_STATUS', payload: data.message || '正在处理...' });
    
    // 更新阶段相关信息
    if (data.proxyPhase) {
      dispatch({ type: 'SET_PROXY_PHASE', payload: data.proxyPhase });
    }
    if (data.phaseStatus) {
      dispatch({ type: 'SET_PHASE_STATUS', payload: data.phaseStatus });
    }
    if (data.completedPhases) {
      dispatch({ type: 'SET_COMPLETED_PHASES', payload: data.completedPhases });
    }
    if (data.phaseProgress) {
      dispatch({ type: 'SET_PHASE_PROGRESS', payload: data.phaseProgress });
    }
    
    // 如果后端提供了pendingCount，使用它；否则计算
    if (data.pendingCount !== undefined) {
      dispatch({ type: 'SET_PENDING_COUNT', payload: data.pendingCount });
    } else {
      // 计算pendingCount
      const calculatedPending = Math.max(0, (data.total || 0) - (data.successCount || 0) - (data.failCount || 0));
      dispatch({ type: 'SET_PENDING_COUNT', payload: calculatedPending });
    }
    
    // 检查是否正在获取代理
    if (data.message && (data.message.includes('正在获取代理IP') || data.message.includes('正在准备获取代理IP'))) {
      dispatch({ type: 'SET_IS_FETCHING_PROXIES', payload: true });
    } else if (data.message && (data.message.includes('代理获取完成') || 
              data.message.includes('开始批量访问') ||
              data.message.includes('正在处理'))) {
      dispatch({ type: 'SET_IS_FETCHING_PROXIES', payload: false });
    }
    
    // 处理任务状态
    if (data.status === 'completed') {
      // 记录任务结束时间
      const endTime = Date.now();
      console.log('SilentBatchOpen Debug - Task Completed:', {
        taskStartTime,
        endTime,
        duration: taskStartTime ? Math.floor((endTime - taskStartTime) / 1000) : 0,
        hasTaskStartTime: !!taskStartTime,
        timeDiff: taskStartTime ? endTime - taskStartTime : 0,
        taskStartTimeType: typeof taskStartTime,
        endTimeType: typeof endTime
      });
      dispatch({ type: 'SET_TASK_END_TIME', payload: endTime });
      console.log('After SET_TASK_END_TIME dispatch', { taskEndTime: endTime });
      
      // 优先使用后端计算的耗时（如果提供）
      const backendDuration = data.duration || data.elapsedTime;
      if (backendDuration) {
        // 后端提供了耗时信息（毫秒），转换为秒
        const durationInSeconds = Math.floor(backendDuration / 1000);
        const minutes = Math.floor(durationInSeconds / 60);
        const seconds = durationInSeconds % 60;
        dispatch({ type: 'SET_STATUS', payload: `批量访问完成！耗时: ${minutes > 0 ? `${minutes}m${seconds}s` : `${seconds}s`}` });
      } else {
        // 使用前端的开始和结束时间计算耗时
        const duration = taskStartTime ? Math.floor((endTime - taskStartTime) / 1000) : 0;
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        // 确保至少显示1秒，避免显示0s
        const displayDuration = Math.max(1, duration);
        dispatch({ type: 'SET_STATUS', payload: `批量访问完成！耗时: ${minutes > 0 ? `${minutes}m${displayDuration % 60}s` : `${displayDuration}s`}` });
      }
      dispatch({ type: 'SET_IS_POLLING', payload: false });
      dispatch({ type: 'SET_IS_OPENING', payload: false });
      dispatch({ type: 'SET_IS_TASK_RUNNING', payload: false });
      dispatch({ type: 'SET_IS_FETCHING_PROXIES', payload: false });
      // 延迟设置 taskId 为 null，确保最终状态能正确显示
      setTimeout(() => {
        console.log('Final state check:', {
          taskStartTime,
          taskEndTime: endTime,
          status: 'completed'
        });
        dispatch({ type: 'SET_TASK_ID', payload: null });
      }, 1000);
      dispatch({ type: 'SET_PROGRESS', payload: 100 });
      dispatch({ type: 'SET_SHOW_PROGRESS', payload: true });
      dispatch({ type: 'SET_HAS_TASK_RUN', payload: true });
    } else if (data.status === 'error') {
      dispatch({ type: 'SET_ERROR', payload: data.message });
      dispatch({ type: 'SET_IS_POLLING', payload: false });
      dispatch({ type: 'SET_IS_OPENING', payload: false });
      dispatch({ type: 'SET_IS_TASK_RUNNING', payload: false });
      dispatch({ type: 'SET_IS_FETCHING_PROXIES', payload: false });
      // 延迟设置 taskId 为 null
      setTimeout(() => {
        dispatch({ type: 'SET_TASK_ID', payload: null });
      }, 1000);
      dispatch({ type: 'SET_SHOW_PROGRESS', payload: true });
      dispatch({ type: 'SET_HAS_TASK_RUN', payload: true });
    } else if (data.status === 'terminated') {
      dispatch({ type: 'SET_STATUS', payload: "任务已终止" });
      dispatch({ type: 'SET_IS_POLLING', payload: false });
      dispatch({ type: 'SET_IS_OPENING', payload: false });
      dispatch({ type: 'SET_IS_TASK_RUNNING', payload: false });
      dispatch({ type: 'SET_IS_FETCHING_PROXIES', payload: false });
      // 延迟设置 taskId 为 null
      setTimeout(() => {
        dispatch({ type: 'SET_TASK_ID', payload: null });
      }, 1000);
      dispatch({ type: 'SET_SHOW_PROGRESS', payload: true });
      dispatch({ type: 'SET_HAS_TASK_RUN', payload: true });
    }
  }, []);

  // 稳定的错误处理回调
  const handleError = useCallback((error: any) => {
    logger.error('Real-time progress error:', new EnhancedError('Real-time progress error:', { error: error.message  }));
    dispatch({ type: 'SET_ERROR', payload: '网络连接异常，请刷新页面重试' });
    dispatch({ type: 'SET_IS_POLLING', payload: false });
    dispatch({ type: 'SET_IS_OPENING', payload: false });
    dispatch({ type: 'SET_IS_TASK_RUNNING', payload: false });
  }, []);

  // 稳定的完成回调
  const handleComplete = useCallback(() => {
    dispatch({ type: 'SET_IS_POLLING', payload: false });
    dispatch({ type: 'SET_IS_OPENING', payload: false });
    dispatch({ type: 'SET_IS_TASK_RUNNING', payload: false });
  }, []);

  // 简单轮询机制 - 替代复杂的WebSocket方案
  useEffect(() => {
    if (!isPolling || !taskId) return;
    
    let intervalId: NodeJS.Timeout | null = null;
    
    const pollProgress = async () => {
      try {
        const response = await fetch(`/api/batchopen/silent-progress?taskId=${taskId}&t=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
          handleProgressUpdate(data);
          
          // 检查任务是否已完成，如果是则立即停止轮询
          if (data.status === 'completed' || data.status === 'error' || data.status === 'terminated') {
            // 等待一小段时间后再次查询，确保获取最终状态
            setTimeout(async () => {
              try {
                const finalResponse = await fetch(`/api/batchopen/silent-progress?taskId=${taskId}&t=${Date.now()}`);
                const finalData = await finalResponse.json();
                if (finalData.success) {
                  handleProgressUpdate(finalData);
                }
              } catch (error) {
                logger.warn('获取最终状态失败:', error instanceof Error ? error : new Error(String(error)));
              }
            }, 1000);
            
            // 立即更新状态，确保按钮可以重新点击
            dispatch({ type: 'SET_IS_POLLING', payload: false });
            dispatch({ type: 'SET_IS_OPENING', payload: false });
            dispatch({ type: 'SET_IS_TASK_RUNNING', payload: false });
            dispatch({ type: 'SET_IS_FETCHING_PROXIES', payload: false });
            
            // 立即清除轮询定时器
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            return;
          }
        }
      } catch (error) {
        // 静默处理轮询错误，避免干扰用户体验
        logger.warn('进度轮询错误:', error instanceof Error ? error : new Error(String(error)));
      }
    };
    
    // 立即执行一次
    pollProgress();
    
    // 设置定时轮询 - 2秒间隔平衡性能和体验
    intervalId = setInterval(pollProgress, 2000);
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isPolling, taskId, handleProgressUpdate]);

  // 获取验证配置
  useEffect(() => {
    const fetchValidationConfig = async () => {
      try {
        const response = await fetch('/api/batchopen/validation-config');
        const data = await response.json();
        
        if (data.success) {
          dispatch({ type: 'SET_VALIDATION_CONFIG', payload: data.config });
          logger.info('验证配置加载成功', { config: data.config });
        } else {
          logger.warn('获取验证配置失败', { error: data.message });
        }
      } catch (error) {
        logger.error('获取验证配置时发生错误', error instanceof Error ? error : new Error(String(error)));
      }
    };
    
    fetchValidationConfig();
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      dispatch({ type: 'SET_IS_FETCHING_PROXIES', payload: false });
      dispatch({ type: 'SET_IS_POLLING', payload: false });
    };
  }, []);

  // 处理函数适配器
  const handleInputChange = useCallback((value: string) => {
    dispatch({ type: 'SET_INPUT', payload: value });
  }, []);

  const handleCycleCountInputChange = useCallback((value: string) => {
    dispatch({ type: 'SET_CYCLE_COUNT_INPUT', payload: value });
  }, []);

  const handleCycleCountChange = useCallback((value: number) => {
    dispatch({ type: 'SET_CYCLE_COUNT', payload: value });
  }, []);

  
  const handleAccessModeChange = useCallback((value: "http" | "puppeteer") => {
    logger.info('Access mode changed:', { from: accessMode, to: value });
    // Allow both "http" and "puppeteer" modes
    dispatch({ type: 'SET_ACCESS_MODE', payload: value });
  }, [accessMode]);

  
  const handleProxyUrlChange = useCallback((value: string) => {
    dispatch({ type: 'SET_PROXY_URL', payload: value });
  }, []);

  const handleRefererOptionChange = useCallback((value: "social" | "custom") => {
    dispatch({ type: 'SET_REFERER_OPTION', payload: value });
  }, []);

  const handleSelectedSocialMediaChange = useCallback((value: string) => {
    dispatch({ type: 'SET_SELECTED_SOCIAL_MEDIA', payload: value });
  }, []);

  const handleCustomRefererChange = useCallback((value: string) => {
    dispatch({ type: 'SET_CUSTOM_REFERER', payload: value });
  }, []);

  
  const handleSetError = useCallback((value: string) => {
    dispatch({ type: 'SET_ERROR', payload: value });
  }, []);

  const handleSetStatus = useCallback((value: string) => {
    dispatch({ type: 'SET_STATUS', payload: value });
  }, []);

  const handleSetProxyValidationSuccess = useCallback((value: boolean) => {
    dispatch({ type: 'SET_PROXY_VALIDATION_SUCCESS', payload: value });
  }, []);

  const handleSetLastValidatedProxyUrl = useCallback((value: string | null) => {
    dispatch({ type: 'SET_LAST_VALIDATED_PROXY_URL', payload: value });
  }, []);

  const handleStartTask = useCallback(() => {
    startBatchOpen();
  }, [startBatchOpen]);

  const handleTerminateTask = useCallback(() => {
    terminateBatchOpen();
  }, [terminateBatchOpen]);

  
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        logger.error('SilentBatchOpen组件错误:', new EnhancedError('SilentBatchOpen组件错误:', { error: error.message,
          componentStack: errorInfo.componentStack
         }));
      }}
    >
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Main functionality */}
        <div className="flex-1 min-w-0">
          <h2 className={UI_CONSTANTS.typography.h3 + " mb-4"}>
            {getTranslation(t, "batchopen.title")}
          </h2>
          <p className={UI_CONSTANTS.typography.body + " mb-6"}>{getTranslation(t, "batchopen.desc")}</p>

          <UrlInput
            input={input}
            onInputChange={handleInputChange}
            urls={urls}
            isOpening={isOpening}
            getTranslation={getTranslation}
            t={t}
          />

          <ParameterConfig
            cycleCountInput={cycleCountInput}
            cycleCount={cycleCount}
            isOpening={isOpening}
            accessMode={accessMode}
            proxyUrl={proxyUrl}
            refererOption={refererOption}
            customReferer={customReferer}
            paramErrors={paramErrors}
            onCycleCountInputChange={handleCycleCountInputChange}
            onCycleCountChange={handleCycleCountChange}
            onAccessModeChange={handleAccessModeChange}
            getTranslation={getTranslation}
            t={t}
          />

          <ProxyConfig
            proxyUrl={proxyUrl}
            proxyValidationSuccess={proxyValidationSuccess}
            isValidatingProxy={isValidatingProxy}
            lastValidatedProxyUrl={lastValidatedProxyUrl}
            refererOption={refererOption}
            selectedSocialMedia={selectedSocialMedia}
            customReferer={customReferer}
                        requiredProxyCount={requiredProxyCount}
            isOpening={isOpening}
            paramErrors={paramErrors}
            onProxyUrlChange={handleProxyUrlChange}
            onRefererOptionChange={handleRefererOptionChange}
            onSelectedSocialMediaChange={handleSelectedSocialMediaChange}
            onCustomRefererChange={handleCustomRefererChange}
            onValidateProxy={validateProxyUrl}
            setError={handleSetError}
            setStatus={handleSetStatus}
            setProxyValidationSuccess={handleSetProxyValidationSuccess}
            setLastValidatedProxyUrl={handleSetLastValidatedProxyUrl}
          />

          <TaskControl
            urls={urls}
            paramErrors={paramErrors}
            isOpening={isOpening}
            isTaskRunning={isTaskRunning}
            isPolling={isPolling}
            isValidatingProxy={isValidatingProxy}
            isFetchingProxies={isFetchingProxies}
            proxyValidationSuccess={proxyValidationSuccess}
            error={error}
            onStartTask={handleStartTask}
            onTerminateTask={handleTerminateTask}
            getTranslation={getTranslation}
            t={t}
          />
        </div>

        {/* Right: Feature description and progress */}
        <div className="flex-1 min-w-0">
          <FeatureDescription
            getTranslation={getTranslation}
            t={t}
          />
          
          {/* 紧凑进度条 - 显示在静默版本说明下方，无多余空白 */}
          <CompactProgressBar
            showProgress={showProgress}
            taskId={taskId}
            progress={progress}
            successCount={successCount}
            failCount={failCount}
            totalVisits={totalVisits}
            status={status || 'running'}
            message={status}
            taskStartTime={taskStartTime}
            taskEndTime={taskEndTime}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
});

SilentBatchOpen.displayName = 'SilentBatchOpen';