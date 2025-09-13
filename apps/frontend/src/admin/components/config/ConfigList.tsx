'use client'
import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Badge } from '../ui/badge'
import { 
  Settings, 
  Search, 
  Filter,
  Plus, 
  Edit, 
  Trash2,
  Eye,
  Copy,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  Check,
  Clock,
  Database,
  Globe,
  Shield,
  Mail,
  CreditCard,
  Smartphone
} from 'lucide-react'
import { useConfigManagement } from '../../hooks/useConfigManagement'

export interface ConfigItem {
  id: string
  key: string
  value: any
  type: 'string' | 'number' | 'boolean' | 'json' | 'array'
  category: string
  description: string
  isSecret: boolean
  isRequired: boolean
  defaultValue?: any
  validation?: {
    min?: number
    max?: number
    pattern?: string
    enum?: string[]
  }
  environment: 'all' | 'development' | 'staging' | 'production'
  lastModified: string
  modifiedBy: string
  version: number
}

export interface ConfigListProps {
  onConfigSelect?: (config: ConfigItem) => void
  onConfigEdit?: (config: ConfigItem) => void
  onConfigDelete?: (configId: string) => void
  onConfigCreate?: () => void
}

export function ConfigList({
  onConfigSelect,
  onConfigEdit,
  onConfigDelete,
  onConfigCreate
}: ConfigListProps) {
  const {
    configs,
    categories,
    isLoading,
    error,
    refreshConfigs,
    exportConfigs,
    importConfigs,
    deleteConfig,
    duplicateConfig
  } = useConfigManagement()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [showSecrets, setShowSecrets] = useState(false)
  const [selectedConfigs, setSelectedConfigs] = useState<Set<string>>(new Set())

  // Filter configs based on search and filters
  const filteredConfigs = useMemo(() => {
    return configs.filter((config: any) => {
      const matchesSearch = searchTerm === '' || 
        config.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        config.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(config.value).toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategory = selectedCategory === 'all' || config.category === selectedCategory
      const matchesEnvironment = selectedEnvironment === 'all' || 
        config.environment === 'all' || config.environment === selectedEnvironment
      const matchesType = selectedType === 'all' || config.type === selectedType
      const matchesSecretFilter = showSecrets || !config.isSecret
      
      return matchesSearch && matchesCategory && matchesEnvironment && matchesType && matchesSecretFilter
    })
  }, [configs, searchTerm, selectedCategory, selectedEnvironment, selectedType, showSecrets])

  const handleConfigSelect = (configId: string) => {
    const newSelected = new Set(selectedConfigs)
    if (newSelected.has(configId)) {
      newSelected.delete(configId)
    } else {
      newSelected.add(configId)
    }
    setSelectedConfigs(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedConfigs.size === filteredConfigs.length) {
      setSelectedConfigs(new Set())
    } else {
      setSelectedConfigs(new Set(filteredConfigs?.filter(Boolean)?.map((config: any) => config.id)))
    }
  }

  const handleDeleteConfig = async (configId: string) => {
    if (window.confirm('Are you sure you want to delete this configuration? This action cannot be undone.')) {
      try {
        await deleteConfig(configId)
        onConfigDelete?.(configId)
      } catch (error) {
        console.error('Error deleting config:', error)
      }
    }
  }

  const handleDuplicateConfig = async (config: ConfigItem) => {
    try {
      await duplicateConfig(config.id, `${config.key}_copy`)
      refreshConfigs()
    } catch (error) {
      console.error('Error duplicating config:', error)
    }
  }

  const handleExportConfigs = async (format: 'json' | 'yaml' | 'env') => {
    try {
      await exportConfigs(format, Array.from(selectedConfigs))
    } catch (error) {
      console.error('Error exporting configs:', error)
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'database': return Database
      case 'api': return Globe
      case 'security': return Shield
      case 'email': return Mail
      case 'payment': return CreditCard
      case 'mobile': return Smartphone
      case 'system': return Settings
      default: return Settings
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string': return 'blue'
      case 'number': return 'green'
      case 'boolean': return 'purple'
      case 'json': return 'orange'
      case 'array': return 'pink'
      default: return 'gray'
    }
  }

  const formatValue = (config: ConfigItem) => {
    if (config.isSecret && !showSecrets) {
      return '••••••••'
    }
    
    if (config.type === 'json' || config.type === 'array') {
      return JSON.stringify(config.value)
    }
    
    return String(config.value)
  }

  const environments = ['all', 'development', 'staging', 'production']
  const types = ['all', 'string', 'number', 'boolean', 'json', 'array']

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Error loading configurations: {error}</p>
            <Button onClick={refreshConfigs} className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Configuration Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage application settings and environment variables
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleExportConfigs('json')}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={refreshConfigs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={onConfigCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Config
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search configurations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm((e.target as any).value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory((e.target as any).value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {categories?.filter(Boolean)?.map((category: any) => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
              
              <select
                value={selectedEnvironment}
                onChange={(e) => setSelectedEnvironment((e.target as any).value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {environments?.filter(Boolean)?.map((env: any) => (
                  <option key={env} value={env}>
                    {env.charAt(0).toUpperCase() + env.slice(1)}
                  </option>
                ))}
              </select>
              
              <select
                value={selectedType}
                onChange={(e) => setSelectedType((e.target as any).value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {types?.filter(Boolean)?.map((type: any) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
              
              <label className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md">
                <input
                  type="checkbox"
                  checked={showSecrets}
                  onChange={(e) => setShowSecrets((e.target as any).checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Show Secrets</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedConfigs.size > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedConfigs.size} configuration{selectedConfigs.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportConfigs('json')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    selectedConfigs.forEach((configId: any) => {
                      const config = configs.find((c: any) => c.id === configId)
                      if (config) handleDuplicateConfig(config)
                    })
                    setSelectedConfigs(new Set())
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete ${selectedConfigs.size} configuration(s)?`)) {
                      selectedConfigs.forEach((configId: any) => handleDeleteConfig(configId))
                      setSelectedConfigs(new Set())
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configurations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Configurations ({filteredConfigs.length})
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedConfigs.size === filteredConfigs.length && filteredConfigs.length > 0}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading configurations...</p>
            </div>
          ) : filteredConfigs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No configurations found</p>
              {searchTerm && (
                <p className="text-sm mt-2">Try adjusting your search criteria</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Key
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Environment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Modified
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredConfigs.map((config: any) => {
                    const CategoryIcon = getCategoryIcon(config.category)
                    
                    return (
                      <tr 
                        key={config.id} 
                        className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => onConfigSelect?.(config)}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedConfigs.has(config.id)}
                            onChange={(e) => {
                              e.stopPropagation()
                              handleConfigSelect(config.id)
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <CategoryIcon className="h-5 w-5 text-gray-400" />
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {config.key}
                              </div>
                              <div className="text-sm text-gray-500 truncate max-w-xs">
                                {config.description}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-white font-mono max-w-xs truncate">
                            {formatValue(config)}
                          </div>
                          {config.isSecret && (
                            <div className="flex items-center mt-1">
                              <Shield className="h-3 w-3 text-red-500 mr-1" />
                              <span className="text-xs text-red-600">Secret</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={getTypeColor(config.type) as any}>
                            {config.type}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline">
                            {config.category}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge 
                            variant={config.environment === 'production' ? 'destructive' : 
                                   config.environment === 'staging' ? 'warning' : 'secondary'}
                          >
                            {config.environment}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div>{new Date(config.lastModified).toLocaleDateString()}</div>
                          <div className="text-xs">by {config.modifiedBy}</div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                onConfigSelect?.(config)
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                onConfigEdit?.(config)
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDuplicateConfig(config)
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteConfig(config.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {configs.length}
                </div>
                <div className="text-sm text-gray-600">Total Configs</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-red-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {configs.filter((c: any) => c.isSecret).length}
                </div>
                <div className="text-sm text-gray-600">Secret Configs</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {configs.filter((c: any) => c.isRequired).length}
                </div>
                <div className="text-sm text-gray-600">Required Configs</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {categories.length}
                </div>
                <div className="text-sm text-gray-600">Categories</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ConfigList
