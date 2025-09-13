'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  TrendingUp, 
  Target, 
  Lightbulb, 
  RefreshCw,
  Calendar,
  Activity,
  Zap,
  Download
} from 'lucide-react'

interface TokenUsageStatsData {
  currentBalance: number
  timeRange: string
  period: {
    startDate?: string
    endDate?: string
    days: number | null
  }
  overview: {
    totalTokensUsed: number
    totalOperations: number
    averageTokensPerOperation: number
    totalRecords: number
  }
  byFeature: Array<{
    feature: string
    displayName: string
    tokens: number
    operations: number
    percentage: number
    averageTokensPerOperation: number
    lastUsed: string
  }>
  trends: Array<{
    date: string
    tokens: number
    operations: number
  }>
  batchOperations: {
    count: number
    totalTokens: number
    averageBatchSize: number
    percentage: number
  }
  efficiency: {
    overallEfficiency: number
    batchEfficiency: number
    batchUsageRate: number
    recommendations: string[]
  }
  patterns: {
    peakHours: number[]
    peakDays: string[]
    averageSessionSize: number
    mostUsedFeature: string | null
  }
}

interface TokenUsageStatsProps {
  userId?: string
  className?: string
}

export default function TokenUsageStats({ userId, className }: TokenUsageStatsProps) {
  const [statsData, setStatsData] = useState<TokenUsageStatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('30d')
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchStats()
  }, [timeRange, userId])

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams({
        timeRange
      })
      
      const response = await fetch(`/api/user/tokens/stats?${params}`)
      if (response.ok) {
        const data = await response.json()
        setStatsData(data.data)
      } else {
        setError('获取统计数据失败')
      }
    } catch (error) {
      console.error('获取Token统计失败:', error)
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const getTimeRangeLabel = (range: string) => {
    const labels: Record<string, string> = {
      '7d': '近7天',
      '30d': '近30天',
      '90d': '近90天',
      '1y': '近1年',
      'all': '所有时间'
    }
    return labels[range] || range
  }

  const exportData = async () => {
    if (!statsData) return
    
    try {
      setExporting(true)
      
      // 准备导出数据
      const exportData = {
        exportTime: new Date().toISOString(),
        timeRange: getTimeRangeLabel(timeRange),
        overview: statsData.overview,
        byFeature: statsData.byFeature,
        batchOperations: statsData.batchOperations,
        efficiency: statsData.efficiency,
        patterns: statsData.patterns,
        trends: statsData.trends
      }
      
      // 创建CSV格式的数据
      const csvContent = [
        // 概览数据
        '概览统计',
        '指标,数值',
        `总消耗Token,${statsData.overview.totalTokensUsed}`,
        `总操作数,${statsData.overview.totalOperations}`,
        `平均Token消耗,${statsData.overview.averageTokensPerOperation}`,
        `总记录数,${statsData.overview.totalRecords}`,
        '',
        // 功能使用数据
        '功能使用统计',
        '功能名称,消耗Token,操作次数,占比(%),平均消耗,最后使用时间',
        ...statsData.byFeature?.filter(Boolean)?.map((f: any) => 
          `${f.displayName},${f.tokens},${f.operations},${f.percentage},${f.averageTokensPerOperation},${new Date(f.lastUsed).toLocaleString('zh-CN')}`
        ),
        '',
        // 趋势数据
        '使用趋势',
        '日期,Token消耗,操作次数',
        ...statsData.trends?.filter(Boolean)?.map((t: any) => 
          `${new Date(t.date).toLocaleDateString('zh-CN')},${t.tokens},${t.operations}`
        )
      ].join('\n')
      
      // 创建并下载文件
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `token-usage-stats-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
    } catch (error) {
      console.error('导出数据失败:', error)
      setError('导出数据失败，请重试')
    } finally {
      setExporting(false)
    }
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

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>加载统计数据中...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={fetchStats} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                重试
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!statsData) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">暂无统计数据</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 时间范围选择 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Token使用统计</h2>
          <p className="text-muted-foreground">
            {getTimeRangeLabel(timeRange)}的详细使用分析
          </p>
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
              <SelectItem value="1y">近1年</SelectItem>
              <SelectItem value="all">所有时间</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportData} variant="outline" size="sm" disabled={exporting}>
            {exporting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
          <Button onClick={fetchStats} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 总体概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总消耗</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData.overview.totalTokensUsed}</div>
            <p className="text-xs text-muted-foreground">Token</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总操作数</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData.overview.totalOperations}</div>
            <p className="text-xs text-muted-foreground">次操作</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均效率</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData.overview.averageTokensPerOperation}</div>
            <p className="text-xs text-muted-foreground">Token/操作</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">记录数</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData.overview.totalRecords}</div>
            <p className="text-xs text-muted-foreground">条记录</p>
          </CardContent>
        </Card>
      </div>

      {/* 功能使用分析 */}
      <Card>
        <CardHeader>
          <CardTitle>功能使用分析</CardTitle>
          <CardDescription>
            各功能的详细使用情况和效率分析
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {statsData.byFeature.map((featureStats: any) => (
              <div key={featureStats.feature} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getFeatureIcon(featureStats.feature)}</span>
                    <div>
                      <h4 className="font-medium">{featureStats.displayName}</h4>
                      <p className="text-sm text-muted-foreground">
                        最后使用: {new Date(featureStats.lastUsed).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {featureStats.percentage}%
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-red-600">{featureStats.tokens}</div>
                    <div className="text-xs text-muted-foreground">消耗Token</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-600">{featureStats.operations}</div>
                    <div className="text-xs text-muted-foreground">操作次数</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-600">
                      {featureStats.averageTokensPerOperation}
                    </div>
                    <div className="text-xs text-muted-foreground">平均消耗</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 批量操作效率 */}
      {statsData.batchOperations.count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>批量操作效率</CardTitle>
            <CardDescription>
              批量操作的使用情况和效率分析
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {statsData.batchOperations.count}
                </div>
                <div className="text-sm text-muted-foreground">批量操作次数</div>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(statsData.batchOperations.averageBatchSize)}
                </div>
                <div className="text-sm text-muted-foreground">平均批次大小</div>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {statsData.batchOperations.percentage}%
                </div>
                <div className="text-sm text-muted-foreground">批量操作占比</div>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {statsData.efficiency.batchEfficiency}
                </div>
                <div className="text-sm text-muted-foreground">批量操作效率</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 使用模式分析 */}
      <Card>
        <CardHeader>
          <CardTitle>使用模式分析</CardTitle>
          <CardDescription>
            基于您的使用习惯的智能分析
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">使用时间模式</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">活跃时段</span>
                  <div className="flex space-x-1">
                    {statsData.patterns.peakHours?.filter(Boolean)?.map((hour: any) => (
                      <Badge key={hour} variant="outline" className="text-xs">
                        {hour}:00
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">活跃日期</span>
                  <div className="flex space-x-1">
                    {statsData.patterns.peakDays?.filter(Boolean)?.map((day: any) => (
                      <Badge key={day} variant="outline" className="text-xs">
                        {day}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">平均会话大小</span>
                  <Badge variant="secondary">
                    {statsData.patterns.averageSessionSize} 操作/天
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">使用偏好</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">最常用功能</span>
                  <Badge variant="default">
                    {statsData.patterns.mostUsedFeature || '暂无'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">批量操作使用率</span>
                  <Badge variant={statsData.efficiency.batchUsageRate > 50 ? "default" : "secondary"}>
                    {statsData.efficiency.batchUsageRate}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">整体效率</span>
                  <Badge variant={statsData.efficiency.overallEfficiency < 2 ? "default" : "secondary"}>
                    {statsData.efficiency.overallEfficiency} Token/操作
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 使用建议 */}
      {statsData.efficiency.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              <span>使用建议</span>
            </CardTitle>
            <CardDescription>
              基于您的使用模式的个性化建议
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statsData.efficiency.recommendations.map((recommendation, index: any) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{recommendation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 使用趋势图表 */}
      {statsData.trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>使用趋势</span>
            </CardTitle>
            <CardDescription>
              {getTimeRangeLabel(timeRange)}的Token使用趋势图表
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* 趋势图表 */}
              <div className="h-64 w-full">
                <div className="flex items-end justify-between h-full space-x-1 pb-4">
                  {statsData.trends.slice(-15).map((trend, index: any) => {
                    const maxTokens = Math.max(...statsData.trends?.filter(Boolean)?.map((t: any) => t.tokens))
                    const height = maxTokens > 0 ? (trend.tokens / maxTokens) * 100 : 0
                    return (
                      <div key={trend.date} className="flex flex-col items-center flex-1 group">
                        <div className="relative">
                          <div 
                            className="bg-blue-500 hover:bg-blue-600 transition-colors rounded-t min-h-[4px] w-full cursor-pointer"
                            style={{ height: `${Math.max(height, 4)}%` }}
                            title={`${new Date(trend.date).toLocaleDateString('zh-CN')}: ${trend.tokens} Token, ${trend.operations} 操作`}
                          />
                          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {trend.tokens} Token
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 transform -rotate-45 origin-left">
                          {new Date(trend.date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 功能使用分布饼图 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-4">功能使用分布</h4>
                  <div className="relative w-48 h-48 mx-auto">
                    {/* 简化的饼图 */}
                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                      {statsData.byFeature.reduce((acc, feature, index: any) => {
                        const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444']
                        const startAngle = acc.currentAngle
                        const angle = (feature.percentage / 100) * 360
                        const endAngle = startAngle + angle
                        
                        const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180)
                        const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180)
                        const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180)
                        const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180)
                        
                        const largeArcFlag = angle > 180 ? 1 : 0
                        
                        const pathData = [
                          `M 50 50`,
                          `L ${x1} ${y1}`,
                          `A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                          'Z'
                        ].join(' ')
                        
                        acc.paths.push(
                          <path
                            key={feature.feature}
                            d={pathData}
                            fill={colors[index % colors.length]}
                            className="hover:opacity-80 transition-opacity"
                          />
                        )
                        
                        acc.currentAngle = endAngle
                        return acc
                      }, { paths: [] as JSX.Element[], currentAngle: 0 }).paths}
                    </svg>
                    
                    {/* 图例 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-lg font-bold">{statsData.overview.totalTokensUsed}</div>
                        <div className="text-xs text-muted-foreground">总消耗</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    {statsData.byFeature.map((feature, index: any) => {
                      const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444']
                      return (
                        <div key={feature.feature} className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: colors[index % colors.length] }}
                          />
                          <span className="text-sm">{feature.displayName}</span>
                          <span className="text-sm text-muted-foreground">({feature.percentage}%)</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4">详细数据</h4>
                  <div className="space-y-3">
                    {statsData.trends.slice(-7).map((trend: any) => (
                      <div key={trend.date} className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm font-mono">
                          {new Date(trend.date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                        </span>
                        <div className="flex items-center space-x-4">
                          <div className="text-sm">
                            <span className="text-red-600">{trend.tokens}</span> Token
                          </div>
                          <div className="text-sm">
                            <span className="text-blue-600">{trend.operations}</span> 操作
                          </div>
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ 
                                width: `${Math.min((trend.tokens / Math.max(...statsData.trends?.filter(Boolean)?.map((t: any) => t.tokens))) * 100, 100)}%` 
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}