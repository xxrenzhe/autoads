'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthContext } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ProtectedButtonProps {
  children: React.ReactNode
  onClick?: () => void | Promise<void>
  featureName?: string
  className?: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  disabled?: boolean
  requireAuth?: boolean
  fallback?: React.ReactNode
}

export function ProtectedButton({
  children,
  onClick,
  featureName,
  className,
  variant,
  size,
  disabled = false,
  requireAuth = true,
  fallback,
  ...props
}: ProtectedButtonProps) {
  const { isAuthenticated, openLoginModal } = useAuthContext()
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    if (requireAuth && !isAuthenticated) {
      openLoginModal(featureName)
      return
    }
    
    setIsLoading(true)
    try {
      await onClick?.()
    } finally {
      setIsLoading(false)
    }
  }

  // 如果提供了 fallback 且未登录，显示 fallback
  if (fallback && !isAuthenticated && requireAuth) {
    return <>{fallback}</>
  }

  // 如果 className 包含完整的按钮样式，使用原始 button 元素
  const hasCustomStyling = className && (
    className.includes('bg-') || 
    className.includes('text-') || 
    className.includes('py-') || 
    className.includes('px-') ||
    className.includes('rounded-')
  )

  if (hasCustomStyling) {
    return (
      <button
        onClick={handleClick}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          className
        )}
        {...props}
      >
      {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            处理中...
          </>
        ) : (
          children
        )}
      </button>
    )
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={cn(className)}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          处理中...
        </>
      ) : (
        children
      )}
    </Button>
  )
}