'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Coins,
  Plus,
  Minus,
  CreditCard,
  History,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface TokenBalance {
  userId: string
  totalTokens: number
  usedTokens: number
  remainingTokens: number
  lastUpdated: string
  subscriptionPlan: string
  monthlyAllocation: number
  rolloverTokens: number
}

export interface TokenTransaction {
  id: string
  userId: string
  type: 'purchase' | 'usage' | 'refund' | 'bonus' | 'rollover'
  amount: number
  cost?: number
  description: string
  feature?: string
  timestamp: string
  status: 'completed' | 'pending' | 'failed'
}

export interface TokenBalanceManagerProps {
  className?: string
}

export function TokenBalanceManager({ className }: TokenBalanceManagerProps) {
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0)
  const [adjustmentReason, setAdjustmentReason] = useState<string>('')
  const [showTopUpModal, setShowTopUpModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'balances' | 'transactions' | 'topup'>('balances')

  const queryClient = useQueryClient()

  // Fetch token balances
  const {
    data: balances = [],
    isLoading: isBalancesLoading
  } = useQuery({
    queryKey: ['token-balances'],
    queryFn: async (): Promise<TokenBalance[]> => {
      const response = await fetch('/api/admin/token-balance')
      if (!response.ok) throw new Error('Failed to fetch token balances')
      const result = await response.json()
      return result.data || []
    },
    staleTime: 2 * 60 * 1000,
  })

  // Fetch token transactions
  const {
    data: transactions = [],
    isLoading: isTransactionsLoading
  } = useQuery({
    queryKey: ['token-transactions'],
    queryFn: async (): Promise<TokenTransaction[]> => {
      const response = await fetch('/api/admin/token-transactions')
      if (!response.ok) throw new Error('Failed to fetch token transactions')
      const result = await response.json()
      return result.data || []
    },
    staleTime: 1 * 60 * 1000,
  })

  // Adjust token balance mutation
  const adjustBalanceMutation = useMutation({
    mutationFn: async ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) => {
      const response = await fetch('/api/admin/token-balance/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount, reason }),
      })
      if (!response.ok) throw new Error('Failed to adjust token balance')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-balances'] })
      queryClient.invalidateQueries({ queryKey: ['token-transactions'] })
      setAdjustmentAmount(0)
      setAdjustmentReason('')
      setSelectedUser('')
    },
  })

  // Top-up tokens mutation
  const topUpMutation = useMutation({
    mutationFn: async ({ userId, amount, paymentMethod }: { userId: string; amount: number; paymentMethod: string }) => {
      const response = await fetch('/api/admin/token-balance/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount, paymentMethod }),
      })
      if (!response.ok) throw new Error('Failed to process top-up')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-balances'] })
      queryClient.invalidateQueries({ queryKey: ['token-transactions'] })
      setShowTopUpModal(false)
    },
  })

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const getBalanceStatus = (balance: TokenBalance): { color: string; icon: React.ReactNode; label: string } => {
    const usagePercentage = (balance.usedTokens / balance.totalTokens) * 100
    
    if (usagePercentage >= 90) {
      return { color: 'text-red-600', icon: <AlertTriangle className="h-4 w-4" />, label: 'Critical' }
    } else if (usagePercentage >= 75) {
      return { color: 'text-yellow-600', icon: <Clock className="h-4 w-4" />, label: 'Warning' }
    } else {
      return { color: 'text-green-600', icon: <CheckCircle className="h-4 w-4" />, label: 'Healthy' }
    }
  }

  const getTransactionIcon = (type: TokenTransaction['type']) => {
    switch (type) {
      case 'purchase': return <Plus className="h-4 w-4 text-green-600" />
      case 'usage': return <Minus className="h-4 w-4 text-red-600" />
      case 'refund': return <Plus className="h-4 w-4 text-blue-600" />
      case 'bonus': return <Plus className="h-4 w-4 text-purple-600" />
      case 'rollover': return <TrendingUp className="h-4 w-4 text-orange-600" />
      default: return <Coins className="h-4 w-4 text-gray-600" />
    }
  }

  const handleAdjustBalance = () => {
    if (!selectedUser || adjustmentAmount === 0 || !adjustmentReason.trim()) {
      return
    }
    
    adjustBalanceMutation.mutate({
      userId: selectedUser,
      amount: adjustmentAmount,
      reason: adjustmentReason
    })
  }

  // Calculate summary statistics
  const totalTokensInSystem = balances.reduce((sum, b: any) => sum + b.totalTokens, 0)
  const totalUsedTokens = balances.reduce((sum, b: any) => sum + b.usedTokens, 0)
  const totalRemainingTokens = balances.reduce((sum, b: any) => sum + b.remainingTokens, 0)
  const averageUsagePercentage = balances.length > 0 
    ? (totalUsedTokens / totalTokensInSystem) * 100 
    : 0

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Token Balance Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage user token balances and top-up system
          </p>
        </div>
        
        <Button onClick={() => setShowTopUpModal(true)}>
          <CreditCard className="h-4 w-4 mr-2" />
          Process Top-Up
        </Button>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <Coins className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Tokens
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(totalTokensInSystem)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-full">
                <Zap className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Used Tokens
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(totalUsedTokens)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Remaining
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(totalRemainingTokens)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Avg Usage
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {averageUsagePercentage.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'balances', label: 'User Balances', icon: Coins },
            { id: 'transactions', label: 'Transactions', icon: History },
            { id: 'topup', label: 'Manual Adjustment', icon: Plus }
          ].map(({ id, label, icon: Icon }: any) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as 'balances' | 'transactions' | 'topup')}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'balances' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {balances.map((balance: any) => {
            const status = getBalanceStatus(balance)
            const usagePercentage = (balance.usedTokens / balance.totalTokens) * 100
            
            return (
              <Card key={balance.userId}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="truncate">User {balance.userId.slice(0, 8)}...</span>
                    <div className={`flex items-center ${status.color}`}>
                      {status.icon}
                      <span className="ml-1 text-sm">{status.label}</span>
                    </div>
                  </CardTitle>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-4">
                    {/* Token Balance */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Token Usage</span>
                        <span>{usagePercentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            usagePercentage >= 90 ? 'bg-red-500' :
                            usagePercentage >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Balance Details */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Total:</span>
                        <span className="ml-2 font-medium">{formatNumber(balance.totalTokens)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Used:</span>
                        <span className="ml-2 font-medium">{formatNumber(balance.usedTokens)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Remaining:</span>
                        <span className="ml-2 font-medium">{formatNumber(balance.remainingTokens)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Rollover:</span>
                        <span className="ml-2 font-medium">{formatNumber(balance.rolloverTokens)}</span>
                      </div>
                    </div>
                    
                    {/* Subscription Info */}
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{balance.subscriptionPlan}</Badge>
                        <span className="text-xs text-gray-500">
                          Monthly: {formatNumber(balance.monthlyAllocation)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Last Updated */}
                    <div className="text-xs text-gray-500">
                      Updated: {new Date(balance.lastUpdated).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {transactions.map((transaction: any) => (
            <Card key={transaction.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getTransactionIcon(transaction.type)}
                    <div>
                      <h4 className="font-medium">{transaction.description}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        User: {transaction.userId.slice(0, 8)}...
                        {transaction.feature && ` • ${transaction.feature}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`font-medium ${
                      transaction.type === 'usage' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {transaction.type === 'usage' ? '-' : '+'}{formatNumber(transaction.amount)} tokens
                    </div>
                    {transaction.cost && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {formatCurrency(transaction.cost)}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      {new Date(transaction.timestamp).toLocaleString()}
                    </div>
                    <Badge 
                      variant={
                        transaction.status === 'completed' ? 'default' :
                        transaction.status === 'pending' ? 'secondary' : 'destructive'
                      }
                      className="mt-1"
                    >
                      {transaction.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'topup' && (
        <Card>
          <CardHeader>
            <CardTitle>Manual Token Adjustment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select User
                </label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser((e.target as HTMLSelectElement).value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose a user...</option>
                  {balances.map((balance: any) => (
                    <option key={balance.userId} value={balance.userId}>
                      User {balance.userId.slice(0, 8)}... ({balance.subscriptionPlan})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Adjustment Amount (tokens)
                </label>
                <Input
                  type="number"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(parseInt((e.target as HTMLInputElement).value) || 0)}
                  placeholder="Enter positive or negative amount"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use positive numbers to add tokens, negative to deduct
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason for Adjustment
                </label>
                <Input
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason((e.target as HTMLInputElement).value)}
                  placeholder="e.g., Refund for service issue, Bonus tokens, etc."
                />
              </div>
              
              <Button
                onClick={handleAdjustBalance}
                disabled={!selectedUser || adjustmentAmount === 0 || !adjustmentReason.trim() || adjustBalanceMutation.isPending}
                className="w-full"
              >
                {adjustBalanceMutation.isPending ? 'Processing...' : 'Apply Adjustment'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default TokenBalanceManager
