'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { 
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Key,
  Globe,
  Mail,
  MessageSquare,
  CreditCard,
  BarChart3,
  Play,
  Pause,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Plus,
  HelpCircle,
  Shield,
  Zap,
  Activity
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Integration {
  id: string
  name: string
  type: 'api' | 'webhook' | 'oauth' | 'database'
  category: 'analytics' | 'payment' | 'communication' | 'advertising' | 'storage' | 'other'
  description: string
  status: 'connected' | 'disconnected' | 'error' | 'pending'
  isActive: boolean
  lastSync?: string
  lastError?: string
  config: Record<string, any>
  credentials: Record<string, any>
  healthStatus: {
    healthy: boolean
    lastCheck: string
    responseTime?: number
    errorCount: number
  }
  usage: {
    requestsToday: number
    requestsThisMonth: number
    rateLimitRemaining?: number
    rateLimitReset?: string
  }
  createdAt: string
  updatedAt: string
}

export interface IntegrationTemplate {
  id: string
  name: string
  provider: string
  category: string
  description: string
  icon: string
  setupGuideUrl: string
  requiredFields: Array<{
    name: string
    label: string
    type: 'text' | 'password' | 'url' | 'select'
    required: boolean
    description: string
    options?: string[]
  }>
  testEndpoint?: string
  documentationUrl: string
}

export interface IntegrationManagerProps {
  className?: string
}

export function IntegrationManager({ className }: .*Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'integrations' | 'templates' | 'health'>('overview')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<IntegrationTemplate | null>(null)
  const [setupData, setSetupData] = useState<Record<string, any>>({})

  const queryClient = useQueryClient()

  // Fetch integrations
  const {
    data: integrations = [],
    isLoading: isIntegrationsLoading
  } = useQuery({
    queryKey: ['integrations', selectedCategory],
    queryFn: async (): Promise<Integration[]> => {
      const params = selectedCategory !== 'all' ? `?category=${selectedCategory}` : ''
      const response = await fetch(`/api/admin/integrations${params}`)
      if (!response.ok) throw new Error('Failed to fetch integrations')
      const result = await response.json()
      return result.data || []
    },
    staleTime: 2 * 60 * 1000,
  })

  // Fetch integration templates
  const {
    data: templates = [],
    isLoading: isTemplatesLoading
  } = useQuery({
    queryKey: ['integration-templates'],
    queryFn: async (): Promise<IntegrationTemplate[]> => {
      const response = await fetch('/api/admin/integrations/templates')
      if (!response.ok) throw new Error('Failed to fetch integration templates')
      const result = await response.json()
      return result.data || []
    },
    staleTime: 10 * 60 * 1000,
  })

  // Create integration mutation
  const createIntegrationMutation = useMutation({
    mutationFn: async (integrationData: any) => {
      const response = await fetch('/api/admin/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(integrationData),
      })
      if (!response.ok) throw new Error('Failed to create integration')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      setShowSetupModal(false)
      setSelectedTemplate(null)
      setSetupData({})
    },
  })

  // Test integration mutation
  const testIntegrationMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const response = await fetch(`/api/admin/integrations/${integrationId}/test`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to test integration')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
    },
  })

  // Toggle integration mutation
  const toggleIntegrationMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const response = await fetch(`/api/admin/integrations/${integrationId}/toggle`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to toggle integration')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
    },
  })

  const getStatusIcon = (status: Integration['status']) => {
    switch (status) => {
      case 'connected': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'disconnected': return <XCircle className="h-4 w-4 text-gray-400" />
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />
      default: return <XCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: Integration['status']): string => {
    switch (status) => {
      case 'connected': return 'bg-green-100 text-green-800'
      case 'disconnected': return 'bg-gray-100 text-gray-800'
      case 'error': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) => {
      case 'analytics': return <BarChart3 className="h-5 w-5" />
      case 'payment': return <CreditCard className="h-5 w-5" />
      case 'communication': return <Mail className="h-5 w-5" />
      case 'advertising': return <Globe className="h-5 w-5" />
      case 'storage': return <Shield className="h-5 w-5" />
      default: return <Settings className="h-5 w-5" />
    }
  }

  const handleSetupIntegration = (template: IntegrationTemplate) => {
    setSelectedTemplate(template)
    setSetupData({})
    setShowSetupModal(true)
  }

  const handleSubmitSetup = () => {
    if (!selectedTemplate) return

    const integrationData = {
      templateId: selectedTemplate.id,
      name: setupData.name || selectedTemplate.name,
      config: setupData,
      credentials: setupData
    }

    createIntegrationMutation.mutate(integrationData)
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  // Calculate summary statistics
  const connectedIntegrations = integrations.filter((i: any) => i.status === 'connected').length
  const errorIntegrations = integrations.filter((i: any) => i.status === 'error').length
  const totalRequests = integrations.reduce((sum, i: any) => sum + i.usage.requestsToday, 0)
  const healthyIntegrations = integrations.filter((i: any) => i.healthStatus.healthy).length

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Third-Party Integration Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Configure, monitor, and manage external service integrations
          </p>
        </div>
        
        <div className="flex space-x-3">
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync All
          </Button>
          <Button onClick={((: any): any) => setShowSetupModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Integration
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <Settings className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Integrations
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {integrations.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Connected
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {connectedIntegrations}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-full">
                <Zap className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Requests Today
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(totalRequests)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Health Issues
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {integrations.length - healthyIntegrations}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'integrations', label: 'Active Integrations', icon: Settings },
            { id: 'templates', label: 'Available Services', icon: Plus },
            { id: 'health', label: 'Health Monitor', icon: Activity }
          ].map(({ id, label, icon: Icon }: any) => (
            <button
              key={id}
              onClick={((: any): any) => setActiveTab(id as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Integration Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['analytics', 'payment', 'communication', 'advertising']?.filter(Boolean)?.map((category: any) => {
                  const categoryIntegrations = integrations.filter((i: any) => i.category === category)
                  const connected = categoryIntegrations.filter((i: any) => i.status === 'connected').length
                  
                  return (
                    <div key={category} className="flex items-center justify-between">
                      <div className="flex items-center">
                        {getCategoryIcon(category)}
                        <span className="ml-2 capitalize">{category}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">
                          {connected}/{categoryIntegrations.length}
                        </span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ 
                              width: `${categoryIntegrations.length > 0 ? (connected / categoryIntegrations.length) * 100 : 0}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {integrations.slice(0, 5)?.filter(Boolean)?.map((integration: any) => (
                  <div key={integration.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      {getStatusIcon(integration.status)}
                      <span className="ml-2 text-sm">{integration.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {integration.lastSync ? new Date(integration.lastSync).toLocaleString() : 'Never'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="space-y-4">
          {/* Category Filter */}
          <div className="flex space-x-2">
            {['all', 'analytics', 'payment', 'communication', 'advertising', 'storage']?.filter(Boolean)?.map((category: any) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={((: any): any) => setSelectedCategory(category)}
              >
                {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
              </Button>
            ))}
          </div>

          {/* Integrations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {integrations.map((integration: any) => (
              <Card key={integration.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      {getCategoryIcon(integration.category)}
                      <span className="ml-2 truncate">{integration.name}</span>
                    </div>
                    <Badge className={getStatusColor(integration.status)}>
                      {integration.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {integration.description}
                    </p>
                    
                    {/* Health Status */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Health:</span>
                      <div className="flex items-center">
                        {integration.healthStatus.healthy ? 
                          <CheckCircle className="h-4 w-4 text-green-600 mr-1" /> :
                          <XCircle className="h-4 w-4 text-red-600 mr-1" />
                        }
                        <span className={integration.healthStatus.healthy ? 'text-green-600' : 'text-red-600'}>
                          {integration.healthStatus.healthy ? 'Healthy' : 'Issues'}
                        </span>
                      </div>
                    </div>

                    {/* Usage Stats */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Today:</span>
                        <span className="ml-1 font-medium">{formatNumber(integration.usage.requestsToday)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Month:</span>
                        <span className="ml-1 font-medium">{formatNumber(integration.usage.requestsThisMonth)}</span>
                      </div>
                    </div>

                    {/* Last Error */}
                    {integration.lastError && (
                      <div className="bg-red-50 border border-red-200 rounded p-2">
                        <p className="text-xs text-red-800">{integration.lastError}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={((: any): any) => testIntegrationMutation.mutate(integration.id)}
                        disabled={testIntegrationMutation.isPending}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Test
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={((: any): any) => toggleIntegrationMutation.mutate(integration.id)}
                        disabled={toggleIntegrationMutation.isPending}
                      >
                        {integration.isActive ? 
                          <Pause className="h-3 w-3 mr-1" /> : 
                          <Play className="h-3 w-3 mr-1" />
                        }
                        {integration.isActive ? 'Pause' : 'Resume'}
                      </Button>
                      
                      <Button variant="outline" size="sm">
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Last Sync */}
                    <div className="text-xs text-gray-500 pt-2 border-t">
                      Last sync: {integration.lastSync ? 
                        new Date(integration.lastSync).toLocaleString() : 
                        'Never'
                      }
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template: any) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  {getCategoryIcon(template.category)}
                  <span className="ml-2">{template.name}</span>
                </CardTitle>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {template.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Provider:</span>
                    <span className="font-medium">{template.provider}</span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      onClick={((: any): any) => handleSetupIntegration(template)}
                      className="flex-1"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Setup
                    </Button>
                    
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Docs
                    </Button>
                    
                    <Button variant="outline" size="sm">
                      <HelpCircle className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'health' && (
        <div className="space-y-4">
          {integrations.map((integration: any) => (
            <Card key={integration.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(integration.status)}
                    <div>
                      <h3 className="font-medium">{integration.name}</h3>
                      <p className="text-sm text-gray-600">
                        Last check: {new Date(integration.healthStatus.lastCheck).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    {integration.healthStatus.responseTime && (
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Response Time</div>
                        <div className="font-medium">{integration.healthStatus.responseTime}ms</div>
                      </div>
                    )}
                    
                    <div className="text-center">
                      <div className="text-sm text-gray-600">Errors (24h)</div>
                      <div className="font-medium">{integration.healthStatus.errorCount}</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-sm text-gray-600">Requests Today</div>
                      <div className="font-medium">{formatNumber(integration.usage.requestsToday)}</div>
                    </div>
                    
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Check
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Setup Modal */}
      {showSetupModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">
              Setup {selectedTemplate.name}
            </h3>
            
            <div className="space-y-4">
              {selectedTemplate.requiredFields.map((field: any) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
                  </label>
                  <Input
                    type={field.type === 'password' ? 'password' : 'text'}
                    value={setupData[field.name] || ''}
                    onChange={((e: any): any) => setSetupData({ ...setupData, [field.name]: e.target.value })}
                    placeholder={field.description}
                  />
                </div>
              ))}
            </div>
            
            <div className="flex space-x-3 mt-6">
              <Button
                onClick={handleSubmitSetup}
                disabled={createIntegrationMutation.isPending}
                className="flex-1"
              >
                {createIntegrationMutation.isPending ? 'Setting up...' : 'Setup Integration'}
              </Button>
              <Button
                variant="outline"
                onClick={((: any): any) => {
                  setShowSetupModal(false)
                  setSelectedTemplate(null)
                  setSetupData({})
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default IntegrationManager