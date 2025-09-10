import React from 'react'

export interface SystemHealthPanelProps {
  metrics: SystemMetrics
  alerts: SystemAlert[]
  onAlertClick?: (alertId: string) => void
}

export interface SystemMetrics {
  cpu: number
  memory: number
  disk: number
  uptime: string
  activeUsers: number
  responseTime: number
}

export interface SystemAlert {
  id: string
  type: 'error' | 'warning' | 'info'
  title: string
  message: string
  timestamp: string
  resolved?: boolean
}

export const SystemHealthPanel: React.FC<SystemHealthPanelProps> = ({
  metrics,
  alerts,
  onAlertClick
}) => {
  const getStatusColor = (value: number) => {
    if (value > 80) return 'text-red-600'
    if (value > 60) return 'text-yellow-600'
    return 'text-green-600'
  }

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">CPU Usage</p>
          <p className={`text-xl font-semibold ${getStatusColor(metrics.cpu)}`}>
            {metrics.cpu}%
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Memory</p>
          <p className={`text-xl font-semibold ${getStatusColor(metrics.memory)}`}>
            {metrics.memory}%
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Disk Usage</p>
          <p className={`text-xl font-semibold ${getStatusColor(metrics.disk)}`}>
            {metrics.disk}%
          </p>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            System Alerts
          </h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              onClick={() => onAlertClick?.(alert.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={`p-1 rounded-full ${
                    alert.type === 'error' ? 'bg-red-100' :
                    alert.type === 'warning' ? 'bg-yellow-100' :
                    'bg-blue-100'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      alert.type === 'error' ? 'bg-red-500' :
                      alert.type === 'warning' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {alert.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {alert.message}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {alert.timestamp}
                  </p>
                  {alert.resolved && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mt-1">
                      Resolved
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SystemHealthPanel