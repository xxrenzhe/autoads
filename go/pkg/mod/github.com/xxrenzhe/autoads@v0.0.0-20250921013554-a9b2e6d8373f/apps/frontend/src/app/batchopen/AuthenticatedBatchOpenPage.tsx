'use client'

import { useLanguage } from "@/contexts/LanguageContext"
import { AuthenticatedBatchOpen } from "@/components/auth/AuthenticatedBatchOpen"
import { ProtectedPage } from "@/components/auth/ProtectedFeature"

export default function AuthenticatedBatchOpenPage() {
  const { t, locale } = useLanguage()

  return (
    <ProtectedPage
      feature="批量打开URL"
      title="批量打开URL功能"
      description="登录后即可使用智能批量访问功能，支持动态代理IP和自定义Referer"
    >
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              批量打开URL
            </h1>
            <p className="text-gray-600 text-lg">
              智能批量访问，动态代理IP，自定义Referer，提升工作效率
            </p>
          </div>
          
          <AuthenticatedBatchOpen locale={locale} t={t} />
        </div>
      </div>
    </ProtectedPage>
  )
}