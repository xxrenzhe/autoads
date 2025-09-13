'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/shared/components/ui/ProgressBar'
import { 
  Zap, 
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Filter,
  BarChart3,
  PieChart,
  AlertTriangle,
  Target,
  Clock,
  Activity
} from 'lucide-react'
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line
} from 'recharts'
import { useTokenUsage } from '../../hooks/useTokenUsage'

export interface TokenUsageTrackerProps {
  userId: string
  showForecast?: boolean
  showBudgetAlerts?: boolean
}

export function TokenUsageTracker({ 
  userId, 
  showForecast = true, 
  showBudgetAlerts = true 
}: TokenUsageTrackerProps) {
  const {
    currentUsage,
    usageHistory,
    featureBreakdown,
    batchOperations,
    forecast,
    budgetAlerts,
    isLoading,
    error,
    exportUsageData,
    setBudgetAlert
  } = useTokenUsage(userId)

  const [selectedTimeRange, setSelectedTimeRange] = useState('30d')
  const [selectedView, setSelectedView] = useState<'overview' | 'features' | 'batches' | 'forecast'>('overview')

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getUsagePercentage = () => {
    if (!currentUsage) return 0
    return (currentUsage.used / currentUsage.limit) * 100
  }

  const getUsageTrend = () => {
    if (!usageHistory || usageHistory.length < 2) return 'stable'
    const recent = usageHistory.slice(-7)
    const older = usageHistory.slice(-14, -7)
    
    if (older.length === 0) return 'stable'
    
    const recentAvg = recent.reduce((sum, day: any) => sum + day.tokens, 0) / recent.length
    const olderAvg = older.reduce((sum, day: any) => sum + day.tokens, 0) / older.length
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100
    
    if (change > 10) return 'increasing'
    if (change < -10) return 'decreasing'
    return 'stable'
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {entry.name}: {formatNumber(entry.value)}
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-gray-600">Loading usage data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-6">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
        <p>Error loading usage data: {error}</p>
      </div>
    )
  }

  const usagePercentage = getUsagePercentage()
  const usageTrend = getUsageTrend()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Token Usage Tracking
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and analyze your token consumption patterns
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => exportUsageData('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Budget Alerts */}
      {showBudgetAlerts && budgetAlerts && budgetAlerts.length > 0 && (
        <div className="space-y-2">
          {budgetAlerts.map((alert, index: number) => (
            <div key={index} className={`p-4 rounded-lg border ${
              alert.severity === 'critical' ? 'bg-red-50 border-red-200' :
              alert.severity === 'warning' ? 'bg-yellow-50 border-yellow-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center">
                <AlertTriangle className={`h-4 w-4 mr-2 ${
                  alert.severity === 'critical' ? 'text-red-600' :
                  alert.severity === 'warning' ? 'text-yellow-600' :
                  'text-blue-600'
                }`} />
                <span className={`text-sm font-medium ${
                  alert.severity === 'critical' ? 'text-red-800' :
                  alert.severity === 'warning' ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>
                  {alert.message}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current Usage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Zap className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-gray-600">Current Usage</span>
              </div>
              <Badge variant={usagePercentage > 80 ? 'destructive' : 'secondary'}>
                {usagePercentage.toFixed(1)}%
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used: {formatNumber(currentUsage?.used || 0)}</span>
                <span>Limit: {formatNumber(currentUsage?.limit || 0)}</span>
              </div>
              <Progress value={usagePercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Activity className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-sm font-medium text-gray-600">Daily Average</span>
              </div>
              <div className="flex items-center">
                {usageTrend === 'increasing' ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : usageTrend === 'decreasing' ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : (
                  <Activity className="h-4 w-4 text-gray-500" />
                )}
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(currentUsage?.dailyAverage || 0)}
              </p>
              <p className="text-sm text-gray-500">tokens per day</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-purple-600 mr-2" />
                <span className="text-sm font-medium text-gray-600">Reset Date</span>
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {currentUsage?.resetDate ? 
                  new Date(currentUsage.resetDate).toLocaleDateString() : 
                  'N/A'
                }
              </p>
              <p className="text-sm text-gray-500">
                {currentUsage?.daysUntilReset || 0} days remaining
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Target className="h-5 w-5 text-orange-600 mr-2" />
                <span className="text-sm font-medium text-gray-600">Projected Usage</span>
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatNumber(forecast?.projectedUsage || 0)}
              </p>
              <p className="text-sm text-gray-500">
                by reset date
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Selector */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => setSelectedView('overview')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            selectedView === 'overview'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setSelectedView('features')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            selectedView === 'features'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          By Features
        </button>
        <button
          onClick={() => setSelectedView('batches')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            selectedView === 'batches'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Batch Operations
        </button>
        {showForecast && (
          <button
            onClick={() => setSelectedView('forecast')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedView === 'forecast'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Forecast
          </button>
        )}
      </div>

      {/* Content based on selected view */}
      {selectedView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Usage History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={usageHistory}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      className="text-xs"
                    />
                    <YAxis 
                      tickFormatter={formatNumber}
                      className="text-xs"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="tokens"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PieChart className="h-5 w-5 mr-2" />
                Usage by Feature
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={featureBreakdown}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="tokens"
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    >
                      {featureBreakdown?.map((entry, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedView === 'features' && (
        <Card>
          <CardHeader>
            <CardTitle>Feature-Specific Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {featureBreakdown?.map((feature, index: number) => (
                <div key={feature.name} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {feature.name}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatNumber(feature.tokens)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {((feature.tokens / (currentUsage?.used || 1)) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedView === 'batches' && (
        <Card>
          <CardHeader>
            <CardTitle>Batch Operations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {batchOperations?.map((batch: any) => (
                <div key={batch.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {batch.name}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {new Date(batch.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatNumber(batch.tokensUsed)}
                    </p>
                    <Badge variant={batch.status === 'completed' ? 'success' : 'secondary'}>
                      {batch.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedView === 'forecast' && showForecast && forecast && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage Forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecast.data}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      className="text-xs"
                    />
                    <YAxis 
                      tickFormatter={formatNumber}
                      className="text-xs"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      name="Actual"
                    />
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      stroke="#10B981"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Predicted"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Forecast Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Projected Usage</span>
                  <span className="font-semibold">{formatNumber(forecast.projectedUsage)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Confidence</span>
                  <Badge variant="outline">{forecast.confidence}%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Will Exceed Limit</span>
                  <Badge variant={forecast.willExceedLimit ? 'destructive' : 'success'}>
                    {forecast.willExceedLimit ? 'Yes' : 'No'}
                  </Badge>
                </div>
                {forecast.recommendations && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                      Recommendations
                    </h4>
                    <ul className="space-y-1">
                      {forecast.recommendations.map((rec, index: number) => (
                        <li key={index} className="text-sm text-gray-600">
                          • {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default TokenUsageTracker
