"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ArrowRight,
  CheckCircle,
  Code,
  Download,
  ExternalLink,
  FileText,
  Info,
  Settings,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('page');

interface VersionInfo {
  version: string;
  zip: string;
  timestamp: number;
  checksum: string;
  size: number;
  buildDate?: string;
  createdAt?: string;
  features?: string[];
  changelog?: string[];
  git?: {
    commitHash: string;
    branch: string;
    lastCommitDate: string;
  };
}

export default function BackgroundOpenInstallPage() {
  const [zipName, setZipName] = useState("background-open.zip");
  const [zipVersion, setZipVersion] = useState("");
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [allVersions, setAllVersions] = useState<VersionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 获取最新版本信息
    const fetchLatest = fetch("/background-open-latest.json").then((res) => res.json());
    // 获取所有版本信息
    const fetchAll = fetch("/background-open-versions.json").then((res) => res.json());

    Promise.all([fetchLatest, fetchAll])
      .then(([latestData, allData]) => {
        setZipName(latestData.zip);
        setVersionInfo(latestData);
        setZipVersion(latestData.version || "");
        setAllVersions(allData || []);
        setLoading(false);
      })
      .catch((error) => {
        logger.error("Failed to fetch version info:", new EnhancedError("Failed to fetch version info:", { error: error instanceof Error ? error.message : String(error)  }));
        setLoading(false);
      });
  }, []);

  const openChromeWebStore = () => {
    // 如果有Chrome Web Store链接，可以在这里添加
    window.open("https://chromewebstore.google.com/", "_blank");
  };

  const handleGoHome = () => {
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Skip to main content for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50"
      >
        跳转到主要内容
      </a>

      <main
        id="main-content"
        className="max-w-4xl mx-auto p-4 lg:p-6 space-y-6 lg:space-y-8"
      >
        {/* Hero Section */}
        <section className="text-center space-y-4 lg:space-y-6 py-6 lg:py-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 px-2">
            Background Open 扩展安装
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-slate-600 max-w-3xl mx-auto px-4">
            安装Background Open扩展程序以获得更好的标签页管理体验，支持后台打开功能
          </p>
        </section>

        {/* 扩展程序介绍 */}
        <Card className="shadow-xl border-0 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader className="pb-4 lg:pb-6">
            <CardTitle className="flex items-center gap-2 lg:gap-3 text-green-900 text-lg lg:text-xl">
              <Download className="h-5 w-5 lg:h-6 lg:w-6 text-green-600" />
              扩展功能特性
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              <div className="space-y-3 p-4 bg-white/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">
                    后台打开
                  </h3>
                </div>
                <p className="text-sm text-green-700">
                  在后台打开多个标签页，不会干扰当前工作流程
                </p>
              </div>

              <div className="space-y-3 p-4 bg-white/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">
                    批量管理
                  </h3>
                </div>
                <p className="text-sm text-green-700">
                  一次性打开多个URL，高效管理大量链接
                </p>
              </div>

              <div className="space-y-3 p-4 bg-white/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">
                    智能控制
                  </h3>
                </div>
                <p className="text-sm text-green-700">
                  智能控制标签页打开顺序和时机，避免浏览器卡顿
                </p>
              </div>

              <div className="space-y-3 p-4 bg-white/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">
                    安全可靠
                  </h3>
                </div>
                <p className="text-sm text-green-700">
                  本地处理，不收集任何数据，保护您的隐私安全
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 安装方式选择 */}
        <Card className="shadow-xl border-0 bg-white/70 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg pb-4 lg:pb-6">
            <CardTitle className="flex items-center gap-2 lg:gap-3 text-blue-900 text-lg lg:text-xl">
              <Settings className="h-5 w-5 lg:h-6 lg:w-6" />
              选择安装方式
            </CardTitle>
            <CardDescription className="text-blue-700 text-sm lg:text-base">
              推荐使用手动安装方式，下载源码包进行安装
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-6 py-6 lg:space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 手动安装 */}
              <div className="space-y-4 p-6 border-2 border-blue-200 rounded-xl bg-blue-50/50">
                <div className="flex items-center gap-3">
                  <Code className="h-6 w-6 text-blue-600" />
                  <h3 className="text-lg font-semibold text-blue-900">
                    手动安装
                  </h3>
                  <Badge className="bg-green-100 text-green-800">
                    推荐
                  </Badge>
                </div>
                <p className="text-sm text-blue-700">
                  下载源码包，按照步骤手动安装到Chrome浏览器
                </p>
                <a
                  href={loading || !zipName ? undefined : `/${zipName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ width: "100%", display: "block" }}
                >
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={loading || !zipName}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {loading
                      ? "加载中..."
                      : `下载源码包${zipVersion ? `（v${zipVersion}）` : ""}`
                    }
                  </Button>
                </a>
                {versionInfo && (
                  <div className="text-xs text-blue-600 mt-2 space-y-1">
                    <div>
                      文件大小: {(versionInfo.size / (1024 * 1024)).toFixed(2)}{" "}
                      MB
                    </div>
                    <div>
                      构建时间:{" "}
                      {(() => {
                        if (!versionInfo) return "";
                        const { buildDate, createdAt, timestamp } = versionInfo;
                        let date: Date | null = null;
                        if (buildDate) date = new Date(buildDate);
                        else if (createdAt) date = new Date(createdAt);
                        else if (timestamp) date = new Date(Number(timestamp));
                        return date && !isNaN(date.getTime()) ? date.toLocaleString() : "无";
                      })()}
                    </div>
                    {versionInfo.git &&
                      versionInfo.git.commitHash !== "unknown" && (
                        <div>
                          Git: {versionInfo.git.commitHash} (
                          {versionInfo.git.branch})
                        </div>
                      )}
                  </div>
                )}

                </div>

              {/* Chrome Web Store (如果将来有的话) */}
              <div className="space-y-4 p-6 border-2 border-gray-200 rounded-xl bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <ExternalLink className="h-6 w-6 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Chrome Web Store
                  </h3>
                  <Badge className="bg-gray-100 text-gray-800">
                    即将推出
                  </Badge>
                </div>
                <p className="text-sm text-gray-700">
                  即将在Chrome Web Store上架，敬请期待
                </p>
                <Button
                  onClick={openChromeWebStore}
                  variant="outline"
                  disabled
                  className="w-full border-gray-300 text-gray-500 hover:bg-gray-50"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  即将推出
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 手动安装步骤 */}
        <Card className="shadow-xl border-0 bg-white/70 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-lg pb-4 lg:pb-6">
            <CardTitle className="flex items-center gap-2 lg:gap-3 text-purple-900 text-lg lg:text-xl">
              <FileText className="h-5 w-5 lg:h-6 lg:w-6" />
              手动安装步骤
            </CardTitle>
            <CardDescription className="text-purple-700 text-sm lg:text-base">
              按照以下步骤在Chrome浏览器中安装扩展程序
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-6 py-6 lg:space-y-8">
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-purple-900 mb-2">
                    下载并解压
                  </h4>
                  <p className="text-sm text-purple-700">
                    下载background-open.zip文件并解压到本地文件夹
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-purple-900 mb-2">
                    打开Chrome扩展管理
                  </h4>
                  <p className="text-sm text-purple-700">
                    在Chrome地址栏输入 chrome://extensions/ 或通过菜单 更多工具 &gt; 扩展程序
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-purple-900 mb-2">
                    启用开发者模式
                  </h4>
                  <p className="text-sm text-purple-700">
                    在扩展程序页面右上角打开"开发者模式"开关
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-purple-900 mb-2">
                    加载已解压的扩展程序
                  </h4>
                  <p className="text-sm text-purple-700">
                    点击"加载已解压的扩展程序"按钮，选择解压后的文件夹
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  5
                </div>
                <div>
                  <h4 className="font-semibold text-purple-900 mb-2">
                    完成安装
                  </h4>
                  <p className="text-sm text-purple-700">
                    扩展程序安装成功后会出现在扩展列表中，可以固定到工具栏
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 典型使用场景卡片 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col gap-2 my-6">
          <h4 className="font-semibold text-blue-900 mb-1">
            典型使用场景
          </h4>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 bg-white/80 rounded-lg p-3 border border-blue-100">
              <div className="font-bold text-blue-700 mb-1">
                多URL
              </div>
              <div className="text-sm text-blue-800">
                所有在跑offer日常补点击，灵活设定循环次数，慢慢补
              </div>
            </div>
            <div className="flex-1 bg-white/80 rounded-lg p-3 border border-blue-100">
              <div className="font-bold text-blue-700 mb-1">
                单URL
              </div>
              <div className="text-sm text-blue-800">
                针对出单的offer快速补点击，最大支持一次补1000个，狠狠补
              </div>
            </div>
          </div>
        </div>

        {/* Auto Refresh Plus 推荐 */}
        <Card className="shadow-xl border-0 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardHeader className="pb-4 lg:pb-6">
            <CardTitle className="flex items-center gap-2 lg:gap-3 text-amber-900 text-lg lg:text-xl">
              <Info className="h-5 w-5 lg:h-6 lg:w-6 text-amber-600" />
              推荐配合插件
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-amber-100 rounded-lg">
                <div className="text-2xl">🔄</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900">
                    Auto Refresh Plus
                  </h3>
                  <p className="text-sm text-amber-700">
                    自动刷新页面，支持自定义间隔时间，配合Background Open扩展程序使用效果更佳
                  </p>
                </div>
                <Button
                  onClick={() =>
                    window.open(
                      "https://chromewebstore.google.com/detail/auto-refresh-plus-page-mo/hgeljhfekpckiiplhkigfehkdpldcggm",
                      "_blank",
                    )
                  }
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  安装
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 返回首页 */}
        <div className="text-center">
          <Button
            onClick={handleGoHome}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
          >
            <ArrowRight className="mr-2 h-5 w-5" />
            返回首页开始使用
          </Button>
        </div>
      </main>
    </div>
  );
}