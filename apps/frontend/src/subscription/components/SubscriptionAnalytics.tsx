'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  CreditCard,
  Calendar,
  BarChart3,
  PieChart,
  Download,
  RefreshCw
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

export interface SubscriptionAnalyticsData {
  totalRevenue: number
  monthlyRecurringRevenue: number
  activeSubscriptions: number
  churnRate: number
  averageRevenuePerUser: number
  lifetimeValue: number
  conversionRate: number
  trialConversionRate: number
  totalSubscriptions: number
  cancelledSubscriptions: number
  trialingSubscriptions: number
  recentSubscriptions: number
  subscriptionBreakdown: Array<{
    planId: string
    planName: string
    count: number
  }>
  period: number
  startDate: string
  endDate: string
}

export interface SubscriptionAnalyticsProps {
  className?: string
}

export function SubscriptionAnalytics({ className }: .*Props) {
  const [period, setPeriod] = useState(30)
  const [refreshing, setRefreshing] = useState(false)

  const {
    data: analytics,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['subscription-analytics', period],
    queryFn: async (): Promise<SubscriptionAnalyticsData> => {
      const response = await fetch(`/api/admin/subscription/analytics?period=${period}`)
      if (!response.ok) => {
        throw new Error('Failed to fetch subscription analytics')
      }
      const result = await response.json()
      return result.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const getChangeIndicator = (value: number, isPositiveGood: boolean = true) => {
    if (value === 0) return null
    
    const isPositive = value > 0
    const isGood = isPositiveGood ? isPositive : !isPositive
    
    return (
      <div className={`flex items-center ${isGood ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? (
          <TrendingUp className="h-3 w-3 mr-1" />
        ) : (
          <TrendingDown className="h-3 w-3 mr-1" />
        )}
        <span className="text-xs">{Math.abs(value).toFixed(1)}%</span>
      </div>
    )
  }

  if (isLoading) => {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Subscription Analytics
          </h2>
          <div className="animate-pulse h-8 w-24 bg-gray-300 rounded"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, index: any) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-300 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) => {
    return (
      <div className={`${className}`}>
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-red-600 mb-4">
              <BarChart3 className="h-12 w-12 mx-auto mb-2" />
              <p>Error loading subscription analytics</p>
              <p className="text-sm text-gray-500 mt-1">{error.message}</p>
            </div>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!analytics) => {
    return (
      <div className={`${className}`}>
        <Card>
          <CardContent className="p-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Analytics Data
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Analytics data is not available at the moment.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Subscription Analytics
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Last {period} days • Updated {new Date(analytics.endDate).toLocaleString()}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={period}
            onChange={(e) => setPeriod(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Monthly Recurring Revenue
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(analytics.monthlyRecurringRevenue)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
            {getChangeIndicator(5.2)} {/* This would come from comparison data */}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Active Subscriptions
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {analytics.activeSubscriptions.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            {getChangeIndicator(2.1)}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Churn Rate
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatPercentage(analytics.churnRate)}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
            {getChangeIndicator(-0.8, false)}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Average Revenue Per User
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(analytics.averageRevenuePerUser)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <CreditCard className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            {getChangeIndicator(3.4)}
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Revenue
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(analytics.totalRevenue)}
                </p>
              </div>
              <Badge variant="secondary">
                {period}d
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Lifetime Value
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(analytics.lifetimeValue)}
                </p>
              </div>
              <Badge variant="secondary">
                Avg
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Conversion Rate
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatPercentage(analytics.conversionRate)}
                </p>
              </div>
              <Badge variant="secondary">
                Overall
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Trial Conversion
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatPercentage(analytics.trialConversionRate)}
                </p>
              </div>
              <Badge variant="secondary">
                Trial
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="h-5 w-5 mr-2" />
              Subscriptions by Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.subscriptionBreakdown.map((item, index: any) => {
                const percentage = analytics.activeSubscriptions > 0 
                  ? (item.count / analytics.activeSubscriptions) * 100 
                  : 0
                
                return (
                  <div key={item.planId} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div 
                        className={`w-3 h-3 rounded-full mr-3 ${
                          index === 0 ? 'bg-blue-500' :
                          index === 1 ? 'bg-green-500' :
                          index === 2 ? 'bg-purple-500' :
                          'bg-gray-500'
                        }`}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.planName}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {item.count}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {percentage.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Subscription Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Active Subscriptions
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {analytics.activeSubscriptions}
                  </span>
                  <Badge variant="success">
                    Active
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Trial Subscriptions
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {analytics.trialingSubscriptions}
                  </span>
                  <Badge variant="warning">
                    Trial
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Cancelled Subscriptions
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {analytics.cancelledSubscriptions}
                  </span>
                  <Badge variant="destructive">
                    Cancelled
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Recent Subscriptions
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {analytics.recentSubscriptions}
                  </span>
                  <Badge variant="secondary">
                    {period}d
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default SubscriptionAnalytics