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
  RefreshCw,
  Download,
  Calendar,
  Target,
  Activity,
  CreditCard,
  UserCheck,
  UserX,
  ArrowUp,
  ArrowDown
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
  ComposedChart
} from 'recharts'

interface SubscriptionAnalytics {
  totalSubscribers: number
  totalRevenue: number
  monthlyRecurringRevenue: number
  averageRevenuePerUser: number
  churnRate: number
  conversionRate: number
  planDistribution: Record<string, number>
  revenueByPlan: Record<string, number>
}

interface SubscriptionTrend {
  date: string
  newSubscriptions: number
  cancellations: number
  revenue: number
  netGrowth: number
}

interface UserLifecycleMetrics {
  newUsers: number
  trialUsers: number
  activeSubscribers: number
  cancelledUsers: number
  averageLifetime: number
  lifetimeValue: number
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

export default function SubscriptionAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<SubscriptionAnalytics | null>(null)
  const [trends, setTrends] = useState<SubscriptionTrend[]>([])
  const [lifecycleMetrics, setLifecycleMetrics] = useState<UserLifecycleMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dateRange, setDateRange] = useState('30')

  useEffect(() => {
    fetchAnalytics()
  }, [dateRange])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      
      const [analyticsResponse, trendsResponse, lifecycleResponse] = await Promise.all([
        fetch('/api/admin/subscriptions/analytics'),
        fetch(`/api/admin/subscriptions/trends?days=${dateRange}`),
        fetch('/api/admin/subscriptions/lifecycle')
      ])

      if (analyticsResponse.ok) {
        const data = await analyticsResponse.json()
        setAnalytics(data.data)
      }

      if (trendsResponse.ok) {
        const data = await trendsResponse.json()
        setTrends(data.data || [])
      }

      if (lifecycleResponse.ok) {
        const data = await lifecycleResponse.json()
        setLifecycleMetrics(data.data)
      }
    } catch (error) {
      console.error('Error fetching subscription analytics:', error)
      toast.error('Failed to fetch subscription analytics')
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
      const response = await fetch(`/api/admin/subscriptions/export?days=${dateRange}`)
      const data = await response.json()
      
      if (data.success) {
        // Create and download CSV
        const csv = convertToCSV(data.data)
        downloadCSV(csv, `subscription-analytics-${new Date().toISOString().split('T')[0]}.csv`)
        toast.success('Analytics data exported successfully')
      }
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.error('Failed to export analytics data')
    }
  }

  const convertToCSV = (data: any[]) => {
    const headers = ['Date', 'New Subscriptions', 'Cancellations', 'Revenue', 'Net Growth']
    const rows = data.map((item: any) => [
      item.date,
      item.newSubscriptions,
      item.cancellations,
      item.revenue,
      item.netGrowth
    ])
    
    return [headers, ...rows].map((row: any) => row.join(',')).join('\n')
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

  if (!analytics) {
    return (
      <Alert>
        <AlertDescription>
          Failed to load subscription analytics. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    )
  }

  const planDistributionData = Object.entries(analytics.planDistribution).map(([plan, count]: any) => ({
    name: plan,
    value: count,
    percentage: ((count / analytics.totalSubscribers) * 100).toFixed(1)
  }))

  const revenueDistributionData = Object.entries(analytics.revenueByPlan).map(([plan, revenue]: any) => ({
    name: plan,
    value: revenue,
    percentage: ((revenue / analytics.totalRevenue) * 100).toFixed(1)
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscription Analytics</h1>
          <p className="text-muted-foreground">
            Monitor subscription performance and user lifecycle metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e: any) => setDateRange(e.target.value)}
            className="px-3 py-1 border rounded-md text-sm"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalSubscribers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Active subscriptions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics.monthlyRecurringRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              MRR
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARPU</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics.averageRevenuePerUser.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">
              Average revenue per user
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.churnRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Monthly churn rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Lifecycle Metrics */}
      {lifecycleMetrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              User Lifecycle Metrics
            </CardTitle>
            <CardDescription>
              Track user journey from trial to subscription
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <UserCheck className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold text-blue-600">{lifecycleMetrics.newUsers}</div>
                <div className="text-sm text-muted-foreground">New Users</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <Calendar className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
                <div className="text-2xl font-bold text-yellow-600">{lifecycleMetrics.trialUsers}</div>
                <div className="text-sm text-muted-foreground">Trial Users</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <CreditCard className="h-6 w-6 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-600">{lifecycleMetrics.activeSubscribers}</div>
                <div className="text-sm text-muted-foreground">Active Subs</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <UserX className="h-6 w-6 mx-auto mb-2 text-red-600" />
                <div className="text-2xl font-bold text-red-600">{lifecycleMetrics.cancelledUsers}</div>
                <div className="text-sm text-muted-foreground">Cancelled</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <BarChart3 className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold text-purple-600">{lifecycleMetrics.averageLifetime}</div>
                <div className="text-sm text-muted-foreground">Avg Lifetime (days)</div>
              </div>
              <div className="text-center p-4 bg-indigo-50 rounded-lg">
                <DollarSign className="h-6 w-6 mx-auto mb-2 text-indigo-600" />
                <div className="text-2xl font-bold text-indigo-600">${lifecycleMetrics.lifetimeValue}</div>
                <div className="text-sm text-muted-foreground">LTV</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="distribution">Plan Distribution</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Analysis</TabsTrigger>
          <TabsTrigger value="cohorts">Cohort Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Growth</CardTitle>
                <CardDescription>New subscriptions vs cancellations over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="newSubscriptions" fill="#10B981" name="New Subscriptions" />
                    <Bar dataKey="cancellations" fill="#EF4444" name="Cancellations" />
                    <Line type="monotone" dataKey="netGrowth" stroke="#3B82F6" name="Net Growth" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
                <CardDescription>Revenue growth over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Subscriber Distribution by Plan</CardTitle>
                <CardDescription>How subscribers are distributed across plans</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={planDistributionData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                    >
                      {planDistributionData.map((entry, index: any) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Plan Performance</CardTitle>
                <CardDescription>Detailed breakdown by plan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {planDistributionData.map((plan, index: any) => (
                    <div key={plan.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <p className="font-medium">{plan.name}</p>
                          <p className="text-sm text-muted-foreground">{plan.value} subscribers</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{plan.percentage}%</p>
                        <p className="text-sm text-muted-foreground">of total</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Distribution by Plan</CardTitle>
                <CardDescription>Revenue contribution by plan</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={revenueDistributionData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                    >
                      {revenueDistributionData.map((entry, index: any) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Metrics</CardTitle>
                <CardDescription>Key revenue indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium">Total Revenue</p>
                      <p className="text-2xl font-bold text-green-600">${analytics.totalRevenue.toLocaleString()}</p>
                    </div>
                    <ArrowUp className="h-6 w-6 text-green-600" />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium">Monthly Recurring Revenue</p>
                      <p className="text-2xl font-bold text-blue-600">${analytics.monthlyRecurringRevenue.toLocaleString()}</p>
                    </div>
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                    <div>
                      <p className="font-medium">Average Revenue Per User</p>
                      <p className="text-2xl font-bold text-purple-600">${analytics.averageRevenuePerUser.toFixed(0)}</p>
                    </div>
                    <Target className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cohorts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cohort Analysis</CardTitle>
              <CardDescription>User retention by signup cohort</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Cohort analysis feature coming soon. This will show user retention patterns by signup month.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
