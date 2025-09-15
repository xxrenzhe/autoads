'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Badge } from '../ui/badge'
import { Alert, AlertDescription } from '../ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Separator } from '../ui/separator'
import { 
  Calculator, 
  Save, 
  RefreshCw, 
  TrendingUp, 
  DollarSign,
  Settings,
  AlertTriangle,
  CheckCircle,
  History,
  Clock,
  User,
  Eye,
  EyeOff
} from 'lucide-react'
import { toast } from 'sonner'

interface TokenConfig {
  siterank: {
    costPerDomain: number
    batchMultiplier: number
    description?: string
  }
  batchopen: {
    costPerUrl: number
    batchMultiplier: number
    description?: string
  }
  adscenter: {
    costPerLinkChange: number
    batchMultiplier: number
    description?: string
  }
}

interface CalculationResult {
  feature: string
  itemCount: number
  isBatch: boolean
  tokenCost: number
  baseCostPerItem: number
  batchMultiplier: number
  calculation: {
    baseCost: number
    afterBatchDiscount: number
    savings: number
  }
}

interface ConfigHistoryRecord {
  id: string
  userId: string
  user: {
    name: string | null
    email: string
  }
  action: string
  changes: any
  reason: string | null
  createdAt: string
}

interface ValidationError {
  field: string
  message: string
}

export default function TokenConfigManager() {
  const [config, setConfig] = useState<TokenConfig | null>(null)
  const [originalConfig, setOriginalConfig] = useState<TokenConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null)
  const [reason, setReason] = useState('')
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [configHistory, setConfigHistory] = useState<ConfigHistoryRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  
  // Calculator state
  const [calcFeature, setCalcFeature] = useState<'siterank' | 'batchopen' | 'adscenter'>('siterank')
  const [calcItemCount, setCalcItemCount] = useState(1)
  const [calcIsBatch, setCalcIsBatch] = useState(false)

  useEffect(() => {
    fetchConfig()
  }, [])

  useEffect(() => {
    if (config && originalConfig) {
      const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig)
      setHasUnsavedChanges(hasChanges)
    }
  }, [config, originalConfig])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/ops/api/v1/console/token-config')
      const data = await response.json()
      
      if (data.success) {
        setConfig(data.data)
        setOriginalConfig(JSON.parse(JSON.stringify(data.data)))
        setValidationErrors([])
      } else {
        toast.error('Failed to fetch token configuration')
      }
    } catch (error) {
      console.error('Error fetching config:', error)
      toast.error('Failed to fetch token configuration')
    } finally {
      setLoading(false)
    }
  }

  const fetchConfigHistory = async () => {
    try {
      setHistoryLoading(true)
      const response = await fetch('/ops/api/v1/console/tokens/history?limit=20')
      const data = await response.json()
      
      if (data.success) {
        setConfigHistory(data.data.records)
      } else {
        toast.error('Failed to fetch configuration history')
      }
    } catch (error) {
      console.error('Error fetching history:', error)
      toast.error('Failed to fetch configuration history')
    } finally {
      setHistoryLoading(false)
    }
  }

  const validateConfig = (configToValidate: TokenConfig): ValidationError[] => {
    const errors: ValidationError[] = []

    // Validate siterank
    if (configToValidate.siterank.costPerDomain < 0) {
      errors.push({ field: 'siterank.costPerDomain', message: 'Cost per domain must be non-negative' })
    }
    if (configToValidate.siterank.costPerDomain > 100) {
      errors.push({ field: 'siterank.costPerDomain', message: 'Cost per domain seems too high (>100)' })
    }
    if (configToValidate.siterank.batchMultiplier < 0 || configToValidate.siterank.batchMultiplier > 1) {
      errors.push({ field: 'siterank.batchMultiplier', message: 'Batch multiplier must be between 0 and 1' })
    }

    // Validate batchopen
    if (configToValidate.batchopen.costPerUrl < 0) {
      errors.push({ field: 'batchopen.costPerUrl', message: 'Cost per URL must be non-negative' })
    }
    if (configToValidate.batchopen.costPerUrl > 100) {
      errors.push({ field: 'batchopen.costPerUrl', message: 'Cost per URL seems too high (>100)' })
    }
    if (configToValidate.batchopen.batchMultiplier < 0 || configToValidate.batchopen.batchMultiplier > 1) {
      errors.push({ field: 'batchopen.batchMultiplier', message: 'Batch multiplier must be between 0 and 1' })
    }

    // Validate adscenter
    if (configToValidate.adscenter.costPerLinkChange < 0) {
      errors.push({ field: 'adscenter.costPerLinkChange', message: 'Cost per link change must be non-negative' })
    }
    if (configToValidate.adscenter.costPerLinkChange > 100) {
      errors.push({ field: 'adscenter.costPerLinkChange', message: 'Cost per link change seems too high (>100)' })
    }
    if (configToValidate.adscenter.batchMultiplier < 0 || configToValidate.adscenter.batchMultiplier > 1) {
      errors.push({ field: 'adscenter.batchMultiplier', message: 'Batch multiplier must be between 0 and 1' })
    }

    return errors
  }

  const updateConfig = async () => {
    if (!config) return

    // Validate configuration
    const errors = validateConfig(config)
    setValidationErrors(errors)
    
    if (errors.length > 0) {
      toast.error('Please fix validation errors before saving')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/ops/api/v1/console/token-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...config,
          reason: reason || 'Token configuration update'
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setConfig(data.data)
        setOriginalConfig(JSON.parse(JSON.stringify(data.data)))
        setReason('')
        setHasUnsavedChanges(false)
        toast.success('Token configuration updated successfully')
        
        // Refresh history if it's being shown
        if (showHistory) {
          fetchConfigHistory()
        }
      } else {
        toast.error(data.error || 'Failed to update configuration')
      }
    } catch (error) {
      console.error('Error updating config:', error)
      toast.error('Failed to update configuration')
    } finally {
      setSaving(false)
    }
  }

  const resetConfig = () => {
    if (originalConfig) {
      setConfig(JSON.parse(JSON.stringify(originalConfig)))
      setValidationErrors([])
      setHasUnsavedChanges(false)
      toast.info('Configuration reset to last saved state')
    }
  }

  const calculateCost = async () => {
    try {
      setCalculating(true)
      const response = await fetch('/ops/api/v1/console/tokens/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          feature: calcFeature,
          itemCount: calcItemCount,
          isBatch: calcIsBatch
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setCalculationResult(data.data)
      } else {
        toast.error(data.error || 'Failed to calculate cost')
      }
    } catch (error) {
      console.error('Error calculating cost:', error)
      toast.error('Failed to calculate cost')
    } finally {
      setCalculating(false)
    }
  }

  const updateFeatureConfig = (
    feature: keyof TokenConfig,
    field: string,
    value: number | string
  ) => {
    if (!config) return

    const updatedConfig = {
      ...config,
      [feature]: {
        ...config[feature],
        [field]: value
      }
    }
    
    setConfig(updatedConfig)
    
    // Real-time validation
    const errors = validateConfig(updatedConfig)
    setValidationErrors(errors)
  }

  const getFieldError = (fieldPath: string): string | undefined => {
    return validationErrors.find((error: any) => error.field === fieldPath)?.message
  }

  const hasFieldError = (fieldPath: string): boolean => {
    return validationErrors.some(error => error.field === fieldPath)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!config) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load token configuration. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Token Configuration</h1>
            {hasUnsavedChanges && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                <Clock className="h-3 w-3 mr-1" />
                Unsaved Changes
              </Badge>
            )}
            {validationErrors.length > 0 && (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {validationErrors.length} Error{validationErrors.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Manage token costs and pricing for all features with live validation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setShowHistory(!showHistory)
              if (!showHistory) fetchConfigHistory()
            }}
          >
            {showHistory ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showHistory ? 'Hide' : 'Show'} History
          </Button>
          <Button
            variant="outline"
            onClick={fetchConfig}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {hasUnsavedChanges && (
            <Button
              variant="outline"
              onClick={resetConfig}
            >
              Reset
            </Button>
          )}
          <Button
            onClick={updateConfig}
            disabled={saving || validationErrors.length > 0}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Please fix the following errors:</p>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((error, index: number) => (
                  <li key={index} className="text-sm">
                    {error.field}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Configuration History */}
      {showHistory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Configuration History
            </CardTitle>
            <CardDescription>
              Recent changes to token configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex items-center justify-center p-4">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : configHistory.length > 0 ? (
              <div className="space-y-3">
                {configHistory.map((record: any) => (
                  <div key={record.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">
                          {record.user.name || record.user.email}
                        </span>
                        <Badge variant="outline">{record.action}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(record.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {record.reason && (
                      <p className="text-sm text-muted-foreground mb-2">
                        Reason: {record.reason}
                      </p>
                    )}
                    <details className="text-sm">
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                        View Changes
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto">
                        {JSON.stringify(record.changes, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No configuration history found
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="configuration" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configuration">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="calculator">
            <Calculator className="h-4 w-4 mr-2" />
            Cost Calculator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-6">
          {/* Reason for changes */}
          <Card>
            <CardHeader>
              <CardTitle>Change Reason</CardTitle>
              <CardDescription>
                Provide a reason for the configuration changes (optional)
              </CardDescription>
            </CardHeader>
            <CardContent>
                <Textarea
                  placeholder="Describe the reason for these changes..."
                  value={reason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                  rows={3}
                />
            </CardContent>
          </Card>

          {/* SiteRank Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                SiteRank Configuration
              </CardTitle>
              <CardDescription>
                Configure token costs for website ranking analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="siterank-cost">Cost per Domain</Label>
                  <Input
                    id="siterank-cost"
                    type="number"
                    min="0"
                    step="0.1"
                    value={config.siterank.costPerDomain}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFeatureConfig('siterank', 'costPerDomain', parseFloat(e.target.value) || 0)}
                    className={hasFieldError('siterank.costPerDomain') ? 'border-red-500' : ''}
                  />
                  {hasFieldError('siterank.costPerDomain') && (
                    <p className="text-sm text-red-600">{getFieldError('siterank.costPerDomain')}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siterank-batch">Batch Multiplier</Label>
                  <Input
                    id="siterank-batch"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.siterank.batchMultiplier}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFeatureConfig('siterank', 'batchMultiplier', parseFloat(e.target.value) || 0)}
                    className={hasFieldError('siterank.batchMultiplier') ? 'border-red-500' : ''}
                  />
                  {hasFieldError('siterank.batchMultiplier') && (
                    <p className="text-sm text-red-600">{getFieldError('siterank.batchMultiplier')}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="siterank-desc">Description</Label>
                <Input
                  id="siterank-desc"
                  value={config.siterank.description || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFeatureConfig('siterank', 'description', e.target.value)}
                  placeholder="Description of this feature's token usage"
                />
              </div>
            </CardContent>
          </Card>

          {/* BatchOpen Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                BatchOpen Configuration
              </CardTitle>
              <CardDescription>
                Configure token costs for batch URL opening
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batchopen-cost">Cost per URL</Label>
                  <Input
                    id="batchopen-cost"
                    type="number"
                    min="0"
                    step="0.1"
                    value={config.batchopen.costPerUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFeatureConfig('batchopen', 'costPerUrl', parseFloat(e.target.value) || 0)}
                    className={hasFieldError('batchopen.costPerUrl') ? 'border-red-500' : ''}
                  />
                  {hasFieldError('batchopen.costPerUrl') && (
                    <p className="text-sm text-red-600">{getFieldError('batchopen.costPerUrl')}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batchopen-batch">Batch Multiplier</Label>
                  <Input
                    id="batchopen-batch"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.batchopen.batchMultiplier}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFeatureConfig('batchopen', 'batchMultiplier', parseFloat(e.target.value) || 0)}
                    className={hasFieldError('batchopen.batchMultiplier') ? 'border-red-500' : ''}
                  />
                  {hasFieldError('batchopen.batchMultiplier') && (
                    <p className="text-sm text-red-600">{getFieldError('batchopen.batchMultiplier')}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="batchopen-desc">Description</Label>
                <Input
                  id="batchopen-desc"
                  value={config.batchopen.description || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFeatureConfig('batchopen', 'description', e.target.value)}
                  placeholder="Description of this feature's token usage"
                />
              </div>
            </CardContent>
          </Card>

          {/* AdsCenter Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                AdsCenter Configuration
              </CardTitle>
              <CardDescription>
                Configure token costs for Google Ads link changes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adscenter-cost">Cost per Link Change</Label>
                  <Input
                    id="adscenter-cost"
                    type="number"
                    min="0"
                    step="0.1"
                    value={config.adscenter.costPerLinkChange}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFeatureConfig('adscenter', 'costPerLinkChange', parseFloat(e.target.value) || 0)}
                    className={hasFieldError('adscenter.costPerLinkChange') ? 'border-red-500' : ''}
                  />
                  {hasFieldError('adscenter.costPerLinkChange') && (
                    <p className="text-sm text-red-600">{getFieldError('adscenter.costPerLinkChange')}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adscenter-batch">Batch Multiplier</Label>
                  <Input
                    id="adscenter-batch"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.adscenter.batchMultiplier}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFeatureConfig('adscenter', 'batchMultiplier', parseFloat(e.target.value) || 0)}
                    className={hasFieldError('adscenter.batchMultiplier') ? 'border-red-500' : ''}
                  />
                  {hasFieldError('adscenter.batchMultiplier') && (
                    <p className="text-sm text-red-600">{getFieldError('adscenter.batchMultiplier')}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adscenter-desc">Description</Label>
                <Input
                  id="adscenter-desc"
                  value={config.adscenter.description || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFeatureConfig('adscenter', 'description', e.target.value)}
                  placeholder="Description of this feature's token usage"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Token Cost Calculator</CardTitle>
              <CardDescription>
                Calculate token costs for different operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="calc-feature">Feature</Label>
                  <select
                    id="calc-feature"
                    className="w-full p-2 border rounded-md"
                    value={calcFeature}
                    onChange={(e) => setCalcFeature(e.target.value as any)}
                  >
                    <option value="siterank">SiteRank</option>
                    <option value="batchopen">BatchOpen</option>
                    <option value="adscenter">AdsCenter</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calc-count">Item Count</Label>
                  <Input
                    id="calc-count"
                    type="number"
                    min="1"
                    value={calcItemCount}
                    onChange={(e) => setCalcItemCount(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calc-batch">Is Batch Operation</Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      id="calc-batch"
                      type="checkbox"
                      checked={calcIsBatch}
                      onChange={(e) => setCalcIsBatch(e.target.checked)}
                    />
                    <Label htmlFor="calc-batch">Batch operation</Label>
                  </div>
                </div>
              </div>
              
              <Button
                onClick={calculateCost}
                disabled={calculating}
                className="w-full"
              >
                <Calculator className="h-4 w-4 mr-2" />
                {calculating ? 'Calculating...' : 'Calculate Cost'}
              </Button>

              {calculationResult && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-3">Calculation Result</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Feature</p>
                      <p className="font-medium capitalize">{calculationResult.feature}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Item Count</p>
                      <p className="font-medium">{calculationResult.itemCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Base Cost</p>
                      <p className="font-medium">{calculationResult.calculation.baseCost} tokens</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Final Cost</p>
                      <p className="font-medium text-lg">{calculationResult.tokenCost} tokens</p>
                    </div>
                  </div>
                  
                  {calculationResult.isBatch && calculationResult.calculation.savings > 0 && (
                    <div className="mt-3 p-3 bg-green-50 rounded-md">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          Batch Discount Applied
                        </span>
                      </div>
                      <p className="text-sm text-green-700 mt-1">
                        Saved {calculationResult.calculation.savings} tokens with batch multiplier
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
