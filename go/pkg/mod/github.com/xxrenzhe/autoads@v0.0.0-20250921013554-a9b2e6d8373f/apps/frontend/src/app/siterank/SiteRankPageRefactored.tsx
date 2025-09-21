"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import AnalysisToolSectionSiterank from "@/components/AnalysisToolSectionSiterank";
import SimpleStepsSectionSiterank from "@/components/SimpleStepsSectionSiterank";
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
import { EnhancedError } from '@/lib/utils/error-handling';
import { http } from '@/shared/http/client'
import { useSession } from "next-auth/react";
const logger = createClientLogger('SiteRankPageRefactored');

function getStr(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value || "";
}

export default function SiteRankPageRefactored() {
  const { t, locale } = useLanguage();
  const { data: session } = useSession();
  
  // 状态管理
  const [urlInput, setUrlInput] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileDomains, setFileDomains] = useState<string[]>([]);
  const [fileError, setFileError] = useState("");
  const [urlError, setUrlError] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [isTokenChecking, setIsTokenChecking] = useState(false);
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
      "Global Rank": 1234,
      PageRank: 4.5,
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
      "Global Rank": 5678,
      PageRank: 3.2,
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
      "Global Rank": 9101,
      PageRank: 2.8,
      "Test Priority": "低",
    },
  ];

  // 实时提取域名
  const urlList = urlInput
    .split("\n")
    .map((line: any) => line.trim())
    .filter((line: any) => line.length > 0);
  const domainList: string[] = urlList?.filter(Boolean)?.map((u: string) => UrlValidator.extractDomain(u)) || [];
  
  // 获取需要分析的域名总数
  const totalDomains = fileDomains.length > 0 ? fileDomains.length : domainList.length;

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
    setFileName("文件已上传");
    setFileError("");
    setUrlError(""); // Clear URL error when file is uploaded
    setTokenError(""); // Clear token error when file is uploaded
  }, []);
  
  
  // 分析引擎
  const { startAnalysis } = useAnalysisEngine({
    domains: fileDomains.length > 0 ? fileDomains : domainList,
    originalData: fileDomains.length > 0 ? fileRows : domainList.map((domain: any) => ({ domain })),
    locale,
    onResultsUpdate: setAnalysisResults,
    onProgressUpdate: setProgressText,
    onStatusUpdate: (analyzing, backgroundQuerying) => {
      setIsAnalyzing(analyzing);
      setIsBackgroundQuerying(backgroundQuerying);
      if (!analyzing && !backgroundQuerying) {
        setHasQueried(true);
      }
    },
  });

  // 开始分析处理
  const handleStartAnalysis = async () => {
    // 清除之前的错误
    setFileError("");
    setUrlError("");
    setTokenError("");
    
    // 如果没有域名，直接返回
    if (domainList.length === 0 && fileDomains.length === 0) {
      return;
    }
    
    // 首先检查用户是否登录
    if (!session?.user?.id) {
      // 未登录用户，跳转到登录页面
      window.location.href = '/api/auth/signin?callbackUrl=' + encodeURIComponent(window.location.pathname);
      return;
    }
    
    // 检查Token余额
    setIsTokenChecking(true);
    try {
      const data = await http.post<{ available: boolean }>(
        '/user/tokens/check-availability',
        { amount: totalDomains }
      );
      
      if (!(data as any).available) {
        setTokenError("Token余额不足，请充值后重试");
        setIsTokenChecking(false);
        return;
      }
    } catch (error) {
      console.error('Token balance check failed:', error);
      // 如果检查失败，允许继续尝试
    } finally {
      setIsTokenChecking(false);
    }
    
    // Token余额充足或检查失败，继续分析
    try {
      setHasQueried(false);
      setAnalysisResults([]);
      await startAnalysis();
    } catch (error) {
      logger.error('分析错误:', new EnhancedError('分析错误:', { error: error instanceof Error ? error.message : String(error)  }));
      const errorMessage = error instanceof Error ? error.message : "分析失败";
      
      // Check if it's a token balance error
      const isTokenError = (errorMessage.includes('Token') && 
                          (errorMessage.includes('余额不足') || 
                           errorMessage.includes('Insufficient tokens') ||
                           errorMessage.includes('不足') ||
                           errorMessage.includes('余额'))) ||
                          errorMessage.includes('INSUFFICIENT_TOKENS') ||
                          (errorMessage.toLowerCase().includes('insufficient') && 
                           errorMessage.toLowerCase().includes('token'));
      
      // Check if using batch URL input mode
      const isBatchInputMode = fileDomains.length === 0 && domainList.length > 0;
      
      if (isTokenError) {
        // Show token error with unified message below the start button
        setTokenError("Token余额不足，请充值后重试");
      } else {
        // For other errors, show in the appropriate section based on input mode
        if (isBatchInputMode) {
          setUrlError(errorMessage);
        } else {
          setFileError(errorMessage);
        }
      }
      
      setIsAnalyzing(false);
      setIsBackgroundQuerying(false);
    }
  };

  // 文件上传处理
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles: File[]) => {
      try {
        const file = acceptedFiles[0];
        if (file) {
          setFileName(file.name);
          // 这里会通过FileUpload组件处理
        }
      } catch (error) {
        console.error('Error in onDrop:', error);
        throw error; // Re-throw to maintain error propagation
      }
    },
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false,
    noClick: true,
  });

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
    "Global Rank",
    "PageRank",
    "Test Priority",
  ];

  const isBatchInputMode = fileDomains.length === 0 && domainList.length > 0;
  const displayColumns = hasQueried
    ? isBatchInputMode
      ? ["domain", "全球排名", "相对排名", "测试优先级"]
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
          "全球排名",
          "相对排名",
          "测试优先级",
        ]
    : exampleColumns;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 网站排名分析专用Slogan和三步说明 */}
        <section className="text-center mb-6">
          <h1 className="text-center">
            {"网站排名分析工具"}
          </h1>
          <p className="subtitle max-w-2xl mx-auto text-slate-600 leading-relaxed">
            {"分析网站全球排名和PageRank，智能计算测试优先级，为您的营销决策提供数据支持"}
          </p>
        </section>

        <SimpleStepsSectionSiterank locale={locale} />

        {/* 主要分析工具 */}
        <Card className="mb-8 shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg pb-4 lg:pb-6 relative">
            <CardTitle className="flex items-center gap-2 lg:gap-3 text-blue-900 text-lg lg:text-xl">
              {t("siterank.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {/* URL输入区域 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-700">
                  {"批量URL输入"}
                </h3>
                <textarea
                  className="w-full h-32 border rounded p-2"
                  placeholder={getStr(t("siterank.inputPlaceholder") as string | string[] | undefined)}
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput((e.target as HTMLTextAreaElement).value);
                    if (urlError) setUrlError("");
                    if (tokenError) setTokenError("");
                  }}
                />
                <p className="text-sm text-slate-500">
                  {`已识别 ${domainList.length} 个域名`}
                </p>
                {urlError && (
                  <p className="text-sm text-red-600">{urlError}</p>
                )}
              </div>

              {/* 文件上传区域 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-700">
                  {"文件上传"}
                </h3>
                <FileUpload
                  onFileProcessed={handleFileProcessed}
                  onError={setFileError}
                  locale={locale}
                  t={t}
                />
                {fileName && (
                  <p className="text-sm text-green-600">
                    {"已上传："}{fileName}
                  </p>
                )}
                {fileError && (
                  <p className="text-sm text-red-600">{fileError}</p>
                )}
                {fileDomains.length > 0 && (
                  <p className="text-sm text-slate-500">
                    {`文件包含 ${fileDomains.length} 个域名`}
                  </p>
                )}
              </div>
            </div>

            {/* 开始分析按钮 */}
            <div className="flex flex-col items-center mt-10">
              <Button
                onClick={handleStartAnalysis}
                disabled={isAnalyzing || isTokenChecking || (domainList.length === 0 && fileDomains.length === 0)}
                className="flex items-center justify-center bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-10 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-base min-w-[140px] text-lg"
              >
                {isTokenChecking ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {"检查中..."}
                  </>
                ) : isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {"分析中..."}
                  </>
                ) : (
                  <>
                    {"开始分析"}
                    {(domainList.length > 0 || fileDomains.length > 0) && (
                      <Badge variant="secondary" className="ml-2">
                        {fileDomains.length > 0 ? fileDomains.length : domainList.length}
                      </Badge>
                    )}
                  </>
                )}
              </Button>
              
              {/* Token余额不足提示 */}
              {tokenError && (
                <p className="text-sm text-red-600 mt-3 text-center">
                  {tokenError}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 结果表格 */}
        <ResultsTable
          results={hasQueried ? analysisResults : exampleData}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          displayColumns={displayColumns}
          locale={locale}
          t={t}
          hasQueried={hasQueried}
          isBackgroundQuerying={isBackgroundQuerying}
          progressText={progressText}
        />

        <AnalysisToolSectionSiterank locale={locale} />
      </div>
    </div>
  );
}
