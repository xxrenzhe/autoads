"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SafeI18nHtml } from "@/components/SafeHtml";
import { UI_CONSTANTS } from "@/components/ui/ui-constants";
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { SilentBatchOpen } from "./SilentBatchOpen";
import AutoClickBatch from "./AutoClickBatch";
import { SimpleProgressBar } from "@/components/ui/SimpleProgressBar";
import { getT } from "@/lib/utils/translation-helpers";
import { ProtectedButton } from "@/components/auth/ProtectedButton";
import { useTokenConsumption } from "@/hooks/useTokenConsumption";
const logger = createClientLogger('BatchOpenSection');

// Secure postMessage utility
const securePostMessage = (message: any) => {
  const targetOrigin = window.location.origin;
  window.postMessage(message, targetOrigin);
};

interface BatchOpenSectionProps {
  locale: string;
  t: (key: string) => string | string[];
}

// Chrome extension API types
interface ChromeExtension {
  id: string;
}

// 声明 window.backgroundOpenExtension 类型
interface ExtendedWindow extends Window { 
  backgroundOpenExtension?: { 
    id: string;
  };
}


// 默认翻译值
const DEFAULT_TRANSLATIONS: Record<string, string> = {
  "batchopen.basicVersion.title": "初级版本",
  "batchopen.advancedVersion.title": "高级版本",
  "batchopen.silentVersion.title": "静默版本",
  "batchopen.autoclickVersion.title": "自动化版本",
  "batchopen.title": "批量打开URL",
  "batchopen.desc": "后台批量访问URL，动态代理IP，自定义Referer",
  "batchopen.advancedVersion.multiUrlMode": "多URL模式",
  "batchopen.advancedVersion.singleUrlMode": "单URL模式",
  "batchopen.advancedVersion.cycleCount": "循环次数",
  "batchopen.advancedVersion.openCount": "打开次数",
  "batchopen.advancedVersion.openInterval": "打开间隔(秒)",
    "batchopen.input.title": "输入URL",
  "batchopen.input.description": "请输入要打开的URL，每行一个",
  "batchopen.input.placeholder": "请输入要批量打开的URL，每行一个...",
  "batchopen.btn.opening": "正在打开...",
  "batchopen.btn.open": "批量打开",
  "batchopen.btn.clear": "清空",
  "batchopen.btn.tip": "提示：批量打开前会自动关闭上次打开的所有标签页",
  "batchopen.status.popup_blocked_tip": "弹窗被阻止！请允许弹窗后重试",
  "batchopen.status.opening": "正在打开...",
  "batchopen.status.popup_blocked": "弹窗被阻止",
  "batchopen.status.success": "成功打开{count}个URL",
  "batchopen.status.terminated": "正在终止批量打开...",
  "batchopen.error.no_urls": "请输入至少一个URL",
  "batchopen.error.invalid_cycle_count": "循环次数必须在1-60之间",
  "batchopen.error.invalid_open_count": "打开次数必须在1-1000之间",
  "batchopen.error.invalid_interval": "打开间隔必须在1-60秒之间",
  "batchOpenSection.basicVersion.title": "初级版本说明",
  "batchOpenSection.basicVersion.tip": "提示：无需安装单独的 Background Open 插件，但只能实现简单的批量打开URL功能，且需要手动刷新代理IP地址。",
  "batchOpenSection.basicVersion.steps.title": "操作步骤：",
  "batchOpenSection.basicVersion.steps.step1": "手动刷新代理IP地址",
  "batchOpenSection.basicVersion.steps.step2": "输入需要打开的多个URL",
  "batchOpenSection.basicVersion.steps.step3": "点击\"批量打开\"，实现批量打开URL",
  "batchOpenSection.advancedVersion.title": "高级版本说明",
  "batchOpenSection.advancedVersion.tip": "必须安装单独的 <a href=\"/background-open-install\" class=\"text-blue-700 underline mx-1\" target=\"_blank\" rel=\"noopener noreferrer\">Background Open</a> 插件，可以实现更丰富的后台循环打开URL的功能，包括多URL模式、单URL模式、循环次数、间隔参数等。",
  "batchOpenSection.advancedVersion.stepsTitle": "使用步骤",
  "batchOpenSection.advancedVersion.scenariosTitle": "适用场景",
  "batchOpenSection.silentVersion.title": "静默版本说明",
  "batchOpenSection.silentVersion.tip": "无需安装任何插件，通过后端Chromium浏览器实现真实的浏览器访问",
  "batchOpenSection.autoclickVersion.title": "自动化版本说明",
  "batchopen.btn.terminate": "终止"
};

// 辅助函数：获取翻译文本
const getTranslation = (t: (key: string) => string | string[], key: string): string => {
  return getT(t, key, DEFAULT_TRANSLATIONS[key]);
};

export const BatchOpenSection: React.FC<BatchOpenSectionProps> = React.memo((props) => {
  const { t: contextT, locale: contextLocale, isLoading } = useLanguage();
  
  // 使用上下文中的翻译函数，如果加载中则使用props中的备用函数
  const t = isLoading ? props.t : contextT;
  const locale = isLoading ? props.locale : contextLocale;
  // 版本切换：basic/silent/autoclick
  const [version, setVersion] = useState<"basic" | "silent" | "autoclick">("basic");
    // URL 输入
  const [input, setInput] = useState("");
  // 解析后的URL列表
  const { consumeTokens } = useTokenConsumption();
  const [urls, setUrls] = useState<string[]>([]);
  // 打开窗口的引用
  const openedWindows = useRef<Window[]>([]);
  // 进度
  const [progress, setProgress] = useState(0);
  // 状态提示
  const [status, setStatus] = useState<string>("");
  // 错误提示
  const [error, setError] = useState<string>("");
  // 是否正在批量打开
  const [isOpening, setIsOpening] = useState(false);
  // 弹窗拦截检测
  const [popupBlocked, setPopupBlocked] = useState(false);
    // 终止标志（防止切换模式/清空时继续执行）
  const abortRef = useRef(false);
  // 插件检测状态 - 默认为false，需要检测后确认
  const [pluginDetected, setPluginDetected] = useState<boolean>(false);
  // 操作反馈状态
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  // 新增：缓存批量打开时的总数，防止过程中分母变化
  const [cachedTotalToOpen, setCachedTotalToOpen] = useState<number | null>(
    null,
  );
  const [isClearing, setIsClearing] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);


  // 计算进度数据（带memoization）
  const progressData = useMemo(() => {
    const total = cachedTotalToOpen || urls.length;
    const percent = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 0;
    
    return {
      total,
      percent,
      displayPercent: percent,
      displayProgress: `${progress}/${total}`,
      shouldShowProgress: isOpening || progress > 0 || (isTerminated && progress > 0)
    };
  }, [progress, cachedTotalToOpen, urls.length, isOpening, isTerminated]);

  // 简化的插件检测函数
  const checkPlugin = useCallback(() => {
    logger.info('🔍 简化插件检测...');
    const extWindow = window as ExtendedWindow & {
      backgroundOpenContentScriptLoaded?: boolean;
      backgroundOpenExtensionId?: string;
    };
    
    // 主要检测方法：检查window.backgroundOpenExtension变量
    if (
      typeof window !== "undefined" &&
      extWindow.backgroundOpenExtension &&
      extWindow.backgroundOpenExtension.id
    ) {
      logger.info('✅ 检测到插件:');
      setPluginDetected(true);
      return true;
    }
    
    // 备用检测：检查content script标记
    if (typeof window !== "undefined" && (
      document.querySelector('script[data-background-open]') || 
      window.hasOwnProperty('backgroundOpenContentScriptLoaded')
    )) {
      logger.info('✅ 检测到content script标记');
      setPluginDetected(true);
      return true;
    }
    
    logger.info('❌ 未检测到插件，可能需要手动激活');
    setPluginDetected(false);
    return false;
  }, []);
  // 显示反馈信息
  const showFeedback = (
    type: "success" | "error" | "info",
    message: string,
  ) => { 
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000); // 5秒后自动消失
  };

  // 页面加载时立即检测插件
  useEffect(() => {
    // 延迟检测，确保页面完全加载
    const timer = setTimeout(() => {
      logger.info('🚀 页面加载完成，开始插件检测');
      checkPlugin();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [checkPlugin]);
  // 监听扩展检测事件
  useEffect(() => {
    function handleExtensionDetected(e: Event) {
      const customEvent = e as CustomEvent;
      (window as ExtendedWindow).backgroundOpenExtension = {
          id: customEvent.detail.id
      };
      logger.info("✅ 页面端收到扩展事件");
      setPluginDetected(true); // 立即更新状态
    }
    
    window.addEventListener(
      "backgroundOpenExtensionDetected",
      handleExtensionDetected as EventListener
    );
    
    // 简化的检测机制：初始检测 + 延迟检测
    checkPlugin();
    
    // 延迟检测，应对页面加载时序问题
    const timeout1 = setTimeout(() => {
      logger.info("🕐 延迟检测（1秒后）");
      checkPlugin();
    }, 1000);
    
    const timeout2 = setTimeout(() => {
      logger.info("🕐 延迟检测（3秒后）");
      checkPlugin();
    }, 3000);
    
    return () => { 
      window.removeEventListener(
        "backgroundOpenExtensionDetected",
        handleExtensionDetected as EventListener);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, [checkPlugin]);
  // 监听批量打开进度和终止确认消息
  useEffect(() => {
    function handleProgressMsg(event: MessageEvent) {
      if (isTerminated) return; // 终止后忽略所有进度消息
      
      // 处理进度更新消息
      if (event.data && event.data.type === "BATCH_OPEN_PROGRESS") {
        const count = event.data.count || 0;
        const total = event.data.total || 1;
        setProgress(count); // 分子为已打开的URL个数
        // 使用扩展端发送的实际总数更新缓存
        setCachedTotalToOpen(total);
        setStatus(`已打开 ${count}/${total} 个标签页`);
        // 当进度达到100%时，只重置isOpening状态，保持进度条显示
        if (count >= total) {
          setTimeout(() => {
            setIsOpening(false);
            setStatus(`批量打开完成，共打开 ${total} 个标签页`);
          }, 1000); // 延迟1秒，让用户看到完成状态
        }
      }
      
      // 处理终止确认消息
      if (event.data && event.data.type === "BATCH_TERMINATE_CONFIRMED") {
        logger.info('收到终止确认消息:');
        setIsOpening(false);
        setIsTerminated(true);
        setStatus("批量打开已完全终止");
        showFeedback("success", event.data.message || "批量打开已完全终止");
      }
    }
    
    // 监听Chrome扩展消息
    function handleChromeMessage(
      message: { type?: string; message?: string }, 
      sender: unknown, 
      sendResponse: (response?: unknown) => void
    ) {
      if (message && message.type === "BATCH_TERMINATE_CONFIRMED") {
        logger.info('收到Chrome扩展终止确认:');
        setIsOpening(false);
        setIsTerminated(true);
        setStatus("批量打开已完全终止");
        showFeedback("success", message.message || "批量打开已完全终止");
      }
    }
    
    window.addEventListener("message", handleProgressMsg);
    
    // 监听Chrome扩展消息（如果可用）
    const windowWithChrome = window as any & { chrome?: {
        runtime?: {
          onMessage?: {
            addListener: (fn: typeof handleChromeMessage) => void;
            removeListener: (fn: typeof handleChromeMessage) => void;
           };
        };
      };
    };
    
    const chromeRuntime = windowWithChrome.chrome?.runtime;
    if (chromeRuntime?.onMessage) {
      chromeRuntime.onMessage.addListener(handleChromeMessage);
    }
    
    return () => {
      window.removeEventListener("message", handleProgressMsg);
      if (chromeRuntime?.onMessage) {
        chromeRuntime.onMessage.removeListener(handleChromeMessage);
      }
    };
  }, [isTerminated]);
  // 解析输入为URL数组
  const parseInput = (text: string): string[] => {
    return text
      .split(/\s|,|;|\n|\r/)
      .map((s: any) => s.trim())
      .filter((s: any) => s.length > 0 && /^https?:\/\//.test(s));
  };

  // 通用输入处理函数
  const handleInputChangeGeneric = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setInput(e.target.value);
    setUrls(parseInput(e.target.value));
    setError("");
  };

  // 清空输入和状态时，重置缓存分母
  const handleClear = () => {
    setIsClearing(true);
    // 不清空输入框内容，只关闭标签页
    // setInput(""); // 注释掉，不清空输入
    // setUrls([]); // 注释掉，不清空URL列表
    setProgress(0); // 重置进度条
    setStatus("");
    setError("");
    setPopupBlocked(false);
    setCachedTotalToOpen(null); // 清空缓存分母
    setIsOpening(false); // 立即关闭"打开中"状态
    abortRef.current = true;
    setIsTerminated(false); // 清空终止状态
    setTimeout(() => {
      abortRef.current = false;
      setIsClearing(false);
    }, 200); // 允许后续操作
    // 关闭所有已打开的标签页
    securePostMessage({ type: "BATCH_CLOSE_ALL_TABS" });
    for (const win of openedWindows.current) {
      try {
        win.close();
      } catch {}
    }
    openedWindows.current = [];
  };

  // 切换版本/模式时终止批量打开
  const handleSwitchVersion = (v: "basic" | "silent" | "autoclick") => {
    abortRef.current = true;
    setVersion(v);
    setTimeout(() => {
      abortRef.current = false;
    }, 100);
  };

  // 批量打开逻辑
  const handleBatchOpen = async () => {
    setError("");
    setStatus("");
    setPopupBlocked(false);
    setProgress(0); // 重置进度条
    setIsTerminated(false); // 重置终止状态
    setCachedTotalToOpen(null); // 重置缓存分母
    abortRef.current = false;
    // 关闭上次所有窗口
    for (const win of openedWindows.current) {
      try {
        win.close();
      } catch {}
    }
    openedWindows.current = [];

    if (urls.length === 0) {
      const errorMsg =
        getTranslation(t, "batchopen.error.no_urls") ||
        "请输入至少一个URL";
      setError(errorMsg);
      showFeedback("error", errorMsg);
      return;
    }
    // 移除输入数量限制
    // if (urls.length > MAX_TABS) {
    //   const errorMsg = getT(t, 'batchopen.error.too_many_urls')
    //     ? getT(t, 'batchopen.error.too_many_urls').replace('{max}', String(MAX_TABS))
    //     : `最多${MAX_TABS}个URL`;
    //   setError(errorMsg);
    //   showFeedback('error', errorMsg);
    //   return;
    // }
    setIsOpening(true);
    let blocked = false;
    const opened: Window[] = [];
    if (version === "basic") {
      // 初级版：检查并消费 token
      const tokenResult = await consumeTokens(
        'batchopen',
        'basic_batch_open',
        urls.length,
        {
          itemCount: urls.length,
          description: `批量打开 - ${urls.length}个URL`,
          onInsufficientBalance: () => {
            setError('Token余额不足，请充值后重试');
            showFeedback("error", 'Token余额不足，请充值后重试');
          }
        }
      );
      
      if (!tokenResult.success) {
        setIsOpening(false);
        return;
      }
      
      // 初级版：只打开一次
      for (let i = 0; i < urls.length; i++) {
        if (abortRef.current) break;
        const url = urls[i];
        const win: Window | null = window.open(url, "_blank");
        if (!win) {
          blocked = true;
          break;
        }
        opened.push(win);
        setProgress(i + 1); // 设置为实际打开的标签页数量
        await new Promise((res) => setTimeout(res, 200));
      }
      openedWindows.current = opened;
      // 延迟1秒后重置isOpening状态，让用户看到完成状态
      setTimeout(() => {
        setIsOpening(false);
        setStatus(`批量打开完成，共打开 ${opened.length} 个标签页`);
      }, 1000);
      if (blocked) {
        setPopupBlocked(true);
        const blockedMsg =
          getTranslation(t, "batchopen.status.popup_blocked") ||
          "弹窗被拦截，请允许弹窗后重试";
        setStatus(blockedMsg);
        showFeedback("error", blockedMsg);
      } else {
        const successMsg =
          getTranslation(t, "batchopen.status.success")?.replace(
            "{count}",
            String(opened.length),
          ) || `成功打开 ${opened.length} 个标签页`;
        setStatus(successMsg);
        showFeedback("success", successMsg);
      }
    }
    setIsOpening(false);
    if (blocked) {
      setPopupBlocked(true);
      setStatus(getTranslation(t, "batchopen.status.popup_blocked") || "弹窗被阻止");
    } else if (!abortRef.current) {
      setStatus(
        getTranslation(t, "batchopen.status.success")
          ? getTranslation(t, "batchopen.status.success").replace(
              "{count}",
              String(opened.length),
            )
          : `已打开${opened.length}个标签页`,
      );
    }
  };

  // 最可靠的终止处理函数 - 多层防护机制
  const handleTerminate = () => {
    logger.info('🛑 前端发起终止请求 - 启动多层防护机制');
    
    // 第1层：立即设置本地终止状态
    setIsOpening(false);
    setIsTerminated(true);
    abortRef.current = true;
    // 不重置进度条，保持当前进度显示
    // setProgress(0); // 注释掉，保留进度条
    setStatus("批量打开已终止");
    // 不清空缓存分母，保持进度条显示
    // setCachedTotalToOpen(null); // 注释掉，保留进度条
    
    let terminateConfirmed = false;
    
    // 第2层：Chrome扩展API终止（主要方法）
    if (typeof window !== 'undefined' && window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
      logger.info('📤 发送Chrome扩展终止消息');
      window.chrome.runtime.sendMessage(
        { action: "terminateBatchOpen" },
        (response: unknown) => {
          logger.info('📨 Chrome扩展终止响应:');
          const typedResponse = response as { success?: boolean; message?: string } | undefined;
          if (typedResponse && typedResponse.success) {
            terminateConfirmed = true;
            setStatus("批量打开已完全终止");
            showFeedback("success", typedResponse.message || "批量打开已成功终止");
          }
      });
    }
    
    // 第3层：PostMessage广播终止（兼容方法）
    if (typeof window !== 'undefined') {
      logger.info('📢 发送PostMessage终止广播');
      securePostMessage({ type: "BATCH_TERMINATE" });
    }
    
    // 第4层：超时保护机制 - 如果3秒内没有收到确认，强制显示终止状态
    setTimeout(() => {
      if (!terminateConfirmed) {
        logger.info('⏰ 终止超时保护触发');
        setStatus("批量打开已终止（超时保护）");
        showFeedback("info", "终止请求已发送，如仍有标签页打开请手动关闭");
      }
    }, 3000);
    
    // 第5层：立即反馈给用户
    showFeedback(
      "info",
      getTranslation(t, "batchopen.status.terminated") || "正在终止批量打开...",
    );
    
    logger.info('🔒 终止请求已发送，等待确认');
  };

  // 进度条显示位置调整：移到高级版本说明卡片下方
  // 进度计算公式调整：多URL模式=已打开/（有效URL数*循环次数），单URL模式=已打开/打开次数

  // 计算总数 - 优先使用缓存的实际总数
  const totalToOpen = cachedTotalToOpen || urls.length;

  // 进度百分比 - 确保不超过100%
  const progressPercent =
    totalToOpen > 0 ? Math.min(100, Math.round((progress / totalToOpen) * 100)) : 0;

  // 计算剩余时间 - 基于剩余未打开次数 * 间隔时间
  const calculateRemainingTime = () => {
    if (!isOpening || progress === 0 || !cachedTotalToOpen) {
      return null as any;
    }

    const total = cachedTotalToOpen;
    const remaining = total - progress;
    
    // 获取间隔时间
    let intervalSeconds = 0;
    
    // 基础版本假设1秒间隔
    intervalSeconds = 1;
    
    // 计算总剩余时间：剩余次数 * 间隔时间
    const remainingSeconds = remaining * intervalSeconds;
    
    if (remainingSeconds < 60) {
      return `约${remainingSeconds}秒`;
    } else if (remainingSeconds < 3600) {
      const minutes = Math.ceil(remainingSeconds / 60);
      return `约${minutes}分钟`;
    } else {
      const hours = Math.ceil(remainingSeconds / 3600);
      return `约${hours}小时`;
    }
  };

  const remainingTime = calculateRemainingTime();

  return (
    <section className="w-full">
      {/* 版本切换按钮 */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${version === "basic" ? UI_CONSTANTS.buttons.primary : UI_CONSTANTS.buttons.outline}`}
          onClick={() => handleSwitchVersion("basic")}
        >
          {getTranslation(t, "batchopen.basicVersion.title")}
        </button>
        <button
          className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${version === "silent" ? UI_CONSTANTS.buttons.primary : UI_CONSTANTS.buttons.outline}`}
          onClick={() => handleSwitchVersion("silent")}
        >
          {getTranslation(t, "batchopen.silentVersion.title")}
        </button>
        <button
          className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${version === "autoclick" ? UI_CONSTANTS.buttons.primary : UI_CONSTANTS.buttons.outline} relative`}
          onClick={() => handleSwitchVersion("autoclick")}
        >
          {getTranslation(t, "batchopen.autoclickVersion.title")}
          <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">
            New
          </span>
        </button>
      </div>
      <div className={`${UI_CONSTANTS.cards.simple} p-8 mb-8`}>
        {version === "silent" ? (
          // 静默版本使用独立的组件
          <SilentBatchOpen locale={locale} t={t} />
        ) : version === "autoclick" ? (
          // 自动化版本使用独立的组件
          <AutoClickBatch locale={locale} t={t} />
        ) : (
          // 基础版本使用原有逻辑
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left: Main functionality */}
            <div className="flex-1 min-w-0">
              <h2 className={UI_CONSTANTS.typography.h3 + " mb-4"}>
                {getTranslation(t, "batchopen.title")}
              </h2>
              <p className={UI_CONSTANTS.typography.body + " mb-6"}>{getTranslation(t, "batchopen.desc")}</p>
              {/* 反馈信息 */}
            {feedback && (
              <div
                className={`mb-4 p-3 rounded-lg text-sm ${
                  feedback.type === "success"
                    ? "bg-green-100 text-green-800 border border-green-200"
                    : feedback.type === "error"
                      ? "bg-red-100 text-red-800 border border-red-200"
                      : "bg-blue-100 text-blue-800 border border-blue-200"
                }`}
              >
                {feedback.message}
              </div>
            )}

            {/* 输入区 */}
            <div className="mb-6">
              <h3 className={UI_CONSTANTS.typography.h4 + " mb-3"}>
                {getTranslation(t, "batchopen.input.title")}
              </h3>
              <p className={UI_CONSTANTS.typography.small + " mb-4"}>
                {getTranslation(t, "batchopen.input.description")}
              </p>
              <textarea
                  className="w-full min-h-[120px] border-2 border-gray-200 rounded-xl p-4 mb-4 focus:border-blue-500 focus:outline-none transition-colors resize-none"
                  placeholder={getTranslation(t, "batchopen.input.placeholder")}
                  value={input}
                  onChange={handleInputChangeGeneric}
                />
              <div className="mb-4 text-sm text-gray-500 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                {`${urls.length} 个URL`}
              </div>
            </div>

            {/* 操作按钮区域 */}
            <div className="mb-6">
              <div className="flex gap-4 mb-4">
                <ProtectedButton
                  featureName="batchopen"
                  className={`${UI_CONSTANTS.buttons.primary} disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                  onClick={handleBatchOpen}
                  disabled={
                    isOpening ||
                    urls.length === 0
                  }
                >
                  {isOpening ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {getTranslation(t, "batchopen.btn.opening")}
                    </>
                  ) : (
                    getTranslation(t, "batchopen.btn.open")
                  )}
                </ProtectedButton>
                <button
                  className={`${UI_CONSTANTS.buttons.outline} disabled:opacity-50 disabled:cursor-not-allowed`}
                  onClick={handleClear}
                  disabled={isOpening}
                >
                  {getTranslation(t, "batchopen.btn.clear")}
                </button>
              </div>
              <p className={UI_CONSTANTS.typography.caption + " flex items-center gap-2"}>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                {getTranslation(t, "batchopen.btn.tip")}
              </p>
            </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-bold text-sm">!</span>
                </div>
                <p className="text-red-800 text-sm font-medium">{error}</p>
              </div>
            </div>
          )}
            {popupBlocked && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 font-bold text-sm">!</span>
                  </div>
                  <p className="text-orange-800 text-sm font-medium">{getTranslation(t, "batchopen.status.popup_blocked_tip")}</p>
                </div>
              </div>
            )}
            {/* 已移除最多标签页提示 */}
          </div>
          {/* Right: Basic version tips and steps */}
          {version === "basic" && (
            <div className="flex-1 min-w-0">
              {/* 主标题 */}
              <h3 className="text-xl font-bold mb-6 text-slate-900 border-b border-slate-200 pb-2">
                {getTranslation(t, "batchOpenSection.basicVersion.title")}
              </h3>
              <div className="space-y-5">
                {/* 提示说明 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 text-base">💡</span>
                    <div>
                      <h4 className="font-semibold text-blue-900 text-base mb-2">功能说明</h4>
                      <p className="text-blue-800 text-base leading-relaxed">
                        {getTranslation(t, "batchOpenSection.basicVersion.tip")}
                      </p>
                    </div>
                  </div>
                </div>
                {/* 操作步骤 */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 text-base mb-3 flex items-center gap-2">
                    <span className="text-gray-600">📋</span>
                    {getTranslation(t, "batchOpenSection.basicVersion.steps.title")}
                  </h4>
                  <ol className="list-decimal list-inside text-gray-700 text-sm leading-relaxed space-y-2">
                    <li className="pl-1">
                      {getTranslation(t, "batchOpenSection.basicVersion.steps.step1")}
                    </li>
                    <li className="pl-1">
                      {getTranslation(t, "batchOpenSection.basicVersion.steps.step2")}
                    </li>
                    <li className="pl-1">
                      {getTranslation(t, "batchOpenSection.basicVersion.steps.step3")}
                    </li>
                  </ol>
                </div>
              </div>
              {/* 初级版进度条显示在右侧说明栏下方 */}
              <SimpleProgressBar
                progress={progress}
                total={cachedTotalToOpen || urls.length}
                isOpening={isOpening}
                isTerminated={isTerminated}
                className="mt-8 mb-2 px-2"
              />
            </div>
          )}
          
          </div>
        )}
        </div>
    </section>
  );
});

BatchOpenSection.displayName = 'BatchOpenSection';

export default BatchOpenSection;
