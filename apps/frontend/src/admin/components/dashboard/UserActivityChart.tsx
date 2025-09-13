'use client'
import React, { useMemo } from 'react'
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
  ComposedChart
} from 'recharts'

export interface UserActivityDataPoint {
  date: string
  activeUsers: number
  newUsers: number
  sessions: number
  pageViews: number
  avgSessionDuration: number
}

export interface UserActivityChartProps {
  data: UserActivityDataPoint[]
  timeRange: string
  type?: 'line' | 'bar' | 'composed'
  height?: number
  title?: string
  description?: string
  className?: string
}

export function UserActivityChart({ 
  data, 
  timeRange, 
  type = 'composed',
  height = 300,
  title = 'User Activity Chart',
  description,
  className = ''
}: UserActivityChartProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    switch (timeRange) {
      case '1h':
        return date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      case '24h':
        return date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      case '7d':
        return date.toLocaleDateString('en-US', { 
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
      case '30d':
        return date.toLocaleDateString('en-US', { 
          month: 'short',
          day: 'numeric'
        })
      default:
        return date.toLocaleDateString('en-US')
    }
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  // Generate accessible data summary for screen readers
  const dataSummary = useMemo(() => {
    if (!data || data.length === 0) return ''
    
    const totalActiveUsers = data.reduce((sum, point: any) => sum + point.activeUsers, 0)
    const totalNewUsers = data.reduce((sum, point: any) => sum + point.newUsers, 0)
    const avgActiveUsers = Math.round(totalActiveUsers / data.length)
    const avgNewUsers = Math.round(totalNewUsers / data.length)
    
    return `Chart showing user activity over ${timeRange}. Average active users: ${avgActiveUsers}, average new users: ${avgNewUsers}. Data points: ${data.length}.`
  }, [data, timeRange])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div 
          className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
          role="tooltip"
          aria-live="polite"
        >
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            {formatDate(label)}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden="true"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {entry.dataKey === 'activeUsers' && 'Active Users: '}
                {entry.dataKey === 'newUsers' && 'New Users: '}
                {entry.dataKey === 'sessions' && 'Sessions: '}
                {entry.dataKey === 'pageViews' && 'Page Views: '}
                {entry.dataKey === 'avgSessionDuration' && 'Avg Duration: '}
                {entry.dataKey === 'avgSessionDuration' 
                  ? formatDuration(entry.value)
                  : new Intl.NumberFormat('en-US').format(entry.value)
                }
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  if (!data || data.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center h-64 text-gray-500 dark:text-gray-400 ${className}`}
        role="img"
        aria-label="Empty chart: No user activity data available"
      >
        <div className="text-center">
          <div className="text-lg font-medium mb-2">No activity data available</div>
          <div className="text-sm">User activity data will appear here once available</div>
        </div>
      </div>
    )
  }

  const chartId = `user-activity-chart-${Math.random().toString(36).substr(2, 9)}`

  if (type === 'line') {
    return (
      <div className={className}>
        {title && (
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
            {title}
          </h3>
        )}
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {description}
          </p>
        )}
        <div
          role="img"
          aria-labelledby={`${chartId}-title`}
          aria-describedby={`${chartId}-desc`}
          tabIndex={0}
          className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
        >
          <div id={`${chartId}-title`} className="sr-only">
            Line chart showing user activity over time
          </div>
          <div id={`${chartId}-desc`} className="sr-only">
            {dataSummary}
          </div>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                className="text-xs"
                aria-label="Time period"
              />
              <YAxis 
                yAxisId="users"
                orientation="left"
                className="text-xs"
                aria-label="Number of users"
              />
              <YAxis 
                yAxisId="sessions"
                orientation="right"
                className="text-xs"
                aria-label="Number of sessions"
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                yAxisId="users"
                type="monotone"
                dataKey="activeUsers"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                name="Active Users"
              />
              <Line
                yAxisId="users"
                type="monotone"
                dataKey="newUsers"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
                name="New Users"
              />
              <Line
                yAxisId="sessions"
                type="monotone"
                dataKey="sessions"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 3 }}
                name="Sessions"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  if (type === 'bar') {
    return (
      <div className={className}>
        {title && (
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
            {title}
          </h3>
        )}
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {description}
          </p>
        )}
        <div
          role="img"
          aria-labelledby={`${chartId}-title`}
          aria-describedby={`${chartId}-desc`}
          tabIndex={0}
          className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
        >
          <div id={`${chartId}-title`} className="sr-only">
            Bar chart showing user activity over time
          </div>
          <div id={`${chartId}-desc`} className="sr-only">
            {dataSummary}
          </div>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                className="text-xs"
                aria-label="Time period"
              />
              <YAxis 
                className="text-xs"
                aria-label="Count"
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="activeUsers" fill="#3b82f6" name="Active Users" />
              <Bar dataKey="newUsers" fill="#10b981" name="New Users" />
              <Bar dataKey="sessions" fill="#f59e0b" name="Sessions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  // Composed chart (default)
  return (
    <div className={className}>
      {title && (
        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {description}
        </p>
      )}
      <div
        role="img"
        aria-labelledby={`${chartId}-title`}
        aria-describedby={`${chartId}-desc`}
        tabIndex={0}
        className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
      >
        <div id={`${chartId}-title`} className="sr-only">
          Combined chart showing user activity metrics over time
        </div>
        <div id={`${chartId}-desc`} className="sr-only">
          {dataSummary}
        </div>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              className="text-xs"
              aria-label="Time period"
            />
            <YAxis 
              yAxisId="users"
              orientation="left"
              className="text-xs"
              aria-label="Number of users and sessions"
            />
            <YAxis 
              yAxisId="duration"
              orientation="right"
              tickFormatter={formatDuration}
              className="text-xs"
              aria-label="Average session duration"
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Bars for user counts */}
            <Bar 
              yAxisId="users"
              dataKey="activeUsers" 
              fill="#3b82f6" 
              fillOpacity={0.8}
              name="Active Users"
            />
            <Bar 
              yAxisId="users"
              dataKey="newUsers" 
              fill="#10b981" 
              fillOpacity={0.8}
              name="New Users"
            />
            
            {/* Lines for sessions and duration */}
            <Line
              yAxisId="users"
              type="monotone"
              dataKey="sessions"
              stroke="#f59e0b"
              strokeWidth={3}
              dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
              name="Sessions"
            />
            <Line
              yAxisId="duration"
              type="monotone"
              dataKey="avgSessionDuration"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ fill: '#ef4444', strokeWidth: 2, r: 3 }}
              strokeDasharray="5 5"
              name="Avg Duration"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default UserActivityChart
