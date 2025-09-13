'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Activity,
  Coins,
  Users,
  Calendar,
  Download,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Target,
  DollarSign
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

export interface TokenUsageMetrics {
  totalTokensUsed: number
  totalCost: number
  averageCostPerToken: number
  uniqueUsers: number
  totalSessions: number
  peakUsageHour: string
  mostUsedFeature: string
  growthRate: number
  efficiencyScore: number
}

export interface TokenUsagePattern {
  feature: string
  tokensUsed: number
  cost: number
  sessions: number
  averageTokensPerSession: number
  peakHour: string
  growthRate: number
  efficiency: number
}

export interface TokenForecast {
  date: string
  predictedUsage: number
  predictedCost: number
  confidence: number
  factors: string[]
}

export interface TokenAlert {
  id: string
  type: 'budget_exceeded' | 'unusual_usage' | 'efficiency_drop' | 'forecast_warning'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  feature?: string
  threshold: number
  currentValue: number
  timestamp: string
  isRead: boolean
}

export interface TokenAnalyticsDashboardProps {
  className?: string
}

export function TokenAnalyticsDashboard({ className }: TokenAnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState('7d')
  const [selectedFeature, setSelectedFeature] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'forecast' | 'alerts'>('overview')

  // Fetch token analytics data
  const {
    data: analytics,
    isLoading: isAnalyticsLoading
  } = useQuery({
    queryKey: ['token-analytics-detailed', timeRange, selectedFeature],
    queryFn: async () => {
      const params = new URLSearchParams({ timeRange })
      if (selectedFeature !== 'all') params.append('feature', selectedFeature)
      
      const response = await fetch(`/api/admin/token-analytics/detailed?${params}`)
      if (!response.ok) throw new Error('Failed to fetch token analytics')
      const result = await response.json()
      return result.data
    },
    staleTime: 2 * 60 * 1000,
  })

  // Fetch usage patterns
  const {
    data: patterns = [],
    isLoading: isPatternsLoading
  } = useQuery({
    queryKey: ['token-usage-patterns', timeRange],
    queryFn: async (): Promise<TokenUsagePattern[]> => {
      const response = await fetch(`/api/admin/token-analytics/patterns?timeRange=${timeRange}`)
      if (!response.ok) throw new Error('Failed to fetch usage patterns')
      const result = await response.json()
      return result.data || []
    },
    staleTime: 5 * 60 * 1000,
  })

  // Fetch forecasts
  const {
    data: forecasts = [],
    isLoading: isForecastsLoading
  } = useQuery({
    queryKey: ['token-forecasts', selectedFeature],
    queryFn: async (): Promise<TokenForecast[]> => {
      const params = selectedFeature !== 'all' ? `?feature=${selectedFeature}` : ''
      const response = await fetch(`/api/admin/token-analytics/forecast${params}`)
      if (!response.ok) throw new Error('Failed to fetch token forecasts')
      const result = await response.json()
      return result.data || []
    },
    staleTime: 10 * 60 * 1000,
  })

  // Fetch alerts
  const {
    data: alerts = [],
    isLoading: isAlertsLoading
  } = useQuery({
    queryKey: ['token-alerts'],
    queryFn: async (): Promise<TokenAlert[]> => {
      const response = await fetch('/api/admin/token-analytics/alerts')
      if (!response.ok) throw new Error('Failed to fetch token alerts')
      const result = await response.json()
      return result.data || []
    },
    staleTime: 1 * 60 * 1000,
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
      minimumFractionDigits: 4
    }).format(amount)
  }

  const getGrowthColor = (rate: number): string => {
    if (rate > 0) return 'text-green-600'
    if (rate < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  const getGrowthIcon = (rate: number) => {
    if (rate > 0) return <TrendingUp className="h-4 w-4" />
    if (rate < 0) return <TrendingDown className="h-4 w-4" />
    return <Activity className="h-4 w-4" />
  }

  const getAlertIcon = (type: TokenAlert['type']) => {
    switch (type) {
      case 'budget_exceeded':
        return <DollarSign className="h-4 w-4 text-red-600" />
      case 'unusual_usage':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'efficiency_drop':
        return <TrendingDown className="h-4 w-4 text-orange-600" />
      case 'forecast_warning':
        return <Clock className="h-4 w-4 text-blue-600" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />
    }
  }

  const getSeverityColor = (severity: TokenAlert['severity']): string => {
    switch (severity) {
      case 'critical': return 'bg-red-100 border-red-200 text-red-800'
      case 'high': return 'bg-orange-100 border-orange-200 text-orange-800'
      case 'medium': return 'bg-yellow-100 border-yellow-200 text-yellow-800'
      case 'low': return 'bg-blue-100 border-blue-200 text-blue-800'
      default: return 'bg-gray-100 border-gray-200 text-gray-800'
    }
  }

  const exportData = async (type: 'usage' | 'patterns' | 'forecast') => {
    try {
      const response = await fetch(`/api/admin/token-analytics/export?type=${type}&timeRange=${timeRange}`)
      if (!response.ok) throw new Error('Export failed')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `token-${type}-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Advanced Token Analytics
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time metrics, patterns analysis, and consumption forecasting
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange((e.target as HTMLSelectElement).value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          
          <Button onClick={() => exportData('usage')}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Coins className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Tokens Used
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(analytics.totalTokensUsed)}
                  </p>
                  <div className={`flex items-center text-sm ${getGrowthColor(analytics.growthRate)}`}>
                    {getGrowthIcon(analytics.growthRate)}
                    <span className="ml-1">{Math.abs(analytics.growthRate).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Cost
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(analytics.totalCost)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Avg: {formatCurrency(analytics.averageCostPerToken)}/token
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-full">
                  <Target className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Efficiency Score
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {analytics.efficiencyScore.toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Most used: {analytics.mostUsedFeature}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Users className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Active Users
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(analytics.uniqueUsers)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Peak: {analytics.peakUsageHour}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'patterns', label: 'Usage Patterns', icon: PieChart },
            { id: 'forecast', label: 'Forecasting', icon: TrendingUp },
            { id: 'alerts', label: 'Alerts', icon: AlertTriangle }
          ].map(({ id, label, icon: Icon }: any) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {label}
              {id === 'alerts' && alerts.filter((a: any) => !a.isRead).length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {alerts.filter((a: any) => !a.isRead).length}
                </Badge>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-gray-500">
                Chart placeholder - Token usage over time
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Cost Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-gray-500">
                Chart placeholder - Cost breakdown by feature
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'patterns' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {patterns.map((pattern, index: any) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{pattern.feature}</span>
                    <Badge variant={pattern.efficiency > 80 ? 'default' : 'secondary'}>
                      {pattern.efficiency.toFixed(1)}% efficient
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Tokens Used:</span>
                        <span className="ml-2 font-medium">{formatNumber(pattern.tokensUsed)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Total Cost:</span>
                        <span className="ml-2 font-medium">{formatCurrency(pattern.cost)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Sessions:</span>
                        <span className="ml-2 font-medium">{pattern.sessions}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Avg/Session:</span>
                        <span className="ml-2 font-medium">{pattern.averageTokensPerSession.toFixed(1)}</span>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Peak Hour:</span>
                        <span className="font-medium">{pattern.peakHour}</span>
                      </div>
                      <div className={`flex items-center justify-between text-sm ${getGrowthColor(pattern.growthRate)}`}>
                        <span className="text-gray-600 dark:text-gray-400">Growth:</span>
                        <div className="flex items-center">
                          {getGrowthIcon(pattern.growthRate)}
                          <span className="ml-1 font-medium">{Math.abs(pattern.growthRate).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'forecast' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage Forecast (Next 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-gray-500 mb-6">
                Chart placeholder - Forecasted usage and cost trends
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {forecasts.slice(0, 3).map((forecast, index: any) => (
                  <div key={index} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {new Date(forecast.date).toLocaleDateString()}
                    </div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatNumber(forecast.predictedUsage)} tokens
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {formatCurrency(forecast.predictedCost)} • {forecast.confidence}% confidence
                    </div>
                    <div className="mt-2">
                      {forecast.factors.slice(0, 2).map((factor, i: any) => (
                        <Badge key={i} variant="outline" className="mr-1 text-xs">
                          {factor}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {alerts.length > 0 ? (
            alerts.map((alert: any) => (
              <Card key={alert.id} className={`${getSeverityColor(alert.severity)} ${!alert.isRead ? 'ring-2 ring-blue-200' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {getAlertIcon(alert.type)}
                      <div>
                        <h4 className="font-medium">{alert.title}</h4>
                        <p className="text-sm mt-1">{alert.description}</p>
                        {alert.feature && (
                          <Badge variant="outline" className="mt-2">
                            {alert.feature}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">
                        {alert.currentValue} / {alert.threshold}
                      </div>
                      <div className="text-gray-500">
                        {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Active Alerts
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  All token usage metrics are within normal ranges.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

export default TokenAnalyticsDashboard
