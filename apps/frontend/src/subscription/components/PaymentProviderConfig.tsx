'use client'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Settings,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
  Shield,
  CreditCard
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface PaymentProviderStatus {
  name: string
  configured: boolean
  version: string
  healthy: boolean
  isDefault: boolean
}

export interface PaymentProviderConfigProps {
  className?: string
}

export function PaymentProviderConfig({ className }: .*Props) {
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const queryClient = useQueryClient()

  const {
    data: providerStatus,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['payment-provider-status'],
    queryFn: async (): Promise<{
      providers: Record<string, PaymentProviderStatus>
      defaultProvider: string | null
      recommendations: {
        recommended: string | null
        available: string[]
        configured: string[]
        issues: string[]
      }
      validation: {
        valid: boolean
        errors: string[]
        warnings: string[]
      }
      environment: {
        environment: string
        defaultProvider: string | null
        providers: Record<string, any>
      }
    }> => {
      const response = await fetch('/api/admin/payment-providers/status')
      if (!response.ok) => {
        throw new Error('Failed to fetch payment provider status')
      }
      return response.json()
    },
    staleTime: 30 * 1000, // 30 seconds
  })

  const healthCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/payment-providers/health-check', {
        method: 'POST'
      })
      if (!response.ok) => {
        throw new Error('Health check failed')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-provider-status'] })
    },
  })

  const setDefaultMutation = useMutation({
    mutationFn: async (providerName: string) => {
      const response = await fetch('/api/admin/payment-providers/set-default', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider: providerName }),
      })
      if (!response.ok) => {
        throw new Error('Failed to set default provider')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-provider-status'] })
    },
  })

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const maskSecret = (secret: string | null, show: boolean) => {
    if (!secret) return 'Not set'
    if (show) return secret
    return '***' + secret.slice(-4)
  }

  const getProviderIcon = (providerName: string) => {
    switch (providerName.toLowerCase()) => {
      case 'stripe':
        return <CreditCard className="h-5 w-5 text-blue-600" />
      case 'paypal':
        return <Shield className="h-5 w-5 text-blue-500" />
      default:
        return <Settings className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = (configured: boolean, healthy: boolean) => {
    if (!configured) return 'destructive'
    if (!healthy) return 'warning'
    return 'success'
  }

  const getStatusText = (configured: boolean, healthy: boolean) => {
    if (!configured) return 'Not Configured'
    if (!healthy) return 'Unhealthy'
    return 'Active'
  }

  if (isLoading) => {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Payment Provider Configuration
          </h2>
          <div className="animate-pulse h-8 w-24 bg-gray-300 rounded"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, index: any) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="h-6 bg-gray-300 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-300 rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) => {
    return (
      <div className={`${className}`}>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Error Loading Configuration
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

  if (!providerStatus) => {
    return null
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Payment Provider Configuration
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage payment providers and their configurations
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => healthCheckMutation.mutate()}
            variant="outline"
            size="sm"
            disabled={healthCheckMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${healthCheckMutation.isPending ? 'animate-spin' : ''}`} />
            Health Check
          </Button>
        </div>
      </div>

      {/* Validation Status */}
      {!providerStatus.validation.valid && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800 dark:text-red-200">
                  Configuration Issues
                </h3>
                <ul className="mt-2 text-sm text-red-700 dark:text-red-300 space-y-1">
                  {providerStatus.validation.errors.map((error, index: any) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {providerStatus.validation.warnings.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
                  Configuration Warnings
                </h3>
                <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  {providerStatus.validation.warnings.map((warning, index: any) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(providerStatus.providers).map(([name, provider]: any) => (
          <Card key={name} className={`${provider.isDefault ? 'ring-2 ring-blue-500' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  {getProviderIcon(name)}
                  <span className="ml-2 capitalize">{name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {provider.isDefault && (
                    <Badge variant="secondary">Default</Badge>
                  )}
                  <Badge variant={getStatusColor(provider.configured, provider.healthy) as any}>
                    {getStatusText(provider.configured, provider.healthy)}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                {/* Provider Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Version:</span>
                    <span className="ml-2 font-medium">{provider.version}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Health:</span>
                    <span className="ml-2 font-medium">
                      {provider.healthy ? (
                        <span className="text-green-600">Healthy</span>
                      ) : (
                        <span className="text-red-600">Unhealthy</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Configuration Details */}
                {providerStatus.environment.providers[name] && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Configuration
                    </h4>
                    
                    {name === 'stripe' && (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Publishable Key:</span>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono">
                              {maskSecret(
                                providerStatus.environment.providers.stripe.publishableKey,
                                showSecrets[`${name}-publishable`]
                              )}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSecretVisibility(`${name}-publishable`)}
                            >
                              {showSecrets[`${name}-publishable`] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Webhook Secret:</span>
                          <span className={`text-xs ${
                            providerStatus.environment.providers.stripe.webhookSecret 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            {providerStatus.environment.providers.stripe.webhookSecret 
                              ? 'Configured' 
                              : 'Not Set'
                            }
                          </span>
                        </div>
                      </div>
                    )}

                    {name === 'paypal' && (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Client ID:</span>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono">
                              {maskSecret(
                                providerStatus.environment.providers.paypal.clientId,
                                showSecrets[`${name}-client`]
                              )}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSecretVisibility(`${name}-client`)}
                            >
                              {showSecrets[`${name}-client`] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Environment:</span>
                          <Badge variant={providerStatus.environment.providers.paypal.sandbox ? 'warning' : 'success'}>
                            {providerStatus.environment.providers.paypal.sandbox ? 'Sandbox' : 'Production'}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center space-x-2 pt-4 border-t">
                  {!provider.isDefault && provider.configured && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDefaultMutation.mutate(name)}
                      disabled={setDefaultMutation.isPending}
                    >
                      Set as Default
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(
                      name === 'stripe' 
                        ? 'https://dashboard.stripe.com' 
                        : 'https://developer.paypal.com',
                      '_blank'
                    )}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recommendations */}
      {providerStatus.recommendations.issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {providerStatus.recommendations.recommended && (
                <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm text-green-800">
                    Recommended provider: <strong>{providerStatus.recommendations.recommended}</strong>
                  </span>
                </div>
              )}
              
              {providerStatus.recommendations.issues.map((issue, index: any) => (
                <div key={index} className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mr-2" />
                  <span className="text-sm text-yellow-800">{issue}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Environment Info */}
      <Card>
        <CardHeader>
          <CardTitle>Environment Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Environment:</span>
              <span className="ml-2 font-medium capitalize">
                {providerStatus.environment.environment}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Default Provider:</span>
              <span className="ml-2 font-medium">
                {providerStatus.environment.defaultProvider || 'None'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Available Providers:</span>
              <span className="ml-2 font-medium">
                {providerStatus.recommendations.available.length}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default PaymentProviderConfig