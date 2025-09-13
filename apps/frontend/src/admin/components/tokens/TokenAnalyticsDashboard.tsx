'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Alert, AlertDescription } from '../ui/alert'
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign,
  BarChart3,
  PieChart,
  RefreshCw,
  Download,
  Calendar,
  Target,
  Activity,
  Zap,
  Clock,
  Filter,
  Search,
  ArrowUp,
  ArrowDown,
  AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ComposedChart,
  Scatter,
  ScatterChart,
  ZAxis
} from 'recharts'

interface TokenAnalytics {
  records: any[]
  pagination: any
  summary: {
    totalTokens: number
    totalItems: number
    totalOperations: number
    averageTokensPerOperation: number
    efficiency: number
    batchOperations: number
    batchEfficiency: number
  }
  breakdown: {
    byFeature: Record<string, number>
    topUsers: any[]
  }
}

interface UsageInsight {
  type: 'trend' | 'efficiency' | 'pattern' | 'anomaly'
  title: string
  description: string
  value: string
  change?: number
  severity: 'info' | 'warning' | 'success' | 'error'
}

interface FeatureConsumption {
  feature: string
  totalTokens: number
  totalOperations: number
  averagePerOperation: number
  efficiency: number
  trend: 'up' | 'down' | 'stable'
  trendPercentage: number
}

interface UserUsagePattern {
  userId: string
  userName: string
  userEmail: string
  totalTokens: number
  operations: number
  efficiency: number
  preferredFeatures: string[]
  batchUsageRate: number
  activityPattern: 'heavy' | 'moderate' | 'light'
  lastActive: string
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function TokenAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<TokenAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dateRange, setDateRange] = useState('30')
  const [selectedFeature, setSelectedFeature] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [insights, setInsights] = useState<UsageInsight[]>([])
  const [featureConsumption, setFeatureConsumption] = useState<FeatureConsumption[]>([])
  const [userPatterns, setUserPatterns] = useState<UserUsagePattern[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'tokens' | 'operations' | 'efficiency'>('tokens')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    setPage(1) // Reset page when filters change
    fetchAnalytics()
  }, [dateRange, selectedFeature])

  useEffect(() => {
    fetchAnalytics()
  }, [page, pageSize])

  useEffect(() => {
    if (analytics) => {
      generateInsights()
      analyzeFeatureConsumption()
      analyzeUserPatterns()
    }
  }, [analytics])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      
      const offset = (page - 1) * pageSize
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
        ...(dateRange !== 'all' && {
          startDate: new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString()
        }),
        ...(selectedFeature !== 'all' && { feature: selectedFeature })
      })

      const response = await fetch(`/api/admin/tokens/analytics?${params}`)
      const data = await response.json()
      
      if (data.success) => {
        setAnalytics(data.data)
        if (data.cached) => {
          toast.info('Showing cached data')
        }
      } else {
        toast.error('Failed to fetch token analytics')
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast.error('Failed to fetch token analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await fetchAnalytics()
  }

  const exportData = async () => {
    try {
      const params = new URLSearchParams({
        limit: '10000',
        ...(dateRange !== 'all' && {
          startDate: new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString()
        }),
        ...(selectedFeature !== 'all' && { feature: selectedFeature })
      })

      const response = await fetch(`/api/admin/tokens/analytics?${params}`)
      const data = await response.json()
      
      if (data.success) => {
        const csv = convertToCSV(data.data.records)
        downloadCSV(csv, `token-analytics-${new Date().toISOString().split('T')[0]}.csv`)
        toast.success('Analytics data exported successfully')
      }
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.error('Failed to export analytics data')
    }
  }

  const convertToCSV = (records: any[]) => {
    const headers = ['Date', 'User', 'Feature', 'Operation', 'Tokens', 'Items', 'Batch', 'Efficiency']
    const rows = records?.filter(Boolean)?.map((record: any) => [
      new Date(record.createdAt).toLocaleDateString(),
      record.user.email,
      record.feature,
      record.operation,
      record.tokensConsumed,
      record.itemCount,
      record.isBatch ? 'Yes' : 'No',
      (record.tokensConsumed / record.itemCount).toFixed(2)
    ])
    
    return [headers, ...rows]?.filter(Boolean)?.map((row: any) => row.join(',')).join('\n')
  }

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const generateInsights = () => {
    if (!analytics) return

    const insights: UsageInsight[] = []

    // Efficiency insight
    if (analytics.summary.efficiency > 0) => {
      const efficiencyRating = analytics.summary.efficiency < 1.5 ? 'excellent' : 
                              analytics.summary.efficiency < 2.5 ? 'good' : 'needs improvement'
      insights.push({
        type: 'efficiency',
        title: 'System Efficiency',
        description: `Average ${analytics.summary.efficiency.toFixed(2)} tokens per item - ${efficiencyRating}`,
        value: `${analytics.summary.efficiency.toFixed(2)} tokens/item`,
        severity: analytics.summary.efficiency < 1.5 ? 'success' : 
                 analytics.summary.efficiency < 2.5 ? 'info' : 'warning'
      })
    }

    // Batch usage insight
    const batchRate = (analytics.summary.batchOperations / analytics.summary.totalOperations) * 100
    insights.push({
      type: 'pattern',
      title: 'Batch Usage Rate',
      description: `${batchRate.toFixed(1)}% of operations use batch processing`,
      value: `${batchRate.toFixed(1)}%`,
      severity: batchRate > 50 ? 'success' : batchRate > 25 ? 'info' : 'warning'
    })

    // Top feature insight
    const topFeature = Object.entries(analytics.breakdown.byFeature)
      .sort(([,a], [,b]) => b - a)[0]
    if (topFeature) => {
      const percentage = (topFeature[1] / analytics.summary.totalTokens * 100).toFixed(1)
      insights.push({
        type: 'trend',
        title: 'Most Used Feature',
        description: `${topFeature[0]} accounts for ${percentage}% of token consumption`,
        value: `${topFeature[1].toLocaleString()} tokens`,
        severity: 'info'
      })
    }

    // User activity insight
    if (analytics.breakdown.topUsers.length > 0) => {
      const activeUsers = analytics.breakdown.topUsers.length
      const topUser = analytics.breakdown.topUsers[0]
      const topUserPercentageNum = (topUser.totalTokens / analytics.summary.totalTokens * 100)
      const topUserPercentage = topUserPercentageNum.toFixed(1)
      
      insights.push({
        type: 'pattern',
        title: 'User Activity',
        description: `${activeUsers} active users, top user consumes ${topUserPercentage}% of tokens`,
        value: `${activeUsers} users`,
        severity: topUserPercentageNum > 50 ? 'warning' : 'info'
      })
    }

    setInsights(insights)
  }

  const analyzeFeatureConsumption = () => {
    if (!analytics) return

    const consumption: FeatureConsumption[] = Object.entries(analytics.breakdown.byFeature)
      .map(([feature, tokens]: any) => {
        const featureRecords = analytics.records.filter((r: any) => r.feature === feature)
        const operations = featureRecords.length
        const averagePerOperation = operations > 0 ? tokens / operations : 0
        const totalItems = featureRecords.reduce((sum, r: any) => sum + r.itemCount, 0)
        const efficiency = totalItems > 0 ? tokens / totalItems : 0

        return {
          feature,
          totalTokens: tokens,
          totalOperations: operations,
          averagePerOperation,
          efficiency,
          trend: 'stable' as const, // Would need historical data for real trend
          trendPercentage: 0
        }
      })
      .sort((a, b) => b.totalTokens - a.totalTokens)

    setFeatureConsumption(consumption)
  }

  const analyzeUserPatterns = () => {
    if (!analytics) return

    const patterns: UserUsagePattern[] = analytics.breakdown.topUsers.map((user: any) => {
      const userRecords = analytics.records.filter((r: any) => r.userId === user.userId)
      const batchOperations = userRecords.filter((r: any) => r.isBatch).length
      const batchUsageRate = userRecords.length > 0 ? (batchOperations / userRecords.length) * 100 : 0
      
      // Determine preferred features
      const featureUsage = userRecords.reduce((acc, record: any) => {
        acc[record.feature] = (acc[record.feature] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      const preferredFeatures = Object.entries(featureUsage)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 2)
        .map(([feature]: any) => feature)

      // Determine activity pattern
      const activityPattern = user.totalTokens > 1000 ? 'heavy' : 
                            user.totalTokens > 100 ? 'moderate' : 'light'

      // Get last active date
      const lastActive = userRecords.length > 0 
        ? new Date(Math.max(...userRecords.map((r: any) => new Date(r.createdAt).getTime()))).toISOString()
        : new Date().toISOString()

      return {
        userId: user.userId,
        userName: user.userName || 'Unknown',
        userEmail: user.userEmail,
        totalTokens: user.totalTokens,
        operations: user.operations,
        efficiency: user.totalItems > 0 ? user.totalTokens / user.totalItems : 0,
        preferredFeatures,
        batchUsageRate,
        activityPattern,
        lastActive
      }
    })

    setUserPatterns(patterns)
  }

  const filteredUserPatterns = userPatterns.filter((user: any) =>
    user.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    let aValue: number
    let bValue: number
    
    switch (sortBy) => {
      case 'operations':
        aValue = a.operations
        bValue = b.operations
        break
      case 'efficiency':
        aValue = a.efficiency
        bValue = b.efficiency
        break
      default: // 'tokens'
        aValue = a.totalTokens
        bValue = b.totalTokens
        break
    }
    
    const multiplier = sortOrder === 'asc' ? 1 : -1
    return (aValue - bValue) * multiplier
  })

  if (loading) => {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!analytics) => {
    return (
      <Alert>
        <AlertDescription>
          Failed to load token analytics. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    )
  }

  const pieChartData = Object.entries(analytics.breakdown.byFeature).map(([feature, tokens]: any) => ({
    name: feature.charAt(0).toUpperCase() + feature.slice(1),
    value: tokens,
    percentage: ((tokens / analytics.summary.totalTokens) * 100).toFixed(1)
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Token Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor token consumption across all users and features
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={exportData}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.totalTokens.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              consumed in {dateRange === 'all' ? 'all time' : `last ${dateRange} days`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Operations</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.totalOperations.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.summary.batchOperations} batch operations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Tokens/Operation</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.averageTokensPerOperation.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              efficiency: {analytics.summary.efficiency.toFixed(2)} tokens/item
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.breakdown.topUsers.length}</div>
            <p className="text-xs text-muted-foreground">
              users with token activity
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Usage Insights
            </CardTitle>
            <CardDescription>
              Key insights and patterns from token usage data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {insights.map((insight, index: any) => (
                <div key={index} className={`p-4 rounded-lg border ${
                  insight.severity === 'success' ? 'bg-green-50 border-green-200' :
                  insight.severity === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                  insight.severity === 'error' ? 'bg-red-50 border-red-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {insight.type === 'trend' && <TrendingUp className="h-4 w-4" />}
                    {insight.type === 'efficiency' && <Target className="h-4 w-4" />}
                    {insight.type === 'pattern' && <Activity className="h-4 w-4" />}
                    {insight.type === 'anomaly' && <AlertTriangle className="h-4 w-4" />}
                    <span className="font-medium text-sm">{insight.title}</span>
                  </div>
                  <div className="text-lg font-bold mb-1">{insight.value}</div>
                  <p className="text-xs text-muted-foreground">{insight.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Time Range:</label>
            <select
              value={dateRange}
              onChange={((e: any): any) => setDateRange(e.target.value)}
              className="px-3 py-1 border rounded-md text-sm"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Feature:</label>
            <select
              value={selectedFeature}
              onChange={((e: any): any) => setSelectedFeature(e.target.value)}
              className="px-3 py-1 border rounded-md text-sm"
            >
              <option value="all">All features</option>
              <option value="siterank">SiteRank</option>
              <option value="batchopen">BatchOpen</option>
              <option value="adscenter">ChangeLink</option>
            </select>
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={((e: any): any) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            className="px-3 py-1 border rounded-md text-sm"
          >
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
            <option value="200">200 per page</option>
            <option value="500">500 per page</option>
          </select>
          
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={((: any) => setPage(p: any) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="px-3 py-1 text-sm">
              Page {page} of {Math.ceil((analytics?.pagination?.total || 0) / pageSize)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={((: any) => setPage(p: any) => p + 1)}
              disabled={!analytics?.pagination?.hasMore}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="features">Feature Analysis</TabsTrigger>
          <TabsTrigger value="users">User Patterns</TabsTrigger>
          <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Token Distribution by Feature */}
            <Card>
              <CardHeader>
                <CardTitle>Token Distribution by Feature</CardTitle>
                <CardDescription>How tokens are consumed across features</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                    >
                      {pieChartData.map((entry, index: any) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Token Activity</CardTitle>
                <CardDescription>Latest token consumption activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.records.slice(0, 5).map((record, index: any) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{record.user.name || record.user.email}</p>
                        <p className="text-sm text-muted-foreground">
                          {record.feature} • {record.operation} • {record.itemCount} items
                          {record.isBatch && <Badge variant="secondary" className="ml-2">Batch</Badge>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{record.tokensConsumed} tokens</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(record.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Feature Consumption Analysis</CardTitle>
                <CardDescription>Detailed breakdown by feature</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {featureConsumption.map((feature: any) => {
                    const percentage = (feature.totalTokens / analytics.summary.totalTokens) * 100
                    
                    return (
                      <div key={feature.feature} className="space-y-3 p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="capitalize font-medium">{feature.feature}</span>
                            <Badge variant="outline">{feature.totalOperations} ops</Badge>
                          </div>
                          <div className="text-right">
                            <span className="font-medium">{feature.totalTokens.toLocaleString()} tokens</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                        
                        <div className="bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Avg per Operation</p>
                            <p className="font-medium">{feature.averagePerOperation.toFixed(1)} tokens</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Efficiency</p>
                            <p className="font-medium">{feature.efficiency.toFixed(2)} tokens/item</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feature Performance Comparison</CardTitle>
                <CardDescription>Efficiency and usage patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart data={featureConsumption}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="totalOperations" 
                      name="Operations"
                      label={{ value: 'Total Operations', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      dataKey="efficiency" 
                      name="Efficiency"
                      label={{ value: 'Tokens per Item', angle: -90, position: 'insideLeft' }}
                    />
                    <ZAxis dataKey="totalTokens" range={[50, 400]} name="Total Tokens" />
                    <Tooltip 
                      formatter={(value, name) => [
                        typeof value === 'number' ? value.toFixed(2) : value, 
                        name === 'efficiency' ? 'Tokens per Item' : 
                        name === 'totalOperations' ? 'Operations' : 'Total Tokens'
                      ]}
                      labelFormatter={(label) => `Feature: ${label}`}
                    />
                    <Scatter dataKey="efficiency" fill="#8884d8" />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Usage Patterns</CardTitle>
                  <CardDescription>Detailed analysis of user behavior and preferences</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={((e: any): any) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border rounded-md text-sm"
                    />
                  </div>
                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={((e: any): any) => {
                      const [field, order] = e.target.value.split('-')
                      setSortBy(field as any)
                      setSortOrder(order as any)
                    }}
                    className="px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="tokens-desc">Tokens (High to Low)</option>
                    <option value="tokens-asc">Tokens (Low to High)</option>
                    <option value="operations-desc">Operations (High to Low)</option>
                    <option value="operations-asc">Operations (Low to High)</option>
                    <option value="efficiency-desc">Efficiency (High to Low)</option>
                    <option value="efficiency-asc">Efficiency (Low to High)</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUserPatterns.slice(0, 20).map((user, index: any) => (
                  <div key={user.userId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                          user.activityPattern === 'heavy' ? 'bg-red-500' :
                          user.activityPattern === 'moderate' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}>
                          {user.userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{user.userName}</p>
                          <p className="text-sm text-muted-foreground">{user.userEmail}</p>
                        </div>
                        <Badge variant={
                          user.activityPattern === 'heavy' ? 'destructive' :
                          user.activityPattern === 'moderate' ? 'default' : 'secondary'
                        }>
                          {user.activityPattern}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{user.totalTokens.toLocaleString()} tokens</p>
                        <p className="text-sm text-muted-foreground">
                          {user.operations} operations
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Efficiency</p>
                        <p className="font-medium">{user.efficiency.toFixed(2)} tokens/item</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Batch Usage</p>
                        <p className="font-medium">{user.batchUsageRate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Preferred Features</p>
                        <div className="flex gap-1 mt-1">
                          {user.preferredFeatures.map((feature: any) => (
                            <Badge key={feature} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Active</p>
                        <p className="font-medium">
                          {new Date(user.lastActive).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="efficiency" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Batch vs Individual Operations</CardTitle>
                <CardDescription>Efficiency comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium">Batch Operations</p>
                      <p className="text-sm text-muted-foreground">
                        {analytics.summary.batchOperations} operations
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{analytics.summary.batchEfficiency.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">tokens per item</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium">Individual Operations</p>
                      <p className="text-sm text-muted-foreground">
                        {analytics.summary.totalOperations - analytics.summary.batchOperations} operations
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{analytics.summary.efficiency.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">tokens per item</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Efficiency Metrics</CardTitle>
                <CardDescription>Overall system efficiency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{analytics.summary.efficiency.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Average tokens per item</p>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{analytics.summary.averageTokensPerOperation.toFixed(1)}</p>
                    <p className="text-sm text-muted-foreground">Average tokens per operation</p>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">
                      {((analytics.summary.batchOperations / analytics.summary.totalOperations) * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Batch operation rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Token Consumption Trends</CardTitle>
                <CardDescription>Usage patterns over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={pieChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                    <Line type="monotone" dataKey="percentage" stroke="#ff7300" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Efficiency Trends</CardTitle>
                <CardDescription>System efficiency over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium">Current Efficiency</p>
                      <p className="text-2xl font-bold">{analytics.summary.efficiency.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">tokens per item</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        {analytics.summary.efficiency < 2 ? (
                          <ArrowDown className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowUp className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`text-sm font-medium ${
                          analytics.summary.efficiency < 2 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {analytics.summary.efficiency < 2 ? 'Efficient' : 'Needs Improvement'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium">Batch Efficiency</p>
                      <p className="text-2xl font-bold">{analytics.summary.batchEfficiency.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">tokens per item (batch)</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <ArrowDown className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">
                          {((1 - analytics.summary.batchEfficiency / analytics.summary.efficiency) * 100).toFixed(1)}% savings
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Recommendations</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {analytics.summary.batchOperations / analytics.summary.totalOperations < 0.5 && (
                        <li>• Encourage more batch operations to improve efficiency</li>
                      )}
                      {analytics.summary.efficiency > 2.5 && (
                        <li>• Review token costs for high-consumption features</li>
                      )}
                      {analytics.breakdown.topUsers.length > 0 && analytics.breakdown.topUsers[0].totalTokens / analytics.summary.totalTokens > 0.3 && (
                        <li>• Monitor top user consumption patterns</li>
                      )}
                      <li>• Consider implementing usage alerts for heavy users</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}