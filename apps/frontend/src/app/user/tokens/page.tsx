'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Calendar, 
  Coins, 
  Activity, 
  TrendingDown, 
  RefreshCw, 
  Eye, 
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface TokenUsage {
  id: string
  feature: string
  action: string
  amount: number
  balance: number
  isBatch: boolean
  batchId?: string
  batchSize?: number
  description: string
  timestamp: string
  metadata?: any
  details?: any
}

interface TokenStats {
  totalTokensUsed: number
  totalOperations: number
  byFeature: Record<string, {
    amount: number
    operations: number
  }>
  byDate: Record<string, {
    tokens: number
    operations: number
  }>
  batchOperations: {
    count: number
    totalTokens: number
    avgBatchSize: number
  }
}

interface BatchOperationDetails {
  batchId: string
  feature: string
  action: string
  totalAmount: number
  operationCount: number
  timestamp: string
  operations: Array<{
    index: number
    description: string
    amount: number
    metadata: any
  }>
  summary: {
    totalTokens: number
    averageTokensPerOperation: number
    operationTypes: Record<string, number>
  }
}

interface ApiResponse {
  success: boolean
  data: {
    currentBalance: number
    records: TokenUsage[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
      hasMore: boolean
    }
    stats: TokenStats
    tokenCosts: Record<string, Record<string, number>>
    query: {
      timeRange: string
      feature: string
      includeBatchDetails: boolean
      startDate?: string
      endDate?: string
    }
  }
}

export default function UserTokensPage() {
  const { data: session } = useSession()
  const [apiData, setApiData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')
  const [featureFilter, setFeatureFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [includeBatchDetails, setIncludeBatchDetails] = useState(false)
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [batchDetails, setBatchDetails] = useState<BatchOperationDetails | null>(null)
  const [loadingBatchDetails, setLoadingBatchDetails] = useState(false)

  useEffect(() => {
    if (session?.user) {
      fetchTokenData()
    }
  }, [session, timeRange, featureFilter, currentPage, includeBatchDetails])

  const fetchTokenData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        timeRange,
        feature: featureFilter,
        page: currentPage.toString(),
        limit: '20',
        includeBatchDetails: includeBatchDetails.toString()
      })
      
      const response = await fetch(`/api/user/tokens?${params}`)
      if (response.ok) {
        const data = await response.json()
        setApiData(data)
      }
    } catch (error) {
      console.error('获取Token数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBatchDetails = async (batchId: string) => {
    try {
      setLoadingBatchDetails(true)
      const response = await fetch(`/api/user/tokens/batch/${batchId}`)
      if (response.ok) {
        const data = await response.json()
        setBatchDetails(data.data)
        setSelectedBatchId(batchId)
      }
    } catch (error) {
      console.error('获取批量操作详情失败:', error)
    } finally {
      setLoadingBatchDetails(false)
    }
  }

  const getFeatureName = (feature: string) => {
    const names: Record<string, string> = {
      'siterank': 'SiteRank 域名分析',
      'batchopen': 'BatchOpen 批量访问',
      'adscenter': 'AdsCenter 自动化广告'
    }
    return names[feature] || feature
  }

  const getFeatureIcon = (feature: string) => {
    switch (feature) {
      case 'siterank':
        return '🔍'
      case 'batchopen':
        return '🚀'
      case 'adscenter':
        return '🔗'
      default:
        return '⚡'
    }
  }

  const formatUsageDescription = (usage: TokenUsage) => {
    return usage.description
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const handleBatchDetailsClick = (batchId: string) => {
    fetchBatchDetails(batchId)
  }

  const closeBatchDetails = () => {
    setSelectedBatchId(null)
    setBatchDetails(null)
  }

  if (!session) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              请先登录查看Token使用记录
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Token 使用记录</h1>
          <p className="text-muted-foreground mt-2">
            查看您的Token消耗情况和使用历史
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={fetchTokenData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/user/tokens/stats" target="_blank">
              <BarChart3 className="h-4 w-4 mr-2" />
              详细统计
            </a>
          </Button>
        </div>
      </div>

      {/* Token 概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">当前余额</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {apiData?.data.currentBalance || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              可用Token数量
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总消耗</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {apiData?.data.stats.totalTokensUsed || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {timeRange === '7d' ? '近7天' : timeRange === '30d' ? '近30天' : '所有时间'}消耗
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总操作数</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apiData?.data.stats.totalOperations || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              实际操作次数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">批量操作</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {apiData?.data.stats.batchOperations.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              批量操作次数
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 功能使用统计 */}
      {apiData?.data.stats.byFeature && Object.keys(apiData.data.stats.byFeature).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>功能使用分布</CardTitle>
            <CardDescription>
              各功能的Token消耗和操作统计
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(apiData.data.stats.byFeature).map(([feature, stats]: any) => (
                <div key={feature} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getFeatureIcon(feature)}</span>
                    <div>
                      <p className="font-medium">{getFeatureName(feature)}</p>
                      <p className="text-sm text-muted-foreground">
                        消耗 {stats.amount} Token · {stats.operations} 次操作
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {Math.round((stats.amount / (apiData.data.stats.totalTokensUsed || 1)) * 100)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 批量操作统计 */}
      {apiData?.data.stats.batchOperations?.count && apiData.data.stats.batchOperations.count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>批量操作统计</CardTitle>
            <CardDescription>
              批量操作的效率分析
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {apiData?.data.stats.batchOperations.count}
                </div>
                <p className="text-sm text-muted-foreground">批量操作次数</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(apiData?.data.stats.batchOperations.avgBatchSize || 0)}
                </div>
                <p className="text-sm text-muted-foreground">平均批次大小</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(((apiData?.data.stats.batchOperations.totalTokens || 0) / (apiData?.data.stats.totalTokensUsed || 1)) * 100)}%
                </div>
                <p className="text-sm text-muted-foreground">批量操作占比</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 筛选和详细记录 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>使用记录</CardTitle>
              <CardDescription>
                详细的Token消耗历史记录
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">近7天</SelectItem>
                  <SelectItem value="30d">近30天</SelectItem>
                  <SelectItem value="90d">近90天</SelectItem>
                  <SelectItem value="all">所有时间</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={featureFilter} onValueChange={setFeatureFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有功能</SelectItem>
                  <SelectItem value="siterank">SiteRank</SelectItem>
                  <SelectItem value="batchopen">BatchOpen</SelectItem>
                  <SelectItem value="adscenter">AdsCenter</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant={includeBatchDetails ? "default" : "outline"}
                size="sm"
                onClick={() => setIncludeBatchDetails(!includeBatchDetails)}
              >
                <Info className="h-4 w-4 mr-2" />
                {includeBatchDetails ? "隐藏详情" : "显示详情"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>加载中...</span>
            </div>
          ) : apiData?.data.records && apiData.data.records.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>功能</TableHead>
                    <TableHead>操作描述</TableHead>
                    <TableHead>消耗Token</TableHead>
                    <TableHead>余额</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiData.data.records.map((usage: any) => (
                    <TableRow key={usage.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span>{getFeatureIcon(usage.feature)}</span>
                          <span className="font-medium">
                            {getFeatureName(usage.feature)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{formatUsageDescription(usage)}</p>
                          <div className="flex gap-1 mt-1">
                            {usage.isBatch && (
                              <Badge variant="outline">
                                批量操作 ({usage.batchSize}项)
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {usage.action}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={usage.amount > 10 ? 'destructive' : 'secondary'}>
                          -{usage.amount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {usage.balance}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(usage.timestamp), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                      </TableCell>
                      <TableCell>
                        {usage.isBatch && usage.batchId && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleBatchDetailsClick(usage.batchId!)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>批量操作详情</DialogTitle>
                                <DialogDescription>
                                  查看批量操作的具体内容和统计信息
                                </DialogDescription>
                              </DialogHeader>
                              {loadingBatchDetails ? (
                                <div className="flex items-center justify-center py-8">
                                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                                  <span>加载详情中...</span>
                                </div>
                              ) : batchDetails && selectedBatchId === usage.batchId ? (
                                <div className="space-y-4">
                                  {/* 批量操作概览 */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="text-center p-3 border rounded">
                                      <div className="text-lg font-bold">{batchDetails.operationCount}</div>
                                      <div className="text-sm text-muted-foreground">操作数量</div>
                                    </div>
                                    <div className="text-center p-3 border rounded">
                                      <div className="text-lg font-bold">{batchDetails.totalAmount}</div>
                                      <div className="text-sm text-muted-foreground">总消耗Token</div>
                                    </div>
                                    <div className="text-center p-3 border rounded">
                                      <div className="text-lg font-bold">
                                        {batchDetails.summary.averageTokensPerOperation.toFixed(1)}
                                      </div>
                                      <div className="text-sm text-muted-foreground">平均消耗</div>
                                    </div>
                                    <div className="text-center p-3 border rounded">
                                      <div className="text-lg font-bold">
                                        {format(new Date(batchDetails.timestamp), 'HH:mm:ss')}
                                      </div>
                                      <div className="text-sm text-muted-foreground">执行时间</div>
                                    </div>
                                  </div>

                                  {/* 操作列表 */}
                                  <div>
                                    <h4 className="font-medium mb-2">操作详情</h4>
                                    <div className="max-h-60 overflow-y-auto border rounded">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="w-16">#</TableHead>
                                            <TableHead>描述</TableHead>
                                            <TableHead className="w-20">Token</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {batchDetails.operations.map((op: any) => (
                                            <TableRow key={op.index}>
                                              <TableCell>{op.index}</TableCell>
                                              <TableCell className="font-mono text-sm">
                                                {op.description}
                                              </TableCell>
                                              <TableCell>{op.amount}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </DialogContent>
                          </Dialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 分页控件 */}
              {apiData.data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    显示 {((apiData.data.pagination.page - 1) * apiData.data.pagination.limit) + 1} - {Math.min(apiData.data.pagination.page * apiData.data.pagination.limit, apiData.data.pagination.total)} 
                    ，共 {apiData.data.pagination.total} 条记录
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </Button>
                    <span className="text-sm">
                      第 {currentPage} 页，共 {apiData.data.pagination.totalPages} 页
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= apiData.data.pagination.totalPages}
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">暂无使用记录</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
