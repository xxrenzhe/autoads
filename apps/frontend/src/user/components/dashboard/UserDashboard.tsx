'use client'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/shared/components/ui/ProgressBar'
import { 
  User, 
  CreditCard, 
  Activity,
  TrendingUp,
  Calendar,
  Settings,
  Bell,
  Download,
  BarChart3,
  Zap,
  Clock,
  Target,
  Award,
  Bookmark
} from 'lucide-react'
import { useUserDashboard } from '../../hooks/useUserDashboard'
import { UsageChart } from './UsageChart'
import { SubscriptionCard } from './SubscriptionCard'
import { QuickActions } from './QuickActions'
import { RecentActivity, ActivityItem } from './RecentActivity'

export interface UserDashboardProps {
  userId: string
  layout?: 'default' | 'compact' | 'detailed'
}

export function UserDashboard({ userId, layout = 'default' }: .*Props) {
  const {
    userStats,
    subscriptionInfo,
    usageData,
    notifications,
    recentActivities,
    isLoading,
    error,
    refreshDashboard
  } = useUserDashboard(userId)

  const [selectedTimeRange, setSelectedTimeRange] = useState('7d')

  useEffect(() => {
    // Auto-refresh dashboard every 5 minutes
    const interval = setInterval(() => {
      refreshDashboard()
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refreshDashboard])

  if (isLoading) => {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-gray-600">Loading dashboard...</p>
      </div>
    )
  }

  if (error) => {
    return (
      <div className="text-center text-red-600 p-6">
        <p>Error loading dashboard: {error}</p>
        <Button onClick={refreshDashboard} className="mt-2">
          Retry
        </Button>
      </div>
    )
  }

  const unreadNotifications = notifications?.filter((n: any) => !n.read).length || 0
  const tokenUsagePercentage = userStats?.tokenUsage ? 
    (userStats.tokenUsage.used / userStats.tokenUsage.limit) * 100 : 0

  // Transform UserActivity to ActivityItem
  const transformedActivities: ActivityItem[] = recentActivities?.filter(Boolean)?.map((activity: any) => ({
    id: activity.id,
    type: activity.type === 'login' ? 'user' : 
          activity.type === 'api_call' ? 'task' : 
          activity.type === 'subscription_change' ? 'system' :
          activity.type === 'profile_update' ? 'user' : 'system',
    title: activity.description,
    description: activity.metadata?.details || activity.description,
    timestamp: activity.timestamp,
    status: activity.type === 'login' ? 'completed' : 
            activity.type === 'api_call' ? 'completed' : 'pending'
  })) || []

  return (
    <div className="space-y-6 p-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {userStats?.name || 'User'}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Here's what's happening with your account today.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          {unreadNotifications > 0 && (
            <Button variant="outline" size="sm" className="relative">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
              <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                {unreadNotifications}
              </Badge>
            </Button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Token Usage */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Zap className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-gray-600">Token Usage</span>
              </div>
              <Badge variant={tokenUsagePercentage > 80 ? 'destructive' : 'secondary'}>
                {tokenUsagePercentage.toFixed(1)}%
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used: {userStats?.tokenUsage?.used || 0}</span>
                <span>Limit: {userStats?.tokenUsage?.limit || 0}</span>
              </div>
              <Progress value={tokenUsagePercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Subscription Status */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <CreditCard className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-sm font-medium text-gray-600">Subscription</span>
              </div>
              <Badge variant={subscriptionInfo?.status === 'active' ? 'success' : 'secondary'}>
                {subscriptionInfo?.status || 'Free'}
              </Badge>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {subscriptionInfo?.plan || 'Free Plan'}
              </p>
              {subscriptionInfo?.expiresAt && (
                <p className="text-sm text-gray-500">
                  Expires: {new Date(subscriptionInfo.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activity Score */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Activity className="h-5 w-5 text-purple-600 mr-2" />
                <span className="text-sm font-medium text-gray-600">Activity Score</span>
              </div>
              <Badge variant="outline">
                {userStats?.activityScore || 0}
              </Badge>
            </div>
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">
                +{userStats?.activityGrowth || 0}% this week
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Account Age */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-orange-600 mr-2" />
                <span className="text-sm font-medium text-gray-600">Member Since</span>
              </div>
              <Badge variant="outline">
                {userStats?.memberSince ? 
                  new Date(userStats.memberSince).getFullYear() : 
                  new Date().getFullYear()
                }
              </Badge>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {userStats?.daysSinceMember || 0} days
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Charts and Usage */}
        <div className="lg:col-span-2 space-y-6">
          {/* Usage Analytics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Usage Analytics
                </div>
                <select
                  value={selectedTimeRange}
                  onChange={(e) => setSelectedTimeRange(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                </select>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UsageChart 
                data={usageData || []}
                timeRange={selectedTimeRange}
              />
            </CardContent>
          </Card>

          {/* Subscription Details */}
          <SubscriptionCard 
            subscription={subscriptionInfo}
            usage={userStats?.tokenUsage}
          />

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RecentActivity activities={transformedActivities} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <QuickActions />

          {/* Notifications - removed for performance optimization */}

          {/* Goals & Achievements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Goals & Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userStats?.achievements?.map((achievement, index: any) => (
                  <div key={index} className="flex items-center space-x-3">
                    <Award className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {achievement.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {achievement.description}
                      </p>
                    </div>
                  </div>
                )) || (
                  <p className="text-sm text-gray-500">No achievements yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bookmarks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bookmark className="h-5 w-5 mr-2" />
                Bookmarks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {userStats?.bookmarks?.map((bookmark, index: any) => (
                  <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {bookmark.title}
                    </span>
                    <Button variant="ghost" size="sm">
                      <Bookmark className="h-3 w-3" />
                    </Button>
                  </div>
                )) || (
                  <p className="text-sm text-gray-500">No bookmarks yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Section - Detailed Stats (if detailed layout) */}
      {layout === 'detailed' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userStats?.usageBreakdown?.map((item, index: any) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{item.feature}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-mono">{item.usage}</span>
                      <div className="w-20">
                        <Progress value={(item.usage / item.limit) * 100} className="h-1" />
                      </div>
                    </div>
                  </div>
                )) || (
                  <p className="text-sm text-gray-500">No usage data available</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {userStats?.performanceMetrics?.averageResponseTime || 0}ms
                  </p>
                  <p className="text-sm text-gray-600">Avg Response Time</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {userStats?.performanceMetrics?.successRate || 0}%
                  </p>
                  <p className="text-sm text-gray-600">Success Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {userStats?.performanceMetrics?.totalRequests || 0}
                  </p>
                  <p className="text-sm text-gray-600">Total Requests</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {userStats?.performanceMetrics?.errorRate || 0}%
                  </p>
                  <p className="text-sm text-gray-600">Error Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default UserDashboard