'use client'

import { useState } from 'react'
import { useBatchOpenVersion } from '@/hooks/useBatchOpenPermissions'
import { BatchOpenVersionGate } from './BatchOpenVersionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Play, Pause, Clock, Bot, Eye, EyeOff, AlertCircle } from 'lucide-react'

interface BatchOpenControlsProps {
  version: 'basic' | 'silent' | 'automated' | 'autoclick'
}

export function BatchOpenControls({ version }: BatchOpenControlsProps) {
  const { hasAccess, versionInfo, isLoading } = useBatchOpenVersion(version)
  const [urls, setUrls] = useState('')
  const [proxyUrl, setProxyUrl] = useState('')
  const [delay, setDelay] = useState('1000')
  const [maxConcurrent, setMaxConcurrent] = useState('5')
  const [isRunning, setIsRunning] = useState(false)
  const [showBrowser, setShowBrowser] = useState(version !== 'silent')
  const [schedule, setSchedule] = useState('')
  const [script, setScript] = useState('')

  const versionLimits = versionInfo ? {
    maxUrls: versionInfo.maxUrls,
    maxConcurrent: versionInfo.maxConcurrent,
    features: versionInfo.features
  } : {
    maxUrls: 50,
    maxConcurrent: 5,
    features: ['basic', 'manual']
  }

  const handleStart = async () => {
    if (!urls.trim()) return

    setIsRunning(true)
    // TODO: Implement actual batch open logic
    console.log(`Starting ${version} batch open with URLs:`, urls.split('\n'))
    
    // Simulate processing
    setTimeout(() => {
      setIsRunning(false)
    }, 3000)
  }

  const handleStop = () => {
    setIsRunning(false)
    // TODO: Implement stop logic
  }

  const getUrlsCount = () => {
    return urls.split('\n').filter((url: any) => url.trim()).length
  }

  const isOverLimit = () => {
    const count = getUrlsCount()
    return versionLimits.maxUrls > 0 && count > versionLimits.maxUrls
  }

  return (
    <BatchOpenVersionGate version={version}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">BatchOpen {versionInfo?.name}</h2>
            <p className="text-gray-600">
              {version === 'basic' && '基础的批量URL打开功能'}
              {version === 'silent' && '后台批量打开，无浏览器界面'}
              {(version === 'automated' || version === 'autoclick') && '支持定时任务和脚本控制'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <Button onClick={handleStop} variant="destructive">
                <Pause className="h-4 w-4 mr-2" />
                停止
              </Button>
            ) : (
              <Button 
                onClick={handleStart} 
                disabled={!urls.trim() || isOverLimit()}
              >
                <Play className="h-4 w-4 mr-2" />
                开始
              </Button>
            )}
          </div>
        </div>

        {isOverLimit() && (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">URL数量超出限制</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              当前版本最多支持 {versionLimits.maxUrls} 个URL，请升级到更高版本以获得更多支持。
            </p>
          </div>
        )}

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">基础设置</TabsTrigger>
            {versionLimits.features.includes('batch') && (
              <TabsTrigger value="advanced">高级设置</TabsTrigger>
            )}
            {versionLimits.features.includes('scheduled') && (
              <TabsTrigger value="automation">自动化</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>URL列表</CardTitle>
                <CardDescription>
                  每行一个URL，支持http://或https://开头的链接
                  {versionLimits.maxUrls > 0 && ` (最多${versionLimits.maxUrls}个)`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="https://example.com/page1&#10;https://example.com/page2&#10;https://example.com/page3"
                  value={urls}
                  onChange={(e) => setUrls((e.target as HTMLTextAreaElement).value)}
                  rows={10}
                  className="font-mono text-sm"
                />
                <div className="mt-2 text-sm text-gray-500">
                  已输入 {getUrlsCount()} 个URL
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>基本设置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="delay">打开间隔 (毫秒)</Label>
                    <Input
                      id="delay"
                      type="number"
                      value={delay}
                      onChange={(e) => setDelay(e.target.value)}
                      min="100"
                      max="10000"
                      step="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxConcurrent">并发数量</Label>
                    <Select value={maxConcurrent} onValueChange={setMaxConcurrent}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1个</SelectItem>
                        <SelectItem value="3">3个</SelectItem>
                        <SelectItem value="5">5个</SelectItem>
                        {version !== 'basic' && (
                          <>
                            <SelectItem value="10">10个</SelectItem>
                            <SelectItem value="20">20个</SelectItem>
                            {(version === 'automated' || version === 'autoclick') && (
                              <SelectItem value="50">50个</SelectItem>
                            )}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {version !== 'silent' && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="showBrowser"
                      checked={showBrowser}
                      onCheckedChange={setShowBrowser}
                    />
                    <Label htmlFor="showBrowser" className="flex items-center gap-2">
                      {showBrowser ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      显示浏览器窗口
                    </Label>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="proxy">代理服务器 (可选)</Label>
                  <Input
                    id="proxy"
                    placeholder="http://proxy.example.com:8080"
                    value={proxyUrl}
                    onChange={(e) => setProxyUrl(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {versionLimits.features.includes('batch') && (
            <TabsContent value="advanced" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>高级设置</CardTitle>
                  <CardDescription>
                    配置更详细的打开参数
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>超时时间 (秒)</Label>
                      <Select defaultValue="30">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10秒</SelectItem>
                          <SelectItem value="30">30秒</SelectItem>
                          <SelectItem value="60">60秒</SelectItem>
                          <SelectItem value="120">120秒</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>重试次数</Label>
                      <Select defaultValue="0">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">不重试</SelectItem>
                          <SelectItem value="1">1次</SelectItem>
                          <SelectItem value="3">3次</SelectItem>
                          <SelectItem value="5">5次</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>User Agent</Label>
                    <Select defaultValue="random">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="random">随机</SelectItem>
                        <SelectItem value="chrome">Chrome</SelectItem>
                        <SelectItem value="firefox">Firefox</SelectItem>
                        <SelectItem value="safari">Safari</SelectItem>
                        <SelectItem value="mobile">移动设备</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {versionLimits.features.includes('scheduled') && (
            <TabsContent value="automation" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    定时任务
                  </CardTitle>
                  <CardDescription>
                    设置定时执行任务
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="schedule">Cron表达式</Label>
                    <Input
                      id="schedule"
                      placeholder="0 9 * * *"
                      value={schedule}
                      onChange={(e) => setSchedule((e.target as HTMLInputElement).value)}
                    />
                    <p className="text-sm text-gray-500">
                      例如：0 9 * * * (每天9点执行)
                    </p>
                  </div>
                  <Button type="button" variant="outline">
                    保存定时任务
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    脚本控制
                  </CardTitle>
                  <CardDescription>
                    使用JavaScript脚本控制打开行为
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="script">JavaScript脚本</Label>
                    <Textarea
                      id="script"
                      placeholder="// 在页面加载后执行的脚本&#10;console.log('Page loaded');&#10;document.querySelector('.button').click();"
                      value={script}
                      onChange={(e) => setScript((e.target as HTMLTextAreaElement).value)}
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>
                  <Button type="button" variant="outline">
                    保存脚本
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </BatchOpenVersionGate>
  )
}
