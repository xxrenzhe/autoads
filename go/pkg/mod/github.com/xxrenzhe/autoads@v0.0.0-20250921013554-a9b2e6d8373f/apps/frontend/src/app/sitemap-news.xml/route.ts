import { APP_CONFIG } from "@/lib/config";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const baseUrl = APP_CONFIG.site.url;
    const currentDate = new Date().toISOString();
  
    // 新闻和博客文章（未来扩展）
    const newsArticles = [
      {
        loc: `${baseUrl}/blog/how-to-detect-url-redirects`,
        lastmod: currentDate,
        changefreq: "monthly",
        priority: 0.7,
        news: {
          publication: {
            name: `${APP_CONFIG.site.name} Blog`,
            language: "zh-CN",
          },
          title: "如何检测URL重定向 - 完整指南",
          publication_date: "2025-01-27T00:00:00+00:00",
          keywords: "URL重定向,检测工具,网站分析,SEO工具",
          genres: "Blog,Technology",
        },
      },
      {
        loc: `${baseUrl}/blog/batch-url-processing-tips`,
        lastmod: currentDate,
        changefreq: "monthly",
        priority: 0.7,
        news: {
          publication: {
            name: `${APP_CONFIG.site.name} Blog`,
            language: "en",
          },
          title: "Batch URL Processing Tips and Best Practices",
          publication_date: "2025-01-27T00:00:00+00:00",
          keywords: "batch processing,URL analysis,automation,web tools",
          genres: "Blog,Technology",
        },
      },
      {
        loc: `${baseUrl}/blog/url-security-analysis`,
        lastmod: currentDate,
        changefreq: "monthly",
        priority: 0.8,
        news: {
          publication: {
            name: `${APP_CONFIG.site.name} Blog`,
            language: "zh-CN",
          },
          title: "URL安全分析：如何识别恶意链接",
          publication_date: "2025-01-27T00:00:00+00:00",
          keywords: "URL安全,恶意链接,网络安全,钓鱼检测",
          genres: "Blog,Security,Technology",
        },
      },
    ];
  
    // 生成News Sitemap XML内容
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
          xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
          xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  ${newsArticles
    .map(
      (article) => `  <url>
      <loc>${article.loc}</loc>
      <lastmod>${article.lastmod}</lastmod>
      <changefreq>${article.changefreq}</changefreq>
      <priority>${article.priority}</priority>
      <news:news>
        <news:publication>
          <news:name>${article.news.publication.name}</news:name>
          <news:language>${article.news.publication.language}</news:language>
        </news:publication>
        <news:title>${article.news.title}</news:title>
        <news:publication_date>${article.news.publication_date}</news:publication_date>
        <news:keywords>${article.news.keywords}</news:keywords>
        <news:genres>${article.news.genres}</news:genres>
      </news:news>
    </url>`,
    )
    .join("\n")}
  </urlset>`;
  
    return new NextResponse(xmlContent, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600", // 新闻内容缓存1小时
      },
    });
  } catch (error) {
    console.error('Error in GET:', error);
    throw error; // Re-throw to maintain error propagation
  }
}
