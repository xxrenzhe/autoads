'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, ArrowLeft } from 'lucide-react'

export default function AuthError() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  useEffect(() => {
    // Log error for debugging
    if (error) {
      console.error('Authentication error:', error)
    }
  }, [error])

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'Configuration':
        return '服务器配置错误，请联系管理员'
      case 'AccessDenied':
        return '访问被拒绝：仅支持 Gmail 账户登录'
      case 'Verification':
        return '验证令牌已过期或无效'
      case 'OAuthSignin':
        return 'OAuth 登录过程中出现错误'
      case 'OAuthCallback':
        return 'OAuth 回调过程中出现错误'
      case 'OAuthCreateAccount':
        return '创建账户时出现错误'
      case 'EmailCreateAccount':
        return '创建邮箱账户时出现错误'
      case 'Callback':
        return 'OAuth 回调处理错误'
      case 'OAuthAccountNotLinked':
        return '该邮箱已与其他登录方式关联'
      case 'SessionRequired':
        return '请先登录以访问此页面'
      case 'Default':
        return '未知错误，请稍后重试'
      default:
        return '登录出现错误，请稍后重试'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <AlertCircle className="mr-2 h-5 w-5" />
            登录失败
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              {getErrorMessage(error)}
            </p>
          </div>
          
          <div className="space-y-2">
            <Button
              onClick={() => router.push('/auth/signin')}
              className="w-full"
              variant="outline"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回登录页面
            </Button>
            
            <Button
              onClick={() => router.push('/')}
              className="w-full"
            >
              返回首页
            </Button>
          </div>
          
          {process.env.NODE_ENV === 'development' && error && (
            <div className="mt-4 p-3 bg-gray-100 rounded-md">
              <p className="text-xs text-gray-600">
                调试信息: {error}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
