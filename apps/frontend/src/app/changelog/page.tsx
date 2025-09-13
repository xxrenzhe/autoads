"use client";

import { UI_CONSTANTS } from "@/components/ui/ui-constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import versionDatesRaw from "@/lib/version-dates.json";
import {
  BarChart3,
  CheckCircle,
  Chrome,
  ExternalLink,
  Globe,
  Play,
  Zap,
} from "lucide-react";
import Link from "next/link";

const versionDates: Record<string, { en: string; zh: string }> =
  versionDatesRaw as Record<string, { en: string; zh: string }>;

export default function ChangelogPage() {
  // 始终显示中文内容，移除语言判断
  const changelog = [
    {
      version: "v2.4.0",
      features: [
        {
          icon: <Zap className="h-5 w-5 text-blue-600 mr-2" />,
          text: "Batchopen静默版上线：零插件实现云端真实访问！"
        },
        {
          icon: <Globe className="h-5 w-5 text-green-600 mr-2" />,
          text: "Batchopen静默版自由定制访问来源！Referer一键设定，无痕访问随心控！"
        },
        {
          icon: <BarChart3 className="h-5 w-5 text-purple-600 mr-2" />,
          text: "Siterank升级SimilarWeb权威数据源！排名流量诊断精准度暴涨！"
        },
        {
          icon: <ExternalLink className="h-5 w-5 text-orange-600 mr-2" />,
          text: "Google Ads自动管理Beta版本上线！"
        },
        {
          icon: <CheckCircle className="h-5 w-5 text-indigo-600 mr-2" />,
          text: "页面UI优化，突出\"功能优先\"的原则！"
        },
      ],
    },
    {
      version: "v2.3.0",
      features: [
        {
          icon: <Globe className="h-5 w-5 text-blue-600 mr-2" />,
          text: "品牌正式升级为AutoAds，首页大改版"
        },
        {
          icon: <Zap className="h-5 w-5 text-green-600 mr-2" />,
          text: "新增多URL模式随机数功能"
        },
        {
          icon: <CheckCircle className="h-5 w-5 text-purple-600 mr-2" />,
          text: "进度条显示优化，支持剩余时间提示"
        },
        {
          icon: <Chrome className="h-5 w-5 text-orange-600 mr-2" />,
          text: "清空功能改进，保留输入内容"
        },
        {
          icon: <Play className="h-5 w-5 text-indigo-600 mr-2" />,
          text: "参数修改即时生效，支持动态调整"
        },
      ],
    },
    {
      version: "v2.2.0",
      features: [
        {
          icon: <Globe className="h-5 w-5 text-blue-600 mr-2" />,
          text: "全新首页设计：专业导航页面展示三大核心功能模块"
        },
        {
          icon: <Zap className="h-5 w-5 text-green-600 mr-2" />,
          text: "批量处理功能独立页面：/batchopen 提供完整批量处理体验"
        },
        {
          icon: <CheckCircle className="h-5 w-5 text-purple-600 mr-2" />,
          text: "随机数功能：高级版多URL模式支持打开次数随机化"
        },
        {
          icon: <Chrome className="h-5 w-5 text-orange-600 mr-2" />,
          text: "品牌升级为 AutoAds，支持多域名访问体验"
        },
        {
          icon: <BarChart3 className="h-5 w-5 text-indigo-600 mr-2" />,
          text: "自动化广告模块正式上线，支持智能链接管理和投放优化"
        },
      ],
    },
    {
      version: "v2.1.0",
      features: [
        {
          icon: <Zap className="h-5 w-5 text-blue-600 mr-2" />,
          text: "新增批量打开高级版，支持循环次数、间隔、单/多URL模式"
        },
        {
          icon: <CheckCircle className="h-5 w-5 text-green-600 mr-2" />,
          text: "基础版批量打开体验优化，进度条与清空功能更直观"
        },
        {
          icon: <Globe className="h-5 w-5 text-purple-600 mr-2" />,
          text: "支持中英文切换，自动识别浏览器语言"
        },
        {
          icon: <BarChart3 className="h-5 w-5 text-indigo-600 mr-2" />,
          text: "网站排名分析功能升级，支持批量优先级计算"
        },
        {
          icon: <ExternalLink className="h-5 w-5 text-green-600 mr-2" />,
          text: "导出功能增强，支持TXT/CSV多格式"
        },
      ],
    },
    {
      version: "v2.0.0",
      features: [
        {
          icon: <Chrome className="h-5 w-5 text-blue-600 mr-2" />,
          text: "新增Background Open浏览器扩展，支持高级批量打开"
        },
        {
          icon: <CheckCircle className="h-5 w-5 text-green-600 mr-2" />,
          text: "移动端适配优化，手机/平板体验更佳"
        },
        {
          icon: <BarChart3 className="h-5 w-5 text-indigo-600 mr-2" />,
          text: "新增网站排名分析入口"
        },
      ],
    },
    {
      version: "v1.0.0",
      features: [
        {
          icon: <CheckCircle className="h-5 w-5 text-green-600 mr-2" />,
          text: "首个正式版本，支持批量URL检测、结果导出"
        },
      ],
    },
  ];

  return (
    <div className={`min-h-screen ${UI_CONSTANTS.gradients.hero}`}>
      <main className="max-w-4xl mx-auto p-4 lg:p-6">
        <div className="text-center mb-8">
          <h1 className={UI_CONSTANTS.typography.h1 + " text-gray-900 mb-3"}>
            更新日志
          </h1>
          <p className={`${UI_CONSTANTS.typography.subtitle} max-w-2xl mx-auto`}>
            记录 AutoAds 平台的每个重要更新和功能改进
          </p>
        </div>
        <div className="space-y-6">
          {changelog.map((log, idx: any) => (
            <div key={log.version} className={UI_CONSTANTS.cards.featured + " p-6 hover:scale-[1.01] transition-transform duration-300"}>
              <div className="flex flex-row items-center justify-between pb-3 mb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-base">{log.version.replace('v', '')}</span>
                  </div>
                  <div>
                    <h2 className={UI_CONSTANTS.typography.h2 + " text-gray-900"}>
                      {log.version}
                    </h2>
                    <p className="text-xs text-gray-500">
                      {versionDates[log.version]?.zh || "-"}
                    </p>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {log.features.map((f, featureIdx: any) => (
                  <div
                    key={featureIdx}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {f.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 text-base leading-relaxed">
                        {f.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-12">
          <Link href="/" className="w-full sm:w-auto">
            <button className={`${UI_CONSTANTS.buttons.primary} w-full flex items-center justify-center gap-2 text-sm px-4 py-2`}>
              <Globe className="h-4 w-4" />
              返回首页
            </button>
          </Link>
          <Link href="/batchopen" className="w-full sm:w-auto">
            <button className={`${UI_CONSTANTS.buttons.secondary} w-full flex items-center justify-center gap-2 text-sm px-4 py-2`}>
              <Zap className="h-4 w-4" />
              批量处理
            </button>
          </Link>
          <Link href="/siterank" className="w-full sm:w-auto">
            <button className={`${UI_CONSTANTS.buttons.success} w-full flex items-center justify-center gap-2 text-sm px-4 py-2`}>
              <BarChart3 className="h-4 w-4" />
              网站排名分析
            </button>
          </Link>
          <Link href="/adscenter" className="w-full sm:w-auto">
            <button className={`${UI_CONSTANTS.buttons.outline} w-full flex items-center justify-center gap-2 text-sm px-4 py-2`}>
              <ExternalLink className="h-4 w-4" />
              自动化广告
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}
