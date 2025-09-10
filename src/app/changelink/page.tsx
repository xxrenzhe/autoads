'use client';

/**
 * ChangeLink 智能广告管理平台主页
 * 提供广告管理功能的总览和快速入口
 */
import React from 'react';
import Link from 'next/link';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Settings, 
  Activity, 
  Calendar,
  Zap,
  Target,
  Mail,
  ArrowRight,
  Users,
  Globe,
  LayoutDashboard
} from 'lucide-react';
import SimpleDashboard from './components/SimpleDashboard';

export default function ChangeLinkPage() {
  const features = [
    {
      title: '🚀 快速开始',
      description: '通过设置向导快速配置Google Ads账号、广告联盟链接和AdsPower环境，开始自动化链接更新',
      href: '/changelink/setup',
      icon: Zap,
      color: 'bg-blue-100 text-blue-600',
      features: ['设置向导', '配置验证', '测试运行', '一键部署']
    },
    {
      title: '⚙️ 配置管理',
      description: '管理Google Ads账号、AdsPower环境设置、自动化配置和系统参数',
      href: '/changelink/configurations',
      icon: Settings,
      color: 'bg-orange-100 text-orange-600',
      features: ['账号管理', '环境配置', '自动化设置', '系统参数']
    },
    {
      title: '⏰ 任务调度',
      description: '智能任务调度系统，支持定时任务、真实点击、自动化执行和任务监控',
      href: '/changelink/scheduling',
      icon: Calendar,
      color: 'bg-pink-100 text-pink-600',
      features: ['定时任务', '真实点击', '自动执行', '任务监控']
    },
    {
      title: '🖥️ 执行监控',
      description: '实时监控自动化执行状态，查看详细执行记录和日志，包括各个环节的执行时间和变更内容',
      href: '/changelink/executions',
      icon: Activity,
      color: 'bg-purple-100 text-purple-600',
      features: ['实时监控', '执行日志', '状态跟踪', '错误分析']
    },
    {
      title: '📊 数据报告',
      description: '全面的执行数据分析，包含成功率、执行时间、性能指标的趋势分析和可视化报告',
      href: '/changelink/reports',
      icon: BarChart3,
      color: 'bg-green-100 text-green-600',
      features: ['实时数据同步', '多维度分析', '趋势预测', '报告导出']
    }
  ];

  const stats = [
    { label: 'Google Ads账户', value: '多账户', icon: Target, color: 'bg-blue-100 text-blue-600' },
    { label: '链接更新', value: '自动化', icon: Zap, color: 'bg-green-100 text-green-600' },
    { label: '系统可用性', value: '99.9%', icon: Activity, color: 'bg-purple-100 text-purple-600' },
    { label: 'AdsPower集成', value: '支持', icon: Globe, color: 'bg-orange-100 text-orange-600' }
  ];

  return (
    <div className={`min-h-screen ${UI_CONSTANTS.gradients.hero}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className={UI_CONSTANTS.typography.h1}>
              Google Ads自动化管理平台
            </h1>
            <p className={`${UI_CONSTANTS.typography.subtitle} max-w-3xl mx-auto`}>
              通过AdsPower浏览器自动访问广告联盟链接，获取最终官网链接，并自动更新Google Ads配置的智能化解决方案
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {stats.map((stat, index) => (
              <div key={index} className={UI_CONSTANTS.cards.default + " p-6 text-center"}>
                <div className="flex items-center justify-center mb-4">
                  <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {features.map((feature, index) => (
              <div key={index} className={UI_CONSTANTS.cards.featured + " p-6 hover:shadow-xl transition-all duration-300"}>
                <div className="flex items-center space-x-3 mb-4">
                  <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center`}>
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className={UI_CONSTANTS.typography.h3}>{feature.title}</h3>
                </div>
                <p className={`${UI_CONSTANTS.typography.body} mb-4`}>
                  {feature.description}
                </p>
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {feature.features.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-center space-x-2 text-sm text-gray-500">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <Link href={feature.href}>
                  <Button className={`${UI_CONSTANTS.buttons.primary} w-full group`}>
                    立即使用
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          {/* Quick Start Section */}
          <div className={`${UI_CONSTANTS.cards.featured} p-8 mb-8`}>
            <div className="text-center mb-8">
              <h2 className={UI_CONSTANTS.typography.h2 + " text-center mb-4"}>🎯 快速开始</h2>
              <p className={`${UI_CONSTANTS.typography.body} max-w-2xl mx-auto`}>
                按照以下步骤快速开始使用 ChangeLink 自动化平台
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-xl font-bold text-blue-600">1</span>
                </div>
                <h3 className={UI_CONSTANTS.typography.h3}>开始配置</h3>
                <p className={`${UI_CONSTANTS.typography.body}`}>
                  使用设置向导配置Google Ads账号、广告联盟链接和AdsPower环境
                </p>
                <Link href="/changelink/setup">
                  <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                    开始设置
                  </Button>
                </Link>
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-xl font-bold text-green-600">2</span>
                </div>
                <h3 className={UI_CONSTANTS.typography.h3}>监控执行状态</h3>
                <p className={`${UI_CONSTANTS.typography.body}`}>
                  实时监控自动化执行状态，查看详细的执行记录和日志
                </p>
                <Link href="/changelink/executions">
                  <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-50">
                    执行监控
                  </Button>
                </Link>
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-xl font-bold text-purple-600">3</span>
                </div>
                <h3 className={UI_CONSTANTS.typography.h3}>查看报表</h3>
                <p className={`${UI_CONSTANTS.typography.body}`}>
                  查看执行数据分析报表，了解系统性能和优化建议
                </p>
                <Link href="/changelink/reports">
                  <Button variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50">
                    数据报表
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* System Features */}
          <div className={UI_CONSTANTS.cards.default + " p-8"}>
            <div className="text-center mb-8">
              <h2 className={UI_CONSTANTS.typography.h2 + " text-center mb-4"}>✨ 系统特性</h2>
              <p className={`${UI_CONSTANTS.typography.body} max-w-2xl mx-auto`}>
                ChangeLink 平台的核心功能和优势
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Zap className="h-8 w-8 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-900">智能化</h4>
                <p className="text-sm text-gray-600">AI驱动的智能分析和优化建议</p>
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Activity className="h-8 w-8 text-green-600" />
                </div>
                <h4 className="font-semibold text-gray-900">实时监控</h4>
                <p className="text-sm text-gray-600">24/7实时系统监控和健康检查</p>
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                  <Settings className="h-8 w-8 text-purple-600" />
                </div>
                <h4 className="font-semibold text-gray-900">自动化</h4>
                <p className="text-sm text-gray-600">全自动数据收集和报告生成</p>
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                  <Mail className="h-8 w-8 text-orange-600" />
                </div>
                <h4 className="font-semibold text-gray-900">邮件订阅</h4>
                <p className="text-sm text-gray-600">定时邮件报告和智能通知</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 保留原有功能链接作为备用
const LegacyFeaturesPage = () => {
  const features = [
    {
      title: '🚀 快速开始',
      description: '通过设置向导快速配置Google Ads账号、广告联盟链接和AdsPower环境，开始自动化链接更新',
      href: '/changelink/setup',
      icon: Zap,
      color: 'bg-blue-50 text-blue-600',
      features: ['设置向导', '配置验证', '测试运行', '一键部署']
    },
    {
      title: '📊 广告数据报告',
      description: '全面的Google Ads数据分析，包含展现量、点击量、CTR、CPC等关键指标的趋势分析和可视化报告',
      href: '/changelink/reports',
      icon: BarChart3,
      color: 'bg-green-50 text-green-600',
      features: ['实时数据同步', '多维度分析', '趋势预测', '邮件订阅']
    },
    {
      title: '🖥️ 执行监控',
      description: '实时监控自动化执行状态，查看详细执行记录和日志，包括各个环节的执行时间和变更内容',
      href: '/changelink/executions',
      icon: Activity,
      color: 'bg-purple-50 text-purple-600',
      features: ['实时监控', '执行日志', '状态跟踪', '错误分析']
    },
    {
      title: '⏰ 任务调度',
      description: '智能任务调度系统，支持定时任务、真实点击、自动化执行和任务监控',
      href: '/changelink/scheduling',
      icon: Calendar,
      color: 'bg-orange-50 text-orange-600',
      features: ['定时任务', '真实点击', '自动执行', '任务监控']
    },
    {
      title: '⚙️ 系统设置',
      description: '管理Google Ads API配置、AdsPower环境设置、系统参数和数据管理',
      href: '/changelink/settings',
      icon: Settings,
      color: 'bg-gray-50 text-gray-600',
      features: ['API配置', '环境设置', '数据管理', '系统参数']
    }
  ];

  const stats = [
    { label: 'Google Ads账户', value: '多账户', icon: Target },
    { label: '链接更新', value: '自动化', icon: Zap },
    { label: '系统可用性', value: '99.9%', icon: Activity },
    { label: 'AdsPower集成', value: '支持', icon: Mail }
  ];

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* 页面标题 */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          🚀 ChangeLink 自动化链接更新平台
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          通过AdsPower浏览器自动访问广告联盟链接，获取最终官网链接，并自动更新Google Ads配置的智能化解决方案
        </p>
      </div>

      {/* 统计数据 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="text-center">
            <CardContent className="p-4">
              <div className="flex items-center justify-center mb-2">
                <stat.icon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 功能模块 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${feature.color}`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <span>{feature.title}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">{feature.description}</p>
              
              <div className="grid grid-cols-2 gap-2">
                {feature.features.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-center space-x-2 text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              
              <Link href={feature.href}>
                <Button className="w-full group">
                  立即使用
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 快速开始 */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-center text-2xl">🎯 快速开始</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="font-semibold">开始配置</h3>
              <p className="text-sm text-gray-600">
                使用设置向导配置Google Ads账号、广告联盟链接和AdsPower环境
              </p>
              <Link href="/changelink/setup">
                <Button variant="outline" size="sm">
                  开始设置
                </Button>
              </Link>
            </div>
            
            <div className="space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-xl font-bold text-green-600">2</span>
              </div>
              <h3 className="font-semibold">监控执行状态</h3>
              <p className="text-sm text-gray-600">
                实时监控自动化执行状态，查看详细的执行记录和日志
              </p>
              <Link href="/changelink/executions">
                <Button variant="outline" size="sm">
                  执行监控
                </Button>
              </Link>
            </div>
            
            <div className="space-y-3">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-xl font-bold text-purple-600">3</span>
              </div>
              <h3 className="font-semibold">查看报表</h3>
              <p className="text-sm text-gray-600">
                查看Google Ads数据分析报表，了解广告性能和优化建议
              </p>
              <Link href="/changelink/reports">
                <Button variant="outline" size="sm">
                  数据报表
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 系统特性 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center">✨ 系统特性</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Zap className="h-8 w-8 text-blue-600" />
              </div>
              <h4 className="font-semibold">智能化</h4>
              <p className="text-sm text-gray-600">AI驱动的智能分析和优化建议</p>
            </div>
            
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Activity className="h-8 w-8 text-green-600" />
              </div>
              <h4 className="font-semibold">实时监控</h4>
              <p className="text-sm text-gray-600">24/7实时系统监控和健康检查</p>
            </div>
            
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                <Settings className="h-8 w-8 text-purple-600" />
              </div>
              <h4 className="font-semibold">自动化</h4>
              <p className="text-sm text-gray-600">全自动数据收集和报告生成</p>
            </div>
            
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                <Mail className="h-8 w-8 text-orange-600" />
              </div>
              <h4 className="font-semibold">邮件订阅</h4>
              <p className="text-sm text-gray-600">定时邮件报告和智能通知</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}