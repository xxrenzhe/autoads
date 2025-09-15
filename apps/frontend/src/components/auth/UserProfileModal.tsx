'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  User, 
  CreditCard, 
  Activity, 
  Settings, 
  Calendar,
  TrendingUp,
  Shield,
  Mail,
  Crown,
  X
} from 'lucide-react'
import TokenBalanceInline from '@/token/components/TokenBalanceInline'
import { useTokenBalance } from '@/lib/hooks/useTokenBalance'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState('profile')
  const { data: tokenBalance } = useTokenBalance()

  if (!session?.user) {
    return null
  }

  const user = session.user
  const userName = user.name || user.email || '用户'
  const userEmail = user.email || ''
  const userAvatar = user.image || ''
  const userRole = user.role as string || 'USER'
  const userInitial = userName.charAt(0).toUpperCase()

  // 模拟数据 - 实际应用中应该从API获取
  const mockTokenData = {
    balance: typeof tokenBalance?.remaining === 'number' ? tokenBalance?.remaining : 1250,
    used: typeof tokenBalance?.used === 'number' ? tokenBalance?.used : 750,
    total: typeof tokenBalance?.total === 'number' ? tokenBalance?.total : 2000,
    recentUsage: [
      { date: '2024-12-19', feature: '网站排名分析', tokens: 50, count: 25 },
      { date: '2024-12-18', feature: '批量打开URL', tokens: 30, count: 15 },
      { date: '2024-12-17', feature: '广告链接管理', tokens: 20, count: 10 },
    ]
  }

  const mockSubscription = {
    plan: 'Premium',
    status: 'active',
    nextBilling: '2025-01-19',
    features: ['无限Token', '高级分析', '优先支持']
  }

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      'USER': { label: '普通用户', color: 'bg-gray-100 text-gray-800' },
      'PREMIUM': { label: '高级用户', color: 'bg-blue-100 text-blue-800' },
      'ADMIN': { label: '管理员', color: 'bg-purple-100 text-purple-800' },
      // SUPER_ADMIN removed in unified role model
    }
    
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.USER
    return (
      <Badge className={`${config.color} border-0`}>
        {config.label}
      </Badge>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 z-10"
        >
          <X className="h-4 w-4" />
        </button>

        <DialogHeader className="pb-6">
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={userAvatar} alt={userName} />
              <AvatarFallback className="bg-blue-500 text-white text-xl">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold text-gray-900 mb-1">
                {userName}
              </DialogTitle>
              <div className="flex items-center space-x-2 mb-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">{userEmail}</span>
              </div>
              <div className="flex items-center space-x-2">
                {getRoleBadge(userRole)}
                {userRole !== 'USER' && (
                  <Badge className="bg-yellow-100 text-yellow-800 border-0">
                    <Crown className="h-3 w-3 mr-1" />
                    VIP
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>个人信息</span>
            </TabsTrigger>
            <TabsTrigger value="subscription" className="flex items-center space-x-2">
              <Crown className="h-4 w-4" />
              <span>订阅管理</span>
            </TabsTrigger>
            <TabsTrigger value="tokens" className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4" />
              <span>Token记录</span>
            </TabsTrigger>
          </TabsList>

          {/* 个人信息 */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>基本信息</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">用户名</label>
                    <p className="text-gray-900 font-medium">{userName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">邮箱</label>
                    <p className="text-gray-900">{userEmail}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">用户角色</label>
                    <div className="mt-1">
                      {getRoleBadge(userRole)}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">注册时间</label>
                    <p className="text-gray-900">2024-01-15</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>使用统计</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">156</div>
                    <div className="text-sm text-gray-600">总使用次数</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">28</div>
                    <div className="text-sm text-gray-600">本月使用</div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">7</div>
                    <div className="text-sm text-gray-600">连续使用天数</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 订阅管理 */}
          <TabsContent value="subscription" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Crown className="h-5 w-5" />
                  <span>当前订阅</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{mockSubscription.plan} 计划</h3>
                    <p className="text-gray-600">下次续费: {mockSubscription.nextBilling}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-800 border-0">
                    {mockSubscription.status === 'active' ? '已激活' : '未激活'}
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-4">
                  <h4 className="font-medium text-gray-900">包含功能:</h4>
                  {mockSubscription.features.map((feature, index: any) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-gray-600">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    管理订阅
                  </Button>
                  <Button variant="outline" size="sm">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    升级计划
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Token记录 */}
          <TabsContent value="tokens" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5" />
                  <span>Token 余额</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    <TokenBalanceInline fallback={mockTokenData.balance} />
                  </div>
                  <div className="text-sm text-gray-600">剩余Token</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{mockTokenData.used}</div>
                    <div className="text-sm text-gray-600">已使用</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">{mockTokenData.total}</div>
                    <div className="text-sm text-gray-600">总配额</div>
                  </div>
                </div>

                {/* 使用进度条 */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>使用进度</span>
                    <span>{Math.round((mockTokenData.used / mockTokenData.total) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(mockTokenData.used / mockTokenData.total) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <Button className="w-full mb-4">
                  <CreditCard className="h-4 w-4 mr-2" />
                  购买更多Token
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>最近使用记录</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockTokenData.recentUsage.map((usage, index: any) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <div>
                          <div className="font-medium text-gray-900">{usage.feature}</div>
                          <div className="text-sm text-gray-500">{usage.date}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">-{usage.tokens} Token</div>
                        <div className="text-sm text-gray-500">{usage.count} 次操作</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <Button variant="outline" className="w-full mt-4">
                  查看完整记录
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
