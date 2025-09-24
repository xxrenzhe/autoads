"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, BarChart3, Link as LinkIcon, Zap } from "lucide-react";
import { DeploymentBanner } from "@/components/DeploymentStatus";
import { GenericHeroSection } from "@/components/common/GenericHeroSection";

export default function HomePage() {
  const { isLoading } = useLanguage();

  // 检测并存储邀请码
  useEffect(() => {
    const trackInvitationClick = async (invitationCode: string) => {
      try {
        // Track the click (optional, for analytics)
        await fetch('/api/invitation/track-click', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ invitationCode })
        });
        
        // Store in localStorage for later use
        localStorage.setItem('pendingInvitationCode', invitationCode);
        
        // Clean URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        
        console.log('Invitation code tracked and stored:', invitationCode);
      } catch (error) {
        console.error('Failed to track invitation click:', error);
        // Still store locally even if tracking fails
        localStorage.setItem('pendingInvitationCode', invitationCode);
      }
    };

    // 从URL参数中获取邀请码
    const urlParams = new URLSearchParams(window.location.search);
    const invitationCode = urlParams.get('invite') || urlParams.get('invitation');
    
    if (invitationCode) {
      trackInvitationClick(invitationCode);
    }
  }, []);

  // 追踪CTA点击事件
  const handleCTAClick = (ctaType: string) => {
    // A/B testing removed - tracking disabled
  };

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 部署状态横幅 - 仅在测试环境显示 */}
      <DeploymentBanner />
      
      {/* Hero Section */}
      <GenericHeroSection 
        title="AutoAds"
        description="专业的URL分析与自动化营销平台，为您的数字营销提供全方位解决方案"
        className="relative py-12 px-4"
        titleClassName="hero-title text-[clamp(4rem,8vw,8rem)] font-bold mb-[1.5rem] leading-[1] bg-[linear-gradient(135deg,#2563eb,#7c3aed)] [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [background-clip:text]"
        titleTag="h1"
        descriptionClassName="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed"
      >
        {/* 核心价值主张 */}
        <div className="grid md:grid-cols-3 gap-6 mb-10 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">高效处理</h3>
            <p className="text-gray-600 text-sm">真实点击数千个URL，节省90%时间</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">精准分析</h3>
            <p className="text-gray-600 text-sm">专业的网站排名与权威度评估</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <LinkIcon className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">智能自动化</h3>
            <p className="text-gray-600 text-sm">自动化广告投放与链接管理</p>
          </div>
        </div>
      </GenericHeroSection>

      {/* 三大功能模块 */}
      <section className="py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              核心功能
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              三大专业工具，满足您的所有数字营销需求
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* 真实点击 */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-all duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                真实点击
              </h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                零插件实现云端真实访问，通过后端Chromium浏览器实现真实的浏览器访问，支持代理IP轮换、自定义Referer等功能，完全模拟用户行为。
              </p>
              <ul className="text-sm text-gray-600 mb-8 space-y-2">
                <li className="flex items-center">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></div>
                  后端Chromium渲染
                </li>
                <li className="flex items-center">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></div>
                  代理IP自动轮换
                </li>
                <li className="flex items-center">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></div>
                  自定义Referer设置
                </li>
                <li className="flex items-center">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></div>
                  真实用户行为模拟
                </li>
              </ul>
              <Link 
                href="/batchopen"
                className="inline-flex items-center justify-center w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 group-hover:shadow-lg"
              >
                立即使用
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </div>

            {/* 网站排名分析 */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-all duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">网站排名分析</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">专业的网站权威度评估和排名分析工具。提供全球排名、PageRank评分，智能计算测试优先级。</p>
              <ul className="text-sm text-gray-600 mb-8 space-y-2">
                <li className="flex items-center">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-3"></div>全球排名查询</li>
                <li className="flex items-center">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-3"></div>PageRank评分</li>
                <li className="flex items-center">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-3"></div>优先级计算</li>
                <li className="flex items-center">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-3"></div>数据导出</li>
              </ul>
              <Link 
                href="/siterank"
                className="inline-flex items-center justify-center w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 group-hover:shadow-lg"
              >立即使用<ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </div>

            {/* 自动化广告 */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-all duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <LinkIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">自动化广告</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">智能的广告链接管理和自动化投放系统。支持链接替换、转化跟踪、ROI优化等高级功能。</p>
              <ul className="text-sm text-gray-600 mb-8 space-y-2">
                <li className="flex items-center">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-3"></div>智能链接替换</li>
                <li className="flex items-center">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-3"></div>转化跟踪</li>
                <li className="flex items-center">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-3"></div>ROI优化</li>
                <li className="flex items-center">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-3"></div>自动化投放</li>
              </ul>
              <Link 
                href="/adscenter"
                className="inline-flex items-center justify-center w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-300 group-hover:shadow-lg"
                onClick={() => handleCTAClick('automation')}
              >
                立即使用
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 统计数据 */}
      <section className="py-10 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">10K+</div>
              <div className="text-gray-600">活跃用户</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-green-600 mb-2">1M+</div>
              <div className="text-gray-600">处理URL</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-purple-600 mb-2">99.9%</div>
              <div className="text-gray-600">服务可用性</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-orange-600 mb-2">24/7</div>
              <div className="text-gray-600">技术支持</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 px-4 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">准备开始了吗？</h2>
          <p className="text-xl mb-8 opacity-90">立即体验AutoAds的强大功能，提升您的数字营销效率</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/batchopen"
              className="inline-flex items-center justify-center bg-white text-blue-600 font-semibold py-3 px-8 rounded-xl hover:bg-gray-50 transition-all duration-300"
            >开始真实点击<ArrowRight className="w-5 h-5 ml-2" />
            </Link>
            <Link 
              href="/siterank"
              className="inline-flex items-center justify-center border-2 border-white text-white font-semibold py-3 px-8 rounded-xl hover:bg-white hover:text-blue-600 transition-all duration-300"
            >分析网站排名<BarChart3 className="w-5 h-5 ml-2" />
            </Link>
            <Link 
              href="/adscenter"
              className="inline-flex items-center justify-center border-2 border-white text-white font-semibold py-3 px-8 rounded-xl hover:bg-white hover:text-purple-600 transition-all duration-300"
              onClick={() => handleCTAClick('automation_cta')}
            >配置自动化广告<LinkIcon className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
