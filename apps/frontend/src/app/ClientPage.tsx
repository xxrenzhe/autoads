"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { useCallback, useEffect, useRef, useState } from "react";

import { UI_CONSTANTS } from "@/components/ui/ui-constants";
import { BatchOpenSection } from "@/components/BatchOpenSection";
import GenericStepsSection from "@/components/common/GenericStepsSection";
import { Download, ExternalLink, Link, Maximize2, RefreshCw, Zap, Settings, Globe, Monitor, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UrlResult } from '@/types/common';
import { processFile } from "@/lib/utils/file-processor";
import { calculatePriority } from "@/lib/utils/priority-calculator";
import { UrlValidator } from "@/lib/utils/url/UrlValidator";
import { EnhancedError } from '@/lib/utils/error-handling';

export default function ClientPage() {
  const { t, isLoading, locale } = useLanguage();
  const [urls, setUrls] = useState<string[]>([]);
  const [results, setResults] = useState<UrlResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [showFinalResults, setShowFinalResults] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Add displayLocale to fix the error
  const displayLocale = locale || 'zh-CN';

  const processUrls = useCallback(
    async (urlList: string[]) => {
      if (urlList.length === 0) return;

      setIsProcessing(true);
      setError(null);
      setResults([]);
      setCurrentIndex(0);
      setProcessedCount(0);
      setShowResults(false);
      setShowFinalResults(false);

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      const validUrls = urlList.filter((url: any) => url.trim() !== "");

      if (validUrls.length === 0) {
        const errorMsg = t("noValidUrls");
        setError(Array.isArray(errorMsg) ? errorMsg[0] : errorMsg);
        setIsProcessing(false);
        return;
      }

      const newResults: UrlResult[] = [];

      for (let i = 0; i < validUrls.length; i++) {
        if (abortControllerRef.current.signal.aborted) {
          break;
        }

        const url = validUrls[i].trim();
        setCurrentIndex(i + 1);

        try {
          const response = await fetch("/api/get-rank", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url }),
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();

          const result: UrlResult = {
            url: url,
            originalUrl: url,
            finalUrl: data.finalUrl || url,
            valid: true,
            domain: UrlValidator.extractDomain(data.finalUrl || url),
            rank: data.rank || 0,
            priority: calculatePriority(data.rank || 0),
            status: data.status || 0,
            timestamp: new Date().toISOString(),
          };

          newResults.push(result);
          setResults([...newResults]);

          // Add delay between requests to avoid overwhelming the server
          if (i < validUrls.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            break;
          }

          const result: UrlResult = {
            url: url,
            originalUrl: url,
            finalUrl: url,
            valid: false,
            domain: UrlValidator.extractDomain(url),
            rank: 0,
            priority: "low",
            status: 500,
            error: err instanceof Error ? err.message : "Unknown error",
            timestamp: new Date().toISOString(),
          };

          newResults.push(result);
          setResults([...newResults]);
        }
      }

      setShowResults(true);
    },
    [t],
  );

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 如果语言还在加载中，显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${UI_CONSTANTS.gradients.hero}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className={UI_CONSTANTS.typography.h1}>真实点击</h1>
            <p className={`${UI_CONSTANTS.typography.subtitle} max-w-3xl mx-auto`}>
              零插件实现云端真实访问，支持代理IP轮换，Referer随心设置，真实模拟用户请求
            </p>
          </div>
          <div className="mt-12">
            <BatchOpenSection locale={displayLocale} t={t} />
          </div>
          <GenericStepsSection
          title="简单三步操作"
          subtitle="云端静默访问，无需插件，真实模拟用户行为"
          steps={[
            {
              number: 1,
              icon: <Link className="w-6 h-6" />,
              title: "输入URL",
              description: "支持多种方式输入要访问的URL列表",
              content: (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">1</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 text-base">
                        多行输入
                      </h4>
                      <p className="text-sm text-gray-600">
                        每行一个URL，支持短链接和长链接
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold text-sm">2</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 text-base">
                        文件上传
                      </h4>
                      <p className="text-sm text-gray-600">
                        支持CSV、XLSX格式文件批量上传
                      </p>
                    </div>
                  </div>
                </div>
              ),
            },
            {
              number: 2,
              icon: <Settings className="w-6 h-6" />,
              title: "配置参数",
              description: "灵活配置访问策略和代理设置",
              content: (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <RefreshCw className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-blue-900 text-base">
                        代理配置
                      </h4>
                      <p className="text-sm text-blue-700">
                        支持代理IP轮换，真实模拟不同地区用户
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <Globe className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-purple-900 text-base">
                        访问策略
                      </h4>
                      <p className="text-sm text-purple-700">
                        自定义访问间隔、循环次数和并发控制
                      </p>
                    </div>
                  </div>
                </div>
              ),
            },
            {
              number: 3,
              icon: <Zap className="w-6 h-6" />,
              title: "静默访问",
              description: "云端自动执行，真实浏览器环境访问",
              content: (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Monitor className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-green-900 text-base">
                        无头浏览器
                      </h4>
                      <p className="text-sm text-green-700">
                        基于Chromium的真实浏览器环境，支持JS渲染
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <Shield className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-orange-900 text-base">
                        反检测机制
                      </h4>
                      <p className="text-sm text-orange-700">
                        智能User-Agent轮换，完整浏览器指纹模拟
                      </p>
                    </div>
                  </div>
                </div>
              ),
            },
          ]}
          colorTheme="purple"
          layout="horizontal"
        />
          {/* Simple results display */}
          {showResults && results.length > 0 && (
            <div className={`${UI_CONSTANTS.cards.simple} p-8 mt-12`}>
              <h2 className={UI_CONSTANTS.typography.h3 + " mb-6"}>分析结果</h2>
              <div className="space-y-3">
                {results.map((result: any) => (
                  <div
                    key={result.originalUrl}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-1">{result.originalUrl}</div>
                      <div className="text-sm text-gray-600">域名: {result.domain}</div>
                      <div className="text-sm text-gray-600">排名: {result.rank}</div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          result.priority === "high"
                            ? "bg-red-100 text-red-800"
                            : result.priority === "medium"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-green-100 text-green-800"
                        }`}
                      >
                        {result.priority === "high" ? "高优先级" : result.priority === "medium" ? "中优先级" : "低优先级"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mt-12">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-bold">!</span>
                </div>
                <div>
                  <h3 className="font-semibold text-red-900 mb-1">处理错误</h3>
                  <p className="text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
