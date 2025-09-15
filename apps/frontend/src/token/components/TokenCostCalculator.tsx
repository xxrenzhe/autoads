'use client'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Calculator,
  BarChart3,
  DollarSign,
  Zap
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

export interface TokenCostCalculatorProps {
  className?: string
}

export function TokenCostCalculator({ className }: TokenCostCalculatorProps) {
  const [selectedFeature, setSelectedFeature] = useState('')
  const [tokenAmount, setTokenAmount] = useState(100)
  const [calculationResults, setCalculationResults] = useState<any>(null)

  const {
    data: tokenConfigs,
    isLoading
  } = useQuery({
    queryKey: ['token-configs'],
    queryFn: async () => {
      const response = await fetch('/ops/api/v1/console/token-config')
      if (!response.ok) {
        throw new Error('Failed to fetch token configurations')
      }
      const result = await response.json()
      return result.data || []
    },
  })

  useEffect(() => {
    if (selectedFeature && tokenAmount && tokenConfigs) {
      const config = tokenConfigs.find((c: any) => c.id === selectedFeature)
      if (config) {
        const totalCost = tokenAmount * config.costPerToken
        const isWithinLimits = tokenAmount >= config.minimumTokens && tokenAmount <= config.maximumTokens
        
        setCalculationResults({
          feature: config.feature,
          tokenAmount,
          costPerToken: config.costPerToken,
          totalCost,
          isWithinLimits,
          minimumTokens: config.minimumTokens,
          maximumTokens: config.maximumTokens,
          minimumCost: config.minimumTokens * config.costPerToken,
          maximumCost: config.maximumTokens * config.costPerToken
        })
      }
    }
  }, [selectedFeature, tokenAmount, tokenConfigs])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(amount)
  }

  const getRecommendedTokens = (config: any) => {
    // Recommend tokens based on typical usage patterns
    const range = config.maximumTokens - config.minimumTokens
    return Math.round(config.minimumTokens + (range * 0.3)) // 30% into the range
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Token Cost Calculator
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Calculate costs for different features and token amounts
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calculator Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calculator className="h-5 w-5 mr-2" />
              Cost Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Feature
              </label>
              <select
                value={selectedFeature}
                onChange={(e) => setSelectedFeature((e.target as HTMLSelectElement).value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a feature...</option>
                {tokenConfigs?.filter((config: any) => config.isActive).map((config: any) => (
                  <option key={config.id} value={config.id}>
                    {config.feature} (${config.costPerToken.toFixed(4)}/token)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Tokens
              </label>
              <Input
                type="number"
                min="1"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(parseInt((e.target as HTMLInputElement).value) || 0)}
                placeholder="Enter token amount"
              />
            </div>

            {selectedFeature && tokenConfigs && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Quick Recommendations
                </h4>
                {(() => {
                  const config = tokenConfigs.find((c: any) => c.id === selectedFeature)
                  if (!config) return null
                  
                  const recommended = getRecommendedTokens(config)
                  return (
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTokenAmount(config.minimumTokens)}
                        className="mr-2"
                      >
                        Min ({config.minimumTokens})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTokenAmount(recommended)}
                        className="mr-2"
                      >
                        Recommended ({recommended})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTokenAmount(config.maximumTokens)}
                      >
                        Max ({config.maximumTokens})
                      </Button>
                    </div>
                  )
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calculation Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Calculation Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {calculationResults ? (
              <div className="space-y-4">
                {/* Main Result */}
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Cost</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(calculationResults.totalCost)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      for {calculationResults.tokenAmount.toLocaleString()} tokens
                    </p>
                  </div>
                </div>

                {/* Validation */}
                <div className={`p-3 rounded-lg ${
                  calculationResults.isWithinLimits 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center">
                    {calculationResults.isWithinLimits ? (
                      <Zap className="h-4 w-4 text-green-600 mr-2" />
                    ) : (
                      <Zap className="h-4 w-4 text-red-600 mr-2" />
                    )}
                    <span className={`text-sm font-medium ${
                      calculationResults.isWithinLimits ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {calculationResults.isWithinLimits 
                        ? 'Within allowed limits' 
                        : 'Outside allowed limits'
                      }
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Feature:</span>
                    <span className="font-medium">{calculationResults.feature}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Cost per token:</span>
                    <span className="font-medium">{formatCurrency(calculationResults.costPerToken)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Token range:</span>
                    <span className="font-medium">
                      {calculationResults.minimumTokens.toLocaleString()} - {calculationResults.maximumTokens.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Cost range:</span>
                    <span className="font-medium">
                      {formatCurrency(calculationResults.minimumCost)} - {formatCurrency(calculationResults.maximumCost)}
                    </span>
                  </div>
                </div>

                {/* Cost Breakdown */}
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    Cost Breakdown
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Base calculation:</span>
                      <span>{calculationResults.tokenAmount} × {formatCurrency(calculationResults.costPerToken)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium border-t pt-2">
                      <span>Total:</span>
                      <span>{formatCurrency(calculationResults.totalCost)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400">
                  Select a feature and enter token amount to calculate costs
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feature Comparison */}
      {tokenConfigs && tokenConfigs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Feature Cost Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Feature</th>
                    <th className="text-center py-2">Cost/Token</th>
                    <th className="text-center py-2">Min Tokens</th>
                    <th className="text-center py-2">Max Tokens</th>
                    <th className="text-center py-2">Min Cost</th>
                    <th className="text-center py-2">Max Cost</th>
                    <th className="text-center py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tokenConfigs.map((config: any) => (
                    <tr key={config.id} className="border-b">
                      <td className="py-2 font-medium">{config.feature}</td>
                      <td className="text-center py-2">{formatCurrency(config.costPerToken)}</td>
                      <td className="text-center py-2">{config.minimumTokens.toLocaleString()}</td>
                      <td className="text-center py-2">{config.maximumTokens.toLocaleString()}</td>
                      <td className="text-center py-2">
                        {formatCurrency(config.minimumTokens * config.costPerToken)}
                      </td>
                      <td className="text-center py-2">
                        {formatCurrency(config.maximumTokens * config.costPerToken)}
                      </td>
                      <td className="text-center py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          config.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {config.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default TokenCostCalculator
