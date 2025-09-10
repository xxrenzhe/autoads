'use client'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Webhook,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Eye,
  Filter
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

export interface WebhookEvent {
  id: string
  type: string
  status: 'pending' | 'processed' | 'failed'
  data: any
  error?: string
  processedAt?: string
  createdAt: string
  retryCount: number
}

export interface WebhookHandlerProps {
  className?: string
  showFilters?: boolean
  maxEvents?: number
}

export function WebhookHandler({ 
  className, 
  showFilters = true, 
  maxEvents = 50 
}: WebhookHandlerProps) {
  const [selectedEventType, setSelectedEventType] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null)

  const {
    data: webhookEvents,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['webhook-events', selectedEventType, selectedStatus],
    queryFn: async (): Promise<WebhookEvent[]> => {
      const params = new URLSearchParams()
      if (selectedEventType !== 'all') params.append('type', selectedEventType)
      if (selectedStatus !== 'all') params.append('status', selectedStatus)
      params.append('limit', maxEvents.toString())

      const response = await fetch(`/api/admin/webhooks/stripe?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch webhook events')
      }
      const result = await response.json()
      return result.data || []
    },
    staleTime: 30 * 1000, // 30 seconds
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed': return 'success'
      case 'failed': return 'destructive'
      case 'pending': return 'warning'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed': return CheckCircle
      case 'failed': return AlertCircle
      case 'pending': return Clock
      default: return Clock
    }
  }

  const handleRetryWebhook = async (eventId: string) => {
    try {
      const response = await fetch(`/api/admin/webhooks/stripe/${eventId}/retry`, {
        method: 'POST'
      })
      
      if (response.ok) {
        refetch()
      }
    } catch (error) {
      console.error('Failed to retry webhook:', error)
    }
  }

  const formatEventType = (type: string) => {
    return type.split('.')?.filter(Boolean)?.map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join(' ')
  }

  const eventTypes = [
    'all',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'payment_intent.succeeded',
    'payment_intent.payment_failed'
  ]

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Webhook Events
          </h2>
          <div className="animate-pulse h-8 w-24 bg-gray-300 rounded"></div>
        </div>
        
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-gray-300 rounded w-1/3"></div>
                    <div className="h-6 bg-gray-300 rounded w-20"></div>
                  </div>
                  <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Error Loading Webhook Events
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {error.message}
            </p>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Webhook Events
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and manage Stripe webhook events
          </p>
        </div>
        
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filters:
                </span>
              </div>
              
              <select
                value={selectedEventType}
                onChange={(e) => setSelectedEventType(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {eventTypes?.filter(Boolean)?.map(type => (
                  <option key={type} value={type}>
                    {type === 'all' ? 'All Events' : formatEventType(type)}
                  </option>
                ))}
              </select>
              
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="processed">Processed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Events List */}
      <div className="space-y-4">
        {webhookEvents && webhookEvents.length > 0 ? (
          webhookEvents.map((event) => {
            const StatusIcon = getStatusIcon(event.status)
            
            return (
              <Card key={event.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <StatusIcon className={`h-4 w-4 ${
                          event.status === 'processed' ? 'text-green-500' :
                          event.status === 'failed' ? 'text-red-500' :
                          'text-yellow-500'
                        }`} />
                        
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatEventType(event.type)}
                        </span>
                        
                        <Badge variant={getStatusColor(event.status) as any}>
                          {event.status}
                        </Badge>
                        
                        {event.retryCount > 0 && (
                          <Badge variant="outline">
                            Retry {event.retryCount}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <p>Event ID: {event.id}</p>
                        <p>Created: {new Date(event.createdAt).toLocaleString()}</p>
                        {event.processedAt && (
                          <p>Processed: {new Date(event.processedAt).toLocaleString()}</p>
                        )}
                        {event.error && (
                          <p className="text-red-600">Error: {event.error}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      
                      {event.status === 'failed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetryWebhook(event.id)}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Webhook className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Webhook Events
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                No webhook events found matching your filters.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Webhook Event Details</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedEvent(null)}
                >
                  ×
                </Button>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Event Information
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm">
                    <p><strong>ID:</strong> {selectedEvent.id}</p>
                    <p><strong>Type:</strong> {selectedEvent.type}</p>
                    <p><strong>Status:</strong> {selectedEvent.status}</p>
                    <p><strong>Created:</strong> {new Date(selectedEvent.createdAt).toLocaleString()}</p>
                    {selectedEvent.processedAt && (
                      <p><strong>Processed:</strong> {new Date(selectedEvent.processedAt).toLocaleString()}</p>
                    )}
                    <p><strong>Retry Count:</strong> {selectedEvent.retryCount}</p>
                  </div>
                </div>
                
                {selectedEvent.error && (
                  <div>
                    <h4 className="font-medium text-red-600 mb-2">Error</h4>
                    <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-700">
                      {selectedEvent.error}
                    </div>
                  </div>
                )}
                
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Event Data
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm overflow-x-auto">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(selectedEvent.data, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default WebhookHandler