'use client'

import { signOut, useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  User, 
  Mail, 
  Calendar, 
  Coins, 
  History, 
  CreditCard, 
  Settings, 
  LogOut,
  ChevronRight,
  Crown,
  Shield,
  Star,
  Loader2,
  Share2,
  Users,
  Gift,
  Copy,
  Check
} from 'lucide-react'
import { getAccountStatus } from '@/lib/utils/account-status'

interface UserCenterModalProps {
  isOpen: boolean
  onClose: () => void
  user: any
}

export default function UserCenterModal({ isOpen, onClose, user }: UserCenterModalProps) {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<'profile' | 'tokens' | 'subscription' | 'invitation'>('profile')
  const [tokenUsage, setTokenUsage] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [monthlyUsage, setMonthlyUsage] = useState(0)
  const [invitationData, setInvitationData] = useState<{
    code?: string
    url?: string
    stats?: any
  }>({})
  const [copied, setCopied] = useState(false)

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      USER: { label: '普通用户', variant: 'default', icon: User },
      ADMIN: { label: '管理员', variant: 'secondary', icon: Shield },
      SUPER_ADMIN: { label: '超级管理员', variant: 'destructive', icon: Crown },
    }
    
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.USER
    const Icon = config.icon
    
    return (
      <Badge variant={config.variant as any} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' })
  }

  // 复制邀请链接
  const handleCopyInvitationLink = async () => {
    if (invitationData.url) {
      try {
        await navigator.clipboard.writeText(invitationData.url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('Failed to copy link:', error)
      }
    }
  }

  // 获取Token使用记录
  useEffect(() => {
    const fetchTokenUsage = async () => {
      if (activeTab === 'tokens' && session?.user?.id) {
        setIsLoading(true)
        try {
          const response = await fetch('/api/user/tokens/usage?limit=20')
          if (response.ok) {
            const data = await response.json()
            setTokenUsage(data.data?.records || [])
            setMonthlyUsage(data.data?.analytics?.totalTokensUsed || 0)
          }
        } catch (error) {
          console.error('Failed to fetch token usage:', error)
        } finally {
          setIsLoading(false)
        }
      }
    }

    fetchTokenUsage()
  }, [activeTab, session?.user?.id])

  // 获取邀请数据
  useEffect(() => {
    const fetchInvitationData = async () => {
      if (activeTab === 'invitation' && session?.user?.id) {
        setIsLoading(true)
        try {
          // 获取邀请码和URL
          const codeResponse = await fetch('/api/invitation/my-code')
          if (codeResponse.ok) {
            const codeData = await codeResponse.json()
            setInvitationData(prev => ({
              ...prev,
              code: codeData.data.invitationCode,
              url: codeData.data.invitationUrl
            }))
          }

          // 获取邀请统计
          const statsResponse = await fetch('/api/invitation/stats')
          if (statsResponse.ok) {
            const statsData = await statsResponse.json()
            setInvitationData(prev => ({
              ...prev,
              stats: statsData.data
            }))
          }
        } catch (error) {
          console.error('Failed to fetch invitation data:', error)
        } finally {
          setIsLoading(false)
        }
      }
    }

    fetchInvitationData()
  }, [activeTab, session?.user?.id])

  const menuItems = [
    {
      id: 'profile',
      label: '个人信息',
      icon: User,
    },
    {
      id: 'tokens',
      label: 'Token消耗记录',
      icon: Coins,
    },
    {
      id: 'subscription',
      label: '订阅管理',
      icon: CreditCard,
    },
    {
      id: 'invitation',
      label: '邀请好友',
      icon: Share2,
    },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.image} alt={user?.name} />
              <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-semibold">{user?.name}</h2>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
            {getRoleBadge(user?.role)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-[calc(80vh-120px)]">
          {/* Tabs */}
          <div className="flex space-x-1 p-1 bg-gray-100 rounded-lg mb-4">
            {menuItems.map((item: any) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={((: any): any) => setActiveTab(item.id as any)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              )
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Mail className="h-4 w-4" />
                      邮箱地址
                    </div>
                    <p className="font-medium">{user?.email}</p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Calendar className="h-4 w-4" />
                      注册时间
                    </div>
                    <p className="font-medium">{formatDate(user?.createdAt || new Date())}</p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Calendar className="h-4 w-4" />
                      最后登录
                    </div>
                    <p className="font-medium">{formatDate(user?.lastLoginAt || new Date())}</p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Coins className="h-4 w-4" />
                      Token余额
                    </div>
                    <p className="font-medium text-lg text-blue-600">{user?.tokenBalance || 0}</p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-medium text-blue-900 mb-2">账户状态</h3>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${getAccountStatus(user || {}).color}`} />
                    <span className={`text-sm ${getAccountStatus(user || {}).color}`}>
                      {getAccountStatus(user || {}).displayText}
                    </span>
                  </div>
                  {user?.emailVerified && (
                    <div className="flex items-center gap-2 mt-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-blue-700">邮箱已验证</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'tokens' && (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">当前Token余额</h3>
                      <p className="text-2xl font-bold text-blue-600 mt-1">
                        {user?.tokenBalance || 0}
                      </p>
                    </div>
                    <Coins className="h-12 w-12 text-blue-500 opacity-50" />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    本月已使用: {monthlyUsage || 0} 个Token
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">最近使用记录</h3>
                  <div className="space-y-2">
                    {isLoading ? (
                      <div className="text-center py-8 text-gray-500">
                        <Loader2 className="h-12 w-12 mx-auto mb-2 animate-spin" />
                        <p>加载中...</p>
                      </div>
                    ) : tokenUsage.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>暂无使用记录</p>
                      </div>
                    ) : (
                      tokenUsage.map((record: any) => (
                        <div key={record.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{record.feature}</p>
                              <p className="text-sm text-gray-500">{record.description || record.operation}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-red-600">-{record.tokensConsumed}</p>
                              <p className="text-xs text-gray-500">
                                {formatDate(record.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'subscription' && (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-3">
                    <Crown className="h-10 w-10 text-purple-500" />
                    <div>
                      <h3 className="font-medium text-gray-900">当前订阅</h3>
                      <p className="text-sm text-gray-600">升级到专业版解锁更多功能</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900">订阅计划</h3>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-500" />
                        <span className="font-medium">基础版</span>
                      </div>
                      <Badge variant="outline">当前</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      适合个人用户，包含基础功能
                    </p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• 100 Token/月</li>
                      <li>• 基础分析功能</li>
                      <li>• 邮件支持</li>
                    </ul>
                  </div>

                  <div className="p-4 border border-purple-200 rounded-lg bg-purple-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Crown className="h-5 w-5 text-purple-500" />
                        <span className="font-medium">专业版</span>
                      </div>
                      <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">
                        推荐
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      适合专业用户，包含高级功能
                    </p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• 1000 Token/月</li>
                      <li>• 高级分析功能</li>
                      <li>• API访问</li>
                      <li>• 优先支持</li>
                    </ul>
                    <Button className="w-full mt-3" variant="default">
                      立即升级
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'invitation' && (
              <div className="space-y-4">
                {/* 邀请奖励说明 */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <Gift className="h-10 w-10 text-blue-500" />
                    <div>
                      <h3 className="font-medium text-gray-900">邀请好友，双方获益</h3>
                      <p className="text-sm text-gray-600">每成功邀请一位好友注册，您和好友都将获得30天Pro套餐</p>
                      <p className="text-xs text-blue-600 mt-1">
                        ✨ 您的专属邀请链接已自动生成，立即开始邀请吧！
                      </p>
                    </div>
                  </div>
                </div>

                {/* 邀请链接 */}
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900">您的专属邀请链接</h3>
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : (
                      <>
                        {invitationData.url ? (
                          <>
                            <div className="flex items-center gap-2 mb-3">
                              <input
                                type="text"
                                value={invitationData.url}
                                readOnly
                                className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCopyInvitationLink}
                                className="flex items-center gap-2"
                              >
                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                {copied ? '已复制' : '复制'}
                              </Button>
                            </div>
                            <p className="text-xs text-gray-500">
                              邀请码：{invitationData.code}
                            </p>
                          </>
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-sm text-gray-500">
                              您的邀请链接正在生成中...
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              如果长时间未显示，请刷新页面重试
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 邀请统计 */}
                {invitationData.stats && (
                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900">邀请统计</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {invitationData.stats.totalAccepted || 0}
                        </div>
                        <div className="text-sm text-green-700">成功邀请</div>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {30 * (invitationData.stats.totalAccepted || 0)}
                        </div>
                        <div className="text-sm text-purple-700">获得天数</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 最近邀请记录 */}
                {invitationData.stats?.recentInvitations && invitationData.stats.recentInvitations.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900">最近邀请</h3>
                    <div className="space-y-2">
                      {invitationData.stats.recentInvitations.slice(0, 5).map((inv: any: any) => (
                        <div key={inv.id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Users className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">{inv.code}</p>
                              <p className="text-xs text-gray-500">
                                创建于 {new Date(inv.createdAt).toLocaleDateString('zh-CN')}
                              </p>
                            </div>
                          </div>
                          <Badge variant={inv.status === 'ACCEPTED' ? 'default' : 'secondary'}>
                            {inv.status === 'ACCEPTED' ? '已接受' : inv.status === 'PENDING' ? '待使用' : inv.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator className="my-4" />

          {/* Footer Actions */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={((: any): any) => window.open('/settings', '_blank')}
              className="text-gray-600"
            >
              <Settings className="h-4 w-4 mr-2" />
              账户设置
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="text-red-600 hover:text-red-700"
            >
              <LogOut className="h-4 w-4 mr-2" />
              退出登录
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}