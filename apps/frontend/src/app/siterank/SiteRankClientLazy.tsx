"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SiteRankData } from '@/lib/utils/common/types';
import { Filter, Loader2, Search } from "lucide-react";
import React, { useState, useCallback } from "react";

// 简化的域名提取函数
function extractDomain(url: string): string {
  try {
    const urlWithProtocol = url.startsWith("http") ? url : `https://${url}`;
    const urlObj = new URL(urlWithProtocol);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return (
      url
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0] || url
    );
  }
}

// 简化的优先级计算
function calculatePriority(rank: number): number {
  if (!rank || Number.isNaN(rank)) return 0;
  if (rank >= 8) return 100;
  if (rank >= 6) return 80;
  if (rank >= 4) return 60;
  if (rank >= 2) return 40;
  return 20;
}

// 简化的API调用 - 使用SimilarWeb
async function fetchRanks(
  domains: string[],
): Promise<{ domain: string; rank: number | null; monthlyVisits: string | null; source: string }[]> {
  const resp = await fetch("/api/siterank/similarweb", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domains }),
  });
  const result = await resp.json();
  
  // 转换SimilarWeb响应格式
  if (result.success && result.data) {
    return result.data.map((item: any) => ({
      domain: item.domain,
      rank: item.globalRank,
      monthlyVisits: item.monthlyVisits,
      source: "SimilarWeb"
    }));
  }
  
  // 返回空结果数组
  return domains?.filter(Boolean)?.map((domain: any) => ({
    domain,
    rank: null,
    monthlyVisits: null,
    source: "SimilarWeb"
  }));
}

const exampleData: SiteRankData[] = [
  {
    domain: "example.com",
    "Website Url": "https://example.com/website-link1",
    rank: 8,
    priority: 100,
    commission: 12.5,
    traffic: 50000,
    status: "completed",
    sources: ["SimilarWeb"],
  },
  {
    domain: "testsite.com",
    "Website Url": "https://testsite.com/website-link2",
    rank: 6,
    priority: 80,
    commission: 8.2,
    traffic: 32000,
    status: "completed",
    sources: ["SimilarWeb"],
  },
];

function SiteRankClientLazy() {
  const { t } = useLanguage();
  const [data, setData] = useState<SiteRankData[]>(exampleData);
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [filterText, setFilterText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 简化的批量查询
  const startRankQueries = useCallback(async (domains: SiteRankData[]) => {
    setLoading(true);
    setQueried(true);
    setAnalysisStatus("正在查询网站排名...");
    setAnalysisProgress(0);
    const updatedData: SiteRankData[] = domains.map((item: any) => ({
      ...item,
      status: "pending",
      rank: null,
      priority: null,
      sources: [],
    }));
    setData(updatedData);

    const batchSize = 10;
    for (let i = 0; i < updatedData.length; i += batchSize) {
      const batch = updatedData.slice(i, i + batchSize);
      try {
        const batchResults = await fetchRanks(batch.map((item: any) => item.domain));
        for (let j = 0; j < batch.length; j++) {
          const idx = i + j;
          const result = batchResults.find((r: any) => r.domain === batch[j].domain);
          if (result) {
            updatedData[idx] = {
              ...updatedData[idx],
              status: "completed",
              rank: result.rank,
              priority: calculatePriority(result.rank || 0),
              sources: [result.source],
            };
          } else {
            updatedData[idx] = {
              ...updatedData[idx],
              status: "error",
              rank: null,
              priority: null,
              sources: ["Error"],
            };
          }
        }
        setData([...updatedData]);
        setAnalysisProgress(
          Math.round(((i + batch.length) / updatedData.length) * 100),
        );
        setAnalysisStatus(`已处理${i + batch.length}/${updatedData.length}`);
        await new Promise((res) => setTimeout(res, 200));
      } catch (error) {
        setError("查询失败，请重试");
        break;
      }
    }
    setAnalysisStatus("查询完成");
    setAnalysisProgress(100);
    setLoading(false);
    setTimeout(() => {
      setAnalysisProgress(0);
      setAnalysisStatus("");
    }, 2000);
  }, []);

  // 处理输入分析
  const handleStartAnalysis = () => {
    if (urlInput.trim() !== "") {
      const urls = urlInput.split("\n").filter((url: any) => url.trim() !== "");
      const formattedData = urls.map((url: any) => {
        const trimmedUrl = url.trim();
        const domain = extractDomain(trimmedUrl);
        return {
          domain,
          "Website Url": trimmedUrl,
          rank: null,
          priority: null,
          commission: undefined,
          traffic: undefined,
          status: "pending" as const,
        };
      });
      setData(formattedData);
      startRankQueries(formattedData);
      return;
    }
    alert("请输入至少一个网站地址");
  };

  // 过滤数据
  const filteredData = data.filter(
    (row) => !filterText || row.domain.includes(filterText),
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <main className="max-w-6xl mx-auto p-4 lg:p-6 space-y-6 lg:space-y-8">
        <Card className="shadow-xl border-0 bg-white/70 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg pb-4 lg:pb-6">
            <CardTitle className="flex items-center gap-2 lg:gap-3 text-blue-900 text-lg lg:text-xl">
              <h1>{t("siterank.title")}</h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  输入网站地址（每行一个）
                </label>
                <Textarea
                  placeholder="https://example.com&#10;https://test.com"
                  value={urlInput}
                  onChange={(e) => setUrlInput((e.target as HTMLTextAreaElement).value)}
                />
              </div>

              <div className="flex justify-center">
                <Button
                  variant="default"
                  size="lg"
                  className="w-full"
                  onClick={handleStartAnalysis}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      开始分析
                    </>
                  )}
                </Button>
              </div>

              {analysisStatus && (
                <div className="text-center text-blue-600">
                  {analysisStatus}{" "}
                  {analysisProgress > 0 && `(${analysisProgress}%)`}
                </div>
              )}

              {error && <div className="text-center text-red-600">{error}</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t("siterank.resultsTitle")}</span>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4" />
                <Input
                  placeholder="搜索域名..."
                  value={filterText}
                  onChange={(e) => setFilterText((e.target as HTMLInputElement).value)}
                  className="w-64 rounded-lg border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-1">Domain</th>
                    <th className="px-2 py-1">Rank</th>
                    <th className="px-2 py-1">Priority</th>
                    <th className="px-2 py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row: any) => (
                    <tr key={row.domain} className="border-b">
                      <td className="px-2 py-1">{row.domain}</td>
                      <td className="px-2 py-1">{row.rank ?? "-"}</td>
                      <td className="px-2 py-1">{row.priority ?? "-"}</td>
                      <td className="px-2 py-1">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default SiteRankClientLazy;
