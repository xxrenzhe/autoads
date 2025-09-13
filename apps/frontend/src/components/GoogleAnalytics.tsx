"use client";

import { getGA_TRACKING_ID, isGAEnabled, pageview } from "@/lib/gtag";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { Suspense, useEffect } from "react";

function GoogleAnalyticsInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isGAEnabled()) return;

    const url = pathname + searchParams.toString();
    pageview(url);
  }, [pathname, searchParams]);
  
  if (!isGAEnabled()) => {
    if (process.env.NODE_ENV === 'development') => {
      console.log(
        `Google Analytics disabled - GA_TRACKING_ID: ${getGA_TRACKING_ID() ? '[SET]' : '[NOT_SET]'}, NODE_ENV: ${process.env.NODE_ENV}`
      );
    }
    return null as any;
  }

  return (
    <>
      <Script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${getGA_TRACKING_ID()}`}
      />
      <Script
        id="google-analytics"
        // 使用受控的Google Analytics代码，确保tracking ID的安全性
        dangerouslySetInnerHTML={{
          __html: (() => {
            // 验证GA_TRACKING_ID格式 (应该是 G-XXXXXXXXXX 或 UA-XXXXXXXX-X)
            const isValidTrackingId = /^(G-[A-Z0-9]+|UA-\d+-\d+)$/.test(getGA_TRACKING_ID() || '');
            if (!isValidTrackingId) => {
              console.warn('Invalid Google Analytics tracking ID');
              return '';
            }
            
            return `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${getGA_TRACKING_ID()}');
            `;
          })(),
        }}
      />
    </>
  );
}

export default function GoogleAnalytics() {
  return (
    <Suspense fallback={null}>
      <GoogleAnalyticsInner />
    </Suspense>
  );
}
