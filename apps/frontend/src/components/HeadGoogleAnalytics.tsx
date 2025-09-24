"use client";

import { getGA_TRACKING_ID, isGAEnabled, pageview } from "@/lib/gtag";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

// Head-optimized Google Analytics component
// This version includes pageview tracking
function HeadGoogleAnalyticsInner() {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isGAEnabled()) {
      const url = pathname + ((searchParams?.toString() ?? '') ? `?${searchParams?.toString()}` : '');
      pageview(url);
    }
  }, [pathname, searchParams]);

  if (!isGAEnabled()) {
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
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${getGA_TRACKING_ID()}');
          `,
        }}
      />
    </>
  );
}

export default function HeadGoogleAnalytics() {
  return (
    <Suspense fallback={null}>
      <HeadGoogleAnalyticsInner />
    </Suspense>
  );
}
