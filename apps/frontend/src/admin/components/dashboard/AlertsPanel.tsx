'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Badge } from '../ui/badge'
import { 
  AlertTriangle, 
  X, 
  CheckCircle, 
  Clock,
  ExternalLink,
  Filter,
  AlertCircle,
  Info
} from 'lucide-react'

export interface SystemAlert {
  id: string
  type: 'cpu' | 'memory' | 'database' | 'cache' | 'api' | 'security' | 'storage'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  timestamp: number
  resolved: boolean
  resolvedAt?: number
  resolvedBy?: string
  source: string
  metadata?: Record<string, any>
  actionUrl?: string
}

export interface AlertsPanelProps {
  alerts: SystemAlert[]
  onResolveAlert?: (alertId: string) => Promise<void>
  onDismissAlert?: (alertId: string) => Promise<void>
  maxDisplayed?: number
}

export function AlertsPanel({ 
  alerts, 
  onResolveAlert, 
  onDismissAlert,
  maxDisplayed = 5 
}: AlertsPanelProps) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all')
  const [resolving, setResolving] = useState<Set<string>>(new Set())

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return AlertTriangle
      case 'high':
        return AlertCircle
      case 'medium':
        return Info
      case 'low':
        return Clock
      default:
        return Info
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          badge: 'destructive',
          bg: 'bg-red-50 border-red-200',
          icon: 'text-red-600'
        }
      case 'high':
        return {
          badge: 'destructive',
          bg: 'bg-orange-50 border-orange-200',
          icon: 'text-orange-600'
        }
      case 'medium':
        return {
          badge: 'warning',
          bg: 'bg-yellow-50 border-yellow-200',
          icon: 'text-yellow-600'
        }
      case 'low':
        return {
          badge: 'secondary',
          bg: 'bg-blue-50 border-blue-200',
          icon: 'text-blue-600'
        }
      default:
        return {
          badge: 'secondary',
          bg: 'bg-gray-50 border-gray-200',
          icon: 'text-gray-600'
        }
    }
  }

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(timestamp).toLocaleDateString()
  }

  const handleResolveAlert = async (alertId: string) => {
    if (!onResolveAlert) return
    
    setResolving(prev => new Set(prev).add(alertId))
    try {
      await onResolveAlert(alertId)
    } finally {
      setResolving(prev => {
        const newSet = new Set(prev)
        newSet.delete(alertId)
        return newSet
      })
    }
  }

  const handleDismissAlert = async (alertId: string) => {
    if (!onDismissAlert) return
    await onDismissAlert(alertId)
  }

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true
    return alert.severity === filter
  })

  const displayedAlerts = filteredAlerts.slice(0, maxDisplayed)
  const severityCounts = alerts.reduce((acc, alert) => {
    acc[alert.severity] = (acc[alert.severity] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
            System Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>All systems operational</p>
              <p className="text-sm">No active alerts</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
            System Alerts ({alerts.length})
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All ({alerts.length})</option>
              {severityCounts.critical && (
                <option value="critical">Critical ({severityCounts.critical})</option>
              )}
              {severityCounts.high && (
                <option value="high">High ({severityCounts.high})</option>
              )}
              {severityCounts.medium && (
                <option value="medium">Medium ({severityCounts.medium})</option>
              )}
              {severityCounts.low && (
                <option value="low">Low ({severityCounts.low})</option>
              )}
            </select>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {displayedAlerts.map((alert) => {
            const SeverityIcon = getSeverityIcon(alert.severity)
            const colors = getSeverityColor(alert.severity)
            const isResolving = resolving.has(alert.id)

            return (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${colors.bg} transition-all duration-200`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <SeverityIcon className={`h-5 w-5 mt-0.5 ${colors.icon}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge variant={colors.badge as any} className="text-xs">
                          {alert.severity.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {alert.source}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(alert.timestamp)}
                        </span>
                      </div>
                      <h4 className="font-medium text-sm text-gray-900 dark:text-white mb-1">
                        {alert.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {alert.message}
                      </p>
                      {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {Object.entries(alert.metadata).map(([key, value]) => (
                            <Badge key={key} variant="outline" className="text-xs">
                              {key}: {String(value)}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        {onResolveAlert && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveAlert(alert.id)}
                            disabled={isResolving}
                            className="text-xs"
                          >
                            {isResolving ? (
                              <>
                                <Clock className="h-3 w-3 mr-1 animate-spin" />
                                Resolving...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Resolve
                              </>
                            )}
                          </Button>
                        )}
                        {alert.actionUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(alert.actionUrl, '_blank')}
                            className="text-xs"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View Details
                          </Button>
                        )}
                        {onDismissAlert && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDismissAlert(alert.id)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        {filteredAlerts.length > maxDisplayed && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 text-center">
              Showing {maxDisplayed} of {filteredAlerts.length} alerts
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => {/* Navigate to full alerts page */}}
            >
              View All Alerts
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AlertsPanel