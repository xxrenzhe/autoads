'use client'
import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts'

export interface UsageDataPoint {
  date: string
  tokens: number
  requests: number
  features: Record<string, number>
}

export interface UsageChartProps {
  data: UsageDataPoint[]
  timeRange: string
  type?: 'line' | 'area' | 'bar'
  height?: number
}

export function UsageChart({ 
  data, 
  timeRange, 
  type = 'area',
  height = 300 
}: UsageChartProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    switch (timeRange) {
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
      case '90d':
        return date.toLocaleDateString('en-US', { 
          month: 'short',
          day: 'numeric'
        })
      default:
        return date.toLocaleDateString('en-US')
    }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            {formatDate(label)}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {entry.dataKey === 'tokens' && 'Tokens: '}
                {entry.dataKey === 'requests' && 'Requests: '}
                {new Intl.NumberFormat('en-US').format(entry.value)}
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
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="text-lg font-medium mb-2">No usage data available</div>
          <div className="text-sm">Usage data will appear here once you start using the service</div>
        </div>
      </div>
    )
  }

  if (type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="tokensGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatDate}
            className="text-xs"
          />
          <YAxis 
            yAxisId="tokens"
            orientation="left"
            className="text-xs"
          />
          <YAxis 
            yAxisId="requests"
            orientation="right"
            className="text-xs"
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            yAxisId="tokens"
            type="monotone"
            dataKey="tokens"
            stroke="#3B82F6"
            fillOpacity={1}
            fill="url(#tokensGradient)"
            strokeWidth={2}
          />
          <Area
            yAxisId="requests"
            type="monotone"
            dataKey="requests"
            stroke="#10B981"
            fillOpacity={1}
            fill="url(#requestsGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatDate}
            className="text-xs"
          />
          <YAxis 
            yAxisId="tokens"
            orientation="left"
            className="text-xs"
          />
          <YAxis 
            yAxisId="requests"
            orientation="right"
            className="text-xs"
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            yAxisId="tokens"
            dataKey="tokens" 
            fill="#3B82F6" 
            fillOpacity={0.8}
          />
          <Bar 
            yAxisId="requests"
            dataKey="requests" 
            fill="#10B981" 
            fillOpacity={0.8}
          />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // Line chart (default)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis 
          dataKey="date" 
          tickFormatter={formatDate}
          className="text-xs"
        />
        <YAxis 
          yAxisId="tokens"
          orientation="left"
          className="text-xs"
        />
        <YAxis 
          yAxisId="requests"
          orientation="right"
          className="text-xs"
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          yAxisId="tokens"
          type="monotone"
          dataKey="tokens"
          stroke="#3B82F6"
          strokeWidth={3}
          dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
        />
        <Line
          yAxisId="requests"
          type="monotone"
          dataKey="requests"
          stroke="#10B981"
          strokeWidth={2}
          dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default UsageChart
