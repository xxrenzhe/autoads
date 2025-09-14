'use client'
import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { 
  Globe,
  Activity,
  Shield,
  Key,
  Settings,
  Plus,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAdminApiEndpoints, useAdminApiKeys, useAdminApiAnalytics } from '@/lib/hooks/admin/useAdminApiManagement'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

// Lightweight chart primitives (no deps) -----------------------------------
function MiniBarChart({ data, maxHeight = 160 }: { data: Array<{ label: string; value: number }>, maxHeight?: number }) {
  const max = Math.max(1, ...data.map(d => d.value || 0))
  const barWidth = data.length > 0 ? Math.max(8, Math.floor(260 / data.length)) : 12
  return (
    <div className="w-full" role="img" aria-label="bar chart">
      <div className="flex items-end gap-1" style={{ height: maxHeight }}>
        {data.map((d, i) => (
          <div key={i} className="flex flex-col items-center" style={{ width: barWidth }}>
            <div
              className="bg-blue-500 rounded-t"
              title={`${d.label}: ${d.value}`}
              style={{ height: Math.max(2, Math.round((d.value / max) * (maxHeight - 20))) }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-2">
        <span>{data[0]?.label || ''}</span>
        <span>{data[data.length - 1]?.label || ''}</span>
      </div>
    </div>
  )
}

function buildRequestSeries(analytics: any): Array<{ label: string; value: number }> {
  const series: Array<{ label: string; value: number }> = []
  const over = analytics?.requestsOverTime || analytics?.requestVolume?.overTime || analytics?.overTime?.requests
  if (Array.isArray(over)) {
    for (const p of over) {
      const label = String(p.date || p.time || '')
      const value = Number(p.count || p.value || 0)
      if (label) series.push({ label, value })
    }
  }
  return series.slice(-24) // limit
}

function buildResponseDistribution(analytics: any): Array<{ label: string; value: number }> {
  const dist = analytics?.responseTimes || analytics?.responseTime || analytics?.latency
  const out: Array<{ label: string; value: number }> = []
  if (dist && typeof dist === 'object') {
    const p50 = Number(dist.p50 ?? dist.p_50 ?? 0)
    const p90 = Number(dist.p90 ?? dist.p_90 ?? 0)
    const p99 = Number(dist.p99 ?? dist.p_99 ?? 0)
    if (p50) out.push({ label: 'p50', value: p50 })
    if (p90) out.push({ label: 'p90', value: p90 })
    if (p99) out.push({ label: 'p99', value: p99 })
  }
  if (out.length === 0 && Array.isArray(dist)) {
    for (const b of dist) {
      out.push({ label: String(b.label || b.bucket || ''), value: Number(b.value || 0) })
    }
  }
  return out
}

function buildErrorRates(analytics: any): Array<{ label: string; value: number }> {
  const arr = analytics?.errorRatesByEndpoint || analytics?.errors?.byEndpoint || []
  const out: Array<{ label: string; value: number }> = []
  if (Array.isArray(arr)) {
    for (const r of arr) {
      out.push({ label: String(r.endpoint || r.path || ''), value: Math.round((Number(r.errorRate || r.rate || 0)) * 100) / 100 })
    }
  }
  return out.slice(0, 10)
}

export interface APIEndpoint {
  id: string
  path: string
  method: string
  description: string
  isActive: boolean
  rateLimitPerMinute: number
  rateLimitPerHour: number
  requiresAuth: boolean
  requiredRole: string
  responseTime: number
  successRate: number
  totalRequests: number
  errorCount: number
  lastAccessed: string
  createdAt: string
  updatedAt: string
}

export interface APIKey {
  id: string
  name: string
  keyPrefix: string
  userId: string
  permissions: string[]
  rateLimitOverride?: number
  isActive: boolean
  expiresAt?: string
  lastUsed?: string
  totalRequests: number
  createdAt: string
}

export interface APIManagerProps {
  className?: string
}

export function APIManager({ className }: APIManagerProps) {
  const [activeTab, setActiveTab] = useState<'endpoints' | 'keys' | 'analytics'>('endpoints')
  const [showCreateEndpoint, setShowCreateEndpoint] = useState(false)
  const [showCreateKey, setShowCreateKey] = useState(false)
  const [editingEndpoint, setEditingEndpoint] = useState<APIEndpoint | null>(null)
  const [editingKey, setEditingKey] = useState<APIKey | null>(null)
  const [endpointForm, setEndpointForm] = useState<{ description: string; isActive: boolean; rateLimitPerMinute?: number; rateLimitPerHour?: number; requiresAuth?: boolean; requiredRole?: string }>({ description: '', isActive: true })
  const [keyForm, setKeyForm] = useState<{ name: string; isActive: boolean; rateLimitOverride?: number; expiresAt?: string; permissionsCSV?: string }>({ name: '', isActive: true })
  const [announcement, setAnnouncement] = useState<string>('')
  const [confirmDeleteEndpointId, setConfirmDeleteEndpointId] = useState<string | null>(null)
  const [confirmDeleteEndpointLabel, setConfirmDeleteEndpointLabel] = useState<string>('')
  const [confirmDeleteKeyId, setConfirmDeleteKeyId] = useState<string | null>(null)
  const [confirmDeleteKeyLabel, setConfirmDeleteKeyLabel] = useState<string>('')
  
  const queryClient = useQueryClient()
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // Announce changes to screen readers
  const announceToScreenReader = (message: string) => {
    setAnnouncement(message)
    setTimeout(() => setAnnouncement(''), 1000)
  }

  // Handle tab navigation with keyboard
  const handleTabKeyDown = (event: React.KeyboardEvent, tabId: string) => {
    const tabs = ['endpoints', 'keys', 'analytics']
    const currentIndex = tabs.indexOf(tabId)
    
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        const nextIndex = (currentIndex + 1) % tabs.length
        setActiveTab(tabs[nextIndex] as any)
        tabRefs.current.get(tabs[nextIndex])?.focus()
        announceToScreenReader(`Switched to ${tabs[nextIndex]} section`)
        break
      case 'ArrowLeft':
        event.preventDefault()
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
        setActiveTab(tabs[prevIndex] as any)
        tabRefs.current.get(tabs[prevIndex])?.focus()
        announceToScreenReader(`Switched to ${tabs[prevIndex]} section`)
        break
      case 'Home':
        event.preventDefault()
        setActiveTab('endpoints')
        tabRefs.current.get('endpoints')?.focus()
        announceToScreenReader('Switched to endpoints section')
        break
      case 'End':
        event.preventDefault()
        setActiveTab('analytics')
        tabRefs.current.get('analytics')?.focus()
        announceToScreenReader('Switched to analytics section')
        break
    }
  }

  const handleTabChange = (newTab: 'endpoints' | 'keys' | 'analytics') => {
    setActiveTab(newTab)
    announceToScreenReader(`Switched to ${newTab} section`)
  }

  // Fetch API endpoints
  const { data: endpoints = [], isLoading: isEndpointsLoading } = useAdminApiEndpoints()

  // Fetch API keys
  const { data: apiKeys = [], isLoading: isKeysLoading } = useAdminApiKeys()

  // Fetch API analytics
  const { data: analytics, isLoading: isAnalyticsLoading } = useAdminApiAnalytics()

  // Create endpoint mutation
  const createEndpointMutation = useMutation({
    mutationFn: async (endpointData: Partial<APIEndpoint>) => {
      // 优先后端直连，失败回退原API
      try {
        const res = await fetch('/go/admin/api-management/endpoints', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(endpointData)
        })
        if (res.ok) return res.json()
        throw new Error('backend create failed')
      } catch {
        const response = await fetch('/api/admin/api-management/endpoints', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(endpointData)
        })
        if (!response.ok) throw new Error('Failed to create endpoint')
        return response.json()
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-management', 'endpoints'] })
      setShowCreateEndpoint(false)
    },
  })

  // Create API key mutation
  const createKeyMutation = useMutation({
    mutationFn: async (keyData: Partial<APIKey>) => {
      try {
        const res = await fetch('/go/admin/api-management/keys', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(keyData)
        })
        if (res.ok) return res.json()
        throw new Error('backend create failed')
      } catch {
        const response = await fetch('/api/admin/api-management/keys', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(keyData)
        })
        if (!response.ok) throw new Error('Failed to create API key')
        return response.json()
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-management', 'keys'] })
      setShowCreateKey(false)
    },
  })

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getStatusColor = (successRate: number): string => {
    if (successRate >= 95) return 'text-green-600'
    if (successRate >= 90) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStatusIcon = (successRate: number) => {
    if (successRate >= 95) return <CheckCircle className="h-4 w-4 text-green-600" />
    if (successRate >= 90) return <Clock className="h-4 w-4 text-yellow-600" />
    return <AlertTriangle className="h-4 w-4 text-red-600" />
  }

  // Backend-first update/delete helpers (fallback to /api)
  const updateEndpointMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<APIEndpoint> }) => {
      try {
        const res = await fetch(`/go/admin/api-management/endpoints/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (res.ok) return res.json();
        throw new Error('backend update failed');
      } catch {
        const r = await fetch(`/api/admin/api-management/endpoints/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!r.ok) throw new Error('Failed to update endpoint');
        return r.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-management', 'endpoints'] });
      queryClient.invalidateQueries({ queryKey: ['api-endpoints'] });
      setAnnouncement('Endpoint updated successfully')
      toast.success('Endpoint updated')
    },
    onError: (e: any) => {
      toast.error(`Update failed: ${e?.message || 'unknown error'}`)
    }
  });

  const deleteEndpointMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        const res = await fetch(`/go/admin/api-management/endpoints/${id}`, { method: 'DELETE' });
        if (res.ok) return true;
        throw new Error('backend delete failed');
      } catch {
        const r = await fetch(`/api/admin/api-management/endpoints/${id}`, { method: 'DELETE' });
        if (!r.ok) throw new Error('Failed to delete endpoint');
        return true;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-management', 'endpoints'] });
      queryClient.invalidateQueries({ queryKey: ['api-endpoints'] });
      setConfirmDeleteEndpointId(null)
      setAnnouncement('Endpoint deleted')
      toast.success('Endpoint deleted')
    },
    onError: (e: any) => {
      toast.error(`Delete failed: ${e?.message || 'unknown error'}`)
    }
  });

  const updateKeyMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<APIKey> }) => {
      try {
        const res = await fetch(`/go/admin/api-management/keys/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (res.ok) return res.json();
        throw new Error('backend update failed');
      } catch {
        const r = await fetch(`/api/admin/api-management/keys/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!r.ok) throw new Error('Failed to update API key');
        return r.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-management', 'keys'] });
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setAnnouncement('API key updated successfully')
      toast.success('API key updated')
    },
    onError: (e: any) => {
      toast.error(`Update key failed: ${e?.message || 'unknown error'}`)
    }
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        const res = await fetch(`/go/admin/api-management/keys/${id}`, { method: 'DELETE' });
        if (res.ok) return true;
        throw new Error('backend delete failed');
      } catch {
        const r = await fetch(`/api/admin/api-management/keys/${id}`, { method: 'DELETE' });
        if (!r.ok) throw new Error('Failed to delete API key');
        return true;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-management', 'keys'] });
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setConfirmDeleteKeyId(null)
      setAnnouncement('API key deleted')
      toast.success('API key deleted')
    },
    onError: (e: any) => {
      toast.error(`Delete key failed: ${e?.message || 'unknown error'}`)
    }
  });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Live region for announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
        id="api-manager-announcements"
      >
        {announcement}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            API Management System
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor, control, and manage all API access and usage
          </p>
        </div>
        
        <div className="flex space-x-3">
          <Button 
            onClick={() => setShowCreateEndpoint(true)}
            aria-label="Add new API endpoint"
          >
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            Add Endpoint
          </Button>
          <Button 
            onClick={() => setShowCreateKey(true)}
            aria-label="Create new API key"
          >
            <Key className="h-4 w-4 mr-2" aria-hidden="true" />
            Create API Key
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="sr-only">API Overview Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-full" aria-hidden="true">
                  <Globe className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Endpoints
                  </p>
                  <p 
                    className="text-2xl font-bold text-gray-900 dark:text-white"
                    aria-label={`${endpoints.length} total API endpoints configured`}
                  >
                    {endpoints.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-full" aria-hidden="true">
                  <Key className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Active API Keys
                  </p>
                  <p 
                    className="text-2xl font-bold text-gray-900 dark:text-white"
                    aria-label={`${apiKeys.filter((key: any) => key.isActive).length} active API keys`}
                  >
                    {apiKeys.filter((key: any) => key.isActive).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-yellow-100 rounded-full" aria-hidden="true">
                  <Activity className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Requests
                  </p>
                  <p 
                    className="text-2xl font-bold text-gray-900 dark:text-white"
                    aria-label={`${formatNumber(analytics?.totalRequests || 0)} total API requests processed`}
                  >
                    {formatNumber(analytics?.totalRequests || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-full" aria-hidden="true">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Avg Response Time
                  </p>
                  <p 
                    className="text-2xl font-bold text-gray-900 dark:text-white"
                    aria-label={`${analytics?.averageResponseTime || 0} milliseconds average response time`}
                  >
                    {analytics?.averageResponseTime || 0}ms
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" role="tablist" aria-label="API management sections">
          {[
            { id: 'endpoints', label: 'Endpoints', icon: Globe },
            { id: 'keys', label: 'API Keys', icon: Key },
            { id: 'analytics', label: 'Analytics', icon: Activity }
          ].map(({ id, label, icon: Icon }: any) => (
            <button
              key={id}
              ref={(el) => {
                if (el) {
                  tabRefs.current.set(id, el)
                } else {
                  tabRefs.current.delete(id)
                }
              }}
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={`${id}-panel`}
              id={`${id}-tab`}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => handleTabChange(id as any)}
              onKeyDown={(e) => handleTabKeyDown(e, id)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4 mr-2" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div 
        role="tabpanel" 
        id="endpoints-panel"
        aria-labelledby="endpoints-tab"
        hidden={activeTab !== 'endpoints'}
      >
        {activeTab === 'endpoints' && (
          <section aria-labelledby="endpoints-section-heading">
            <h2 id="endpoints-section-heading" className="sr-only">API Endpoints Management</h2>
            <div className="space-y-6">
              {/* Endpoints List */}
              <div className="grid grid-cols-1 gap-6">
                {isEndpointsLoading ? (
                  <div role="status" aria-label="Loading API endpoints">
                    <div className="animate-pulse space-y-4">
                      {Array.from({ length: 3 }).map((_, index: any) => (
                        <Card key={index} aria-hidden="true">
                          <CardContent className="p-6">
                            <div className="space-y-3">
                              <div className="h-6 bg-gray-300 rounded w-1/3"></div>
                              <div className="h-4 bg-gray-300 rounded w-2/3"></div>
                              <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <span className="sr-only">Loading API endpoints...</span>
                  </div>
                ) : endpoints.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Globe className="h-12 w-12 mx-auto mb-4 text-gray-400" aria-hidden="true" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No API Endpoints
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Create your first API endpoint to get started.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  endpoints.map((endpoint: any) => (
                    <Card key={endpoint.id}>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <Badge 
                              variant={endpoint.method === 'GET' ? 'default' : 
                                       endpoint.method === 'POST' ? 'secondary' : 'outline'}
                              aria-label={`HTTP ${endpoint.method} method`}
                            >
                              {endpoint.method}
                            </Badge>
                            <div>
                              <h3 className="font-medium text-gray-900 dark:text-white">
                                {endpoint.path}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {endpoint.description}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <div aria-label={`Success rate: ${endpoint.successRate.toFixed(1)}%`}>
                              {getStatusIcon(endpoint.successRate)}
                            </div>
                            <Badge 
                              variant={endpoint.isActive ? 'default' : 'secondary'}
                              aria-label={`Endpoint status: ${endpoint.isActive ? 'Active' : 'Inactive'}`}
                            >
                              {endpoint.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <div className="flex space-x-2" role="group" aria-label={`Actions for ${endpoint.path} endpoint`}>
                              <Button 
                                variant="outline" 
                                size="sm"
                                aria-label={`View details for ${endpoint.path} endpoint`}
                              >
                                <Eye className="h-3 w-3" aria-hidden="true" />
                                <span className="sr-only">View</span>
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                aria-label={`Edit ${endpoint.path} endpoint`}
                                onClick={() => {
                                  setEditingEndpoint(endpoint)
                                  setEndpointForm({
                                    description: endpoint.description || '',
                                    isActive: !!endpoint.isActive,
                                    rateLimitPerMinute: endpoint.rateLimitPerMinute,
                                    requiresAuth: endpoint.requiresAuth,
                                    requiredRole: endpoint.requiredRole || ''
                                  })
                                }}
                              >
                                <Edit className="h-3 w-3" aria-hidden="true" />
                                <span className="sr-only">Edit</span>
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                aria-label={`Delete ${endpoint.path} endpoint`}
                                onClick={() => {
                                  setConfirmDeleteEndpointId(String(endpoint.id || endpoint.path))
                                  setConfirmDeleteEndpointLabel(endpoint.path)
                                }}
                              >
                                <Trash2 className="h-3 w-3" aria-hidden="true" />
                                <span className="sr-only">Delete</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4" role="list" aria-label="Endpoint metrics">
                          <div role="listitem">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Rate Limit</p>
                            <p className="font-medium" aria-label={`Rate limit: ${endpoint.rateLimitPerMinute} requests per minute`}>
                              {endpoint.rateLimitPerMinute}/min
                            </p>
                          </div>
                          <div role="listitem">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Response Time</p>
                            <p className="font-medium" aria-label={`Average response time: ${endpoint.responseTime} milliseconds`}>
                              {endpoint.responseTime}ms
                            </p>
                          </div>
                          <div role="listitem">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
                            <p className={`font-medium ${getStatusColor(endpoint.successRate)}`}>
                              {endpoint.successRate.toFixed(1)}%
                            </p>
                          </div>
                          <div role="listitem">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Requests</p>
                            <p className="font-medium" aria-label={`${formatNumber(endpoint.totalRequests)} total requests processed`}>
                              {formatNumber(endpoint.totalRequests)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      <div 
        role="tabpanel" 
        id="keys-panel"
        aria-labelledby="keys-tab"
        hidden={activeTab !== 'keys'}
      >
        {activeTab === 'keys' && (
          <section aria-labelledby="keys-section-heading">
            <h2 id="keys-section-heading" className="sr-only">API Keys Management</h2>
            <div className="space-y-6">
              {/* API Keys List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isKeysLoading ? (
                  <div role="status" aria-label="Loading API keys">
                    <div className="animate-pulse space-y-4">
                      {Array.from({ length: 3 }).map((_, index: any) => (
                        <Card key={index} aria-hidden="true">
                          <CardContent className="p-6">
                            <div className="space-y-3">
                              <div className="h-6 bg-gray-300 rounded w-1/2"></div>
                              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                              <div className="h-4 bg-gray-300 rounded w-1/3"></div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <span className="sr-only">Loading API keys...</span>
                  </div>
                ) : apiKeys.length === 0 ? (
                  <Card className="col-span-full">
                    <CardContent className="p-8 text-center">
                      <Key className="h-12 w-12 mx-auto mb-4 text-gray-400" aria-hidden="true" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No API Keys
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Create your first API key to get started.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  apiKeys.map((key: any) => (
                    <Card key={key.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Key className="h-5 w-5 mr-2 text-blue-500" aria-hidden="true" />
                            <span className="truncate">{key.name}</span>
                          </div>
                          <Badge 
                            variant={key.isActive ? 'default' : 'secondary'}
                            aria-label={`API key status: ${key.isActive ? 'Active' : 'Inactive'}`}
                          >
                            {key.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Key Prefix</p>
                            <p 
                              className="font-mono text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded"
                              aria-label={`API key prefix: ${key.keyPrefix}`}
                            >
                              {key.keyPrefix}...
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4" role="list" aria-label="API key statistics">
                            <div role="listitem">
                              <p className="text-sm text-gray-600 dark:text-gray-400">Requests</p>
                              <p 
                                className="font-medium"
                                aria-label={`${formatNumber(key.totalRequests)} total requests made with this key`}
                              >
                                {formatNumber(key.totalRequests)}
                              </p>
                            </div>
                            <div role="listitem">
                              <p className="text-sm text-gray-600 dark:text-gray-400">Permissions</p>
                              <p 
                                className="font-medium"
                                aria-label={`${key.permissions.length} permissions granted to this key`}
                              >
                                {key.permissions.length}
                              </p>
                            </div>
                          </div>
                          
                          {key.lastUsed && (
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Last Used</p>
                              <p 
                                className="text-sm"
                                aria-label={`Last used on ${new Date(key.lastUsed).toLocaleDateString()}`}
                              >
                                {new Date(key.lastUsed).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                          
                          <div className="flex space-x-2" role="group" aria-label={`Actions for ${key.name} API key`}>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1"
                              aria-label={`Edit ${key.name} API key`}
                              onClick={() => {
                                setEditingKey(key)
                                  setKeyForm({ 
                                    name: key.name, 
                                    isActive: !!key.isActive, 
                                    rateLimitOverride: key.rateLimitOverride,
                                    expiresAt: key.expiresAt ? String(key.expiresAt).slice(0,10) : '',
                                    permissionsCSV: Array.isArray(key.permissions) ? key.permissions.join(',') : ''
                                  })
                                }}
                            >
                              <Edit className="h-3 w-3 mr-1" aria-hidden="true" />
                              Edit
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              aria-label={`Delete ${key.name} API key`}
                              onClick={() => {
                                setConfirmDeleteKeyId(String(key.id))
                                setConfirmDeleteKeyLabel(key.name)
                              }}
                            >
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      <div 
        role="tabpanel" 
        id="analytics-panel"
        aria-labelledby="analytics-tab"
        hidden={activeTab !== 'analytics'}
      >
        {activeTab === 'analytics' && (
          <section aria-labelledby="analytics-section-heading">
            <h2 id="analytics-section-heading" className="sr-only">API Analytics Dashboard</h2>
            <div className="space-y-6">
              {/* Analytics Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Request Volume
                    </h3>
                  </CardHeader>
                  <CardContent>
                    {isAnalyticsLoading ? (
                      <div className="h-64 animate-pulse bg-gray-100 dark:bg-gray-800 rounded" />
                    ) : (
                      (() => {
                        const series = buildRequestSeries(analytics)
                        return series.length > 0 ? (
                          <MiniBarChart data={series} />
                        ) : (
                          <div className="h-64 flex items-center justify-center text-gray-500">No data</div>
                        )
                      })()
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Response Times
                    </h3>
                  </CardHeader>
                  <CardContent>
                    {isAnalyticsLoading ? (
                      <div className="h-64 animate-pulse bg-gray-100 dark:bg-gray-800 rounded" />
                    ) : (
                      (() => {
                        const dist = buildResponseDistribution(analytics)
                        return dist.length > 0 ? (
                          <MiniBarChart data={dist} />
                        ) : (
                          <div className="h-64 flex items-center justify-center text-gray-500">No latency data</div>
                        )
                      })()
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Error Rates
                    </h3>
                  </CardHeader>
                  <CardContent>
                    {isAnalyticsLoading ? (
                      <div className="h-64 animate-pulse bg-gray-100 dark:bg-gray-800 rounded" />
                    ) : (
                      (() => {
                        const er = buildErrorRates(analytics)
                        return er.length > 0 ? (
                          <MiniBarChart data={er} />
                        ) : (
                          <div className="h-64 flex items-center justify-center text-gray-500">No error data</div>
                        )
                      })()
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Top Endpoints
                    </h3>
                  </CardHeader>
                  <CardContent>
                    {isAnalyticsLoading ? (
                      <div role="status" aria-label="Loading top endpoints">
                        <div className="animate-pulse space-y-3">
                          {Array.from({ length: 5 }).map((_, index: any) => (
                            <div key={index} className="flex justify-between" aria-hidden="true">
                              <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                              <div className="h-4 bg-gray-300 rounded w-1/4"></div>
                            </div>
                          ))}
                        </div>
                        <span className="sr-only">Loading top endpoints...</span>
                      </div>
                    ) : endpoints.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">
                        No endpoint data available
                      </p>
                    ) : (
                      <div className="space-y-3" role="list" aria-label="Top 5 most used API endpoints">
                        {endpoints.slice(0, 5).map((endpoint, index: any) => (
                          <div 
                            key={endpoint.id} 
                            className="flex items-center justify-between"
                            role="listitem"
                          >
                            <div className="flex items-center">
                              <span 
                                className="text-sm font-medium text-gray-500 w-6"
                                aria-label={`Rank ${index + 1}`}
                              >
                                #{index + 1}
                              </span>
                              <span className="text-sm font-medium ml-2">
                                {endpoint.path}
                              </span>
                            </div>
                            <span 
                              className="text-sm text-gray-600"
                              aria-label={`${formatNumber(endpoint.totalRequests)} total requests`}
                            >
                              {formatNumber(endpoint.totalRequests)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Edit Endpoint Dialog */}
      <Dialog open={!!editingEndpoint} onOpenChange={(open) => { if (!open) setEditingEndpoint(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Endpoint</DialogTitle>
            <DialogDescription>Update endpoint metadata and limits</DialogDescription>
          </DialogHeader>
          {editingEndpoint && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Path</label>
                <div className="text-sm font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">{editingEndpoint.path}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Method</label>
                <div className="text-sm font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">{editingEndpoint.method}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Description</label>
                <Input value={endpointForm.description} onChange={(e) => setEndpointForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input id="ep-active" type="checkbox" checked={endpointForm.isActive} onChange={(e) => setEndpointForm(f => ({ ...f, isActive: e.target.checked }))} />
                  <label htmlFor="ep-active" className="text-sm">Active</label>
                </div>
                <div className="flex items-center gap-2">
                  <input id="ep-auth" type="checkbox" checked={!!endpointForm.requiresAuth} onChange={(e) => setEndpointForm(f => ({ ...f, requiresAuth: e.target.checked }))} />
                  <label htmlFor="ep-auth" className="text-sm">Requires Auth</label>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Rate Limit (per minute)</label>
                  <Input type="number" value={endpointForm.rateLimitPerMinute ?? ''} onChange={(e) => setEndpointForm(f => ({ ...f, rateLimitPerMinute: e.target.value ? Number(e.target.value) : undefined }))} />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Rate Limit (per hour)</label>
                  <Input type="number" value={endpointForm.rateLimitPerHour ?? ''} onChange={(e) => setEndpointForm(f => ({ ...f, rateLimitPerHour: e.target.value ? Number(e.target.value) : undefined }))} />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Required Role</label>
                  <select 
                    className="w-full border rounded h-9 bg-white dark:bg-gray-900 text-sm px-2"
                    value={endpointForm.requiredRole || ''}
                    onChange={(e) => setEndpointForm(f => ({ ...f, requiredRole: e.target.value }))}
                    disabled={!endpointForm.requiresAuth}
                  >
                    <option value="">None</option>
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                  {!endpointForm.requiresAuth && (
                    <p className="text-xs text-gray-500 mt-1">Requires Auth 关闭时，角色限制无效</p>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                if (!editingEndpoint) return
                // 联动校验：hour 不应小于 minute（简单规则）
                if (
                  endpointForm.rateLimitPerHour !== undefined &&
                  endpointForm.rateLimitPerMinute !== undefined &&
                  endpointForm.rateLimitPerHour < endpointForm.rateLimitPerMinute
                ) {
                  toast.error('Validation: per-hour limit should not be less than per-minute limit')
                  return
                }
                updateEndpointMutation.mutate({ id: String(editingEndpoint.id || editingEndpoint.path), payload: endpointForm })
                setEditingEndpoint(null)
              }}
            >Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit API Key Dialog */}
      <Dialog open={!!editingKey} onOpenChange={(open) => { if (!open) setEditingKey(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit API Key</DialogTitle>
            <DialogDescription>Update key name, status and override</DialogDescription>
          </DialogHeader>
          {editingKey && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Name</label>
                <Input value={keyForm.name} onChange={(e) => setKeyForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input id="key-active" type="checkbox" checked={keyForm.isActive} onChange={(e) => setKeyForm(f => ({ ...f, isActive: e.target.checked }))} />
                  <label htmlFor="key-active" className="text-sm">Active</label>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Rate Limit Override</label>
                  <Input type="number" value={keyForm.rateLimitOverride ?? ''} onChange={(e) => setKeyForm(f => ({ ...f, rateLimitOverride: e.target.value ? Number(e.target.value) : undefined }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Expires At</label>
                  <Input type="date" value={keyForm.expiresAt ?? ''} onChange={(e) => setKeyForm(f => ({ ...f, expiresAt: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Permissions (comma separated)</label>
                  <Input value={keyForm.permissionsCSV ?? ''} onChange={(e) => setKeyForm(f => ({ ...f, permissionsCSV: e.target.value }))} placeholder="read,write,admin" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                if (!editingKey) return
                const payload: any = { name: keyForm.name, isActive: keyForm.isActive }
                if (keyForm.rateLimitOverride !== undefined) payload.rateLimitOverride = keyForm.rateLimitOverride
                if (keyForm.expiresAt && keyForm.expiresAt.length > 0) {
                  const today = new Date(); today.setHours(0,0,0,0)
                  const exp = new Date(keyForm.expiresAt)
                  if (isNaN(exp.getTime())) {
                    toast.error('Invalid expiresAt date')
                    return
                  }
                  if (exp.getTime() < today.getTime()) {
                    toast.error('expiresAt cannot be in the past')
                    return
                  }
                  payload.expiresAt = keyForm.expiresAt
                }
                if (keyForm.permissionsCSV && keyForm.permissionsCSV.trim().length > 0) {
                  payload.permissions = keyForm.permissionsCSV.split(',').map(s => s.trim()).filter(Boolean)
                }
                updateKeyMutation.mutate({ id: String(editingKey.id), payload })
                setEditingKey(null)
              }}
            >Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default APIManager
