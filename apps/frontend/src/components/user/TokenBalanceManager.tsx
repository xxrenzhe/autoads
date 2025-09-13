'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  Wallet, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  CreditCard,
  Calendar,
  Target
} from 'lucide-react'
import { toast } from 'sonner'

interface TokenBalance {
  currentBalance: number
  monthlyUsage: number
  planQuota: number
  usagePercentage: number
  remainingQuota: number
  forecast: {
    projectedUsage: number
    confidence: number
    willExceedQuota: boolean
    daysUntilDepletion: number | null
  }
  analytics: {
    averageDaily: number
    byFeature: Record<string, number>
    efficiency: number
  }
}

export default function TokenBalanceManager() {
  const [balance, setBalance] = useState<TokenBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [topUpAmount, setTopUpAmount] = useState(100)
  const [isTopUpLoading, setIsTopUpLoading] = useState(false)
  const [showTopUpForm, setShowTopUpForm] = useState(false)

  useEffect(() => {
    fetchBalance()
  }, [])

  const fetchBalance = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user/tokens/balance')
      const data = await response.json()
      
      if (data.success) => {
        setBalance(data.data)
      } else {
        toast.error('Failed to fetch token balance')
      }
    } catch (error) {
      console.error('Error fetching balance:', error)
      toast.error('Failed to fetch token balance')
    } finally {
      setLoading(false)
    }
  }

  const handleTopUp = async () => {
    if (topUpAmount < 1 || topUpAmount > 10000) => {
      toast.error('Top-up amount must be between 1 and 10,000 tokens')
      return
    }

    try {
      setIsTopUpLoading(true)
      const response = await fetch('/api/user/tokens/balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: topUpAmount,
          reason: `Token top-up: ${topUpAmount} tokens`
        })
      })

      const data = await response.json()
      
      if (data.success) => {
        setBalance(prev => prev ? { ...prev, currentBalance: data.data.newBalance } : null)
        setShowTopUpForm(false)
        setTopUpAmount(100)
        toast.success(data.data.message)
      } else {
        toast.error(data.error || 'Failed to process top-up')
      }
    } catch (error) {
      console.error('Error processing top-up:', error)
      toast.error('Failed to process top-up')
    } finally {
      setIsTopUpLoading(false)
    }
  }

  const getBalanceStatus = () => {
    if (!balance) return { color: 'gray', text: 'Unknown' }
    
    if (balance.currentBalance < 10) => {
      return { color: 'red', text: 'Critical' }
    } else if (balance.currentBalance < 50) => {
      return { color: 'yellow', text: 'Low' }
    } else if (balance.currentBalance < 200) => {
      return { color: 'blue', text: 'Moderate' }
    } else {
      return { color: 'green', text: 'Healthy' }
    }
  }

  const getUsageStatus = () => {
    if (!balance) return { color: 'gray', text: 'Unknown' }
    
    if (balance.usagePercentage >= 90) => {
      return { color: 'red', text: 'High Usage' }
    } else if (balance.usagePercentage >= 70) => {
      return { color: 'yellow', text: 'Moderate Usage' }
    } else {
      return { color: 'green', text: 'Normal Usage' }
    }
  }

  if (loading) => {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!balance) => {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load token balance. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    )
  }

  const balanceStatus = getBalanceStatus()
  const usageStatus = getUsageStatus()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Token Balance</h1>
          <p className="text-muted-foreground">
            Manage your token balance and monitor usage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchBalance}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => setShowTopUpForm(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Top Up
          </Button>
        </div>
      </div>

      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{balance.currentBalance.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge 
                variant={balanceStatus.color === 'red' ? 'destructive' : 
                        balanceStatus.color === 'yellow' ? 'secondary' : 'default'}
              >
                {balanceStatus.text}
              </Badge>
              <p className="text-xs text-muted-foreground">tokens available</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Usage</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{balance.monthlyUsage.toLocaleString()}</div>
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>Usage</span>
                <span>{balance.usagePercentage.toFixed(1)}%</span>
              </div>
              <Progress value={balance.usagePercentage} className="h-2" />
              <div className="flex items-center gap-2 mt-2">
                <Badge 
                  variant={usageStatus.color === 'red' ? 'destructive' : 
                          usageStatus.color === 'yellow' ? 'secondary' : 'default'}
                >
                  {usageStatus.text}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  of {balance.planQuota.toLocaleString()} quota
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{balance.analytics.averageDaily.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-2">
              tokens per day
            </p>
            {balance.forecast.daysUntilDepletion && (
              <div className="mt-2">
                <p className="text-sm font-medium">
                  {balance.forecast.daysUntilDepletion} days remaining
                </p>
                <p className="text-xs text-muted-foreground">
                  at current usage rate
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        {balance.currentBalance < 50 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Low Balance Warning:</strong> Your token balance is running low. 
              Consider topping up to avoid service interruption.
            </AlertDescription>
          </Alert>
        )}

        {balance.forecast.willExceedQuota && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Usage Warning:</strong> Based on current usage patterns, you may exceed your monthly quota. 
              Projected usage: {balance.forecast.projectedUsage.toFixed(0)} tokens 
              (Confidence: {(balance.forecast.confidence * 100).toFixed(0)}%)
            </AlertDescription>
          </Alert>
        )}

        {balance.forecast.daysUntilDepletion && balance.forecast.daysUntilDepletion < 7 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Critical Balance Warning:</strong> At current usage rate, your token balance will be depleted in approximately {balance.forecast.daysUntilDepletion} days.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Usage Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Breakdown</CardTitle>
          <CardDescription>Token consumption by feature this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(balance.analytics.byFeature).map(([feature, tokens]: any) => {
              const percentage = (tokens / balance.monthlyUsage) * 100
              return (
                <div key={feature} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="capitalize font-medium">{feature}</span>
                    <span className="text-sm text-muted-foreground">
                      {tokens.toLocaleString()} tokens ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Forecast */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Usage Forecast
          </CardTitle>
          <CardDescription>Projected token consumption for the next 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <p className="text-2xl font-bold">{balance.forecast.projectedUsage.toFixed(0)}</p>
              <p className="text-sm text-muted-foreground">Projected tokens</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <p className="text-2xl font-bold">{(balance.forecast.confidence * 100).toFixed(0)}%</p>
              <p className="text-sm text-muted-foreground">Confidence level</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <p className="text-2xl font-bold">{balance.analytics.efficiency.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Tokens per item</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Up Form Modal */}
      {showTopUpForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Top Up Tokens
              </CardTitle>
              <CardDescription>
                Add tokens to your account balance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="topup-amount">Amount</Label>
                <Input
                  id="topup-amount"
                  type="number"
                  min="1"
                  max="10000"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(parseInt(e.target.value) || 0)}
                  placeholder="Enter token amount"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum: 1 token, Maximum: 10,000 tokens
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span>Current Balance:</span>
                <span className="font-medium">{balance.currentBalance.toLocaleString()} tokens</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span>After Top-up:</span>
                <span className="font-medium">{(balance.currentBalance + topUpAmount).toLocaleString()} tokens</span>
              </div>

              <Separator />

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowTopUpForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleTopUp}
                  disabled={isTopUpLoading || topUpAmount < 1 || topUpAmount > 10000}
                  className="flex-1"
                >
                  {isTopUpLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Top Up
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}