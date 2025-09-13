// 类型定义
interface PageConfig {
  path: string;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  lastModified: Date;
  multilingual: boolean;
  future?: boolean;
}

interface SitemapConfig {
  path: string;
  description: string;
  cacheTime: number;
  future?: boolean;
}

import { APP_CONFIG } from "./config/index";

// Sitemap和SEO配置文件
export const sitemapConfig = {
  // 基础配置
  baseUrl: APP_CONFIG.site.url,
  defaultLanguage: "zh-CN",
  supportedLanguages: ["en", "zh-CN", "zh-TW", "zh-HK", "zh"],

  // 页面配置
  pages: {
    homepage: {
      path: "/",
      priority: 1.0,
      changeFrequency: "daily" as const,
      lastModified: new Date("2025-01-27"),
      multilingual: true,
    },
    manual: {
      path: "/manual",
      priority: 0.9,
      changeFrequency: "weekly" as const,
      lastModified: new Date("2025-01-27"),
      multilingual: true,
    },
    apiDocs: {
      path: "/api-docs",
      priority: 0.7,
      changeFrequency: "monthly" as const,
      lastModified: new Date("2025-01-27"),
      multilingual: true,
      future: true, // 标记为未来功能
    },
    privacy: {
      path: "/privacy",
      priority: 0.3,
      changeFrequency: "yearly" as const,
      lastModified: new Date("2025-01-27"),
      multilingual: true,
      future: true,
    },
    terms: {
      path: "/terms",
      priority: 0.3,
      changeFrequency: "yearly" as const,
      lastModified: new Date("2025-01-27"),
      multilingual: true,
      future: true,
    },
    about: {
      path: "/about",
      priority: 0.5,
      changeFrequency: "monthly" as const,
      lastModified: new Date("2025-01-27"),
      multilingual: true,
      future: true,
    },
    blog: {
      path: "/blog",
      priority: 0.8,
      changeFrequency: "daily" as const,
      lastModified: new Date("2025-01-27"),
      multilingual: true,
      future: true,
    },
    faq: {
      path: "/faq",
      priority: 0.6,
      changeFrequency: "monthly" as const,
      lastModified: new Date("2025-01-27"),
      multilingual: true,
      future: true,
    },
    contact: {
      path: "/contact",
      priority: 0.4,
      changeFrequency: "monthly" as const,
      lastModified: new Date("2025-01-27"),
      multilingual: true,
      future: true,
    },
  },

  // Sitemap文件配置
  sitemaps: {
    main: {
      path: "/sitemap.xml",
      description: "主要页面sitemap",
      cacheTime: 86400, // 24小时
    },
    images: {
      path: "/sitemap-images.xml",
      description: "图片sitemap",
      cacheTime: 86400,
    },
    news: {
      path: "/sitemap-news.xml",
      description: "新闻sitemap",
      cacheTime: 3600, // 1小时
    },
    videos: {
      path: "/sitemap-videos.xml",
      description: "视频sitemap",
      cacheTime: 86400,
      future: true,
    },
    index: {
      path: "/sitemap-index.xml",
      description: "Sitemap索引文件",
      cacheTime: 86400,
    },
  },

  // 搜索引擎配置
  searchEngines: {
    google: {
      name: "Google",
      userAgent: "Googlebot",
      crawlDelay: 0.5,
      allowedPaths: ["/", "/manual", "/blog"],
      blockedPaths: ["/api/", "/_next/", "/admin/", "/private/"],
    },
    bing: {
      name: "Bing",
      userAgent: "Bingbot",
      crawlDelay: 1,
      allowedPaths: ["/", "/manual", "/blog"],
      blockedPaths: ["/api/", "/_next/", "/admin/", "/private/"],
    },
    baidu: {
      name: "Baidu",
      userAgent: "Baiduspider",
      crawlDelay: 2,
      allowedPaths: ["/", "/manual", "/blog"],
      blockedPaths: ["/api/", "/_next/", "/admin/", "/private/"],
    },
  },

  // 图片资源配置
  images: {
    favicon: {
      path: "/favicon.ico",
      alt: `${APP_CONFIG.site.name} Favicon`,
      title: `${APP_CONFIG.site.name} Logo`,
    },
    appleTouchIcon: {
      path: "/apple-touch-icon.png",
      alt: `${APP_CONFIG.site.name} Apple Touch Icon`,
      title: `${APP_CONFIG.site.name} Apple Icon`,
    },
    androidIcon192: {
      path: "/android-chrome-192x192.png",
      alt: `${APP_CONFIG.site.name} Android Icon 192x192`,
      title: `${APP_CONFIG.site.name} Android Icon`,
    },
    androidIcon512: {
      path: "/android-chrome-512x512.png",
      alt: `${APP_CONFIG.site.name} Android Icon 512x512`,
      title: `${APP_CONFIG.site.name} High-res Android Icon`,
    },
  },

  // Google Search Console 配置
  googleSearchConsole: {
    verificationCode: "google-site-verification=YOUR_VERIFICATION_CODE_HERE",
    sitemapSubmissionUrls: [
      `${APP_CONFIG.site.url}/sitemap.xml`,
      `${APP_CONFIG.site.url}/sitemap-images.xml`,
      `${APP_CONFIG.site.url}/sitemap-news.xml`,
    ],
  },

  // 其他搜索引擎验证
  searchEngineVerification: {
    bing: "YOUR_BING_VERIFICATION_CODE_HERE",
    yandex: "YOUR_YANDEX_VERIFICATION_CODE_HERE",
    baidu: "YOUR_BAIDU_VERIFICATION_CODE_HERE",
  },
};

// 工具函数
export const sitemapUtils = { // 获取所有当前可用页面（排除future标记的页面）
  getCurrentPages() {
    return Object.entries(sitemapConfig.pages)
      .filter(([, config]: any) => !(config as PageConfig).future)
      .map(([key, config]: any) => ({ key, ...config }));
  },

  // 生成多语言URL
  generateLanguageAlternates(path: string) {
    const alternates: Record<string, string> = {};
    for (const lang of sitemapConfig.supportedLanguages) {
      alternates[lang] = `${sitemapConfig.baseUrl}${path}`;
    }
    return alternates;
  },

  // 格式化最后修改时间
  formatLastModified(date: Date) {
    return date.toISOString();
  },

  // 验证sitemap URL
  validateSitemapUrl(url: string) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  // 获取所有sitemap URL
  getAllSitemapUrls() {
    return Object.values(sitemapConfig.sitemaps)
      .filter((sitemap: any) => !(sitemap as SitemapConfig).future)
      .map((sitemap: any) => `${sitemapConfig.baseUrl}${sitemap.path}`);
  },
};
