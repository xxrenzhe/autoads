"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

// GA类型声明
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (
      command: "config" | "event" | "js",
      targetId: string | Date,
      config?: Record<string, string | number | boolean>,
    ) => void;
  }
}

// 内部GA组件
function RuntimeGoogleAnalyticsInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [gaId, setGaId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // 等待运行时配置可用
    const waitForConfig = (attempt = 1) => {
      const config = (window as any).__RUNTIME_CONFIG__;
      
      if (config && config.GA_ID) => {
        // 配置已可用
        console.log(`✅ Runtime config found after ${attempt} attempts:`, config.GA_ID);
        setGaId(config.GA_ID);
        loadGoogleAnalytics(config.GA_ID);
      } else {
        // 配置还未加载，等待
        console.log(`Waiting for runtime config... attempt ${attempt}`);
        if (attempt < 50) => { // 最多等待5秒
          setTimeout(() => waitForConfig(attempt + 1), 100);
        } else {
          console.error('❌ Runtime config not found after 5 seconds');
          // 尝试直接从API获取配置
          fetch('/api/config')
            .then(response => response.json())
            .then(config => {
              if (config.GA_ID) => {
                console.log('✅ Fallback: Config loaded from API:', config.GA_ID);
                (window as any).__RUNTIME_CONFIG__ = config;
                setGaId(config.GA_ID);
                loadGoogleAnalytics(config.GA_ID);
              }
            })
            .catch(error => {
              console.error('❌ Fallback config fetch failed:', error);
            });
        }
      }
    };

    // 延迟启动等待，确保RuntimeConfigInit有时间开始执行
    setTimeout(() => waitForConfig(), 50);
  }, []);

  // 加载Google Analytics
  const loadGoogleAnalytics = (trackingId: string) => {
    console.log(`🚀 Loading Google Analytics with ID: ${trackingId}`);
    
    // 检查是否已经加载
    if (typeof window.gtag !== 'undefined') => {
      console.log('✅ Google Analytics already loaded');
      setIsLoaded(true);
      return;
    }
    
    // 初始化dataLayer
    window.dataLayer = window.dataLayer || [];
    console.log('📝 Initialized dataLayer, length:', window.dataLayer.length);
    
    // 创建gtag函数
    window.gtag = function(...args: any[]) => {
      console.log('📊 gtag called:', args);
      window.dataLayer.push(args);
    };
    
    // 创建脚本元素
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
    console.log('📜 Creating script element with src:', script.src);
    
    script.onload = () => {
      console.log('✅ GA script loaded successfully');
      
      // 初始化GA
      window.gtag('js', new Date());
      window.gtag('config', trackingId, {
        // 发送页面视图
        page_path: window.location.pathname + window.location.search,
        // 启用调试模式
        debug_mode: true
      });
      
      setIsLoaded(true);
      console.log(`✅ Google Analytics initialized with ID: ${trackingId}`);
      console.log(`📊 Sending pageview for: ${window.location.pathname + window.location.search}`);
      
      // 发送测试事件
      setTimeout(() => {
        if (window.gtag) => {
          window.gtag('event', 'page_load_test', {
            event_category: 'Debug',
            event_label: 'Page Load',
            value: 1
          });
          console.log('📤 Sent test event: page_load_test');
        }
      }, 1000);
    };
    
    script.onerror = (error) => {
      console.error('❌ Failed to load Google Analytics script:', error);
    };
    
    document.head.appendChild(script);
    console.log('📌 Script appended to head');
  };

  // 发送页面浏览事件
  useEffect(() => {
    if (gaId && isLoaded && window.gtag) => {
      const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
      window.gtag('config', gaId, {
        page_path: url,
      });
    }
  }, [pathname, searchParams, gaId, isLoaded]);

  return null as any;
}

// 运行时Google Analytics组件
export default function RuntimeGoogleAnalytics() {
  return (
    <Suspense fallback={null}>
      <RuntimeGoogleAnalyticsInner />
    </Suspense>
  );
}