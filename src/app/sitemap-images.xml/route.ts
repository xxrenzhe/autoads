import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://autoads.dev";
  
    const images = [
      {
        loc: `${baseUrl}/images/url-analysis-example.png`,
        title: "URL Analysis Example",
        caption: "Professional URL analysis and batch processing interface",
        geoLocation: "Worldwide",
        license: "https://creativecommons.org/licenses/by/4.0/",
      },
      {
        loc: `${baseUrl}/images/batch-processing-demo.png`,
        title: "Batch Processing Demo",
        caption: "Batch URL processing with real-time status tracking",
        geoLocation: "Worldwide",
        license: "https://creativecommons.org/licenses/by/4.0/",
      },
      {
        loc: `${baseUrl}/images/site-ranking-tool.png`,
        title: "Site Ranking Tool",
        caption: "Website ranking analysis and priority calculation",
        geoLocation: "Worldwide",
        license: "https://creativecommons.org/licenses/by/4.0/",
      },
      {
        loc: `${baseUrl}/images/background-open.png`,
        title: "Chrome Extension",
        caption: "Chrome browser extension for background tab opening",
        geoLocation: "Worldwide",
        license: "https://creativecommons.org/licenses/by/4.0/",
      },
      {
        loc: `${baseUrl}/images/data-export.png`,
        title: "Data Export",
        caption: "Multi-format data export capabilities (TXT, CSV)",
        geoLocation: "Worldwide",
        license: "https://creativecommons.org/licenses/by/4.0/",
      },
    ];
  
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
          xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
    <url>
      <loc>${baseUrl}</loc>
      <image:image>
        <image:loc>${images[0].loc}</image:loc>
        <image:title>${images[0].title}</image:title>
        <image:caption>${images[0].caption}</image:caption>
        <image:geo_location>${images[0].geoLocation}</image:geo_location>
        <image:license>${images[0].license}</image:license>
      </image:image>
      <image:image>
        <image:loc>${images[1].loc}</image:loc>
        <image:title>${images[1].title}</image:title>
        <image:caption>${images[1].caption}</image:caption>
        <image:geo_location>${images[1].geoLocation}</image:geo_location>
        <image:license>${images[1].license}</image:license>
      </image:image>
      <image:image>
        <image:loc>${images[2].loc}</image:loc>
        <image:title>${images[2].title}</image:title>
        <image:caption>${images[2].caption}</image:caption>
        <image:geo_location>${images[2].geoLocation}</image:geo_location>
        <image:license>${images[2].license}</image:license>
      </image:image>
      <image:image>
        <image:loc>${images[3].loc}</image:loc>
        <image:title>${images[3].title}</image:title>
        <image:caption>${images[3].caption}</image:caption>
        <image:geo_location>${images[3].geoLocation}</image:geo_location>
        <image:license>${images[3].license}</image:license>
      </image:image>
      <image:image>
        <image:loc>${images[4].loc}</image:loc>
        <image:title>${images[4].title}</image:title>
        <image:caption>${images[4].caption}</image:caption>
        <image:geo_location>${images[4].geoLocation}</image:geo_location>
        <image:license>${images[4].license}</image:license>
      </image:image>
    </url>
  </urlset>`;
  
    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error('Error in GET:', error);
    throw error; // Re-throw to maintain error propagation
  }
}
