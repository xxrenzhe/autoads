'use client'

import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { LoginButton } from './LoginButton'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User, LogOut, Settings, CreditCard, Shield } from 'lucide-react'
import Link from 'next/link'

interface AuthStatusProps {
  showAvatar?: boolean
  showDropdown?: boolean
  variant?: 'default' | 'compact' | 'minimal'
}

export function AuthStatus({ 
  showAvatar = true, 
  showDropdown = true,
  variant = 'default'
}: AuthStatusProps) {
  const { data: session, status } = useSession()

  // 加载状态
  if (status === 'loading') {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
        {variant === 'default' && (
          <div className="w-20 h-4 bg-gray-200 rounded animate-pulse" />
        )}
      </div>
    )
  }

  // 未登录状态
  if (!session) {
    return (
      <LoginButton
        variant={variant === 'minimal' ? 'ghost' : 'outline'}
        size={variant === 'compact' ? 'sm' : 'default'}
        title="登录 AutoAds"
        description="使用 Google 账户登录，享受完整的自动化营销功能"
      >
        {variant === 'minimal' ? '登录' : '使用 Google 登录'}
      </LoginButton>
    )
  }

  // 已登录状态
  const user = session.user
  const userName = user?.name || user?.email || '用户'
  const userEmail = user?.email || ''
  const userAvatar = user?.image || ''
  const userInitial = userName.charAt(0).toUpperCase()

  if (!showDropdown) {
    return (
      <div className="flex items-center space-x-2">
        {showAvatar && (
          <Avatar className="h-8 w-8">
            <AvatarImage src={userAvatar} alt={userName} />
            <AvatarFallback className="bg-blue-500 text-white text-sm">
              {userInitial}
            </AvatarFallback>
          </Avatar>
        )}
        {variant !== 'minimal' && (
          <span className="text-sm font-medium text-gray-700 truncate max-w-32">
            {userName}
          </span>
        )}
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center space-x-2 h-auto p-2 hover:bg-gray-50"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={userAvatar} alt={userName} />
            <AvatarFallback className="bg-blue-500 text-white text-sm">
              {userInitial}
            </AvatarFallback>
          </Avatar>
          {variant !== 'minimal' && (
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium text-gray-900 truncate max-w-32">
                {userName}
              </span>
              {variant === 'default' && userEmail && (
                <span className="text-xs text-gray-500 truncate max-w-32">
                  {userEmail}
                </span>
              )}
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{userName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {userEmail}
            </p>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <Link href="/dashboard" className="flex items-center">
            <User className="mr-2 h-4 w-4" />
            <span>个人中心</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/dashboard/tokens" className="flex items-center">
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Token 余额</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/account/settings" className="flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            <span>账户设置</span>
          </Link>
        </DropdownMenuItem>

        {/* 管理员链接 */}
        {session.user?.role && ['ADMIN', 'SUPER_ADMIN'].includes(session.user.role) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin" className="flex items-center text-purple-600">
                <Shield className="mr-2 h-4 w-4" />
                <span>管理后台</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={((: any): any) => signOut()}
          className="flex items-center text-red-600 focus:text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}