import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import AppLayout from "@/components/AppLayout";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { APP_CONFIG } from "@/lib/config";
import { sanitizeHtml } from "@/lib/utils/security/sanitize";
import { AuthProvider } from "@/contexts/AuthContext";
import { SessionProvider } from "next-auth/react";
// 内存优化模块已移除
import "@/lib/scheduled-task-init";
import "@/lib/autoclick-init";
import QueryProvider from "@/components/providers/QueryProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: APP_CONFIG?.seo?.defaultTitle || "AutoAds.dev",
    template: `%s | ${APP_CONFIG?.site?.name || "AutoAds.dev"}`,
  },
  description:
    APP_CONFIG?.seo?.defaultDescription || "一站式自动化营销平台",
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
    "营销效率提升",
  ],
  authors: [{ name: APP_CONFIG?.site?.name || "AutoAds.dev" }],
  creator: APP_CONFIG?.site?.name || "AutoAds.dev",
  publisher: APP_CONFIG?.site?.name || "AutoAds.dev",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(APP_CONFIG?.site?.url || "https://autoads.dev"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_CONFIG?.site?.url || "https://autoads.dev",
    siteName: APP_CONFIG?.seo?.siteName || "AutoAds.dev",
    title: APP_CONFIG?.seo?.defaultTitle || "AutoAds.dev",
    description:
      APP_CONFIG?.seo?.defaultDescription || "一站式自动化营销平台",
    images: [
      {
        url: APP_CONFIG?.seo?.defaultImage || "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${APP_CONFIG?.site?.name || "AutoAds.dev"} - 一站式自动化营销平台`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_CONFIG?.site?.name || "AutoAds.dev"} - 一站式自动化营销平台`,
    description:
      "AutoAds一站式自动化营销平台，集成真实点击、网站排名分析、智能广告投放三大核心功能，助力企业提升数字营销效率",
    images: [APP_CONFIG?.seo?.defaultImage || "/og-image.png"],
    creator: APP_CONFIG?.seo?.twitterHandle || "@autoads_dev",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3B82F6" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="https://autoads.dev/" />
        <link rel="alternate" href="https://autoads.dev/" hrefLang="en" />
        <link rel="alternate" href="https://autoads.dev/zh" hrefLang="zh" />
        
        {/* Google Analytics */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.GA_ID || 'G-F1HVLMDMV0'}`}
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${process.env.GA_ID || 'G-F1HVLMDMV0'}');
            `,
          }}
        />
        
        <script
          type="application/ld+json"
          // 使用sanitizeHtml确保结构化数据的安全性
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(
              ((
                (globalThis as Record<string, unknown>).metadata as Record<
                  string,
                  Record<string, unknown>
                >
              )?.other?.["jsonld-website"] as string) || "",
              {
                ALLOWED_TAGS: [], // JSON-LD不应包含HTML标签
                ALLOWED_ATTR: []
              }
            ),
          }}
        />
      </head>
      <body className={inter.className}>
        <SessionProvider>
          <AuthProvider>
            <LanguageProvider>
              <QueryProvider>
                <AppLayout>{children}</AppLayout>
              </QueryProvider>
            </LanguageProvider>
          </AuthProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
