'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/components/ui/card'
import { Button } from '@/admin/components/ui/button'
import { Badge } from '@/admin/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/admin/components/ui/tabs'
import { Alert, AlertDescription } from '@/admin/components/ui/alert'
import APIAnalyticsDashboard from '@/admin/components/api/APIAnalyticsDashboard'
import APIManager from '@/admin/components/api/APIManager'
import APIRateLimitManager from '@/admin/components/api/APIRateLimitManager'
import { 
  Settings, 
  BarChart3, 
  Activity, 
  Shield, 
  Globe,
  RefreshCw,
  Download,
  Bell
} from 'lucide-react'

export default function APIManagementDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const handleRefresh = () => {
    setLastUpdated(new Date())
    // 触发数据刷新
    window.dispatchEvent(new Event('refresh-metrics'))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Management & Monitoring</h1>
          <p className="text-muted-foreground">
            Comprehensive API management with real-time monitoring and analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button>
            <Bell className="h-4 w-4 mr-2" />
            Configure Alerts
          </Button>
        </div>
      </div>

      {/* 系统状态概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Operational</div>
            <p className="text-xs text-muted-foreground">
              All systems normal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active APIs</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">
              23 healthy, 1 degraded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limits</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98%</div>
            <p className="text-xs text-muted-foreground">
              Within limits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {lastUpdated.toLocaleTimeString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time data
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容区域 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="endpoints" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Endpoints
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Monitoring
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertDescription>
              Welcome to the API Management Dashboard. This dashboard provides comprehensive monitoring and management capabilities for your APIs.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 快速统计 */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
                <CardDescription>24-hour summary</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Requests</span>
                    <span className="font-bold">1.2M</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Response Time</span>
                    <span className="font-bold">245ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Error Rate</span>
                    <span className="font-bold text-green-600">0.3%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Users</span>
                    <span className="font-bold">8,432</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 热门端点 */}
            <Card>
              <CardHeader>
                <CardTitle>Top Endpoints (24h)</CardTitle>
                <CardDescription>Most accessed APIs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { path: '/api/batchopen/silent-start', requests: 45234, success: 99.8 },
                    { path: '/api/user/profile', requests: 32156, success: 99.9 },
                    { path: '/api/siterank/batch', requests: 28943, success: 98.5 },
                    { path: '/api/user/tokens/balance', requests: 23421, success: 100 },
                    { path: '/api/subscription/subscribe', requests: 19876, success: 97.2 }
                  ].map((endpoint, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm truncate flex-1">{endpoint.path}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{endpoint.requests.toLocaleString()}</Badge>
                        <Badge variant={endpoint.success > 99 ? 'default' : 'secondary'}>
                          {endpoint.success}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="endpoints">
          <APIManager />
        </TabsContent>

        <TabsContent value="monitoring">
          <APIAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 监控配置 */}
            <Card>
              <CardHeader>
                <CardTitle>Monitoring Configuration</CardTitle>
                <CardDescription>Configure monitoring settings and thresholds</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Collection Interval</label>
                    <select className="w-full p-2 border rounded">
                      <option>5 seconds</option>
                      <option>10 seconds</option>
                      <option>30 seconds</option>
                      <option>1 minute</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Error Rate Threshold</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border rounded" 
                      defaultValue="5"
                      min="0"
                      max="100"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Response Time Threshold (ms)</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border rounded" 
                      defaultValue="2000"
                      min="100"
                    />
                  </div>
                  
                  <Button className="w-full">Save Configuration</Button>
                </div>
              </CardContent>
            </Card>

            {/* 告警配置 */}
            <Card>
              <CardHeader>
                <CardTitle>Alert Configuration</CardTitle>
                <CardDescription>Configure alert notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive alerts via email</p>
                    </div>
                    <input type="checkbox" defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Slack Integration</p>
                      <p className="text-sm text-muted-foreground">Send alerts to Slack</p>
                    </div>
                    <input type="checkbox" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Webhook Notifications</p>
                      <p className="text-sm text-muted-foreground">Custom webhook endpoints</p>
                    </div>
                    <input type="checkbox" />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Alert Severity Levels</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked />
                        <span className="text-sm">Critical</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked />
                        <span className="text-sm">High</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" />
                        <span className="text-sm">Medium</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" />
                        <span className="text-sm">Low</span>
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}