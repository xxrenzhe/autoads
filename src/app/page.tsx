import HomePage from "./HomePage";
import { Metadata } from "next";
import { APP_CONFIG } from "@/lib/config";

export const metadata: Metadata = {
  title: "AutoAds - 一站式自动化营销平台 | 专业数字营销解决方案",
  description: "AutoAds一站式自动化营销平台，集成真实点击、网站排名分析、智能广告投放三大核心功能。提供云端真实访问、代理IP轮换、自定义Referer、PageRank评估、自动化广告管理、数据导出等专业服务，助力企业提升数字营销效率。",
  keywords: [
    "自动化营销平台",
    "数字营销",
    "真实点击",
    "网站排名分析", 
    "智能广告投放",
    "云端真实访问",
    "PageRank评估",
    "自动化广告管理",
    "数据导出",
    "Chrome扩展",
    "营销自动化",
    "数字营销工具",
    "广告投放优化",
    "网站权威度分析",
    "代理IP轮换",
    "营销效率提升"
  ],
  openGraph: {
    title: "AutoAds - 一站式自动化营销平台",
    description: "集成真实点击、网站排名分析、智能广告投放三大核心功能，助力企业提升数字营销效率",
    type: "website",
    url: APP_CONFIG.site.url,
    siteName: "AutoAds",
    images: [
      {
        url: `${APP_CONFIG.site.url}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "AutoAds - 一站式自动化营销平台",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AutoAds - 一站式自动化营销平台",
    description: "集成真实点击、网站排名分析、智能广告投放三大核心功能，助力企业提升数字营销效率",
    images: [`${APP_CONFIG.site.url}/og-image.png`],
    creator: "@autoads_dev",
  },
  alternates: {
    canonical: APP_CONFIG.site.url,
  },
};

export default function Page() {
  return <HomePage />;
}
