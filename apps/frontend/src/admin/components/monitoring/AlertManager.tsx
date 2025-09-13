'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Badge } from '../ui/badge'
import { 
  AlertTriangle, 
  Bell, 
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Filter,
  Search,
  Settings,
  Clock,
  TrendingUp,
  Zap,
  Shield,
  Database,
  Cpu,
  MemoryStick,
  HardDrive
} from 'lucide-react'
import { useSystemMonitoring } from '../../hooks/useSystemMonitoring'

export interface SystemAlert {
  id: string
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'database' | 'api' | 'custom'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  threshold: number
  currentValue: number
  timestamp: number
  resolved: boolean
  resolvedAt?: number
  resolvedBy?: string
  acknowledgedBy?: string
  acknowledgedAt?: number
}

export interface AlertRule {
  id: string
  name: string
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'database' | 'api' | 'custom'
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals'
  threshold: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  cooldown: number // minutes
  notifications: string[] // email, slack, webhook
}

export interface AlertManagerProps {
  showRules?: boolean
  maxAlerts?: number
}

export function AlertManager({ showRules = true, maxAlerts = 50 }: AlertManagerProps) {
  const {
    alerts,
    isAlertsLoading,
    alertsError,
    createAlert,
    resolveAlert,
    isCreatingAlert,
    isResolvingAlert
  } = useSystemMonitoring()

  const [searchTerm, setSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [selectedAlert, setSelectedAlert] = useState<SystemAlert | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Filter alerts
  const filteredAlerts = alerts.filter((alert: any) => {
    const matchesSearch = searchTerm === '' || 
      alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.message.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter
    const matchesType = typeFilter === 'all' || alert.type === typeFilter
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && !alert.resolved) ||
      (statusFilter === 'resolved' && alert.resolved)
    
    return matchesSearch && matchesSeverity && matchesType && matchesStatus
  }).slice(0, maxAlerts)

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'cpu': return Cpu
      case 'memory': return MemoryStick
      case 'disk': return HardDrive
      case 'database': return Database
      case 'api': return Zap
      case 'network': return TrendingUp
      default: return AlertTriangle
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'warning'
      case 'low': return 'secondary'
      default: return 'secondary'
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
    try {
      await resolveAlert(alertId)
    } catch (error) {
      console.error('Error resolving alert:', error)
    }
  }

  const handleAcknowledgeAlert = async (alertId: string) => {
    // Implementation for acknowledging alerts
    console.log('Acknowledging alert:', alertId)
  }

  const criticalAlerts = alerts.filter((a: any) => a.severity === 'critical' && !a.resolved)
  const highAlerts = alerts.filter((a: any) => a.severity === 'high' && !a.resolved)
  const activeAlerts = alerts.filter((a: any) => !a.resolved)

  if (alertsError) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Error loading alerts: {alertsError}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {criticalAlerts.length}
                </div>
                <div className="text-sm text-gray-600">Critical Alerts</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {highAlerts.length}
                </div>
                <div className="text-sm text-gray-600">High Priority</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {activeAlerts.length}
                </div>
                <div className="text-sm text-gray-600">Active Alerts</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Check className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {alerts.filter((a: any) => a.resolved).length}
                </div>
                <div className="text-sm text-gray-600">Resolved Today</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search alerts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm((e.target as any).value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter((e.target as any).value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
              </select>
              
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter((e.target as any).value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter((e.target as any).value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="cpu">CPU</option>
                <option value="memory">Memory</option>
                <option value="disk">Disk</option>
                <option value="database">Database</option>
                <option value="api">API</option>
                <option value="network">Network</option>
              </select>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Alert
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Rules
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts List */}
      <div className="space-y-4">
        {isAlertsLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-300 rounded w-full"></div>
                  <div className="h-3 bg-gray-300 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredAlerts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No alerts found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm || severityFilter !== 'all' || typeFilter !== 'all'
                  ? 'No alerts match your current filters.'
                  : 'All systems are running smoothly.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAlerts.map((alert) => {
            const AlertIcon = getAlertIcon(alert.type)
            
            return (
              <Card 
                key={alert.id}
                className={`transition-all hover:shadow-md ${
                  alert.severity === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                  alert.severity === 'high' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' :
                  ''
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="flex-shrink-0">
                        <div className={`p-2 rounded-full ${
                          alert.severity === 'critical' ? 'bg-red-100 text-red-600' :
                          alert.severity === 'high' ? 'bg-orange-100 text-orange-600' :
                          alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          <AlertIcon className="h-5 w-5" />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {alert.title}
                          </h3>
                          <Badge variant={getSeverityColor(alert.severity) as any}>
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {alert.type}
                          </Badge>
                          {alert.resolved && (
                            <Badge variant="success" className="text-xs">
                              RESOLVED
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-gray-700 dark:text-gray-300 mb-3">
                          {alert.message}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {formatTimestamp(alert.timestamp)}
                          </div>
                          <div>
                            Threshold: {alert.threshold}
                          </div>
                          <div>
                            Current: {alert.currentValue}
                          </div>
                        </div>
                        
                        {alert.resolvedBy && (
                          <div className="mt-2 text-sm text-green-600">
                            Resolved by {alert.resolvedBy} at {new Date(alert.resolvedAt!).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-4">
                      {!alert.resolved && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolveAlert(alert.id)}
                            disabled={isResolvingAlert}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedAlert(alert)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Load More */}
      {filteredAlerts.length >= maxAlerts && (
        <div className="text-center">
          <Button variant="outline">
            Load More Alerts
          </Button>
        </div>
      )}
    </div>
  )
}

export default AlertManager
