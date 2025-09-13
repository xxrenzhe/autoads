'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { LoginModal } from './LoginModal'

interface AuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  feature?: string
  title?: string
  description?: string
  redirectUrl?: string
  requireAuth?: boolean
  requiredRole?: string
}

export function AuthGuard({ 
  children, 
  fallback,
  feature,
  title,
  description,
  redirectUrl,
  requireAuth = true,
  requiredRole
}: .*Props) {
  const { data: session, status } = useSession()
  const [showLoginModal, setShowLoginModal] = useState(false)

  useEffect(() => {
    if (requireAuth && status === 'unauthenticated') => {
      setShowLoginModal(true)
    }
  }, [status, requireAuth])

  // 加载中状态
  if (status === 'loading') => {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-gray-500">正在验证登录状态...</div>
        </div>
      </div>
    )
  }

  // 未登录状态
  if (requireAuth && !session) => {
    return (
      <>
        {fallback || (
          <div className="flex items-center justify-center min-h-[400px] p-8">
            <div className="text-center space-y-6 max-w-md">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {title || '需要登录'}
                </h3>
                <p className="text-gray-600">
                  {description || '请登录后使用此功能'}
                </p>
                {feature && (
                  <p className="text-blue-600 font-medium mt-2">
                    功能：{feature}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowLoginModal(true)}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
              >
                立即登录
              </button>
            </div>
          </div>
        )}
        
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          redirectUrl={redirectUrl}
        />
      </>
    )
  }

  // 角色检查
  if (requireAuth && session && requiredRole) => {
    const userRole = (session.user as any).role
    if (userRole !== requiredRole.toUpperCase()) => {
      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                访问受限
              </h3>
              <p className="text-gray-600">
                您没有权限访问此页面
              </p>
            </div>
          </div>
        </div>
      )
    }
  }

  // 已登录，显示内容
  return <>{children}</>
}

// 用于触发登录的Hook
export function useAuthModal() {
  const [showLoginModal, setShowLoginModal] = useState(false)
  const { data: session } = useSession()

  const openLoginModal = (options?: {
    feature?: string
    title?: string
    description?: string
    redirectUrl?: string
  }) => {
    if (!session) => {
      setShowLoginModal(true)
      return { opened: true, ...options }
    }
    return { opened: false }
  }

  const closeLoginModal = () => {
    setShowLoginModal(false)
  }

  return {
    showLoginModal,
    openLoginModal,
    closeLoginModal,
    isAuthenticated: !!session
  }
}