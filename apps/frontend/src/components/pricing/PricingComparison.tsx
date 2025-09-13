'use client'

import React from 'react'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface FeatureCategory {
  name: string
  features: Feature[]
}

interface Feature {
  name: string
  description?: string
  free: boolean | string
  pro: boolean | string
  max: boolean | string
}

export default function PricingComparison() {
  const featureCategories: FeatureCategory[] = [
    {
      name: '基础功能',
      features: [
        {
          name: 'Token 配额',
          description: '每月可使用的 Token 数量',
          free: '1,000',
          pro: '10,000',
          max: '50,000'
        },
        {
          name: 'URL 检查',
          description: '检查网站链接的有效性',
          free: true,
          pro: true,
          max: true
        },
        {
          name: '批量操作',
          description: '一次处理多个链接',
          free: '最多 10 个',
          pro: '最多 1,000 个',
          max: '无限制'
        },
        {
          name: '项目数量',
          description: '可创建的项目数量',
          free: '3 个',
          pro: '无限制',
          max: '无限制'
        },
        {
          name: '数据导出',
          description: '导出分析结果和报告',
          free: 'CSV',
          pro: 'CSV, Excel, PDF',
          max: 'CSV, Excel, PDF, API'
        }
      ]
    },
    {
      name: '高级功能',
      features: [
        {
          name: 'API 访问',
          description: '通过 API 集成到您的系统',
          free: false,
          pro: '基础 API',
          max: '完整 API'
        },
        {
          name: '自定义报告',
          description: '创建个性化的分析报告',
          free: false,
          pro: true,
          max: true
        },
        {
          name: '实时监控',
          description: '实时监控链接状态变化',
          free: false,
          pro: '每小时检查',
          max: '每分钟检查'
        },
        {
          name: '自动化规则',
          description: '设置自动化处理规则',
          free: false,
          pro: '基础规则',
          max: '高级规则'
        },
        {
          name: '团队协作',
          description: '多用户协作功能',
          free: false,
          pro: '最多 5 用户',
          max: '无限用户'
        }
      ]
    },
    {
      name: '支持服务',
      features: [
        {
          name: '邮件支持',
          description: '通过邮件获得技术支持',
          free: '工作日响应',
          pro: '24小时响应',
          max: '2小时响应'
        },
        {
          name: '在线聊天',
          description: '实时在线客服支持',
          free: false,
          pro: '工作时间',
          max: '24/7'
        },
        {
          name: '电话支持',
          description: '电话技术支持服务',
          free: false,
          pro: false,
          max: true
        },
        {
          name: '专属客户经理',
          description: '指定的客户成功经理',
          free: false,
          pro: false,
          max: true
        },
        {
          name: '培训服务',
          description: '产品使用培训和指导',
          free: '在线文档',
          pro: '视频教程',
          max: '一对一培训'
        }
      ]
    },
    {
      name: '企业功能',
      features: [
        {
          name: 'SSO 单点登录',
          description: '企业级单点登录集成',
          free: false,
          pro: false,
          max: true
        },
        {
          name: '白标定制',
          description: '使用您的品牌标识',
          free: false,
          pro: false,
          max: true
        },
        {
          name: '私有部署',
          description: '在您的服务器上部署',
          free: false,
          pro: false,
          max: '可选'
        },
        {
          name: '数据备份',
          description: '自动数据备份和恢复',
          free: '7 天',
          pro: '30 天',
          max: '无限制'
        },
        {
          name: 'SLA 保证',
          description: '服务级别协议保证',
          free: false,
          pro: '99.5%',
          max: '99.9%'
        }
      ]
    }
  ]

  const renderFeatureValue = (value: boolean | string | undefined) => {
    if (value === undefined) {
      return <span className="text-sm text-gray-400">-</span>
    }
    if (typeof value === 'boolean') {
      return value ? (
        <CheckIcon className="h-5 w-5 text-green-500 mx-auto" />
      ) : (
        <XMarkIcon className="h-5 w-5 text-gray-300 mx-auto" />
      )
    }
    return (
      <span className="text-sm text-gray-900 font-medium">
        {value}
      </span>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-4 px-6 font-semibold text-gray-900">
              功能
            </th>
            <th className="text-center py-4 px-6">
              <div className="text-lg font-bold text-gray-900">免费版</div>
              <div className="text-sm text-gray-600">¥0/月</div>
            </th>
            <th className="text-center py-4 px-6">
              <div className="text-lg font-bold text-gray-900">Pro 版</div>
              <div className="text-sm text-gray-600">¥199/月</div>
              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                最受欢迎
              </div>
            </th>
            <th className="text-center py-4 px-6">
              <div className="text-lg font-bold text-gray-900">Max 版</div>
              <div className="text-sm text-gray-600">¥699/月</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {featureCategories.map((category, categoryIndex: any) => (
            <React.Fragment key={category.name}>
              {/* Category Header */}
              <tr className="bg-gray-50">
                <td
                  colSpan={4}
                  className="py-3 px-6 text-sm font-semibold text-gray-900 uppercase tracking-wider"
                >
                  {category.name}
                </td>
              </tr>
              
              {/* Category Features */}
              {category.features.map((feature, featureIndex: any) => (
                <tr
                  key={feature.name}
                  className={`border-b border-gray-100 ${
                    featureIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  }`}
                >
                  <td className="py-4 px-6">
                    <div>
                      <div className="font-medium text-gray-900">
                        {feature.name}
                      </div>
                      {feature.description && (
                        <div className="text-sm text-gray-600 mt-1">
                          {feature.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    {renderFeatureValue(feature.free)}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {renderFeatureValue(feature.pro)}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {renderFeatureValue(feature.max)}
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* Mobile View */}
      <div className="md:hidden mt-8">
        <div className="space-y-8">
          {['free', 'pro', 'max'].map((planType: any) => {
            const planNames = {
              free: '免费版',
              pro: 'Pro 版',
              max: 'Max 版'
            }
            const planPrices = {
              free: '¥0/月',
              pro: '¥199/月',
              max: '¥699/月'
            }
            
            return (
              <div key={planType} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900">
                    {planNames[planType as keyof typeof planNames]}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {planPrices[planType as keyof typeof planPrices]}
                  </p>
                  {planType === 'pro' && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                      最受欢迎
                    </div>
                  )}
                </div>
                
                <div className="space-y-6">
                  {featureCategories.map((category: any) => (
                    <div key={category.name}>
                      <h4 className="font-semibold text-gray-900 mb-3">
                        {category.name}
                      </h4>
                      <div className="space-y-2">
                        {category.features.map((feature: any) => (
                          <div key={feature.name} className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">
                              {feature.name}
                            </span>
                            <div className="ml-4">
                              {renderFeatureValue(feature[planType as keyof typeof feature])}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}