'use client'

import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  User, 
  Coins, 
  Activity, 
  Settings, 
  CreditCard,
  BarChart3,
  Clock
} from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'

interface UserStats {
  tokenBalance: number
  totalUsed: number
  recentActivity: number
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session?.user) => {
      fetchUserStats()
    }
  }, [session])

  const fetchUserStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user/tokens?timeRange=7d')
      if (response.ok) => {
        const data = await response.json()
        setUserStats({
          tokenBalance: data.currentBalance || 0,
          totalUsed: data.totalUsed || 0,
          recentActivity: data.recentUsage?.length || 0
        })
      }
    } catch (error) {
      console.error('获取用户统计失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!session) => {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              请先登录查看个人中心
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">个人中心</h1>
          <p className="text-muted-foreground mt-2">
            欢迎回来，{session.user?.name || session.user?.email}
          </p>
        </div>
        <Badge variant={session.user?.role === 'ADMIN' || session.user?.role === 'SUPER_ADMIN' ? 'default' : 'secondary'}>
          {session.user?.role === 'SUPER_ADMIN' ? '超级管理员' : 
           session.user?.role === 'ADMIN' ? '管理员' : '用户'}
        </Badge>
      </div>

      {/* 用户信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            账户信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">邮箱</p>
              <p className="font-medium">{session.user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">用户名</p>
              <p className="font-medium">{session.user?.name || '未设置'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Token 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Token余额</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loading ? '...' : userStats?.tokenBalance || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              可用Token数量
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">近7天消耗</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {loading ? '...' : userStats?.totalUsed || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Token消耗总量
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">使用次数</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : userStats?.recentActivity || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              近7天操作次数
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 快捷操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快捷操作</CardTitle>
          <CardDescription>
            常用功能和设置
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/user/tokens">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-2">
                <Coins className="h-6 w-6" />
                <span>Token使用记录</span>
              </Button>
            </Link>
            
            <Link href="/pricing">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-2">
                <CreditCard className="h-6 w-6" />
                <span>套餐管理</span>
              </Button>
            </Link>
            
            <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-2" disabled>
              <Settings className="h-6 w-6" />
              <span>账户设置</span>
            </Button>
            
            {(session.user?.role === 'ADMIN' || session.user?.role === 'SUPER_ADMIN') && (
              <Link href="/admin">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-2 border-purple-200 text-purple-600 hover:bg-purple-50">
                  <Settings className="h-6 w-6" />
                  <span>管理后台</span>
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 最近活动 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            最近活动
          </CardTitle>
          <CardDescription>
            您最近的操作记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>暂无最近活动</p>
            <p className="text-sm mt-2">
              <Link href="/user/tokens" className="text-blue-600 hover:underline">
                查看详细使用记录
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}