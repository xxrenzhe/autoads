import { APP_CONFIG } from "@/lib/config";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = APP_CONFIG.site.url;
  const currentDate = new Date();

  // 设置不同类型页面的最后修改时间
  const lastModifiedDates = {
    homepage: new Date("2025-01-27"), // 最近更新日期
    manual: new Date("2025-01-27"), // 手册页面更新日期
  };

  return [
    // 首页 - 最高优先级
    {
      url: baseUrl,
      lastModified: lastModifiedDates.homepage,
      changeFrequency: "daily" as const,
      priority: 1.0,
      alternates: {
        languages: {
          en: `${baseUrl}`,
          "zh-CN": `${baseUrl}`,
          "zh-TW": `${baseUrl}`,
          "zh-HK": `${baseUrl}`,
          zh: `${baseUrl}`,
        },
      },
    },

    // 用户手册页面 - 高优先级
    {
      url: `${baseUrl}/manual`,
      lastModified: lastModifiedDates.manual,
      changeFrequency: "weekly" as const,
      priority: 0.9,
      alternates: {
        languages: {
          en: `${baseUrl}/manual`,
          "zh-CN": `${baseUrl}/manual`,
          "zh-TW": `${baseUrl}/manual`,
          "zh-HK": `${baseUrl}/manual`,
          zh: `${baseUrl}/manual`,
        },
      },
    },

    // API 文档页面（未来扩展）
    {
      url: `${baseUrl}/api-docs`,
      lastModified: currentDate,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      alternates: {
        languages: {
          en: `${baseUrl}/api-docs`,
          "zh-CN": `${baseUrl}/api-docs`,
          zh: `${baseUrl}/api-docs`,
        },
      },
    },

    // 隐私政策页面（未来扩展）
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: "yearly" as const,
      priority: 0.3,
      alternates: {
        languages: {
          en: `${baseUrl}/privacy`,
          "zh-CN": `${baseUrl}/privacy`,
          zh: `${baseUrl}/privacy`,
        },
      },
    },

    // 服务条款页面（未来扩展）
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: "yearly" as const,
      priority: 0.3,
      alternates: {
        languages: {
          en: `${baseUrl}/terms`,
          "zh-CN": `${baseUrl}/terms`,
          zh: `${baseUrl}/terms`,
        },
      },
    },

    // 关于我们页面（未来扩展）
    {
      url: `${baseUrl}/about`,
      lastModified: currentDate,
      changeFrequency: "monthly" as const,
      priority: 0.5,
      alternates: {
        languages: {
          en: `${baseUrl}/about`,
          "zh-CN": `${baseUrl}/about`,
          zh: `${baseUrl}/about`,
        },
      },
    },

    // 博客首页（未来扩展）
    {
      url: `${baseUrl}/blog`,
      lastModified: currentDate,
      changeFrequency: "daily" as const,
      priority: 0.8,
      alternates: {
        languages: {
          en: `${baseUrl}/blog`,
          "zh-CN": `${baseUrl}/blog`,
          zh: `${baseUrl}/blog`,
        },
      },
    },

    // FAQ页面（未来扩展）
    {
      url: `${baseUrl}/faq`,
      lastModified: currentDate,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      alternates: {
        languages: {
          en: `${baseUrl}/faq`,
          "zh-CN": `${baseUrl}/faq`,
          zh: `${baseUrl}/faq`,
        },
      },
    },

    // 联系我们页面（未来扩展）
    {
      url: `${baseUrl}/contact`,
      lastModified: currentDate,
      changeFrequency: "monthly" as const,
      priority: 0.4,
      alternates: {
        languages: {
          en: `${baseUrl}/contact`,
          "zh-CN": `${baseUrl}/contact`,
          zh: `${baseUrl}/contact`,
        },
      },
    },
  ];
}
