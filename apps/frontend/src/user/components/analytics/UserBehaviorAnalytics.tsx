'use client'
import React, { useState, useId, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart3, 
  TrendingUp,
  Clock,
  MousePointer,
  Eye,
  Users,
  Target,
  Calendar,
  Filter,
  Download,
  Zap,
  Globe,
  Smartphone
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts'
import { useBehaviorAnalytics } from '../../hooks/useBehaviorAnalytics'

export interface UserBehaviorAnalyticsProps {
  userId: string
  timeRange?: string
  showComparison?: boolean
}

export function UserBehaviorAnalytics({ 
  userId, 
  timeRange = '30d',
  showComparison = true 
}: UserBehaviorAnalyticsProps) {
  const {
    behaviorData,
    activityPatterns,
    featureAdoption,
    userJourney,
    segmentData,
    retentionData,
    isLoading,
    error,
    exportAnalytics
  } = useBehaviorAnalytics(userId, timeRange)

  const [selectedView, setSelectedView] = useState<'overview' | 'patterns' | 'features' | 'journey' | 'retention'>('overview')
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange)
  
  // Generate unique IDs for accessibility
  const headingId = useId()
  const timeRangeLabelId = useId()
  const viewAnnouncementId = useId()

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  }

  // Generate accessible data summaries for screen readers
  const generateDataSummary = useCallback((data: any[], type: string) => {
    if (!data || data.length === 0) return `No ${type} data available`
    
    const total = data.reduce((sum, item: any) => sum + (item.value || item.sessions || item.activity || 0), 0)
    const average = Math.round(total / data.length)
    
    return `${type} chart with ${data.length} data points. Total: ${formatNumber(total)}, Average: ${formatNumber(average)}`
  }, [])

  const handleViewChange = useCallback((newView: string) => {
    setSelectedView(newView as any)
    // Announce view change to screen readers
    const announcement = `Switched to ${newView} view`
    const announcer = document.getElementById(viewAnnouncementId)
    if (announcer) {
      announcer.textContent = announcement
    }
  }, [viewAnnouncementId])

  const handleKeyDown = useCallback((event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      action()
    }
  }, [])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div 
          className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
          role="tooltip"
          aria-live="polite"
        >
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {label}
          </p>
          {payload.map((entry: any, index: number: any) => (
            <div key={index} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden="true"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {entry.name}: {entry.value}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  if (isLoading) {
    return (
      <div 
        className="flex items-center justify-center h-64"
        role="status"
        aria-label="Loading behavior analytics"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" aria-hidden="true"></div>
        <p className="ml-3 text-gray-600">Loading behavior analytics...</p>
        <span className="sr-only">Loading behavior analytics data, please wait...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div 
        className="text-center text-red-600 p-6"
        role="alert"
        aria-live="assertive"
      >
        <p>Error loading behavior analytics: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 id={headingId} className="text-2xl font-bold text-gray-900 dark:text-white">
            Behavior Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Understand your usage patterns and optimize your experience
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <label 
            id={timeRangeLabelId}
            htmlFor="time-range-select"
            className="sr-only"
          >
            Select time range for analytics
          </label>
          <select
            id="time-range-select"
            value={selectedTimeRange}
            onChange={((e: any): any) => setSelectedTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-labelledby={timeRangeLabelId}
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={((: any): any) => exportAnalytics('csv')}
            aria-label="Export analytics data as CSV"
          >
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            Export
          </Button>
        </div>
      </div>

      {/* Live region for announcements */}
      <div 
        id={viewAnnouncementId}
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      ></div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Eye className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-gray-600">Total Sessions</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(behaviorData?.totalSessions || 0)}
              </p>
              <div className="flex items-center mt-1">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-sm text-green-600">
                  +{behaviorData?.sessionGrowth || 0}% vs last period
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-sm font-medium text-gray-600">Avg Session Duration</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatDuration(behaviorData?.avgSessionDuration || 0)}
              </p>
              <div className="flex items-center mt-1">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-sm text-green-600">
                  +{behaviorData?.durationGrowth || 0}% vs last period
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <MousePointer className="h-5 w-5 text-purple-600 mr-2" />
                <span className="text-sm font-medium text-gray-600">Features Used</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {behaviorData?.featuresUsed || 0}
              </p>
              <p className="text-sm text-gray-500">
                of {behaviorData?.totalFeatures || 0} available
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Target className="h-5 w-5 text-orange-600 mr-2" />
                <span className="text-sm font-medium text-gray-600">Engagement Score</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {behaviorData?.engagementScore || 0}
              </p>
              <Badge variant={
                (behaviorData?.engagementScore || 0) > 80 ? 'success' :
                (behaviorData?.engagementScore || 0) > 60 ? 'warning' : 'secondary'
              }>
                {(behaviorData?.engagementScore || 0) > 80 ? 'High' :
                 (behaviorData?.engagementScore || 0) > 60 ? 'Medium' : 'Low'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Selector */}
      <div 
        role="tablist" 
        aria-label="Analytics view selector"
        className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg"
      >
        {[
          { key: 'overview', label: 'Overview', icon: BarChart3 },
          { key: 'patterns', label: 'Activity Patterns', icon: Clock },
          { key: 'features', label: 'Feature Adoption', icon: Zap },
          { key: 'journey', label: 'User Journey', icon: Target },
          { key: 'retention', label: 'Retention', icon: Users }
        ].map(({ key, label, icon: Icon }: { key: string; label: string; icon: any }) => (
          <button
            key={key}
            role="tab"
            aria-selected={selectedView === key}
            aria-controls={`${key}-panel`}
            tabIndex={selectedView === key ? 0 : -1}
            onClick={() => handleViewChange(key)}
            onKeyDown={(e) => handleKeyDown(e, () => handleViewChange(key))}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              selectedView === key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4 mr-2" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {/* Content based on selected view */}
      {selectedView === 'overview' && (
        <div 
          role="tabpanel" 
          id="overview-panel"
          aria-labelledby="overview-tab"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>
                <h2 className="text-lg font-semibold">Session Activity</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="h-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                role="img"
                aria-label={`Session activity chart. ${generateDataSummary(behaviorData?.sessionHistory || [], 'session activity')}`}
                tabIndex={0}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={behaviorData?.sessionHistory || []}>
                    <defs>
                      <linearGradient id="sessionGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      className="text-xs"
                      aria-label="Date"
                    />
                    <YAxis 
                      className="text-xs"
                      aria-label="Number of sessions"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="sessions"
                      stroke="#3B82F6"
                      fillOpacity={1}
                      fill="url(#sessionGradient)"
                      strokeWidth={2}
                      name="Sessions"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Device & Platform Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={behaviorData?.deviceBreakdown || []}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="sessions"
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    >
                      {(behaviorData?.deviceBreakdown || []).map((entry, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedView === 'patterns' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Activity Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityPatterns?.hourlyActivity || []}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="hour" 
                      tickFormatter={(value) => `${value}:00`}
                      className="text-xs"
                    />
                    <YAxis className="text-xs" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="activity" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Patterns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activityPatterns?.weeklyActivity?.map((day, index: number) => (
                    <div key={day.day} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {day.day}
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${(day.activity / Math.max(...(activityPatterns?.weeklyActivity?.filter(Boolean)?.map((d: any) => d.activity) || [1]))) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-12 text-right">
                          {day.activity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Peak Usage Times</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activityPatterns?.peakTimes?.map((peak, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {peak.timeRange}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {peak.description}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {peak.intensity}% activity
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {selectedView === 'features' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Feature Adoption Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={featureAdoption?.adoptionTimeline || []}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      className="text-xs"
                    />
                    <YAxis className="text-xs" />
                    <Tooltip content={<CustomTooltip />} />
                    {featureAdoption?.features?.map((feature, index: number) => (
                      <Line
                        key={feature.name}
                        type="monotone"
                        dataKey={feature.name}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Feature Usage Ranking</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {featureAdoption?.features?.map((feature, index: number) => (
                    <div key={feature.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-lg font-bold text-gray-400">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {feature.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {feature.usage} uses
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        feature.adoptionRate > 80 ? 'success' :
                        feature.adoptionRate > 50 ? 'warning' : 'secondary'
                      }>
                        {feature.adoptionRate}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feature Discovery</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {featureAdoption?.discoveryMethods?.map((method, index: any) => (
                    <div key={method.method} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {method.method}
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${method.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-12 text-right">
                          {method.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {selectedView === 'journey' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Journey Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userJourney?.journeySteps?.map((step, index: any) => (
                  <div key={step.step} className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                        step.completionRate > 80 ? 'bg-green-500' :
                        step.completionRate > 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}>
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {step.step}
                        </h4>
                        <Badge variant="outline">
                          {step.completionRate}% completion
                        </Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            step.completionRate > 80 ? 'bg-green-500' :
                            step.completionRate > 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${step.completionRate}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Avg time: {formatDuration(step.avgTimeSpent)}
                      </p>
                    </div>
                    {index < (userJourney?.journeySteps?.length || 0) - 1 && (
                      <div className="flex-shrink-0">
                        <div className="w-6 h-0.5 bg-gray-300" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Drop-off Points</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {userJourney?.dropOffPoints?.map((point, index: any) => (
                    <div key={point.step} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div>
                        <p className="font-medium text-red-800 dark:text-red-200">
                          {point.step}
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400">
                          {point.dropOffRate}% drop-off rate
                        </p>
                      </div>
                      <Badge variant="destructive">
                        High Risk
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Success Paths</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {userJourney?.successPaths?.map((path, index: any) => (
                    <div key={path.path} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-200">
                          {path.path}
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          {path.successRate}% success rate
                        </p>
                      </div>
                      <Badge variant="success">
                        Optimal
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {selectedView === 'retention' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Retention Cohort Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={retentionData?.cohortData || []}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="period" 
                      className="text-xs"
                    />
                    <YAxis 
                      tickFormatter={(value) => `${value}%`}
                      className="text-xs"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="retention"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {retentionData?.dayOneRetention || 0}%
                  </p>
                  <p className="text-sm text-gray-600">Day 1 Retention</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {retentionData?.daySevenRetention || 0}%
                  </p>
                  <p className="text-sm text-gray-600">Day 7 Retention</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {retentionData?.dayThirtyRetention || 0}%
                  </p>
                  <p className="text-sm text-gray-600">Day 30 Retention</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserBehaviorAnalytics
