// 应用配置文件 - 统一管理所有硬编码常量
import { getDomainConfig, DOMAIN_CONFIG } from './domain-config';

// 基础配置
const BASE_CONFIG = {
  // AutoAds 配置
  autoads: {
    site: {
      name: "AutoAds",
      title: "AutoAds - 一站式自动化营销平台 | 真实点击、网站排名分析、智能广告投放",
      description: "AutoAds是一站式自动化营销平台，提供真实点击、网站排名分析、智能广告投放三大核心功能。支持云端真实访问、代理IP轮换、自定义Referer、PageRank评估、自动化广告管理、数据导出等，助力企业提升数字营销效率。",
      email: "contact@autoads.dev",
      github: "https://github.com/autoads-dev",
      twitter: "https://twitter.com/autoads_dev",
    },
  },
  
  // URLChecker 配置
  urlchecker: {
    site: {
      name: "URLChecker",
      title: "URLChecker.dev - 专业URL批量检测工具 | 网站状态监控、批量链接检查",
      description: "URLChecker.dev是专业的URL批量检测工具，提供网站状态监控、批量链接检查、HTTP状态码检测、重定向跟踪等功能。支持大规模URL处理，实时监控网站可用性。",
      email: "contact@urlchecker.dev",
      github: "https://github.com/xxrenzhe/url-batch-checker",
      twitter: "https://twitter.com/urlchecker_dev",
    },
  },
};

// 动态获取当前域名的配置
export const APP_CONFIG = {
  get site() {
    const domainConfig = getDomainConfig();
    const isUrlChecker = domainConfig.domain.includes('urlchecker.dev');
    const config = isUrlChecker ? BASE_CONFIG.urlchecker : BASE_CONFIG.autoads;
    
    return {
      ...config.site,
      url: domainConfig.baseUrl,
    };
  },
  
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || (() => {
      const domainConfig = getDomainConfig();
      return `${domainConfig.baseUrl}/api`;
    })(),
    timeout: 30000,
    retries: 3,
    rateLimit: {
      requests: 100,
      window: 60000, // 1 minute
    },
  },

  // URL Processing Configuration
  urlProcessing: {
    maxUrls: 1000,
    batchSize: 50,
    timeout: 10000,
    maxRetries: 3,
    userAgent: "AutoAds-Dev/1.0 (Professional URL Analysis Tool)",
  },

  // API Services Configuration
  urlAnalysisAPIs: {
    whereisit: "https://api.whereisit.io/url-analysis",
    httpstatus: "https://httpstatus.io/api/url-analysis",
    urlanalyzer: "https://api.urlanalyzer.com/v1/analysis",
    urlchecker: "https://api.urlchecker.com/v1/check",
  },

  // SimilarWeb API Configuration
  similarWeb: {
    apiUrl: process.env.NEXT_PUBLIC_SIMILARWEB_API_URL || "https://data.similarweb.com/api/v1/data",
    timeout: parseInt(process.env.NEXT_PUBLIC_SIMILARWEB_TIMEOUT || "30000"),
  },

  // Performance Configuration
  performance: {
    maxConcurrentRequests: 10,
    requestDelay: 100,
    cacheTimeout: 300000, // 5 minutes
    maxCacheSize: 1000,
  },

  // Export Configuration
  export: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    supportedFormats: ["txt", "csv", "json"],
    defaultFormat: "csv",
    includeHeaders: true,
    dateFormat: "YYYY-MM-DD HH:mm:ss",
  },

  // UI Configuration
  ui: {
    theme: {
      primary: "#3B82F6",
      secondary: "#1E40AF",
      accent: "#60A5FA",
      background: "#F8FAFC",
      surface: "#FFFFFF",
      text: "#1E293B",
      textSecondary: "#64748B",
    },
    layout: {
      maxWidth: "1200px",
      sidebarWidth: "280px",
      headerHeight: "64px",
      footerHeight: "80px",
    },
    animations: {
      duration: 300,
      easing: "ease-in-out",
    },
  },

  // Feature Flags
  features: {
    urlAnalysis: true,
    siteRanking: true,
    dataExport: true,
    chromeExtension: true,
    manualInput: true,
    realTimeUpdates: true,
    advancedAnalytics: false,
  },

  // Security Configuration
  security: {
    allowedDomains: ["*"],
    blockedDomains: [],
    maxUrlLength: 2048,
    validateUrls: true,
    sanitizeInput: true,
  },

  // Analytics Configuration
  analytics: {
    enabled: true,
    provider: "google",
    trackingId: process.env.NEXT_PUBLIC_GA_ID,
    anonymizeIp: true,
    respectDnt: true,
  },

  // SEO Configuration
  seo: {
    defaultTitle: "AutoAds - 一站式自动化营销平台 | 专业数字营销解决方案",
    defaultDescription:
      "AutoAds一站式自动化营销平台，集成真实点击、网站排名分析、智能广告投放三大核心功能。提供云端真实访问、代理IP轮换、自定义Referer、PageRank评估、自动化广告管理、数据导出等专业服务，助力企业提升数字营销效率。",
    defaultKeywords:
      "自动化营销平台, 数字营销, 真实点击, 网站排名分析, 智能广告投放, 云端真实访问, 代理IP轮换, 自定义Referer, PageRank评估, 自动化广告管理, 数据导出, Chrome扩展, 营销自动化, 数字营销工具, 广告投放优化, 网站权威度分析, 营销效率提升, 自动化营销解决方案, 数字营销平台, 广告管理工具, 网站分析工具",
    defaultImage: "/og-image.png",
    twitterHandle: "@autoads_dev",
    siteName: "AutoAds",
  },
};

// 类型导出
export type AppConfig = typeof APP_CONFIG;
export type SiteConfig = AppConfig["site"];
export type APIConfig = AppConfig["api"];
export type PerformanceConfig = AppConfig["performance"];

// 辅助函数
export const getFullUrl = (path: string) => {
  return `${APP_CONFIG.site.url}${path}`;
};

export const isValidUrl = (url: string): boolean => {
  return APP_CONFIG.security.validateUrls && /^https?:\/\/.+/.test(url);
};

export const ensureHttps = (url: string): string => {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `https://${url}`;
};
