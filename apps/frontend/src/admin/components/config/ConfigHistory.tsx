'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Badge } from '../ui/badge'
import { 
  Clock, 
  User, 
  Eye,
  RotateCcw,
  GitBranch,
  ArrowRight,
  Calendar,
  Filter,
  Search
} from 'lucide-react'
import { useConfigManagement } from '../../hooks/useConfigManagement'

export interface ConfigHistory {
  id: string
  configId: string
  oldValue: any
  newValue: any
  changedBy: string
  changedAt: string
  reason?: string
  version: number
}

export interface ConfigHistoryProps {
  configId: string
  configKey?: string
  onRestore?: (historyId: string) => Promise<void>
  maxItems?: number
}

export function ConfigHistory({
  configId,
  configKey,
  onRestore,
  maxItems = 50
}: ConfigHistoryProps) {
  const { getConfigHistory, isLoading } = useConfigManagement()
  const [selectedHistory, setSelectedHistory] = useState<ConfigHistory | null>(null)
  const [showDiff, setShowDiff] = useState<string | null>(null)

  const history = getConfigHistory(configId).slice(0, maxItems)

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return 'null'
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60)
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours)
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`
    } else if (diffInHours < 24 * 7) {
      const days = Math.floor(diffInHours / 24)
      return `${days} day${days !== 1 ? 's' : ''} ago`
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  const handleRestore = async (historyItem: ConfigHistory) => {
    if (window.confirm('Are you sure you want to restore this configuration version?')) {
      try {
        await onRestore?.(historyItem.id)
      } catch (error) {
        console.error('Error restoring configuration:', error)
      }
    }
  }

  const toggleDiff = (historyId: string) => {
    setShowDiff(showDiff === historyId ? null : historyId)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading configuration history...</p>
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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Configuration History
          </h2>
          {configKey && (
            <p className="text-gray-600 dark:text-gray-400">
              Change history for: <code className="bg-gray-100 px-2 py-1 rounded text-sm">{configKey}</code>
            </p>
          )}
        </div>
        <Badge variant="outline">
          {history.length} change{history.length !== 1 ? 's' : ''}
        </Badge>
      </div>  
    {/* History Timeline */}
      {history.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No history available
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              This configuration has not been modified yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {history.map((item, index) => (
            <Card key={item.id} className="relative">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    {/* Timeline indicator */}
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${
                        index === 0 ? 'bg-blue-600' : 'bg-gray-300'
                      }`} />
                      {index < history.length - 1 && (
                        <div className="w-0.5 h-16 bg-gray-200 mt-2" />
                      )}
                    </div>

                    {/* Change details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          v{item.version}
                        </Badge>
                        <div className="flex items-center text-sm text-gray-600">
                          <User className="h-4 w-4 mr-1" />
                          {item.changedBy}
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <Clock className="h-4 w-4 mr-1" />
                          {formatTimestamp(item.changedAt)}
                        </div>
                      </div>

                      {item.reason && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                          {item.reason}
                        </p>
                      )}

                      {/* Value change preview */}
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center mb-2">
                              <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded">
                                OLD VALUE
                              </span>
                            </div>
                            <pre className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 p-3 rounded border overflow-x-auto">
                              {formatValue(item.oldValue)}
                            </pre>
                          </div>
                          <div>
                            <div className="flex items-center mb-2">
                              <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded">
                                NEW VALUE
                              </span>
                            </div>
                            <pre className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 p-3 rounded border overflow-x-auto">
                              {formatValue(item.newValue)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleDiff(item.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {onRestore && index > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestore(item)}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Detailed diff view */}
                {showDiff === item.id && (
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Detailed Changes
                    </h4>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                          <div className="flex items-center mb-2">
                            <span className="text-sm font-medium text-red-800 dark:text-red-200">
                              Removed
                            </span>
                          </div>
                          <pre className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">
                            {formatValue(item.oldValue)}
                          </pre>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                          <div className="flex items-center mb-2">
                            <span className="text-sm font-medium text-green-800 dark:text-green-200">
                              Added
                            </span>
                          </div>
                          <pre className="text-sm text-green-700 dark:text-green-300 whitespace-pre-wrap">
                            {formatValue(item.newValue)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Load more */}
      {history.length >= maxItems && (
        <div className="text-center">
          <Button variant="outline">
            Load More History
          </Button>
        </div>
      )}
    </div>
  )
}

export default ConfigHistory