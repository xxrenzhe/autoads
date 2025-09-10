'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { RefreshCw, Clock, Hash, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

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

interface BatchOperationDetailProps {
  batchId: string
  onClose?: () => void
}

export default function BatchOperationDetail({ batchId, onClose }: BatchOperationDetailProps) {
  const [details, setDetails] = useState<BatchOperationDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBatchDetails()
  }, [batchId])

  const fetchBatchDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/user/tokens/batch/${batchId}`)
      if (response.ok) {
        const data = await response.json()
        setDetails(data.data)
      } else {
        setError('获取批量操作详情失败')
      }
    } catch (error) {
      console.error('获取批量操作详情失败:', error)
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const getFeatureName = (feature: string) => {
    const names: Record<string, string> = {
      'siterank': 'SiteRank 域名分析',
      'batchopen': 'BatchOpen 批量访问',
      'changelink': 'ChangeLink 链接替换'
    }
    return names[feature] || feature
  }

  const getFeatureIcon = (feature: string) => {
    switch (feature) {
      case 'siterank':
        return '🔍'
      case 'batchopen':
        return '🚀'
      case 'changelink':
        return '🔗'
      default:
        return '⚡'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>加载批量操作详情中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={fetchBatchDetails} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          重试
        </Button>
      </div>
    )
  }

  if (!details) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">未找到批量操作详情</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 批量操作概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>{getFeatureIcon(details.feature)}</span>
            <span>{getFeatureName(details.feature)}</span>
          </CardTitle>
          <CardDescription>
            批次ID: {details.batchId}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <Hash className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-2xl font-bold">{details.operationCount}</div>
              <div className="text-sm text-muted-foreground">操作数量</div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <Zap className="h-5 w-5 text-red-500" />
              </div>
              <div className="text-2xl font-bold">{details.totalAmount}</div>
              <div className="text-sm text-muted-foreground">总消耗Token</div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <Zap className="h-5 w-5 text-green-500" />
              </div>
              <div className="text-2xl font-bold">
                {details.summary.averageTokensPerOperation.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground">平均消耗</div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-2xl font-bold">
                {format(new Date(details.timestamp), 'HH:mm:ss')}
              </div>
              <div className="text-sm text-muted-foreground">执行时间</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 操作类型统计 */}
      {Object.keys(details.summary.operationTypes).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>操作类型分布</CardTitle>
            <CardDescription>
              不同类型操作的数量统计
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(details.summary.operationTypes).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{type}</p>
                    <p className="text-sm text-muted-foreground">{count} 次</p>
                  </div>
                  <Badge variant="secondary">
                    {Math.round((count / details.operationCount) * 100)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 详细操作列表 */}
      <Card>
        <CardHeader>
          <CardTitle>操作详情</CardTitle>
          <CardDescription>
            批量操作中每个具体操作的详细信息
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>操作描述</TableHead>
                  <TableHead className="w-24">Token消耗</TableHead>
                  <TableHead className="w-32">元数据</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.operations.map((operation) => (
                  <TableRow key={operation.index}>
                    <TableCell className="font-mono">
                      {operation.index}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{operation.description}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {operation.amount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {operation.metadata && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {typeof operation.metadata === 'object' 
                            ? Object.entries(operation.metadata).map(([key, value]) => (
                                <div key={key}>
                                  {key}: {String(value)}
                                </div>
                              ))
                            : String(operation.metadata)
                          }
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      {onClose && (
        <div className="flex justify-end">
          <Button onClick={onClose} variant="outline">
            关闭
          </Button>
        </div>
      )}
    </div>
  )
}