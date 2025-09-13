'use client'

import { useBatchOpenPermissions } from '@/hooks/useBatchOpenPermissions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Lock, ArrowRight, Play, VolumeX, Bot, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

const VERSION_CONFIG = [
  {
    id: 'basic',
    icon: Play,
    color: 'bg-blue-50 border-blue-200'
  },
  {
    id: 'silent',
    icon: VolumeX,
    color: 'bg-purple-50 border-purple-200'
  },
  {
    id: 'automated',
    icon: Bot,
    color: 'bg-green-50 border-green-200'
  }
]

export function BatchOpenVersionShowcase() {
  const router = useRouter()
  const { data: permissions, isLoading, error } = useBatchOpenPermissions()

  if (isLoading) => {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-3">加载版本信息...</span>
      </div>
    )
  }

  if (error) => {
    return (
      <div className="text-center p-8 text-red-600">
        加载版本信息失败，请刷新页面重试
      </div>
    )
  }

  if (!permissions) => {
    return null
  }

  const handleUseVersion = (versionId: string) => {
    router.push(`/batchopen/${versionId}`)
  }

  const handleUpgrade = () => {
    router.push('/pricing')
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">BatchOpen 功能版本</h2>
        <p className="text-gray-600">
          选择适合您需求的BatchOpen版本，升级订阅解锁更多功能
        </p>
        {permissions.subscriptionBased && (
          <Badge className="bg-orange-100 text-orange-800 border-orange-300">
            基于订阅套餐的权限
          </Badge>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {VERSION_CONFIG.map((config: any) => {
          const version = permissions.versions[config.id as keyof typeof permissions.versions]
          const Icon = config.icon
          const hasAccess = version.available

          return (
            <Card 
              key={config.id} 
              className={`relative ${config.color} border-2`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-6 w-6" />
                    <CardTitle className="text-lg">{version.name}</CardTitle>
                  </div>
                  {hasAccess ? (
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      已授权
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-800 border-gray-300">
                      需升级
                    </Badge>
                  )}
                </div>
                <CardDescription>{version.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    URL限制: {version.maxUrls === -1 ? '无限制' : `${version.maxUrls}个`}
                  </div>
                  <div className="text-sm font-medium">
                    并发数: {version.maxConcurrent}个
                  </div>
                </div>

                <ul className="space-y-2">
                  {version.features.map((feature, index: any) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="pt-4">
                  {hasAccess ? (
                    <Button 
                      onClick={() => handleUseVersion(config.id)}
                      className="w-full"
                    >
                      使用 {version.name}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        disabled
                        className="w-full"
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        需要升级订阅
                      </Button>
                      {config.id !== 'basic' && (
                        <Button 
                          onClick={handleUpgrade}
                          variant="ghost"
                          className="w-full text-sm"
                        >
                          立即升级
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">版本对比说明</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 基础版：适合日常使用，提供基本的批量打开功能</li>
          <li>• 静默版：适合需要后台运行、不打扰当前工作的场景</li>
          <li>• 自动化版：适合需要程序化控制、定时任务的商业用户</li>
        </ul>
      </div>
    </div>
  )
}