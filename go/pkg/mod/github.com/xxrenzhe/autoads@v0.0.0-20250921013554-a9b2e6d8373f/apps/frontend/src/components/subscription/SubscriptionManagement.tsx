'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  CreditCardIcon,
  CalendarIcon,
  ChartBarIcon,
  CogIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline'
import { http } from '@/shared/http/client'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { paymentsEnabled } from '@/lib/config/feature-flags'

interface Subscription {
  id: string
  planId: string
  planName: string
  status: 'active' | 'canceled' | 'past_due' | 'unpaid'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  price: number
  currency: string
  interval: string
  tokenQuota: number
  tokenUsed: number
  stripeSubscriptionId: string
}

interface Invoice {
  id: string
  amount: number
  currency: string
  status: 'paid' | 'open' | 'void' | 'uncollectible'
  created: string
  paidAt?: string
  invoiceUrl: string
}

interface UsageStats {
  currentPeriod: {
    tokensUsed: number
    tokensTotal: number
    utilizationRate: number
  }
  dailyUsage: Array<{
    date: string
    tokens: number
  }>
}

export default function SubscriptionManagement() {
  const PAYMENTS_ENABLED = paymentsEnabled();
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'downgrade' | 'cancel' | null>(null)
  const { data: session } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session?.userId) {
      loadSubscriptionData(true)
    }
  }, [session])

  const loadSubscriptionData = async (useCache = false) => {
    setLoading(true)
    try {
      const getter = useCache ? http.getCached : http.get
      const [subData, invoicesData, usageData] = await Promise.all([
        getter<{ subscription: Subscription | null }>('/subscriptions/current', undefined as any, 30_000) as any,
        getter<{ invoices: Invoice[] }>('/subscriptions/invoices', undefined as any, 30_000) as any,
        getter<{ usage: UsageStats }>('/subscriptions/usage', undefined as any, 15_000) as any
      ])

      setSubscription((subData as any)?.subscription || null)
      setInvoices((invoicesData as any)?.invoices || [])
      setUsageStats((usageData as any)?.usage || null)
    } catch (error) {
      console.error('Error loading subscription data:', error)
      toast.error('加载订阅数据失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async () => {
    setActionLoading('upgrade')
    try {
      const { url } = await http.post<{ url: string }>(
        '/subscriptions/upgrade-portal',
        undefined
      )
      if (url) {
        window.location.href = url
      } else {
        toast.error('升级失败，请稍后重试')
      }
    } catch (error) {
      console.error('Error upgrading subscription:', error)
      toast.error('升级失败，请稍后重试')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDowngrade = async () => {
    setActionLoading('downgrade')
    try {
      const res = await http.post<{ success: boolean }>(
        '/subscriptions/downgrade',
        undefined
      )
      if ((res as any)?.success !== false) {
        await loadSubscriptionData()
        toast.success('降级请求已提交，将在当前计费周期结束时生效')
      } else {
        toast.error('降级失败，请稍后重试')
      }
    } catch (error) {
      console.error('Error downgrading subscription:', error)
      toast.error('降级失败，请稍后重试')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelSubscription = async () => {
    setActionLoading('cancel')
    try {
      const res = await http.post<{ success: boolean }>(
        '/subscriptions/cancel',
        undefined
      )
      if ((res as any)?.success !== false) {
        await loadSubscriptionData()
        toast.success('订阅已取消，将在当前计费周期结束时停止')
      } else {
        toast.error('取消失败，请稍后重试')
      }
    } catch (error) {
      console.error('Error canceling subscription:', error)
      toast.error('取消失败，请稍后重试')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReactivate = async () => {
    setActionLoading('reactivate')
    try {
      const res = await http.post<{ success: boolean }>(
        '/subscriptions/reactivate',
        undefined
      )
      if ((res as any)?.success !== false) {
        await loadSubscriptionData()
        toast.success('订阅已重新激活')
      } else {
        toast.error('重新激活失败，请稍后重试')
      }
    } catch (error) {
      console.error('Error reactivating subscription:', error)
      toast.error('重新激活失败，请稍后重试')
    } finally {
      setActionLoading(null)
    }
  }

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: currency === 'USD' ? 'CNY' : currency,
      minimumFractionDigits: 0
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', text: '活跃' },
      canceled: { color: 'bg-red-100 text-red-800', text: '已取消' },
      past_due: { color: 'bg-yellow-100 text-yellow-800', text: '逾期' },
      unpaid: { color: 'bg-red-100 text-red-800', text: '未付款' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    )
  }

  const getInvoiceStatusBadge = (status: string) => {
    const statusConfig = {
      paid: { color: 'bg-green-100 text-green-800', text: '已付款' },
      open: { color: 'bg-blue-100 text-blue-800', text: '待付款' },
      void: { color: 'bg-gray-100 text-gray-800', text: '已作废' },
      uncollectible: { color: 'bg-red-100 text-red-800', text: '无法收款' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.open
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i: number) => (
          <div key={i} className="animate-pulse bg-white rounded-lg shadow p-6">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="text-center py-12">
        <CreditCardIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">没有活跃订阅</h3>
        <p className="text-gray-600 mb-6">
          您当前使用的是免费版，升级到付费计划解锁更多功能
        </p>
        <button
          onClick={() => router.push('/pricing')}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          查看订阅计划
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* 通用确认弹窗 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>请确认操作</DialogTitle>
            <DialogDescription>
              {confirmAction === 'downgrade' && '确定要降级订阅吗？降级将在当前计费周期结束时生效。'}
              {confirmAction === 'cancel' && '确定要取消订阅吗？取消后您将在当前计费周期结束时失去付费功能。'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button
              className="px-4 py-2 rounded border"
              onClick={() => setConfirmOpen(false)}
            >
              取消
            </button>
            <button
              className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-50"
              disabled={actionLoading !== null}
              onClick={async () => {
                setConfirmOpen(false)
                if (confirmAction === 'downgrade') await handleDowngrade()
                if (confirmAction === 'cancel') await handleCancelSubscription()
                setConfirmAction(null)
              }}
            >
              确认
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Current Subscription */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">当前订阅</h2>
          {getStatusBadge(subscription.status)}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <div className="text-sm text-gray-600">计划</div>
            <div className="text-lg font-semibold text-gray-900">{subscription.planName}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">价格</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatPrice(subscription.price, subscription.currency)}/{subscription.interval === 'month' ? '月' : '年'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">下次扣费</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatDate(subscription.currentPeriodEnd)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Token 使用</div>
            <div className="text-lg font-semibold text-gray-900">
              {subscription.tokenUsed.toLocaleString()} / {subscription.tokenQuota.toLocaleString()}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${Math.min((subscription.tokenUsed / subscription.tokenQuota) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Subscription Actions */}
        {!PAYMENTS_ENABLED ? (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
            支付与套餐变更功能暂未开通。如需升级请联系在线客服。
          </div>
        ) : (
        <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-200">
          {subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
            <>
              <button
                onClick={handleUpgrade}
                disabled={actionLoading === 'upgrade'}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                <ArrowUpIcon className="h-4 w-4 mr-2" />
                {actionLoading === 'upgrade' ? '处理中...' : '升级计划'}
              </button>
              
              <button
                onClick={() => { setConfirmAction('downgrade'); setConfirmOpen(true) }}
                disabled={actionLoading === 'downgrade'}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <ArrowDownIcon className="h-4 w-4 mr-2" />
                {actionLoading === 'downgrade' ? '处理中...' : '降级计划'}
              </button>
              
              <button
                onClick={() => { setConfirmAction('cancel'); setConfirmOpen(true) }}
                disabled={actionLoading === 'cancel'}
                className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              >
                <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                {actionLoading === 'cancel' ? '处理中...' : '取消订阅'}
              </button>
            </>
          )}
          
          {subscription.cancelAtPeriodEnd && (
            <button
              onClick={handleReactivate}
              disabled={actionLoading === 'reactivate'}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <CheckCircleIcon className="h-4 w-4 mr-2" />
              {actionLoading === 'reactivate' ? '处理中...' : '重新激活'}
            </button>
          )}
        </div>
        )}

        {/* Cancellation Notice */}
        {subscription.cancelAtPeriodEnd && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
              <div className="text-sm text-yellow-800">
                您的订阅将在 {formatDate(subscription.currentPeriodEnd)} 结束。
                在此之前您仍可以使用所有付费功能。
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Usage Statistics */}
      {usageStats && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <ChartBarIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900">使用统计</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {usageStats.currentPeriod.tokensUsed.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">本期已使用 Token</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {(usageStats.currentPeriod.tokensTotal - usageStats.currentPeriod.tokensUsed).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">剩余 Token</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {usageStats.currentPeriod.utilizationRate}%
              </div>
              <div className="text-sm text-gray-600">使用率</div>
            </div>
          </div>

          {/* Usage Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Token 使用进度</span>
              <span>
                {usageStats.currentPeriod.tokensUsed.toLocaleString()} / {usageStats.currentPeriod.tokensTotal.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-300 ${
                  usageStats.currentPeriod.utilizationRate > 90 ? 'bg-red-500' :
                  usageStats.currentPeriod.utilizationRate > 75 ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${Math.min(usageStats.currentPeriod.utilizationRate, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Usage Warning */}
          {usageStats.currentPeriod.utilizationRate > 80 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
                <div className="text-sm text-yellow-800">
                  您已使用了 {usageStats.currentPeriod.utilizationRate}% 的 Token 配额。
                  {usageStats.currentPeriod.utilizationRate > 90 ? 
                    '建议升级到更高级的计划以避免服务中断。' : 
                    '请注意监控使用量，避免超出配额。'
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Billing History */}
      {PAYMENTS_ENABLED && (
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <div className="flex items-center mb-6">
          <CalendarIcon className="h-6 w-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-bold text-gray-900">账单历史</h2>
        </div>
        
        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    日期
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    金额
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice: any) => (
                  <tr key={invoice.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(invoice.created)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatPrice(invoice.amount, invoice.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getInvoiceStatusBadge(invoice.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <a
                        href={invoice.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-900"
                      >
                        查看发票
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <CalendarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600">暂无账单记录</p>
          </div>
        )}
      </div>
      )}

      {/* Payment Method */}
      {PAYMENTS_ENABLED && (
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <CreditCardIcon className="h-6 w-6 text-purple-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900">付款方式</h2>
          </div>
          <button className="text-blue-600 hover:text-blue-800 font-medium">
            更新付款方式
          </button>
        </div>
        
        <div className="flex items-center p-4 bg-gray-50 rounded-lg">
          <CreditCardIcon className="h-8 w-8 text-gray-400 mr-4" />
          <div>
            <div className="font-medium text-gray-900">**** **** **** 4242</div>
            <div className="text-sm text-gray-600">Visa • 过期时间 12/25</div>
          </div>
        </div>
      </div>
      )}

      {/* Support */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">需要帮助？</h2>
        <p className="text-gray-700 mb-4">
          我们的客户支持团队随时为您提供帮助，解答关于订阅、账单或功能使用的任何问题。
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="mailto:support@adscenter.com"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            📧 发送邮件
          </a>
          <a
            href="/help"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            📚 帮助中心
          </a>
        </div>
      </div>
    </div>
  )
}
