// Google Analytics配置和工具函数

// 声明gtag类型
declare global {
  interface Window {
    gtag: (
      command: "config" | "event" | "js",
      targetId: string | Date,
      config?: Record<string, string | number | boolean>,
    ) => void;
    GA_TRACKING_ID?: string;
    isGAEnabled?: boolean;
  }
}

// 获取GA追踪ID - 现在使用运行时配置
export const getGA_TRACKING_ID = (): string | undefined => {
  if (typeof window === 'undefined') {
    // 服务器端
    return process.env.GA_ID || process.env.NEXT_PUBLIC_GA_ID;
  }
  
  // 客户端 - 从运行时配置获取
  return (window as any).__RUNTIME_CONFIG__?.GA_ID;
};

// 检查是否有GA ID（开发和生产环境都启用）
export const isGAEnabled = (): boolean => {
  // 检查是否启用了分析功能
  if (typeof window !== 'undefined') {
    const config = (window as any).__RUNTIME_CONFIG__;
    if (config && config.ENABLE_ANALYTICS === false) {
      return false;
    }
  }
  return Boolean(getGA_TRACKING_ID());
};

// 在开发环境中暴露到全局变量用于调试
if (typeof window !== 'undefined') {
  (window as any).getGA_TRACKING_ID = getGA_TRACKING_ID;
  (window as any).isGAEnabled = isGAEnabled;
}

// 页面浏览事件
export const pageview = (url: string) => { 
  const GA_TRACKING_ID = getGA_TRACKING_ID();
  if (!isGAEnabled() || typeof window === "undefined" || !window.gtag || !GA_TRACKING_ID) return;

  window.gtag("config", GA_TRACKING_ID, {
    page_path: url,
  });
};

// 自定义事件跟踪
export const event = ({
  action,
  category,
  label,
  value,
}: { action: string;
  category: string;
  label?: string;
  value?: number }) => {
  const GA_TRACKING_ID = getGA_TRACKING_ID();
  if (!isGAEnabled() || typeof window === "undefined" || !window.gtag || !GA_TRACKING_ID) return;

  const config: Record<string, string | number | boolean> = {
    event_category: category,
  };

  if (label !== undefined) {
    config.event_label = label;
  }

  if (value !== undefined) {
    config.value = value;
  }

  window.gtag("event", action, config);
};

// 用户行为事件
export const trackUserAction = (
  action: string,
  details?: Record<string, unknown>,
) => { 
  event({
    action,
    category: "User Interaction",
    label: details ? JSON.stringify(details) : undefined,
  });
};

// URL处理相关事件
export const trackUrlProcessing = (action: string, count?: number) => {
  event({
    action,
    category: "URL Processing",
    label: `URLs: ${count || 0}`,
    value: count,
  });
};

// 重定向检测事件
export const trackRedirectDetection = (
  method: string,
  success: boolean,
  count?: number,
) => {
  event({
    action: success
      ? "redirect_detection_success"
      : "redirect_detection_failure",
    category: "Redirect Detection",
    label: `Method: ${method}, Count: ${count || 0}`,
    value: count,
  });
};

// 导出功能事件
export const trackExport = (format: string, count: number) => {
  event({
    action: "export_data",
    category: "Data Export",
    label: `Format: ${format}`,
    value: count,
  });
};
