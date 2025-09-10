'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Badge } from '../ui/badge'
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  RefreshCw,
  Play,
  Square,
  Settings,
  ExternalLink,
  Clock,
  Zap,
  Database,
  Globe,
  Server,
  Shield
} from 'lucide-react'
import { useSystemMonitoring } from '../../hooks/useSystemMonitoring'

export interface ServiceStatus {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  responseTime: number
  lastCheck: number
  uptime: number
  version?: string
  description?: string
  dependencies?: string[]
  endpoint?: string
}

export interface HealthStatusProps {
  showActions?: boolean
  compactView?: boolean
  autoRefresh?: boolean
}

export function HealthStatus({ 
  showActions = true, 
  compactView = false,
  autoRefresh = true 
}: HealthStatusProps) {
  const {
    services,
    systemMetrics,
    isServicesLoading,
    servicesError,
    restartService,
    isRestartingService,
    formatUptime
  } = useSystemMonitoring(autoRefresh ? 30000 : 0)

  const [selectedService, setSelectedService] = useState<ServiceStatus | null>(null)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return CheckCircle
      case 'degraded': return AlertTriangle
      case 'down': return XCircle
      default: return AlertTriangle
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success'
      case 'degraded': return 'warning'
      case 'down': return 'destructive'
      default: return 'secondary'
    }
  }

  const getServiceIcon = (serviceName: string) => {
    const name = serviceName.toLowerCase()
    if (name.includes('database') || name.includes('db')) return Database
    if (name.includes('api') || name.includes('server')) return Globe
    if (name.includes('cache') || name.includes('redis')) return Zap
    if (name.includes('auth') || name.includes('security')) return Shield
    return Server
  }

  const handleRestartService = async (serviceName: string) => {
    if (window.confirm(`Are you sure you want to restart ${serviceName}? This may cause temporary downtime.`)) {
      try {
        await restartService(serviceName)
      } catch (error) {
        console.error('Error restarting service:', error)
      }
    }
  }

  const formatResponseTime = (time: number) => {
    if (time < 1000) return `${time}ms`
    return `${(time / 1000).toFixed(2)}s`
  }

  const healthyServices = services.filter(s => s.status === 'healthy')
  const degradedServices = services.filter(s => s.status === 'degraded')
  const downServices = services.filter(s => s.status === 'down')

  const overallHealth = downServices.length > 0 ? 'down' : 
                      degradedServices.length > 0 ? 'degraded' : 'healthy'

  if (servicesError) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Error loading service status: {servicesError}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall Health Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Server className="h-5 w-5 mr-2" />
              System Health Overview
            </div>
            <Badge variant={getStatusColor(overallHealth) as any}>
              {overallHealth.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {healthyServices.length}
              </div>
              <div className="text-sm text-gray-600">Healthy Services</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {degradedServices.length}
              </div>
              <div className="text-sm text-gray-600">Degraded Services</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {downServices.length}
              </div>
              <div className="text-sm text-gray-600">Down Services</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isServicesLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
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
        ) : services.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="p-8 text-center">
                <Server className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No services found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Service monitoring data is not available.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          services.map((service) => {
            const StatusIcon = getStatusIcon(service.status)
            const ServiceIcon = getServiceIcon(service.name)
            
            return (
              <Card 
                key={service.name}
                className={`transition-all hover:shadow-md ${
                  selectedService?.name === service.name ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedService(service)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <ServiceIcon className="h-8 w-8 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {service.name}
                        </h3>
                        {service.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {service.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getStatusColor(service.status) as any}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {service.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Response Time</div>
                      <div className="font-mono text-sm">
                        {formatResponseTime(service.responseTime)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Uptime</div>
                      <div className="font-mono text-sm">
                        {formatUptime(service.uptime)}
                      </div>
                    </div>
                  </div>

                  {service.version && (
                    <div className="mb-4">
                      <div className="text-sm text-gray-500 mb-1">Version</div>
                      <Badge variant="outline" className="text-xs">
                        v{service.version}
                      </Badge>
                    </div>
                  )}

                  <div className="mb-4">
                    <div className="text-sm text-gray-500 mb-1">Last Check</div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {new Date(service.lastCheck).toLocaleString()}
                    </div>
                  </div>

                  {service.dependencies && service.dependencies.length > 0 && (
                    <div className="mb-4">
                      <div className="text-sm text-gray-500 mb-2">Dependencies</div>
                      <div className="flex flex-wrap gap-1">
                        {service.dependencies?.map((dep: string) => (
                          <Badge key={dep} variant="outline" className="text-xs">
                            {dep}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {showActions && (
                    <div className="flex items-center space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRestartService(service.name)
                        }}
                        disabled={isRestartingService}
                      >
                        {isRestartingService ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      
                      {service.endpoint && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(service.endpoint, '_blank')
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Open service details modal or navigate to service page
                        }}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Service Details Modal/Panel */}
      {selectedService && !compactView && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                {React.createElement(getServiceIcon(selectedService.name), { className: "h-5 w-5 mr-2" })}
                {selectedService.name} Details
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedService(null)}
              >
                ×
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                  Service Information
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status:</span>
                    <Badge variant={getStatusColor(selectedService.status) as any}>
                      {selectedService.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Response Time:</span>
                    <span className="font-mono">{formatResponseTime(selectedService.responseTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Uptime:</span>
                    <span className="font-mono">{formatUptime(selectedService.uptime)}</span>
                  </div>
                  {selectedService.version && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Version:</span>
                      <span className="font-mono">v{selectedService.version}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Check:</span>
                    <span>{new Date(selectedService.lastCheck).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                  Actions
                </h4>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleRestartService(selectedService.name)}
                    disabled={isRestartingService}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Restart Service
                  </Button>
                  
                  {selectedService.endpoint && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => window.open(selectedService.endpoint, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Endpoint
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Configure Service
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default HealthStatus