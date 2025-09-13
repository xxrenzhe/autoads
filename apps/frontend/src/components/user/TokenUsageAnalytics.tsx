'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  BarChart3,
  PieChart,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download
} from 'lucide-react'
import { toast } from 'sonner'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts'

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

interface UsageData {
  records: any[]
  pagination: any
  analytics: any
  timeSeries: any[]
  batchSummaries: any[]
  forecast: any
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function TokenUsageAnalytics() {
  const [balance, setBalance] = useState<TokenBalance | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dateRange, setDateRange] = useState('30d')
  const [selectedFeature, setSelectedFeature] = useState<string>('all')

  useEffect(() => {
    fetchData()
  }, [dateRange, selectedFeature])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      const [balanceRes, usageRes] = await Promise.all([
        fetch('/api/user/tokens/balance'),
        fetch(`/api/user/tokens/usage?${new URLSearchParams({
          ...(dateRange !== 'all' && {
            startDate: new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString()
          }),
          ...(selectedFeature !== 'all' && { feature: selectedFeature })
        })}`)
      ])

      const [balanceData, usageData] = await Promise.all([
        balanceRes.json(),
        usageRes.json()
      ])

      if (balanceData.success) {
        setBalance(balanceData.data)
      }

      if (usageData.success) {
        setUsage(usageData.data)
      }
    } catch (error) {
      console.error('Error fetching token data:', error)
      toast.error('Failed to fetch token data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await fetchData()
  }

  const exportUsage = async () => {
    try {
      const response = await fetch(`/api/user/tokens/usage?${new URLSearchParams({
        limit: '1000',
        ...(dateRange !== 'all' && {
          startDate: new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString()
        }),
        ...(selectedFeature !== 'all' && { feature: selectedFeature })
      })}`)

      const data = await response.json()
      
      if (data.success) {
        const csv = convertToCSV(data.data.records)
        downloadCSV(csv, `token-usage-${new Date().toISOString().split('T')[0]}.csv`)
        toast.success('Usage data exported successfully')
      }
    } catch (error) {
      console.error('Error exporting usage:', error)
      toast.error('Failed to export usage data')
    }
  }

  const convertToCSV = (records: any[]) => {
    const headers = ['Date', 'Feature', 'Operation', 'Tokens', 'Items', 'Batch', 'Efficiency']
    const rows = records?.filter(Boolean)?.map((record: any) => [
      new Date(record.createdAt).toLocaleDateString(),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!balance || !usage) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load token usage data. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    )
  }

  const pieChartData = Object.entries(balance.analytics.byFeature).map(([feature, tokens]: any) => ({
    name: feature.charAt(0).toUpperCase() + feature.slice(1),
    value: tokens,
    percentage: ((tokens / balance.monthlyUsage) * 100).toFixed(1)
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Token Usage Analytics</h1>
          <p className="text-muted-foreground">
            Track your token consumption and usage patterns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={exportUsage}
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

      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{balance.currentBalance.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              tokens available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Usage</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{balance.monthlyUsage.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              of {balance.planQuota.toLocaleString()} quota
            </p>
            <Progress value={balance.usagePercentage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{balance.analytics.averageDaily.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              tokens per day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Efficiency</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{balance.analytics.efficiency.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              tokens per item
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Alert */}
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
            <strong>Low Balance Warning:</strong> At current usage rate, your token balance will be depleted in approximately {balance.forecast.daysUntilDepletion} days.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
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

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="batches">Batch Operations</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Usage by Feature */}
            <Card>
              <CardHeader>
                <CardTitle>Usage by Feature</CardTitle>
                <CardDescription>Token consumption breakdown</CardDescription>
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

            {/* Recent Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Usage</CardTitle>
                <CardDescription>Latest token consumption activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {usage.records.slice(0, 5).map((record, index: any) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium capitalize">{record.feature}</p>
                        <p className="text-sm text-muted-foreground">
                          {record.operation} • {record.itemCount} items
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

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage Trends</CardTitle>
              <CardDescription>Token consumption over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={usage.timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="totalTokens"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batches" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Batch Operations</CardTitle>
              <CardDescription>Summary of batch operations and their efficiency</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {usage.batchSummaries.slice(0, 10).map((batch, index: any) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium capitalize">{batch.feature}</p>
                      <p className="text-sm text-muted-foreground">
                        {batch.operation} • {batch.totalItems} items
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(batch.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{batch.totalTokens} tokens</p>
                      <p className="text-sm text-muted-foreground">
                        {(batch.totalTokens / batch.totalItems).toFixed(2)} per item
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage Forecast</CardTitle>
              <CardDescription>Projected token consumption for the next 30 days</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">{usage.forecast.next30Days.toFixed(0)}</p>
                  <p className="text-sm text-muted-foreground">Projected tokens</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">{(usage.forecast.confidence * 100).toFixed(0)}%</p>
                  <p className="text-sm text-muted-foreground">Confidence</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">
                    {balance.forecast.daysUntilDepletion || '∞'}
                  </p>
                  <p className="text-sm text-muted-foreground">Days until depletion</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Forecast by Feature</h4>
                {Object.entries(usage.forecast.breakdown).map(([feature, tokens]: any) => (
                  <div key={feature} className="flex items-center justify-between">
                    <span className="capitalize">{feature}</span>
                    <span className="font-medium">{(tokens as number).toFixed(0)} tokens</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}