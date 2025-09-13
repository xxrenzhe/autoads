"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { UI_CONSTANTS } from "@/components/ui/ui-constants";
import GenericStepsSection from "@/components/common/GenericStepsSection";
import { BatchOpenSection } from "@/components/BatchOpenSection";
import { Link, Zap, Shield, Globe } from "lucide-react";

export default function BatchOpenClientPage() {
  const { t, isLoading, locale } = useLanguage();

  // 如果语言还在加载中，显示加载状态
  if (isLoading) => {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"
            role="status"
            aria-label="页面加载中"
          />
          <p className="text-gray-600" aria-live="polite">Loading...</p>
          <span className="sr-only">正在加载页面内容，请稍候</span>
        </div>
      </div>
    );
  }

  const displayLocale = locale || 'zh-CN';

  return (
    <div className={`min-h-screen ${UI_CONSTANTS.gradients.hero}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* 页面标题 */}
          <header className="text-center mb-12">
            <h1 className={UI_CONSTANTS.typography.h1}>真实点击</h1>
            <p className={`${UI_CONSTANTS.typography.subtitle} max-w-3xl mx-auto`}>
              零插件实现云端真实访问，支持代理IP轮换，Referer随心设置，真实模拟用户请求
            </p>
          </header>

          {/* 批量打开功能 - 免登录访问，但功能按钮需要登录 */}
          <main className="mt-12" role="main" aria-labelledby="batch-open-title">
            <BatchOpenSection locale={displayLocale} t={t} />
          </main>

          {/* 功能介绍步骤 */}
          <section className="mt-16" aria-labelledby="steps-title">
            <GenericStepsSection
              title="简单三步操作"
              subtitle="选择适合的版本，轻松实现批量访问"
              steps={[
                {
                  number: 1,
                  icon: <Link className="w-6 h-6" />,
                  title: "选择版本",
                  description: "根据需求选择初级、静默或自动化版本",
                  content: (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-sm">1</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 text-base">
                            初级版本
                          </h4>
                          <p className="text-sm text-gray-600">
                            简单批量打开，无需安装插件
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-purple-600 font-semibold text-sm">2</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 text-base">
                            静默版本
                          </h4>
                          <p className="text-sm text-gray-600">
                            云端真实访问，支持代理IP和自定义Referer
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-green-600 font-semibold text-sm">3</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 text-base">
                            自动化版本
                          </h4>
                          <p className="text-sm text-gray-600">
                            定时任务，智能调度，24小时自动化运行
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                },
                {
                  number: 2,
                  icon: <Shield className="w-6 h-6" />,
                  title: "配置参数",
                  description: "灵活配置访问参数，满足不同场景需求",
                  content: (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <Shield className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 text-base">
                            代理IP配置
                          </h4>
                          <p className="text-sm text-gray-600">
                            支持多种代理协议，自动获取和验证代理池
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                          <Globe className="w-4 h-4 text-orange-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 text-base">
                            访问模式选择
                          </h4>
                          <p className="text-sm text-gray-600">
                            HTTP快速访问或Puppeteer真实浏览器渲染
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-sm">⚙️</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 text-base">
                            高级参数
                          </h4>
                          <p className="text-sm text-gray-600">
                            循环次数、访问间隔、随机化策略等
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                },
                {
                  number: 3,
                  icon: <Zap className="w-6 h-6" />,
                  title: "开始执行",
                  description: "一键启动，实时监控，获取详细报告",
                  content: (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <Zap className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 text-base">
                            实时监控
                          </h4>
                          <p className="text-sm text-gray-600">
                            进度条实时显示，成功率和失败率一目了然
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-sm">📊</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 text-base">
                            详细统计
                          </h4>
                          <p className="text-sm text-gray-600">
                            访问时长、状态码、错误信息等完整记录
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-purple-600 font-semibold text-sm">🔄</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 text-base">
                            任务管理
                          </h4>
                          <p className="text-sm text-gray-600">
                            支持暂停、终止、重试等多种操作
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                }
              ]}
            />
          </section>

          {/* 功能特色 */}
          <section className="mt-16 bg-white rounded-2xl shadow-lg p-8" aria-labelledby="features-title">
            <header className="text-center mb-8">
              <h2 id="features-title" className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                为什么选择我们的真实点击服务？
              </h2>
              <p className="text-gray-600">
                专业的云端访问解决方案，让您的营销更高效
              </p>
            </header>

            <div className="grid md:grid-cols-3 gap-6" role="list">
              <div className="text-center p-6 bg-blue-50 rounded-xl" role="listitem">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">安全可靠</h3>
                <p className="text-sm text-gray-600">
                  企业级安全保障，数据加密传输，保护您的隐私
                </p>
              </div>

              <div className="text-center p-6 bg-green-50 rounded-xl" role="listitem">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">高效快速</h3>
                <p className="text-sm text-gray-600">
                  并发处理，智能调度，大幅提升处理效率
                </p>
              </div>

              <div className="text-center p-6 bg-purple-50 rounded-xl" role="listitem">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">全球覆盖</h3>
                <p className="text-sm text-gray-600">
                  多地区代理节点，模拟真实用户地理分布
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}