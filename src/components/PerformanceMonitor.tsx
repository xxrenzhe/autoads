"use client";

import { APP_CONFIG } from "@/lib/config";
import { useEffect } from "react";
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('PerformanceMonitor');

interface PerformanceMetrics {
  fcp?: number;
  lcp?: number;
  fid?: number;
  cls?: number;
  ttfb?: number;
  loadTime?: number;
}

// 评估性能等级
const getPerformanceGrade = (metrics: PerformanceMetrics): string => {
  let score = 100;

  if (metrics.fcp && metrics.fcp > 1800) score -= 20;
  else if (metrics.fcp && metrics.fcp > 1000) score -= 10;

  if (metrics.lcp && metrics.lcp > 2500) score -= 30;
  else if (metrics.lcp && metrics.lcp > 1200) score -= 15;

  if (metrics.fid && metrics.fid > 100) score -= 20;
  else if (metrics.fid && metrics.fid > 50) score -= 10;

  if (metrics.cls && metrics.cls > 0.25) score -= 20;
  else if (metrics.cls && metrics.cls > 0.1) score -= 10;

  if (metrics.loadTime && metrics.loadTime > 3000) score -= 20;
  else if (metrics.loadTime && metrics.loadTime > 1000) score -= 10;

  if (score >= 90) return "🟢 优秀 (A)";
  if (score >= 80) return "🟡 良好 (B)";
  if (score >= 70) return "🟠 一般 (C)";
  return "🔴 需要优化 (D)";
};

// 发送到分析服务的函数
const sendToAnalytics = (metrics: PerformanceMetrics) => {
  // 这里可以集成Google Analytics, Vercel Analytics等
  if (typeof window !== "undefined" && "gtag" in window) {
    const gtag = (window as Window & { gtag: typeof window.gtag }).gtag;

    const eventData: Record<string, string | number | boolean> = {};

    if (metrics.fcp) eventData.fcp = Math.round(metrics.fcp);
    if (metrics.lcp) eventData.lcp = Math.round(metrics.lcp);
    if (metrics.fid) eventData.fid = Math.round(metrics.fid);
    if (metrics.cls) eventData.cls = Math.round(metrics.cls * 1000) / 1000;
    if (metrics.loadTime) eventData.load_time = Math.round(metrics.loadTime);

    gtag("event", "page_performance", eventData);
  }
};

export default function PerformanceMonitor() {
  useEffect(() => {
    // 监控页面加载性能
    const measurePerformance = () => {
      try {
        const navigation = performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming;
        const metrics: PerformanceMetrics = {};

        // 计算关键性能指标
        if (navigation) {
          metrics.ttfb = navigation.responseStart - navigation.requestStart;
          metrics.loadTime = navigation.loadEventEnd - navigation.fetchStart;
        }

        // 获取Web Vitals
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            switch (entry.entryType) {
              case "paint":
                if (entry.name === "first-contentful-paint") {
                  metrics.fcp = entry.startTime;
                }
                break;
              case "largest-contentful-paint":
                metrics.lcp = entry.startTime;
                break;
              case "first-input":
                metrics.fid = (entry as any).processingStart - entry.startTime;
                break;
              case "layout-shift":
                if (!(entry as any).hadRecentInput) {
                  metrics.cls = (metrics.cls || 0) + (entry as any).value;
                }
                break;
            }
          }
        });

        observer.observe({
          entryTypes: [
            "paint",
            "largest-contentful-paint",
            "first-input",
            "layout-shift",
          ],
        });

        // 在页面加载完成后输出性能报告
        window.addEventListener("load", () => {
          setTimeout(() => {
            const finalMetrics = { ...metrics };
            if (navigation) {
              finalMetrics.loadTime = performance.now();
            }

            // 开发环境下输出性能报告
            if (process.env.NODE_ENV === "development") {
              logger.info(`🚀 ${APP_CONFIG.site.name} 性能报告`);
              logger.info(`📊 首次内容绘制 (FCP): ${metrics.fcp || "未测量"}ms`);
              logger.info(`📊 最大内容绘制 (LCP): ${metrics.lcp || "未测量"}ms`);
              logger.info(`📊 首次输入延迟 (FID): ${metrics.fid || "未测量"}ms`);
              logger.info(`📊 累积布局偏移 (CLS): ${metrics.cls || "未测量"}`);
              logger.info(`📊 首字节时间 (TTFB): ${metrics.ttfb || "未测量"}ms`);
              logger.info(`📊 总加载时间: ${finalMetrics.loadTime || "未测量"}ms`);

              // 性能评估
              const performanceGrade = getPerformanceGrade(finalMetrics);
              logger.info("🏆 性能评级:");
              logger.info(performanceGrade);

              if (finalMetrics.loadTime && finalMetrics.loadTime > 1000) {
                logger.warn("⚠️ 页面加载时间超过1秒，建议优化");
              }
            }

            // 生产环境下可以发送到分析服务
            if (process.env.NODE_ENV === "production") {
              // 可以发送到Google Analytics或其他分析服务
              sendToAnalytics(finalMetrics);
            }
          }, 1000);
        });

        // 清理observer
        return () => {
          observer.disconnect();
        };
      } catch (error) {
        logger.warn("性能监控初始化失败:", new EnhancedError("性能监控初始化失败", { 
      error: error instanceof Error ? error.message : String(error)
    }));
        return () => {}; // 返回空的清理函数
      }
    };

    const cleanup = measurePerformance();
    return cleanup;
  }, []);

  return null as any; // 这个组件不渲染任何内容
}