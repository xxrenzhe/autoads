"use client";

import { useState, useCallback } from "react";
import { UI_CONSTANTS } from "@/components/ui/ui-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2 } from "lucide-react";
import { FileUpload } from "@/components/siterank/FileUpload";
import { ResultsTable } from "@/components/siterank/ResultsTable";
import { useAnalysisEngine } from "@/components/siterank/AnalysisEngine";
import { UrlValidator } from "@/lib/utils/url/UrlValidator";
import type { AnalysisResult } from "@/lib/siterank/types";
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import GenericStepsSection from "@/components/common/GenericStepsSection";
import { Download, Search, Upload } from "lucide-react";
import { EnhancedError } from '@/lib/utils/error-handling';
import { defaultSiteRankConfig, validateBatchQueryCount } from '@/lib/config/siterank';
import { ProtectedButton } from '@/components/auth/ProtectedButton';
import { useTokenConsumption } from '@/hooks/useTokenConsumption';
import { getUiDefaultRpm, fetchUiDefaultRpm, getPlanFeatureRpmSync } from '@/lib/config/rate-limit';
import WeChatSubscribeModal from '@/components/common/WeChatSubscribeModal';
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits';
import { getUiDefaultRpm, fetchUiDefaultRpm } from '@/lib/config/rate-limit';
const logger = createClientLogger('SiteRankClient');


function getStr(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value || "";
}

export default function SiteRankClient() {
  const { t, displayLocale } = useLanguage();
  const { consumeTokens, hasEnoughTokens, getTokenBalance } = useTokenConsumption();
  const { data: subscriptionData, loading: subscriptionLoading } = useSubscriptionLimits();
  
  // 状态管理
  const [urlInput, setUrlInput] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileDomains, setFileDomains] = useState<string[]>([]);
  const [fileError, setFileError] = useState("");
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<Record<string, string>[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("domain");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [hasQueried, setHasQueried] = useState(false);
  const [isBackgroundQuerying, setIsBackgroundQuerying] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [showWeChatModal, setShowWeChatModal] = useState(false);
  const [modalRequired, setModalRequired] = useState<number | undefined>(undefined);
  const [modalBalance, setModalBalance] = useState<number | undefined>(undefined);

  // 示例数据
  const exampleData = [
    {
      MID: "100001",
      "Merchant Name": "示例商家A",
      Country: "CN",
      Category: "服饰",
      "Advert Url": "https://merchant-a.com/ad",
      RD: "rd1",
      Commission: "12.5%",
      "Application time": "2024-01-15",
      Link: "https://affiliate-a.com/link1",
      Domain: "merchant-a.com",
      GlobalRank: 1234,
      MonthlyVisits: "45.2K",
      "Test Priority": "高",
    },
    {
      MID: "100002",
      "Merchant Name": "示例商家B",
      Country: "US",
      Category: "数码",
      "Advert Url": "https://merchant-b.com/ad",
      RD: "rd2",
      Commission: "8.2%",
      "Application time": "2024-01-20",
      Link: "https://affiliate-b.com/link2",
      Domain: "merchant-b.com",
      GlobalRank: 5678,
      MonthlyVisits: "12.8K",
      "Test Priority": "中",
    },
    {
      MID: "100003",
      "Merchant Name": "示例商家C",
      Country: "UK",
      Category: "家居",
      "Advert Url": "https://merchant-c.com/ad",
      RD: "rd3",
      Commission: "15.0%",
      "Application time": "2024-01-25",
      Link: "https://affiliate-c.com/link3",
      Domain: "merchant-c.com",
      GlobalRank: 9101,
      MonthlyVisits: "3.5K",
      "Test Priority": "低",
    },
  ];

  // 实时提取域名
  const urlList = urlInput
    .split("\n")
    .map((line: any) => line.trim())
    .filter((line: any) => line.length > 0);
  const domainList = urlList?.filter(Boolean)?.map(UrlValidator.extractDomain);
  
  // 计算去重后的域名数量
  const uniqueDomainSet = new Set(domainList);
  const uniqueDomainCount = uniqueDomainSet.size;
  const duplicateCount = domainList.length - uniqueDomainCount;
  
  // 获取批量查询限制（基于用户订阅）
  const batchQueryLimit = subscriptionLoading 
    ? defaultSiteRankConfig.batchQueryLimit 
    : subscriptionData?.limits?.siterank?.batchLimit || defaultSiteRankConfig.batchQueryLimit;
  
  // 检查是否超过限制
  const isBatchInputMode = fileDomains.length === 0 && domainList.length > 0;
  const isOverLimit = isBatchInputMode && domainList.length > batchQueryLimit;

  // 处理排序点击
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // 文件处理回调
  const handleFileProcessed = useCallback((data: { domains: string[]; columns: string[]; rows: Record<string, string>[] }) => {
    setFileDomains(data.domains);
    setFileColumns(data.columns);
    setFileRows(data.rows);
    setFileError("");
  }, []);

  // 分析引擎
  const { startAnalysis, rateLimitStatus, getEstimatedCompletionTime, cacheStats } = useAnalysisEngine({
    domains: fileDomains.length > 0 ? fileDomains : domainList,
    originalData: fileDomains.length > 0 ? fileRows : domainList.map((domain: any) => ({ domain } as Record<string, string | number | null | undefined>)),
    locale: displayLocale,
    onResultsUpdate: setAnalysisResults,
    onProgressUpdate: setProgressText,
    onStatusUpdate: (analyzing, backgroundQuerying) => {
      setIsAnalyzing(analyzing);
      setIsBackgroundQuerying(backgroundQuerying);
      if (analyzing || backgroundQuerying) {
        setHasQueried(true);
      }
    },
  });

  // UI 限流提示（展示）
  const [uiRateLimitMax, setUiRateLimitMax] = useState<number>(getUiDefaultRpm());
  const [planRpm, setPlanRpm] = useState<number | undefined>(undefined);
  const [featureRpm, setFeatureRpm] = useState<number | undefined>(undefined);
  useEffect(() => { fetchUiDefaultRpm().then(setUiRateLimitMax).catch(() => {}); }, []);
  useEffect(() => {
    const planId = subscriptionData?.planId;
    const { planRpm: p, featureRpm: f } = getPlanFeatureRpmSync(planId, 'siterank');
    setPlanRpm(p); setFeatureRpm(f);
  }, [subscriptionData?.planId]);

  // 开始分析处理
  const handleStartAnalysis = async () => {
    try {
      // 如果是批量URL输入模式，检查域名数量
      if (fileDomains.length === 0 && domainList.length > 0) {
        const validation = validateBatchQueryCount(domainList);
        if (!validation.valid) {
          setFileError(validation.error || "域名数量超过限制");
          return;
        }
      }
      
      // 计算需要的Token数量（每个域名1个Token）
      const domainCount = fileDomains.length > 0 ? fileDomains.length : domainList.length;
      const requiredTokens = domainCount;
      
      // 检查并消耗Token
      // 默认改为后端路由处理预检与扣费；如需前置扣费，可设置 NEXT_PUBLIC_FRONTEND_EAGER_TOKEN_CONSUMPTION=true
      if (process.env.NEXT_PUBLIC_FRONTEND_EAGER_TOKEN_CONSUMPTION === 'true') {
        const tokenResult = await consumeTokens(
          'siterank',
          'batch_analysis',
          requiredTokens,
          {
            itemCount: domainCount,
            description: `网站排名分析 - ${domainCount}个域名`,
            onInsufficientBalance: async () => {
              // 展示客服微信弹窗
              setFileError('Token余额不足，请联系顾问充值');
              try {
                const balance = await getTokenBalance();
                setModalBalance(balance ?? undefined);
              } catch {}
              setModalRequired(requiredTokens);
              setShowWeChatModal(true);
            }
          }
        );
        if (!tokenResult.success) {
          return;
        }
      }
      
      setAnalysisResults([]);
      setIsAnalyzing(true);
      setIsBackgroundQuerying(false);
      setProgressText("");
      
      await startAnalysis();
      
    } catch (error) {
      const e: any = error;
      logger.error('分析错误:', new EnhancedError('分析错误:', { error: e?.message || String(e) }));
      // 处理 402（余额不足）与 429（限流）
      const status = e?.status ?? e?.details?.status;
      if (status === 402 || e?.message === 'INSUFFICIENT_TOKENS') {
        try { const balance = await getTokenBalance(); setModalBalance(balance ?? undefined); } catch {}
        setModalRequired(undefined);
        setShowWeChatModal(true);
        setFileError('Token余额不足，请联系顾问充值或升级套餐');
      } else if (status === 429) {
        const retryAfter = e?.details?.retryAfter || e?.details?.RetryAfter;
        setFileError(`请求过于频繁，请稍后再试${retryAfter ? `（建议 ${retryAfter}s 后重试）` : ''}`);
      } else {
        setFileError(e instanceof Error ? e.message : '分析失败');
      }
      setIsAnalyzing(false);
      setIsBackgroundQuerying(false);
      setHasQueried(false);
    }
  };

  // UI 速率上限（展示用途，后端为权威）
  const [uiRateLimitMax, setUiRateLimitMax] = useState<number>(getUiDefaultRpm());
  useEffect(() => { fetchUiDefaultRpm().then(setUiRateLimitMax).catch(() => {}); }, []);

  // 显示列配置
  const exampleColumns = [
    "MID",
    "Merchant Name", 
    "Country",
    "Category",
    "Advert Url",
    "RD",
    "Commission",
    "Application time",
    "Link",
    "Domain",
    "GlobalRank",
    "MonthlyVisits",
    "Test Priority",
  ];

  const displayColumns = hasQueried
    ? isBatchInputMode
      ? ["domain", "GlobalRank", "MonthlyVisits", "测试优先级"]
      : [
          "MID",
          "Merchant Name",
          "Country", 
          "Category",
          "Advert Url",
          "RD",
          "Commission",
          "Application time",
          "Link",
          "domain",
          "GlobalRank",
          "MonthlyVisits",
          "测试优先级",
        ]
    : exampleColumns;

  return (
    <div className={`min-h-screen ${UI_CONSTANTS.gradients.hero}`}>
      <WeChatSubscribeModal
        open={showWeChatModal}
        onOpenChange={setShowWeChatModal}
        scenario="insufficient_balance"
        requiredTokens={modalRequired}
        currentBalance={modalBalance}
      />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className={UI_CONSTANTS.typography.h1}>网站排名分析</h1>
            <p className={`${UI_CONSTANTS.typography.subtitle} max-w-3xl mx-auto`}>
              专业的网站权威度评估和排名分析工具。提供全球排名、月访问量，智能计算测试优先级
            </p>
          </div>

          <div className="mt-12">
            <div className={`${UI_CONSTANTS.cards.featured} mb-8 p-8`}>
              <div className="mb-6">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <h2 className={UI_CONSTANTS.typography.h2}>
                    {t("siterank.title")}
                  </h2>
                </div>
                <p className={`${UI_CONSTANTS.typography.body} text-center max-w-2xl mx-auto`}>
                  支持批量URL输入和文件上传，智能分析网站排名和流量数据
                </p>
              </div>
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-stretch">
                  {/* URL输入区域 */}
                  <div className="flex-1 flex flex-col">
                    <h3 className={UI_CONSTANTS.typography.h3 + " mb-4 flex items-center gap-2"}>
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-blue-600 font-bold text-sm">1</span>
                      </div>
                      {"批量URL输入"}
                    </h3>
                    <div className="flex-1 flex flex-col">
                      <textarea
                        className="w-full border-2 border-gray-200 rounded-xl p-4 resize-none h-[140px] focus:border-blue-500 focus:outline-none transition-colors"
                        placeholder={getStr(t("siterank.inputPlaceholder") as string | string[] | undefined)}
                        value={urlInput}
                        onChange={(e: any) => setUrlInput(e.target.value)}
                      />
                      <div className="text-sm text-gray-500 mt-3 h-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full inline-block"></span>
                        已识别 {domainList.length} 个域名
                        {duplicateCount > 0 && (
                          <span className="text-green-600">
                            (去重后 {uniqueDomainCount} 个，{duplicateCount} 个重复)
                          </span>
                        )}
                        {domainList.length > batchQueryLimit * 0.8 && (
                          <span className={`font-medium ${domainList.length > batchQueryLimit ? 'text-red-600' : 'text-orange-600'}`}>
                            {domainList.length > batchQueryLimit ? '❌' : '⚠️'} 
                            {domainList.length > batchQueryLimit 
                              ? `超过限制（最多 ${batchQueryLimit} 个）` 
                              : `接近限制（最多 ${batchQueryLimit} 个）`
                            }
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 分隔符 - "或" */}
                  <div className="flex items-center justify-center lg:flex-col lg:justify-center py-4 lg:py-0">
                    <div className="relative">
                      <div className="lg:hidden absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                      </div>
                      <div className="hidden lg:block absolute inset-0 flex justify-center">
                        <div className="h-full border-l border-gray-200"></div>
                      </div>
                      <div className="relative flex items-center justify-center w-14 h-14 bg-white rounded-full border-2 border-gray-200 shadow-lg">
                        <span className="text-gray-600 font-semibold text-base">
                          {"或"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 文件上传区域 */}
                  <div className="flex-1 flex flex-col">
                    <h3 className={UI_CONSTANTS.typography.h3 + " mb-4 flex items-center gap-2"}>
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="text-green-600 font-bold text-sm">2</span>
                      </div>
                      {"文件上传"}
                    </h3>
                    <div className="flex-1 h-[140px]">
                      <FileUpload
                        onFileProcessed={handleFileProcessed}
                        onError={setFileError}
                        onFileSelected={setFileName}
                        locale={displayLocale}
                        t={t}
                        fileName={fileName}
                        fileError={fileError}
                        fileDomains={fileDomains}
                        duplicateCount={fileDomains.length > 0 ? fileDomains.length - new Set(fileDomains).size : 0}
                        batchQueryLimit={batchQueryLimit}
                      />
                    </div>
                  </div>
                </div>

                {/* 开始分析按钮 */}
                <div className="flex flex-col items-center mt-12">
                  {/* 错误提示 */}
                  {isOverLimit && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-700 text-sm font-medium">
                        ❌ 域名数量超过限制，请减少至 {batchQueryLimit} 个域名以内
                      </p>
                    </div>
                  )}
                  <ProtectedButton
                    featureName="siterank"
                    onClick={handleStartAnalysis}
                    disabled={isAnalyzing || isOverLimit || (domainList.length === 0 && fileDomains.length === 0)}
                    className={`${UI_CONSTANTS.buttons.primary} text-lg py-4 px-12 min-w-[200px] flex items-center gap-3 ${isAnalyzing || isOverLimit ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl'}`}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        {"准备分析..."}
                      </>
                    ) : (
                      <>
                        {"开始分析"}
                        {(domainList.length > 0 || fileDomains.length > 0) && (
                          <>
                            <Badge variant="secondary" className="ml-2 bg-white/20 text-white border-white/30">
                              {fileDomains.length > 0 ? fileDomains.length : domainList.length}
                            </Badge>
                            <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800 border-yellow-300">
                              {fileDomains.length > 0 ? fileDomains.length : domainList.length} Token
                            </Badge>
                          </>
                        )}
                      </>
                    )}
                  </ProtectedButton>
                  
                  {/* 分析进度显示 */}
                  {(isBackgroundQuerying || progressText) && (
                    <div className="mt-6 space-y-3">
                      {/* 速率限制状态 */}
                      <div className={`flex items-center justify-center space-x-3 text-sm px-4 py-3 rounded-xl ${
                        rateLimitStatus.isLimited || rateLimitStatus.remaining < 50 
                          ? 'bg-orange-50 text-orange-600' 
                          : 'bg-green-50 text-green-600'
                      }`}>
                        <div className="flex items-center space-x-2">
                          {rateLimitStatus.isLimited ? (
                            <>
                              <span className="font-medium">⚠️ 已达到速率限制</span>
                              <span>等待重置: {Math.ceil((rateLimitStatus.resetTime - Date.now()) / 1000)}秒</span>
                            </>
                          ) : (
                            <>
                        <span className="font-medium">📊 剩余请求配额:</span>
                        <span className="font-semibold">{rateLimitStatus.remaining}/{uiRateLimitMax}</span>
                        {planRpm ? (
                          <span className="ml-3 text-gray-500">套餐上限: <span className="font-medium text-gray-700">{planRpm} RPM</span></span>
                        ) : null}
                        {featureRpm ? (
                          <span className="ml-3 text-gray-500">功能上限: <span className="font-medium text-gray-700">{featureRpm} RPM</span></span>
                        ) : null}
                              <span className="text-xs opacity-75">
                                (已用: {rateLimitStatus.totalRequests})
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* 查询进度 */}
                      <div className="flex items-center justify-center space-x-3 text-sm text-blue-600 bg-blue-50 px-4 py-3 rounded-xl">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="font-medium">
                          {"正在查询排名数据..."}
                          {progressText && (
                            <span className="ml-2 font-semibold text-blue-800">
                              ({progressText})
                            </span>
                          )}
                          {rateLimitStatus.remaining < 100 && (
                            <span className="ml-2 text-xs text-orange-600">
                              · 预计还需: {Math.ceil(getEstimatedCompletionTime(
                                (fileDomains.length > 0 ? fileDomains.length : domainList.length) - 
                                (progressText ? parseInt(progressText.split('/')[0]) : 0)
                              ) / 1000)}秒
                            </span>
                          )}
                        </span>
                      </div>
                      
                      {/* 缓存提示（仅提示，命中缓存仍全额扣费） */}
                      <div className="flex items-center justify-center space-x-2 text-xs text-gray-600">
                        <span>💡 缓存: 命中 {cacheStats.hits}/{cacheStats.total} · 用于提速，命中缓存仍全额扣费</span>
                      </div>
                    </div>
                  )}
                </div>
            </div>
          </div>
          
          <div className="mt-12">
            {/* 结果表格 */}
            <ResultsTable
              results={hasQueried ? analysisResults : exampleData}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              displayColumns={displayColumns}
              locale={displayLocale}
              t={t}
              hasQueried={hasQueried}
              isBackgroundQuerying={isBackgroundQuerying}
              progressText={progressText}
            />
          </div>
          
          <div className="mt-16">
            <GenericStepsSection
              title="简单三步，轻松分析"
              subtitle="批量输入或上传域名，一键查询排名，导出分析结果"
              steps={[
                {
                  number: 1,
                  icon: <Upload className="w-8 h-8" />,
                  title: "输入/上传域名",
                  description: "支持批量输入或上传Excel/CSV文件",
                },
                {
                  number: 2,
                  icon: <Search className="w-8 h-8" />,
                  title: "一键查询排名",
                  description: "自动识别域名并查询主流排名数据",
                },
                {
                  number: 3,
                  icon: <Download className="w-8 h-8" />,
                  title: "导出/分析结果",
                  description: "支持结果筛选、排序和导出Excel",
                },
              ]}
              colorTheme="blue"
              layout="horizontal"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
