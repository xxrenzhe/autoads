'use client'
import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Coins,
  Settings,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Calculator,
  TrendingUp,
  AlertTriangle
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { http } from '@/shared/http/client'

export interface TokenConfig {
  id: string
  feature: string
  costPerToken: number
  minimumTokens: number
  maximumTokens: number
  description: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface TokenConfigManagerProps {
  className?: string
}

export function TokenConfigManager({ className }: TokenConfigManagerProps) {
  const [editingConfig, setEditingConfig] = useState<TokenConfig | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    feature: '',
    costPerToken: 0,
    minimumTokens: 1,
    maximumTokens: 1000,
    description: ''
  })
  const queryClient = useQueryClient()

  const {
    data: tokenConfigs,
    isLoading,
    error
  } = useQuery({
    queryKey: ['token-configs'],
    queryFn: async (): Promise<TokenConfig[]> => {
      const result = await http.get<{ data: TokenConfig[] }>('/admin/token-config')
      return (result as any).data || []
    },
    staleTime: 5 * 60 * 1000,
  })

  const createConfigMutation = useMutation({
    mutationFn: async (configData: Partial<TokenConfig>) => {
      return http.post('/admin/token-config', configData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-configs'] })
      setShowCreateForm(false)
      resetForm()
      toast.success('配置创建成功')
    },
    onError: (err: any) => toast.error(err?.message || '配置创建失败')
  })

  const updateConfigMutation = useMutation({
    mutationFn: async ({ id, ...configData }: Partial<TokenConfig> & { id: string }) => {
      return http.put(`/admin/token-config/${id}`, configData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-configs'] })
      setEditingConfig(null)
      resetForm()
      toast.success('配置已更新')
    },
    onError: (err: any) => toast.error(err?.message || '更新配置失败')
  })

  const deleteConfigMutation = useMutation({
    mutationFn: async (configId: string) => {
      return http.delete(`/admin/token-config/${configId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-configs'] })
      toast.success('配置已删除')
    },
    onError: (err: any) => toast.error(err?.message || '删除配置失败')
  })

  const toggleConfigMutation = useMutation({
    mutationFn: async (configId: string) => {
      return http.post(`/admin/token-config/${configId}/toggle`, undefined)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-configs'] })
      toast.success('配置状态已切换')
    },
    onError: (err: any) => toast.error(err?.message || '切换状态失败')
  })

  const resetForm = () => {
    setFormData({
      feature: '',
      costPerToken: 0,
      minimumTokens: 1,
      maximumTokens: 1000,
      description: ''
    })
  }

  const handleEdit = (config: TokenConfig) => {
    setEditingConfig(config)
    setFormData({
      feature: config.feature,
      costPerToken: config.costPerToken,
      minimumTokens: config.minimumTokens,
      maximumTokens: config.maximumTokens,
      description: config.description
    })
    setShowCreateForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingConfig) {
      updateConfigMutation.mutate({
        id: editingConfig.id,
        ...formData
      })
    } else {
      createConfigMutation.mutate(formData)
    }
  }

  const handleDelete = (configId: string) => {
    if (window.confirm('Are you sure you want to delete this token configuration?')) {
      deleteConfigMutation.mutate(configId)
    }
  }

  const calculateEstimatedCost = (tokens: number, costPerToken: number) => {
    return (tokens * costPerToken).toFixed(4)
  }

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Token Configuration
          </h2>
          <div className="animate-pulse h-8 w-24 bg-gray-300 rounded"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index: any) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="h-6 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-300 rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Token Configuration Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Configure token costs and limits for different features
          </p>
        </div>
        
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Configuration
        </Button>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingConfig ? 'Edit Token Configuration' : 'Create Token Configuration'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Feature Name
                  </label>
                  <Input
                    value={formData.feature}
                    onChange={(e) => setFormData({ ...formData, feature: e.target.value })}
                    placeholder="e.g., SiteRank API, Batch URL Check"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cost Per Token
                  </label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={formData.costPerToken}
                    onChange={(e) => setFormData({ ...formData, costPerToken: parseFloat(e.target.value) || 0 })}
                    placeholder="0.0010"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Minimum Tokens
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.minimumTokens}
                    onChange={(e) => setFormData({ ...formData, minimumTokens: parseInt(e.target.value) || 1 })}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Maximum Tokens
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.maximumTokens}
                    onChange={(e) => setFormData({ ...formData, maximumTokens: parseInt(e.target.value) || 1000 })}
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this feature"
                />
              </div>

              {/* Cost Calculator */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Cost Calculator
                </h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Min Cost:</span>
                    <span className="ml-2 font-medium">
                      ${calculateEstimatedCost(formData.minimumTokens, formData.costPerToken)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Max Cost:</span>
                    <span className="ml-2 font-medium">
                      ${calculateEstimatedCost(formData.maximumTokens, formData.costPerToken)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Avg Cost:</span>
                    <span className="ml-2 font-medium">
                      ${calculateEstimatedCost((formData.minimumTokens + formData.maximumTokens) / 2, formData.costPerToken)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button
                  type="submit"
                  disabled={createConfigMutation.isPending || updateConfigMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingConfig ? 'Update' : 'Create'}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false)
                    setEditingConfig(null)
                    resetForm()
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Token Configurations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tokenConfigs && tokenConfigs.length > 0 ? (
          tokenConfigs.map((config: TokenConfig) => (
            <Card key={config.id} className={`${!config.isActive ? 'opacity-60' : ''}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Coins className="h-5 w-5 mr-2 text-yellow-500" />
                    <span className="truncate">{config.feature}</span>
                  </div>
                  <Badge variant={config.isActive ? 'success' : 'secondary'}>
                    {config.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {/* Cost Information */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Cost/Token:</span>
                        <span className="ml-1 font-medium">${config.costPerToken.toFixed(4)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Min Tokens:</span>
                        <span className="ml-1 font-medium">{config.minimumTokens}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Max Tokens:</span>
                        <span className="ml-1 font-medium">{config.maximumTokens}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Range:</span>
                        <span className="ml-1 font-medium">
                          ${calculateEstimatedCost(config.minimumTokens, config.costPerToken)} - 
                          ${calculateEstimatedCost(config.maximumTokens, config.costPerToken)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {config.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {config.description}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(config)}
                      className="flex-1"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleConfigMutation.mutate(config.id)}
                      disabled={toggleConfigMutation.isPending}
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(config.id)}
                      disabled={deleteConfigMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Last Updated */}
                  <div className="text-xs text-gray-500 pt-2 border-t">
                    Updated {new Date(config.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full">
            <Card>
              <CardContent className="p-8 text-center">
                <Coins className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Token Configurations
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Create your first token configuration to get started.
                </p>
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Configuration
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Summary Statistics */}
      {tokenConfigs && tokenConfigs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Settings className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Configs
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {tokenConfigs.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Active Configs
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {tokenConfigs.filter((c: any) => c.isActive).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Calculator className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Avg Cost/Token
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${(tokenConfigs.reduce((sum, c: any) => sum + c.costPerToken, 0) / tokenConfigs.length).toFixed(4)}
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
                    Inactive Configs
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {tokenConfigs.filter((c: any) => !c.isActive).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default TokenConfigManager
