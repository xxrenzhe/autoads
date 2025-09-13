'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  FileText,
  Download,
  Calendar,
  TrendingUp,
  Users,
  DollarSign,
  BarChart3,
  PieChart,
  Filter,
  RefreshCw
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

export interface ReportData {
  id: string
  name: string
  type: 'revenue' | 'subscriptions' | 'churn' | 'growth' | 'custom'
  period: string
  generatedAt: string
  size: string
  downloadUrl: string
  status: 'generating' | 'ready' | 'failed'
}

export interface SubscriptionReportsProps {
  className?: string
}

export function SubscriptionReports({ className }: SubscriptionReportsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('30')
  const [selectedType, setSelectedType] = useState('all')
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set())

  const {
    data: reports,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['subscription-reports', selectedPeriod, selectedType],
    queryFn: async (): Promise<ReportData[]> => {
      const params = new URLSearchParams()
      if (selectedPeriod !== 'all') params.append('period', selectedPeriod)
      if (selectedType !== 'all') params.append('type', selectedType)

      const response = await fetch(`/api/admin/subscription/reports?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch reports')
      }
      const result = await response.json()
      return result.data || []
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  const generateReport = async (type: string, period: string) => {
    setGeneratingReports(prev => new Set(prev).add(`${type}-${period}`))
    
    try {
      const response = await fetch('/api/admin/subscription/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, period }),
      })

      if (response.ok) {
        refetch()
      }
    } catch (error) {
      console.error('Failed to generate report:', error)
    } finally {
      setGeneratingReports(prev => {
        const newSet = new Set(prev)
        newSet.delete(`${type}-${period}`)
        return newSet
      })
    }
  }

  const downloadReport = async (reportId: string) => {
    try {
      const response = await fetch(`/api/admin/subscription/reports/${reportId}/download`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `subscription-report-${reportId}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to download report:', error)
    }
  }

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'revenue': return <DollarSign className="h-4 w-4 text-green-500" />
      case 'subscriptions': return <Users className="h-4 w-4 text-blue-500" />
      case 'churn': return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'growth': return <BarChart3 className="h-4 w-4 text-purple-500" />
      default: return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'success'
      case 'generating': return 'warning'
      case 'failed': return 'destructive'
      default: return 'secondary'
    }
  }

  const reportTypes = [
    { id: 'revenue', name: 'Revenue Report', description: 'Monthly and yearly revenue analysis' },
    { id: 'subscriptions', name: 'Subscription Report', description: 'Active subscriptions and trends' },
    { id: 'churn', name: 'Churn Analysis', description: 'Customer retention and churn rates' },
    { id: 'growth', name: 'Growth Report', description: 'User acquisition and growth metrics' }
  ]

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Subscription Reports
          </h2>
          <div className="animate-pulse h-8 w-24 bg-gray-300 rounded"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, index: number) => (
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

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Subscription Reports
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Generate and download subscription analytics reports
          </p>
        </div>
        
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
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
              value={selectedPeriod}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedPeriod(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
              <option value="all">All time</option>
            </select>
            
            <select
              value={selectedType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedType(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="revenue">Revenue</option>
              <option value="subscriptions">Subscriptions</option>
              <option value="churn">Churn</option>
              <option value="growth">Growth</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Quick Generate */}
      <Card>
        <CardHeader>
          <CardTitle>Generate New Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {reportTypes.map((type) => (
              <div key={type.id} className="p-4 border rounded-lg">
                <div className="flex items-center mb-2">
                  {getReportIcon(type.id)}
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {type.name}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {type.description}
                </p>
                <Button
                  size="sm"
                  onClick={() => generateReport(type.id, selectedPeriod)}
                  disabled={generatingReports.has(`${type.id}-${selectedPeriod}`)}
                  className="w-full"
                >
                  {generatingReports.has(`${type.id}-${selectedPeriod}`) ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="h-3 w-3 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Existing Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {reports && reports.length > 0 ? (
            <div className="space-y-4">
              {reports.map((report: ReportData) => (
                <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getReportIcon(report.type)}
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {report.name}
                      </h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="h-3 w-3" />
                        <span>{report.period}</span>
                        <span>•</span>
                        <span>Generated {new Date(report.generatedAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{report.size}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Badge variant={getStatusColor(report.status)}>
                      {report.status}
                    </Badge>
                    
                    {report.status === 'ready' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadReport(report.id)}
                      >
                        <Download className="h-3 w-3 mr-2" />
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Reports Available
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Generate your first report using the options above.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Reports Generated
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {reports?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Most Popular Type
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  Revenue
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-full">
                <PieChart className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Ready Reports
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {reports?.filter((r) => r.status === 'ready').length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default SubscriptionReports
