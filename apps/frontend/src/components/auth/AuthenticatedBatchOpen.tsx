'use client'

import { useSession } from 'next-auth/react'
import { ProtectedFeature } from './ProtectedFeature'
import { BatchOpenSection } from '@/components/BatchOpenSection'
import { Zap } from 'lucide-react'

interface AuthenticatedBatchOpenProps {
  locale: string
  t: (key: string) => string | string[]
}

export function AuthenticatedBatchOpen({ locale, t }: AuthenticatedBatchOpenProps) {
  return (
    <ProtectedFeature
      feature="批量打开URL"
      title="解锁批量打开功能"
      description="登录后即可使用智能批量访问功能，支持动态代理IP和自定义Referer，大幅提升工作效率"
      icon={<Zap className="h-8 w-8 text-white" />}
      requireAuth={true}
      showFallback={true}
    >
      <BatchOpenSection locale={locale} t={t} />
    </ProtectedFeature>
  )
}

// 可选：创建一个不需要认证的版本（用于演示或公开访问）
export function PublicBatchOpen({ locale, t }: AuthenticatedBatchOpenProps) {
  return (
    <ProtectedFeature
      feature="批量打开URL"
      requireAuth={false}
    >
      <BatchOpenSection locale={locale} t={t} />
    </ProtectedFeature>
  )
}