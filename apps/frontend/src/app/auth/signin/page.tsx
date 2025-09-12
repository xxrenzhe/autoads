'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Chrome, Mail, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

export default function SignIn() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(searchParams.get('error'))
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // If user is already authenticated, redirect to dashboard
    if (status === 'authenticated') {
      const callbackUrl = searchParams.get('callbackUrl') || '/'
      router.push(callbackUrl)
    }
  }, [status, router, searchParams])

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
      await signIn('google', { 
        callbackUrl,
        redirect: true // Let NextAuth handle the redirect
      })
    } catch (err) {
      console.error('Sign in error:', err)
      setError('登录失败，请稍后重试')
      setIsLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-gray-600">正在检查登录状态...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-500 to-red-500 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            欢迎回来
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            使用您的 Gmail 账户快速登录
          </p>
        </div>
        
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">
                  {error === 'AccessDenied' 
                    ? '仅支持 Gmail 账户登录，请使用 @gmail.com 邮箱' 
                    : '登录出现错误，请稍后重试'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {success && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <p className="text-sm">正在跳转到 Google 登录页面...</p>
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Chrome className="mr-2 h-6 w-6" />
              Gmail 一键登录
            </CardTitle>
            <CardDescription className="text-base">
              无需密码，安全便捷
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 hover:border-gray-400 shadow-sm"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  正在跳转...
                </>
              ) : (
                <>
                  <Chrome className="mr-2 h-5 w-5" />
                  使用 Google 账户继续
                </>
              )}
            </Button>
            
            <div className="space-y-2">
              <div className="flex items-center justify-center text-xs text-gray-500">
                <div className="flex items-center">
                  <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                  <span>安全认证</span>
                </div>
                <span className="mx-2">•</span>
                <div className="flex items-center">
                  <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                  <span>快速登录</span>
                </div>
                <span className="mx-2">•</span>
                <div className="flex items-center">
                  <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                  <span>无需密码</span>
                </div>
              </div>
              
              <div className="text-xs text-gray-400 text-center pt-2 border-t">
                <p>• 仅支持 @gmail.com 邮箱地址</p>
                <p>• 登录即表示您同意我们的服务条款和隐私政策</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}