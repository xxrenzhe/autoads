"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { ProtectedFeature } from "@/components/auth/ProtectedFeature";
import { AuthenticatedBatchOpen } from "@/components/auth/AuthenticatedBatchOpen";
import { UI_CONSTANTS } from "@/components/ui/ui-constants";
import GenericStepsSection from "@/components/common/GenericStepsSection";
import { Link, Zap, Shield, Globe } from "lucide-react";

interface AuthenticatedClientPageProps {
  currentPage?: string;
}

export default function AuthenticatedClientPage({ 
  currentPage = "batchopen" 
}: AuthenticatedClientPageProps) {
  const { t, isLoading, locale } = useLanguage();

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

  const displayLocale = locale || 'zh-CN';

  return (
    <div className={`min-h-screen ${UI_CONSTANTS.gradients.hero}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* 页面标题 */}
          <div className="text-center mb-12">
            <h1 className={UI_CONSTANTS.typography.h1}>真实点击</h1>
            <p className={`${UI_CONSTANTS.typography.subtitle} max-w-3xl mx-auto`}>
              零插件实现云端真实访问，支持代理IP轮换，Referer随心设置，真实模拟用户请求
            </p>
          </div>

          {/* 认证保护的批量打开功能 */}
          <div className="mt-12">
            <ProtectedFeature
              feature="批量打开URL"
              title="解锁批量打开功能"
              description="登录后即可使用智能批量访问功能，支持动态代理IP和自定义Referer，大幅提升工作效率"
              icon={<Zap className="h-8 w-8 text-white" />}
              requireAuth={true}
              showFallback={true}
            >
              <AuthenticatedBatchOpen locale={displayLocale} t={t} />
            </ProtectedFeature>
          </div>

          {/* 功能介绍步骤 */}
          <div className="mt-16">
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
                  )
                },
                {
                  number: 2,
                  icon: <Shield className="w-6 h-6" />,
                  title: "智能处理",
                  description: "云端真实访问，自动代理IP轮换",
                  content: (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <Shield className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 text-base">
                            代理IP轮换
                          </h4>
                          <p className="text-sm text-gray-600">
                            自动切换不同地区的代理IP，避免被检测
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                          <Globe className="w-4 h-4 text-orange-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 text-base">
                            真实浏览器环境
                          </h4>
                          <p className="text-sm text-gray-600">
                            使用真实浏览器内核，完全模拟用户行为
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                },
                {
                  number: 3,
                  icon: <Zap className="w-6 h-6" />,
                  title: "获取结果",
                  description: "实时查看访问状态和统计数据",
                  content: (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <Zap className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 text-base">
                            实时进度
                          </h4>
                          <p className="text-sm text-gray-600">
                            实时显示访问进度和成功率统计
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-sm">✓</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 text-base">
                            详细报告
                          </h4>
                          <p className="text-sm text-gray-600">
                            生成详细的访问报告，支持导出分析
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                }
              ]}
            />
          </div>

          {/* 功能特色 */}
          <div className="mt-16 bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                为什么选择我们的真实点击服务？
              </h2>
              <p className="text-gray-600">
                专业的云端访问解决方案，让您的营销更高效
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-blue-50 rounded-xl">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">安全可靠</h3>
                <p className="text-sm text-gray-600">
                  企业级安全保障，数据加密传输，保护您的隐私
                </p>
              </div>

              <div className="text-center p-6 bg-green-50 rounded-xl">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">高效快速</h3>
                <p className="text-sm text-gray-600">
                  并发处理，智能调度，大幅提升处理效率
                </p>
              </div>

              <div className="text-center p-6 bg-purple-50 rounded-xl">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">全球覆盖</h3>
                <p className="text-sm text-gray-600">
                  多地区代理节点，模拟真实用户地理分布
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}