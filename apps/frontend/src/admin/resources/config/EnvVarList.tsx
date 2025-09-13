'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Badge } from '../../components/ui/badge'
import { 
  Settings, 
  Search, 
  Plus, 
  Edit, 
  Trash2,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Shield,
  Clock,
  User,
  Filter
} from 'lucide-react'
import { useEnvVars, useDeleteEnvVar, getEnvVarCategory, getEnvVarIcon, formatEnvVarValue } from '../../hooks/useEnvVarManagement'
import { EnvironmentVariable } from '../../hooks/useEnvVarManagement'

interface EnvVarListProps {
  onEdit?: (envVar: EnvironmentVariable) => void
  onCreate?: () => void
}

export function EnvVarList({ onEdit, onCreate }: .*Props) {
  const { data: envVars, isLoading, error, refetch } = useEnvVars()
  const deleteEnvVar = useDeleteEnvVar()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showSecrets, setShowSecrets] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Get unique categories
  const categories = useMemo(() => {
    if (!envVars) return []
    const cats = Array.from(new Set(envVars.map((ev: any) => getEnvVarCategory(ev.key))))
    return cats.sort()
  }, [envVars])

  // Filter environment variables
  const filteredEnvVars = useMemo(() => {
    if (!envVars) return []
    
    return envVars.filter((envVar: any) => {
      const matchesSearch = searchTerm === '' || 
        envVar.key.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategory = selectedCategory === 'all' || 
        getEnvVarCategory(envVar.key) === selectedCategory
      
      const matchesSecretFilter = showSecrets || !envVar.isSecret
      
      return matchesSearch && matchesCategory && matchesSecretFilter
    })
  }, [envVars, searchTerm, selectedCategory, showSecrets])

  const handleCopy = async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Failed to copy value:', error)
    }
  }

  const handleDelete = (envVar: EnvironmentVariable) => {
    if (window.confirm(`Are you sure you want to delete "${envVar.key}"?`)) => {
      deleteEnvVar.mutate(envVar.id)
    }
  }

  const toggleSecretVisibility = (id: string) => {
    // This would be handled by the parent component's state
    // For now, we'll use the global showSecrets state
    setShowSecrets(!showSecrets)
  }

  if (isLoading) => {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading environment variables...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) => {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-red-500">
            Error loading environment variables: {error.message}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Environment Variables
            <Badge variant="secondary">{filteredEnvVars.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {onCreate && (
              <Button onClick={onCreate} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Variable
              </Button>
            )}
          </div>
        </div>
        
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search environment variables..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map((category: any) => (
                <option key={category} value={category}>
                  {getEnvVarIcon(category)} {category}
                </option>
              ))}
            </select>
            
            <Button
              variant={showSecrets ? "default" : "outline"}
              size="sm"
              onClick={() => setShowSecrets(!showSecrets)}
            >
              <Shield className="h-4 w-4 mr-2" />
              Show Secrets
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {filteredEnvVars.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {envVars?.length === 0 ? (
              <>
                <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No environment variables found</p>
                {onCreate && (
                  <Button className="mt-4" onClick={onCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Variable
                  </Button>
                )}
              </>
            ) : (
              <p>No environment variables match your search criteria</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEnvVars.map((envVar: any) => {
              const category = getEnvVarCategory(envVar.key)
              const icon = getEnvVarIcon(category)
              
              return (
                <div
                  key={envVar.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{icon}</span>
                        <span className="font-medium text-sm font-mono">
                          {envVar.key}
                        </span>
                        {envVar.isSecret && (
                          <Badge variant="outline" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Secret
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {category}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                          {formatEnvVarValue(envVar.value, envVar.isSecret, showSecrets)}
                        </code>
                        <div className="flex items-center gap-1">
                          {envVar.isSecret && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleSecretVisibility(envVar.id)}
                            >
                              {showSecrets ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleCopy(envVar.value, envVar.id)}
                          >
                            <Copy className={`h-3 w-3 ${copiedId === envVar.id ? 'text-green-600' : ''}`} />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{envVar.creator?.name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(envVar.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      {onEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(envVar)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(envVar)}
                        disabled={deleteEnvVar.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}