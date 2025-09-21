// SEO配置生成器
import { APP_CONFIG, getFullUrl } from "./config/index";

// SEO配置生成器
export const generateSEO = ({
  title,
  description,
  path = "",
  image = "default",
  type = "website",
  locale = "en_US",
}: { title: string;
  description: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  locale?: string }) => {
  const url = getFullUrl(path);
  const imageUrl =
    image === "default"
      ? `${APP_CONFIG?.site?.url || "https://autoads.dev"}${APP_CONFIG?.seo?.defaultImage || "/og-image.png"}`
      : image.startsWith("http")
        ? image
        : `${APP_CONFIG?.site?.url || "https://autoads.dev"}${image}`;

  return {
    title,
    description,
    keywords:
      APP_CONFIG?.seo?.defaultKeywords ||
      "自动化营销平台, 数字营销, 真实点击, 网站排名分析, 智能广告投放",
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
      canonical: url,
    },
    openGraph: {
      type,
      locale,
      url,
      siteName: APP_CONFIG?.seo?.siteName || "AutoAds.dev",
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
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
};

// 结构化数据生成器
export const generateStructuredData = {
  // 网站应用结构化数据
  webApplication: () => ({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: APP_CONFIG?.site?.name || "AutoAds.dev",
    description:
      APP_CONFIG?.site?.description || "一站式自动化营销平台",
    url: APP_CONFIG?.site?.url || "https://autoads.dev",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web Browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Organization",
      name: APP_CONFIG?.site?.name || "AutoAds.dev",
      url: APP_CONFIG?.site?.url || "https://autoads.dev",
    },
    featureList: [
      "真实点击",
      "网站排名分析", 
      "智能广告投放",
      "批量URL打开",
      "PageRank评估",
      "自动化广告管理",
      "数据导出"
    ],
  }),

  // 组织结构化数据
  organization: () => ({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: APP_CONFIG?.site?.name || "AutoAds.dev",
    url: APP_CONFIG?.site?.url || "https://autoads.dev",
    logo: `${APP_CONFIG?.site?.url || "https://autoads.dev"}/logo.svg`,
    description: "一站式自动化营销平台，提供真实点击、网站排名分析、智能广告投放服务",
    sameAs: [
      APP_CONFIG?.site?.twitter || "https://twitter.com/autoads_dev",
      APP_CONFIG?.site?.github || "https://github.com/autoads-dev",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: APP_CONFIG?.site?.email || "contact@autoads.dev",
    },
  }),

  // 软件应用结构化数据
  softwareApplication: () => ({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: APP_CONFIG?.site?.name || "AutoAds.dev",
    description:
      APP_CONFIG?.site?.description || "一站式自动化营销平台",
    url: APP_CONFIG?.site?.url || "https://autoads.dev",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web Browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "真实点击",
      "网站排名分析",
      "智能广告投放",
      "批量URL打开",
      "PageRank评估",
      "自动化广告管理",
      "数据导出"
    ],
  }),

  // 网站结构化数据
  webSite: () => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: APP_CONFIG?.site?.name || "AutoAds.dev",
    description:
      APP_CONFIG?.site?.description || "一站式自动化营销平台",
    url: APP_CONFIG?.site?.url || "https://autoads.dev",
    potentialAction: {
      "@type": "SearchAction",
      target: `${APP_CONFIG?.site?.url || "https://autoads.dev"}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  }),

  // 网页结构化数据
  webPage: ({
    name,
    description,
    url,
  }: { name: string; description: string; url: string }) => ({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    description,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: APP_CONFIG?.site?.name || "AutoAds.dev",
      url: APP_CONFIG?.site?.url || "https://autoads.dev",
    },
  }),

  // 文章结构化数据
  article: ({
    headline,
    description,
    datePublished,
    dateModified,
    url,
  }: { headline: string;
    description: string;
    datePublished: string;
    dateModified: string;
    url: string }) => ({
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    datePublished,
    dateModified,
    url,
    author: {
      "@type": "Organization",
      name: APP_CONFIG?.site?.name || "AutoAds.dev",
      url: APP_CONFIG?.site?.url || "https://autoads.dev",
    },
    publisher: {
      "@type": "Organization",
      name: APP_CONFIG?.site?.name || "AutoAds.dev",
      url: APP_CONFIG?.site?.url || "https://autoads.dev",
    },
  }),

  // 面包屑结构化数据
  breadcrumbList: (items: { name: string; url: string }[]) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index: any) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }),

  // FAQ页面结构化数据
  faqPage: (faqs: { question: string; answer: string }[]) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq: any) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  }),

  // 技术文章结构化数据
  techArticle: ({
    headline,
    description,
    datePublished,
    dateModified,
    url,
  }: { headline: string;
    description: string;
    datePublished: string;
    dateModified: string;
    url: string }) => ({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline,
    description,
    datePublished,
    dateModified,
    url,
    author: {
      "@type": "Organization",
      name: APP_CONFIG?.site?.name || "AutoAds.dev",
      url: APP_CONFIG?.site?.url || "https://autoads.dev",
    },
    publisher: {
      "@type": "Organization",
      name: APP_CONFIG?.site?.name || "AutoAds.dev",
      url: APP_CONFIG?.site?.url || "https://autoads.dev",
    },
  }),
};
