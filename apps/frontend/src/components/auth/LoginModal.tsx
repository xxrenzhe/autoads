'use client'

import React, { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { Dialog, DialogClose, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Button } from '@/components/ui/button'
import { X, Shield, Zap, BarChart3, Globe, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  feature?: string // 保留参数但不使用，避免破坏现有接口
  redirectUrl?: string
}

// Custom DialogContent with styled close button
const CustomDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full p-1 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 bg-white/80 backdrop-blur-sm">
        <X className="h-5 w-5" />
        <span className="sr-only">关闭登录对话框</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
CustomDialogContent.displayName = DialogPrimitive.Content.displayName

export function LoginModal({ 
  isOpen, 
  onClose, 
  redirectUrl = "/"
}: .*Props) {
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  // 如果用户已登录，自动关闭弹窗
  useEffect(() => {
    if (session && isOpen) => {
      onClose()
    }
  }, [session, isOpen, onClose])

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      // Check if user has pending invitation code
      const pendingCode = localStorage.getItem('pendingInvitationCode')
      
      // Set flag to indicate potential new OAuth user
      // This will be cleared after subscription creation
      sessionStorage.setItem('newOAuthUser', 'true')
      
      // Use NextAuth signIn with redirect for OAuth flow
      await signIn('google', { 
        callbackUrl: redirectUrl,
        redirect: true // Let NextAuth handle the redirect
      })
    } catch (error) {
      console.error('登录失败:', error)
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <CustomDialogContent 
        className="sm:max-w-md w-full mx-4 rounded-2xl shadow-2xl bg-white p-0 overflow-hidden"
        aria-labelledby="login-modal-title"
        aria-describedby="login-modal-description"
      >
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 opacity-50" />
        
  
        <div className="relative z-10">
          <DialogHeader className="text-center px-8 pt-8 pb-4">
            <DialogTitle 
              id="login-modal-title"
              className="text-2xl font-bold text-gray-900 mb-2"
            >
              请先登录
            </DialogTitle>
            <p 
              id="login-modal-description"
              className="text-gray-600"
            >
              使用 Google 账号一键登录，即可使用所有功能
            </p>
          </DialogHeader>

          <div className="px-8 pb-8">
            {/* 登录按钮 */}
            <Button
              onClick={handleGoogleSignIn}
              disabled={isLoading || status === 'loading'}
              aria-describedby={isLoading ? "login-status" : undefined}
              className={cn(
                "w-full bg-white border-2 border-gray-200 rounded-xl px-6 py-4 text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all duration-200 mb-4"
              )}
            >
              <svg 
                className="w-6 h-6" 
                viewBox="0 0 24 24"
                aria-hidden="true"
                role="img"
                aria-label="Google logo"
              >
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {isLoading ? '登录中...' : 'Google 一键登录'}
            </Button>

            {/* 安全提示 */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <Shield className="h-3 w-3" />
              <span>安全快速，无需注册</span>
            </div>

            {/* 底部链接 */}
            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-500">
                登录即表示您同意我们的{' '}
                <a href="/terms" className="text-blue-600 hover:text-blue-700 underline">
                  服务条款
                </a>{' '}
                和{' '}
                <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline">
                  隐私政策
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Screen reader status updates */}
        {isLoading && (
          <div 
            id="login-status" 
            aria-live="polite" 
            className="sr-only"
          >
            正在处理登录请求，请稍候
          </div>
        )}
      </CustomDialogContent>
    </Dialog>
  )
}