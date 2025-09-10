import BatchOpenClientPage from "./BatchOpenClientPage";
import { Metadata } from "next";
import { APP_CONFIG } from "@/lib/config";

export const metadata: Metadata = {
  title: "真实点击 - AutoAds自动化营销平台",
  description: "零插件实现云端真实访问，支持代理IP轮换，Referer随心设置，真实模拟用户请求。高效处理数千个链接，大幅提升工作效率。",
  keywords: [
    "真实点击",
    "批量URL打开",
    "代理IP轮换",
    "真实访问",
    "云端点击",
    "批量链接处理",
    "模拟用户行为",
    "自动化访问",
    "链接批量打开",
    "点击工具"
  ],
  openGraph: {
    title: "真实点击 - AutoAds自动化营销平台",
    description: "零插件实现云端真实访问，支持代理IP轮换，Referer随心设置，真实模拟用户请求",
    type: "website",
    url: `${APP_CONFIG.site.url}/batchopen`,
    siteName: "AutoAds",
    images: [
      {
        url: `${APP_CONFIG.site.url}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "真实点击工具",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "真实点击 - AutoAds自动化营销平台",
    description: "零插件实现云端真实访问，支持代理IP轮换，Referer随心设置，真实模拟用户请求",
    images: [`${APP_CONFIG.site.url}/og-image.png`],
    creator: "@autoads_dev",
  },
  alternates: {
    canonical: `${APP_CONFIG.site.url}/batchopen`,
  },
};

export default function BatchOpenPage() {
  return <BatchOpenClientPage />;
}