'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Receipt,
  Download,
  Calendar,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Filter
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

export interface BillingRecord {
  id: string
  description: string
  amount: number
  currency: string
  status: 'paid' | 'pending' | 'failed' | 'refunded'
  date: string
  invoiceUrl?: string
  receiptUrl?: string
  subscriptionId?: string
  planName?: string
}

export interface BillingHistoryProps {
  userId?: string
  className?: string
  showFilters?: boolean
  maxRecords?: number
}

export function BillingHistory({ 
  userId, 
  className, 
  showFilters = true, 
  maxRecords = 50 
}: BillingHistoryProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all')

  const {
    data: billingHistory,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['billing-history', userId, selectedStatus, selectedPeriod],
    queryFn: async (): Promise<BillingRecord[]> => {
      const params = new URLSearchParams()
      if (userId) params.append('userId', userId)
      if (selectedStatus !== 'all') params.append('status', selectedStatus)
      if (selectedPeriod !== 'all') params.append('period', selectedPeriod)
      params.append('limit', maxRecords.toString())

      const endpoint = userId ? '/api/user/billing/history' : '/api/admin/billing/history'
      const response = await fetch(`${endpoint}?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch billing history')
      }
      
      const result = await response.json()
      return result.data || []
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) => {
      case 'paid': return 'success'
      case 'pending': return 'warning'
      case 'failed': return 'destructive'
      case 'refunded': return 'secondary'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) => {
      case 'paid': return CheckCircle
      case 'pending': return Clock
      case 'failed': return AlertCircle
      case 'refunded': return RefreshCw
      default: return Clock
    }
  }

  const handleDownloadInvoice = async (recordId: string) => {
    try {
      const response = await fetch(`/api/billing/invoice/${recordId}/download`)
      if (response.ok) => {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `invoice-${recordId}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to download invoice:', error)
    }
  }

  const handleDownloadReceipt = async (recordId: string) => {
    try {
      const response = await fetch(`/api/billing/receipt/${recordId}/download`)
      if (response.ok) => {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `receipt-${recordId}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to download receipt:', error)
    }
  }

  if (isLoading) => {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Billing History
          </h2>
          <div className="animate-pulse h-8 w-24 bg-gray-300 rounded"></div>
        </div>
        
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index: any) => (
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

  if (error) => {
    return (
      <div className={`${className}`}>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Error Loading Billing History
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
            Billing History
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage your billing records and invoices
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
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
              
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Time</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing Records */}
      <div className="space-y-4">
        {billingHistory && billingHistory.length > 0 ? (
          billingHistory.map((record: any) => {
            const StatusIcon = getStatusIcon(record.status)
            
            return (
              <Card key={record.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <StatusIcon className={`h-4 w-4 ${
                          record.status === 'paid' ? 'text-green-500' :
                          record.status === 'failed' ? 'text-red-500' :
                          record.status === 'pending' ? 'text-yellow-500' :
                          'text-gray-500'
                        }`} />
                        
                        <span className="font-medium text-gray-900 dark:text-white">
                          {record.description}
                        </span>
                        
                        <Badge variant={getStatusColor(record.status) as any}>
                          {record.status}
                        </Badge>
                        
                        {record.planName && (
                          <Badge variant="outline">
                            {record.planName}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(record.date).toLocaleDateString()}
                          </div>
                          <div className="flex items-center">
                            <CreditCard className="h-3 w-3 mr-1" />
                            {formatCurrency(record.amount, record.currency)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {record.invoiceUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadInvoice(record.id)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Invoice
                        </Button>
                      )}
                      
                      {record.receiptUrl && record.status === 'paid' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadReceipt(record.id)}
                        >
                          <Receipt className="h-4 w-4 mr-1" />
                          Receipt
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
              <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Billing History
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {selectedStatus !== 'all' || selectedPeriod !== 'all' 
                  ? 'No billing records found matching your filters.'
                  : 'You don\'t have any billing records yet.'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary */}
      {billingHistory && billingHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Billing Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {billingHistory.length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total Records
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {billingHistory.filter((r: any) => r.status === 'paid').length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Paid
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {billingHistory.filter((r: any) => r.status === 'pending').length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Pending
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {billingHistory.filter((r: any) => r.status === 'failed').length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Failed
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default BillingHistory