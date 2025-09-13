import React from 'react'

export interface RevenueChartProps {
  data: RevenueDataPoint[]
  height?: number
}

export interface RevenueDataPoint {
  date: string
  revenue: number
  subscriptions?: number
}

export const RevenueChart: React.FC<RevenueChartProps> = ({
  data,
  height = 300
}) => {
  // Simple placeholder chart - in real implementation would use a charting library
  const maxRevenue = Math.max(...data?.filter(Boolean)?.map((d: any) => d.revenue))
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Revenue Overview
      </h3>
      <div className="space-y-2" style={{ height }}>
        {data.map((point, index: any) => (
          <div key={index} className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-400 w-20">
              {point.date}
            </span>
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${(point.revenue / maxRevenue) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white w-20 text-right">
              ${point.revenue.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default RevenueChart