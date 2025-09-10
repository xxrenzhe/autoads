import { APP_CONFIG } from "@/lib/config";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const baseUrl = APP_CONFIG.site.url;
    const currentDate = new Date().toISOString();
  
    // 所有子sitemap列表
    const sitemaps = [
      {
        loc: `${baseUrl}/sitemap.xml`,
        lastmod: currentDate,
        description: "主要页面sitemap - 包含所有网站页面",
      },
      {
        loc: `${baseUrl}/sitemap-images.xml`,
        lastmod: currentDate,
        description: "图片sitemap - 包含所有网站图片资源",
      },
      {
        loc: `${baseUrl}/sitemap-news.xml`,
        lastmod: currentDate,
        description: "新闻sitemap - 包含博客文章和新闻内容（未来扩展）",
      },
      {
        loc: `${baseUrl}/sitemap-videos.xml`,
        lastmod: currentDate,
        description: "视频sitemap - 包含教程视频和演示内容（未来扩展）",
      },
    ];
  
    // 生成Sitemap Index XML内容
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
  <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${sitemaps
    .map(
      (sitemap) => `  <sitemap>
      <loc>${sitemap.loc}</loc>
      <lastmod>${sitemap.lastmod}</lastmod>
    </sitemap>`,
    )
    .join("\n")}
  </sitemapindex>`;
  
    return new NextResponse(xmlContent, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=86400, s-maxage=86400", // 缓存24小时
        "X-Robots-Tag": "noindex", // 防止sitemap本身被索引
      },
    });
  } catch (error) {
    console.error('Error in GET:', error);
    throw error; // Re-throw to maintain error propagation
  }
}
