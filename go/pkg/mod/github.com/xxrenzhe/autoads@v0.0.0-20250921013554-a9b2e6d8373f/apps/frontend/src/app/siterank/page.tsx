import { Metadata } from "next";
import { APP_CONFIG } from "@/lib/config";
import SiteRankClient from "./SiteRankClient";

export const metadata: Metadata = {
  title: "网站排名分析 - AutoAds自动化营销平台",
  description: "专业的网站排名分析工具，提供全球排名查询、PageRank评分、优先级计算、数据导出功能。智能评估网站权威度，助力营销决策。",
  keywords: [
    "网站排名分析",
    "全球排名查询",
    "PageRank评分",
    "优先级计算",
    "网站权威度评估",
    "网站分析工具",
    "排名查询工具",
    "网站权威度分析",
    "PageRank评估",
    "网站排名工具",
    "域名排名分析",
    "网站分析平台"
  ],
  openGraph: {
    title: "网站排名分析 - AutoAds自动化营销平台",
    description: "专业的网站排名分析工具，提供全球排名查询、PageRank评分、优先级计算、数据导出功能",
    type: "website",
    url: `${APP_CONFIG.site.url}/siterank`,
    siteName: "AutoAds",
    images: [
      {
        url: `${APP_CONFIG.site.url}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "网站排名分析工具",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "网站排名分析 - AutoAds自动化营销平台",
    description: "专业的网站排名分析工具，提供全球排名查询、PageRank评分、优先级计算、数据导出功能",
    images: [`${APP_CONFIG.site.url}/og-image.png`],
    creator: "@autoads_dev",
  },
  alternates: {
    canonical: `${APP_CONFIG.site.url}/siterank`,
  },
};

export default function SiteRankPage() {
  return <SiteRankClient />;
}