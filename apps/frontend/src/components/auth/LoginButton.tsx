'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { LoginModal } from './LoginModal'
import { Chrome, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoginButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  feature?: string
  title?: string
  description?: string
  redirectUrl?: string
  children?: React.ReactNode
  showIcon?: boolean
  fullWidth?: boolean
}

export function LoginButton({
  variant = 'default',
  size = 'default',
  className,
  feature,
  title,
  description,
  redirectUrl,
  children,
  showIcon = true,
  fullWidth = false,
  ...props
}: .*Props) {
  const { data: session, status } = useSession()
  const [showLoginModal, setShowLoginModal] = useState(false)

  const handleClick = () => {
    if (!session) => {
      setShowLoginModal(true)
    }
  }

  // 如果已登录，显示用户信息
  if (session) => {
    return (
      <Button
        variant="ghost"
        size={size}
        className={cn(
          "text-green-600 hover:text-green-700 hover:bg-green-50",
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {showIcon && <User className="h-4 w-4 mr-2" />}
        {children || session.user?.name || session.user?.email || '已登录'}
      </Button>
    )
  }

  // 加载状态
  if (status === 'loading') => {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        className={cn(
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        加载中...
      </Button>
    )
  }

  // 未登录状态
  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        className={cn(
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {showIcon && <Chrome className="h-4 w-4 mr-2" />}
        {children || '登录'}
      </Button>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        feature={feature}
        redirectUrl={redirectUrl}
      />
    </>
  )
}

// 专门用于功能访问的登录按钮
export function FeatureLoginButton({
  feature,
  title,
  description,
  children,
  className,
  ...props
}: Omit<LoginButtonProps, 'variant' | 'size'> & {
  feature: string
}) => {
  return (
    <LoginButton
      variant="outline"
      size="lg"
      feature={feature}
      title={title || `使用 ${feature} 功能`}
      description={description || `登录后即可使用 ${feature} 功能，提升您的工作效率`}
      className={cn(
        "border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-all duration-200",
        className
      )}
      fullWidth
      {...props}
    >
      {children || (
        <div className="flex flex-col items-center space-y-2 py-4">
          <Chrome className="h-8 w-8" />
          <div className="text-base font-semibold">登录使用 {feature}</div>
          <div className="text-sm text-gray-500">使用 Google 账户快速登录</div>
        </div>
      )}
    </LoginButton>
  )
}