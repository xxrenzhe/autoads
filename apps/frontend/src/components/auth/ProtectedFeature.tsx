'use client'

import { useSession } from 'next-auth/react'
import { AuthGuard } from './AuthGuard'
import { FeatureLoginButton } from './LoginButton'
import { Shield, Zap, Users } from 'lucide-react'

interface ProtectedFeatureProps {
  children: React.ReactNode
  feature: string
  title?: string
  description?: string
  icon?: React.ReactNode
  requireAuth?: boolean
  showFallback?: boolean
}

export function ProtectedFeature({
  children,
  feature,
  title,
  description,
  icon,
  requireAuth = true,
  showFallback = true
}: .*Props) {
  const { data: session, status } = useSession()

  // 如果不需要认证，直接显示内容
  if (!requireAuth) => {
    return <>{children}</>
  }

  // 如果已登录，显示内容
  if (session) => {
    return <>{children}</>
  }

  // 如果不显示fallback，使用AuthGuard
  if (!showFallback) => {
    return (
      <AuthGuard
        feature={feature}
        title={title}
        description={description}
        requireAuth={requireAuth}
      >
        {children}
      </AuthGuard>
    )
  }

  // 自定义fallback界面
  return (
    <div className="relative">
      {/* 模糊的内容预览 */}
      <div className="filter blur-sm pointer-events-none select-none opacity-50">
        {children}
      </div>
      
      {/* 登录遮罩 */}
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center space-y-6 max-w-sm mx-auto p-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            {icon || getFeatureIcon(feature)}
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {title || `解锁 ${feature} 功能`}
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              {description || `登录后即可使用 ${feature} 功能，提升您的工作效率`}
            </p>
          </div>

          <FeatureLoginButton
            feature={feature}
            title={title}
            description={description}
            className="shadow-lg"
          />
        </div>
      </div>
    </div>
  )
}

// 根据功能名称获取对应图标
function getFeatureIcon(feature: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    '批量打开': <Zap className="h-8 w-8 text-white" />,
    '网站排名': <Shield className="h-8 w-8 text-white" />,
    '广告管理': <Users className="h-8 w-8 text-white" />,
    'batchopen': <Zap className="h-8 w-8 text-white" />,
    'siterank': <Shield className="h-8 w-8 text-white" />,
    'adscenter': <Users className="h-8 w-8 text-white" />
  }
  
  return iconMap[feature] || <Shield className="h-8 w-8 text-white" />
}

// 用于包装整个页面的认证组件
export function ProtectedPage({
  children,
  feature,
  title = "需要登录",
  description = "请登录后使用此功能"
}: {
  children: React.ReactNode
  feature?: string
  title?: string
  description?: string
}) => {
  return (
    <AuthGuard
      feature={feature}
      title={title}
      description={description}
      requireAuth={true}
    >
      {children}
    </AuthGuard>
  )
}