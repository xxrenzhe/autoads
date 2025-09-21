// Unified application configuration
import { getDomainConfig } from '../domain-config';
import { getCachedRemoteConfig, getConfigValue } from './remote-config';

// Base configurations for different domains
const DOMAIN_BASE_CONFIGS = {
  autoads: {
    site: {
      name: "AutoAds",
      title: "AutoAds - 一站式自动化营销平台 | 真实点击、网站排名分析、智能广告投放",
      description: "AutoAds是一站式自动化营销平台，提供真实点击、网站排名分析、智能广告投放三大核心功能。支持批量URL打开、PageRank评估、自动化广告管理、数据导出等，助力企业提升数字营销效率。",
      email: "contact@autoads.dev",
      github: "https://github.com/autoads-dev",
      twitter: "https://twitter.com/autoads_dev",
    },
  },
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

export const APP_CONFIG = {
  // Site Configuration - dynamically based on domain
  get site() {
    const domainConfig = getDomainConfig();
    const isUrlChecker = domainConfig.domain.includes('urlchecker.dev');
    const baseConfig = isUrlChecker ? DOMAIN_BASE_CONFIGS.urlchecker : DOMAIN_BASE_CONFIGS.autoads;
    
    return {
      ...baseConfig.site,
      url: domainConfig.baseUrl,
    };
  },

  // API Configuration
  api: {
    get baseUrl() {
      const domainConfig = getDomainConfig();
      return process.env.NEXT_PUBLIC_API_BASE_URL || `${domainConfig.baseUrl}/api`;
    },
    timeout: 30000,
    retries: 3,
    rateLimit: {
      requests: 100,
      window: 60000,
    },
  },

  // External API Configuration
  external: {
    similarWeb: {
      get apiUrl() {
        const snap = getCachedRemoteConfig();
        // 优先远端聚合配置（Go 的 Config.APIs.SimilarWeb.BaseURL）
        const remote = snap ? getConfigValue<string>('APIs.SimilarWeb.BaseURL', snap) : undefined;
        return remote || process.env.NEXT_PUBLIC_SIMILARWEB_API_URL || "https://data.similarweb.com/api/v1/data";
      },
      get timeout() {
        const snap = getCachedRemoteConfig();
        // 优先远端 HTTP 超时（Config.HTTP.Timeout，单位 ms）
        const remote = snap ? getConfigValue<number>('HTTP.Timeout', snap) : undefined;
        const envVal = parseInt(process.env.NEXT_PUBLIC_SIMILARWEB_TIMEOUT || "30000");
        return (typeof remote === 'number' && Number.isFinite(remote)) ? remote : envVal;
      },
    },
    googleAds: {
      apiUrl: "https://googleads.googleapis.com",
      version: process.env.NEXT_PUBLIC_GOOGLE_ADS_API_VERSION || "v14",
      timeout: 30000,
    },
    adsPower: {
      apiUrl: process.env.NEXT_PUBLIC_ADSPOWER_API_URL || "http://local.adspower.net:50325",
      timeout: 10000,
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

  // Performance Configuration
  performance: {
    maxConcurrentRequests: 10,
    requestDelay: 100,
    cacheTimeout: 300000,
    maxCacheSize: 1000,
  },

  // Security Configuration
  security: {
    allowedDomains: ["*"],
    blockedDomains: [],
    maxUrlLength: 2048,
    validateUrls: true,
    sanitizeInput: true,
  },

  // SEO Configuration - dynamically based on domain
  get seo() {
    const domainConfig = getDomainConfig();
    const isUrlChecker = domainConfig.domain.includes('urlchecker.dev');
    
    if (isUrlChecker) {
      return {
        defaultTitle: "URLChecker.dev - 专业URL批量检测工具 | 网站状态监控解决方案",
        defaultDescription: "URLChecker.dev是专业的URL批量检测工具，提供网站状态监控、批量链接检查、HTTP状态码检测、重定向跟踪等功能。支持大规模URL处理，实时监控网站可用性。",
        defaultKeywords: "URL批量检测,网站状态监控,链接检查,HTTP状态码,重定向跟踪,批量URL处理,网站可用性监控,404检测,链接有效性检查,网站健康检查,SEO工具,网站分析,链接管理,自动化检测,URL监控",
        defaultImage: "/og-image.png",
        twitterHandle: "@urlchecker_dev",
        siteName: "URLChecker",
      };
    }
    
    return {
      defaultTitle: "AutoAds - 一站式自动化营销平台 | 专业数字营销解决方案",
      defaultDescription: "AutoAds一站式自动化营销平台，集成真实点击、网站排名分析、智能广告投放三大核心功能。提供批量URL打开、PageRank评估、自动化广告管理、数据导出等专业服务，助力企业提升数字营销效率。",
      defaultKeywords: "自动化营销平台, 数字营销, 真实点击, 网站排名分析, 智能广告投放, 批量URL打开, PageRank评估, 自动化广告管理, 数据导出, Chrome扩展, 营销自动化, 数字营销工具, 广告投放优化, 网站权威度分析, 批量链接处理, 营销效率提升, 自动化营销解决方案, 数字营销平台, 广告管理工具, 网站分析工具",
      defaultImage: "/og-image.png",
      twitterHandle: "@autoads_dev",
      siteName: "AutoAds",
    };
  },
};

// 辅助函数
export const getFullUrl = (path: string) => {
  return `${APP_CONFIG.site.url}${path}`;
};

export type AppConfig = typeof APP_CONFIG;
