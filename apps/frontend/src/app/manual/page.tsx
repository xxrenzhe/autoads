"use client";

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
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Globe,
  HelpCircle,
  Info,
  Lightbulb,
  Lock,
  Play,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  Shield,
  Star,
  Target,
  TrendingUp,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";

export default function ManualPage() {
  const { t, locale, isLoading } = useLanguage();

  // Only show loading if language context is still loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-6xl mx-auto p-4 lg:p-6">
          <div className="h-96 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: <Globe className="h-6 w-6" />,
      title: locale === "zh" ? "批量URL处理" : "Batch URL Processing",
      description:
        locale === "zh"
          ? "一次性处理多个URL，支持短链接解析、重定向检测和最终URL获取"
          : "Process multiple URLs at once with short link resolution, redirect detection, and final URL extraction",
      color: "blue",
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: locale === "zh" ? "网站排名分析" : "Site Ranking Analysis",
      description:
        locale === "zh"
          ? "集成Open PageRank API，分析网站权威性和优先级，助力决策制定"
          : "Integrated Open PageRank API for website authority analysis and priority calculation",
      color: "purple",
    },
    {
      icon: <Upload className="h-6 w-6" />,
      title: locale === "zh" ? "多格式文件支持" : "Multi-Format File Support",
      description:
        locale === "zh"
          ? "支持CSV、XLSX、XLS格式文件上传，自动解析URL列表"
          : "Support CSV, XLSX, XLS file uploads with automatic URL list parsing",
      color: "green",
    },
    {
      icon: <Download className="h-6 w-6" />,
      title: locale === "zh" ? "数据导出功能" : "Data Export Features",
      description:
        locale === "zh"
          ? "支持TXT、CSV格式导出，包含原始URL、最终URL、域名、排名等信息"
          : "Export data in TXT and CSV formats with original URLs, final URLs, domains, and rankings",
      color: "orange",
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: locale === "zh" ? "隐私优先设计" : "Privacy-First Design",
      description:
        locale === "zh"
          ? "纯前端实现，不存储任何用户数据，确保数据安全和隐私保护"
          : "Pure frontend implementation with no data storage, ensuring data security and privacy",
      color: "red",
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: locale === "zh" ? "智能批量打开" : "Smart Batch Opening",
      description:
        locale === "zh"
          ? "支持基础版本和高级版本，满足不同场景的URL批量打开需求"
          : "Support basic and advanced versions for different URL batch opening scenarios",
      color: "indigo",
    },
  ];

  const useCases = [
    {
      icon: <Search className="h-5 w-5" />,
      title: locale === "zh" ? "SEO优化分析" : "SEO Optimization Analysis",
      description:
        locale === "zh"
          ? "验证链接结构、分析重定向链、优化网站SEO表现"
          : "Validate link structures, analyze redirect chains, optimize website SEO performance",
    },
    {
      icon: <Target className="h-5 w-5" />,
      title: locale === "zh" ? "竞争对手监控" : "Competitor Monitoring",
      description:
        locale === "zh"
          ? "监控竞争对手URL策略、分析排名变化趋势"
          : "Monitor competitor URL strategies and analyze ranking trends",
    },
    {
      icon: <Users className="h-5 w-5" />,
      title: locale === "zh" ? "社交媒体分析" : "Social Media Analysis",
      description:
        locale === "zh"
          ? "分析社交媒体链接效果、跟踪传播路径"
          : "Analyze social media link effectiveness and track propagation paths",
    },
    {
      icon: <Shield className="h-5 w-5" />,
      title: locale === "zh" ? "安全威胁检测" : "Security Threat Detection",
      description:
        locale === "zh"
          ? "检测可疑URL模式、监控恶意域名活动"
          : "Detect suspicious URL patterns and monitor malicious domain activities",
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      title: locale === "zh" ? "数据质量验证" : "Data Quality Validation",
      description:
        locale === "zh"
          ? "验证数据源URL有效性、确保数据完整性"
          : "Validate data source URL validity and ensure data integrity",
    },
    {
      icon: <Rocket className="h-5 w-5" />,
      title: locale === "zh" ? "营销活动追踪" : "Marketing Campaign Tracking",
      description:
        locale === "zh"
          ? "追踪营销链接效果、分析转化路径"
          : "Track marketing link effectiveness and analyze conversion paths",
    },
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: "bg-blue-50 border-blue-200 text-blue-800",
      purple: "bg-purple-50 border-purple-200 text-purple-800",
      green: "bg-green-50 border-green-200 text-green-800",
      orange: "bg-orange-50 border-orange-200 text-orange-800",
      red: "bg-red-50 border-red-200 text-red-800",
      indigo: "bg-indigo-50 border-indigo-200 text-indigo-800",
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-4xl font-bold text-gray-900">
                {locale === "zh" ? "使用手册" : "User Manual"}
              </h1>
            </div>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              {locale === "zh"
                ? "AutoAds 专业URL分析与真实点击工具的完整使用指南。从基础操作到高级功能，助您高效处理URL数据。"
                : "Complete user guide for AutoAds professional URL analysis and batch processing tool. From basic operations to advanced features, helping you efficiently process URL data."}
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 lg:px-6 py-8">
        {/* Quick Start Section */}
        <section className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {locale === "zh" ? "快速开始" : "Quick Start"}
            </h2>
            <p className="text-lg text-gray-600">
              {locale === "zh"
                ? "3步快速上手，立即开始URL分析"
                : "Get started in 3 steps and begin URL analysis immediately"}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-blue-600 font-bold text-lg">1</span>
                </div>
                <CardTitle className="text-lg">
                  {locale === "zh" ? "输入URL" : "Input URLs"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  {locale === "zh"
                    ? "在文本区域输入URL（每行一个）或上传CSV/Excel文件"
                    : "Enter URLs in the text area (one per line) or upload CSV/Excel files"}
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-green-600 font-bold text-lg">2</span>
                </div>
                <CardTitle className="text-lg">
                  {locale === "zh" ? "自动检测" : "Auto Detect"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  {locale === "zh"
                    ? '点击"自动检测"开始真实点击URL，获取最终URL和排名信息'
                    : "Click 'Auto Detect' to start batch processing and get final URLs and ranking information"}
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-purple-600 font-bold text-lg">3</span>
                </div>
                <CardTitle className="text-lg">
                  {locale === "zh" ? "查看结果" : "View Results"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  {locale === "zh"
                    ? "查看分析结果，导出数据或使用批量打开功能"
                    : "View analysis results, export data or use batch opening features"}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Core Features Section */}
        <section className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {locale === "zh" ? "核心功能" : "Core Features"}
            </h2>
            <p className="text-lg text-gray-600">
              {locale === "zh"
                ? "专业级URL处理工具，满足各种分析需求"
                : "Professional URL processing tools to meet various analysis needs"}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature: any) => (
              <Card
                key={feature.title}
                className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <CardHeader>
                  <div
                    className={`w-12 h-12 ${getColorClasses(feature.color)} rounded-lg flex items-center justify-center mb-4`}
                  >
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {locale === "zh" ? "应用场景" : "Use Cases"}
            </h2>
            <p className="text-lg text-gray-600">
              {locale === "zh"
                ? "适用于各种URL分析和数据处理场景"
                : "Suitable for various URL analysis and data processing scenarios"}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {useCases.map((useCase: any) => (
              <Card
                key={useCase.title}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      {useCase.icon}
                    </div>
                    <CardTitle className="text-base">{useCase.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm">{useCase.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Batch Open Feature Section */}
        <section className="mb-12">
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <div className="flex items-center mb-4">
                <Zap className="h-6 w-6 text-blue-600 mr-3" />
                <CardTitle className="text-2xl text-blue-900">
                  {locale === "zh" ? "批量打开功能" : "Batch Open Feature"}
                </CardTitle>
              </div>
              <CardDescription className="text-lg">
                {locale === "zh"
                  ? "支持基础版本和高级版本的URL批量打开功能"
                  : "Support for basic and advanced URL batch opening features"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg p-6 border border-blue-200">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3">
                    {locale === "zh" ? "基础版本" : "Basic Version"}
                  </h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>
                        {locale === "zh"
                          ? "无需安装插件，即开即用"
                          : "No plugin required, ready to use"}
                      </span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>
                        {locale === "zh"
                          ? "支持多URL批量打开"
                          : "Support multi-URL batch opening"}
                      </span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>
                        {locale === "zh"
                          ? "手动清空已打开标签页"
                          : "Manual clearing of opened tabs"}
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="bg-white rounded-lg p-6 border border-purple-200">
                  <h3 className="text-lg font-semibold text-purple-900 mb-3">
                    {locale === "zh" ? "高级版本" : "Advanced Version"}
                  </h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>
                        {locale === "zh"
                          ? "需要"
                          : "Requires "}
                        <Link 
                          href="/background-open-install" 
                          className="text-blue-600 hover:text-blue-800 underline font-medium"
                        >
                          Background Open
                        </Link>
                        {locale === "zh"
                          ? "插件"
                          : " plugin"}
                      </span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>
                        {locale === "zh"
                          ? "支持多URL模式和单URL模式"
                          : "Support multi-URL and single-URL modes"}
                      </span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>
                        {locale === "zh"
                          ? "循环次数和间隔参数控制"
                          : "Cycle count and interval parameter control"}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Tips & Best Practices */}
        <section className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {locale === "zh" ? "使用技巧" : "Tips & Best Practices"}
            </h2>
            <p className="text-lg text-gray-600">
              {locale === "zh"
                ? "提升使用效率的专业建议"
                : "Professional tips to improve efficiency"}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <div className="flex items-center">
                  <Lightbulb className="h-5 w-5 text-orange-600 mr-2" />
                  <CardTitle className="text-orange-900">
                    {locale === "zh" ? "性能优化" : "Performance Tips"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-orange-800">
                <ul className="space-y-2">
                  <li>
                    •{" "}
                    {locale === "zh"
                      ? "建议每次处理不超过1000个URL"
                      : "Recommend processing no more than 1000 URLs at once"}
                  </li>
                  <li>
                    •{" "}
                    {locale === "zh"
                      ? "使用CSV文件批量导入大量URL"
                      : "Use CSV files for bulk importing large numbers of URLs"}
                  </li>
                  <li>
                    •{" "}
                    {locale === "zh"
                      ? "定期清理浏览器缓存以提升性能"
                      : "Regularly clear browser cache to improve performance"}
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <div className="flex items-center">
                  <Shield className="h-5 w-5 text-green-600 mr-2" />
                  <CardTitle className="text-green-900">
                    {locale === "zh" ? "安全建议" : "Security Tips"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-green-800">
                <ul className="space-y-2">
                  <li>
                    •{" "}
                    {locale === "zh"
                      ? "避免处理来源不明的可疑URL"
                      : "Avoid processing suspicious URLs from unknown sources"}
                  </li>
                  <li>
                    •{" "}
                    {locale === "zh"
                      ? "定期更新浏览器和扩展程序"
                      : "Regularly update browsers and extensions"}
                  </li>
                  <li>
                    •{" "}
                    {locale === "zh"
                      ? "使用HTTPS链接确保数据传输安全"
                      : "Use HTTPS links to ensure secure data transmission"}
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Call to Action */}
        <section className="text-center py-12">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
            <h2 className="text-3xl font-bold mb-4">
              {locale === "zh" ? "准备开始了吗？" : "Ready to Get Started?"}
            </h2>
            <p className="text-xl mb-8 opacity-90">
              {locale === "zh"
                ? "立即体验专业的URL分析工具"
                : "Experience professional URL analysis tools immediately"}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/">
                <Button
                  size="lg"
                  className="bg-white text-blue-600 hover:bg-gray-100"
                >
                  <Play className="h-5 w-5 mr-2" />
                  {locale === "zh" ? "开始使用" : "Get Started"}
                </Button>
              </Link>
              <Link href="/siterank">
                <Button
                  size="lg"
                  className="bg-white/10 border-white text-white hover:bg-white hover:text-blue-600 backdrop-blur-sm"
                >
                  <BarChart3 className="h-5 w-5 mr-2" />
                  {locale === "zh" ? "排名分析" : "Ranking Analysis"}
                </Button>
              </Link>
              <Link href="/background-open-install">
                <Button
                  size="lg"
                  className="bg-white/10 border-white text-white hover:bg-white hover:text-blue-600 backdrop-blur-sm"
                >
                  <ExternalLink className="h-5 w-5 mr-2" />
                  {locale === "zh" ? "安装扩展" : "Install Extension"}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
