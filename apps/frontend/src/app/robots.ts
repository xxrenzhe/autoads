import { APP_CONFIG } from "@/lib/config";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = APP_CONFIG.site.url;

  return {
    rules: [
      // 允许所有搜索引擎访问
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/", // API路由不需要索引
          "/_next/", // Next.js内部文件
          "/admin/", // 旧管理路径，保持屏蔽
          "/ops/",   // 管理网关，仅供管理员直达
          "/monitoring/", // 监控页面不对外索引
          "/test-environment/", // 测试环境页面不对外索引
          "/private/", // 私有内容（未来可能添加）
          "*.json", // JSON文件
          "/sitemap-*.xml", // 子sitemap文件（只索引主sitemap）
        ],
        crawlDelay: 1, // 爬虫延迟1秒，对服务器友好
      },

      // Google搜索引擎特殊规则
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/api/", "/_next/", "/admin/", "/ops/", "/monitoring/", "/test-environment/", "/private/"],
        crawlDelay: 0.5, // Google可以更频繁地爬取
      },

      // Bing搜索引擎特殊规则
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: ["/api/", "/_next/", "/admin/", "/ops/", "/monitoring/", "/test-environment/", "/private/"],
        crawlDelay: 1,
      },

      // 百度搜索引擎特殊规则
      {
        userAgent: "Baiduspider",
        allow: "/",
        disallow: ["/api/", "/_next/", "/admin/", "/ops/", "/monitoring/", "/test-environment/", "/private/"],
        crawlDelay: 2, // 百度爬虫较慢一些
      },

      // 限制一些不需要的爬虫
      {
        userAgent: ["SemrushBot", "AhrefsBot", "MJ12bot", "DotBot"],
        disallow: "/",
      },
    ],

    // 指向我们的sitemap文件
    sitemap: [
      `${baseUrl}/sitemap.xml`, // 主要页面sitemap
      `${baseUrl}/sitemap-index.xml`, // sitemap索引文件
      `${baseUrl}/sitemap-images.xml`, // 图片sitemap
    ],

    // 主机地址（可选，但推荐）
    host: baseUrl,
  };
}
