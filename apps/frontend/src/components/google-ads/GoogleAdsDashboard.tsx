'use client';

import { EnhancedError } from '@/lib/utils/error-handling';
import React, { useState, useEffect } from 'react';
import { 

Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
const logger = createClientLogger('GoogleAdsDashboard');

import { 
  Activity, 
  DollarSign, 
  Eye, 
  MousePointer, 
  TrendingUp, 
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  BarChart3,
  Users,
  Target,
  Calendar,
  Settings
} from 'lucide-react';

interface AccountData {
  id: string;
  name: string;
  status: string;
  currency: string;
  timeZone: string;
  campaigns: CampaignData[];
}

interface CampaignData {
  id: string;
  name: string;
  status: string;
  budget: number;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

interface ServiceStats {
  accounts: number;
  campaigns: number;
  impressions: number;
  clicks: number;
  cost: number;
  lastRefresh: number;
  isDemoMode: boolean;
}

export default function GoogleAdsDashboard() {
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [accountsRes, statsRes] = await Promise.allSettled([
        fetch('/api/google-ads/accounts'),
        fetch('/api/google-ads/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'stats' })
        })
    ]);
      if (accountsRes.status === 'fulfilled') {
        const accountsData = await accountsRes.value.json();
        if (accountsData.success) {
          setAccounts(accountsData.data);
          if (accountsData.data.length > 0 && !selectedAccount) {
            setSelectedAccount(accountsData.data[0].id);
          }
        }
      }

      if (statsRes.status === 'fulfilled') {
        const statsData = await statsRes.value.json();
        if (statsData.success) {
          setStats(statsData.data);
        }
      }
    } catch (err) { setError('Failed to load Google Ads data');
      logger.error('Error loading Google Ads data:', new EnhancedError('Error loading Google Ads data:', { error: err instanceof Error ? err.message : String(err)
       }));
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      setIsRefreshing(true);
      await fetch('/api/google-ads/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'refresh' })
      });
      await loadData();
    } catch (err) { setError('Failed to refresh data');
      logger.error('Error refreshing data:', new EnhancedError('Error refreshing data:', { error: err instanceof Error ? err.message : String(err)
       }));
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'enabled':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'removed':
      case 'disabled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'enabled':
        return <CheckCircle className="w-4 h-4" />;
      case 'paused':
        return <AlertTriangle className="w-4 h-4" />;
      case 'removed':
      case 'disabled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const calculateCTR = (clicks: number, impressions: number) => {
    return impressions > 0 ? (clicks / impressions) * 100 : 0;
  };

  const calculateCPC = (cost: number, clicks: number) => {
    return clicks > 0 ? cost / clicks : 0;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span>Loading Google Ads data...</span>
          </div>
        </div>
      </div>
    );
  }

  const currentAccount = accounts.find((acc: any) => acc.id === selectedAccount);
  const totalImpressions = stats?.impressions || 0;
  const totalClicks = stats?.clicks || 0;
  const totalCost = stats?.cost || 0;
  const avgCTR = calculateCTR(totalClicks, totalImpressions);
  const avgCPC = calculateCPC(totalCost, totalClicks);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">📊 Google Ads 仪表板</h1>
        <p className="text-gray-600">
          实时监控和管理 Google Ads 账户、广告系列和性能指标
        </p>
      </div>

      {stats?.isDemoMode && (
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            当前运行在演示模式下，显示的是模拟数据。在生产环境中，请配置真实的 Google Ads API 凭据。
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="mb-6 flex flex-wrap gap-4">
        <Button onClick={refreshData} disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          刷新数据
        </Button>
        <Button variant="outline">
          <Settings className="w-4 h-4 mr-2" />
          配置设置
        </Button>
        <Button variant="outline">
          <BarChart3 className="w-4 h-4 mr-2" />
          详细报告
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">账户数量</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.accounts || 0}</div>
            <p className="text-xs text-muted-foreground">
              活跃 Google Ads 账户
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">广告系列</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.campaigns || 0}</div>
            <p className="text-xs text-muted-foreground">
              总广告系列数量
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总展示次数</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalImpressions)}</div>
            <p className="text-xs text-muted-foreground">
              累计展示次数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总点击次数</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalClicks)}</div>
            <p className="text-xs text-muted-foreground">
              累计点击次数
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">点击率 (CTR)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgCTR.toFixed(2)}%</div>
            <Progress value={Math.min(avgCTR, 100)} className="mt-2" />
            <p className="text-sm text-muted-foreground mt-2">
              平均点击率
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">每次点击费用 (CPC)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(avgCPC)}</div>
            <Progress value={Math.min((avgCPC / 10) * 100, 100)} className="mt-2" />
            <p className="text-sm text-muted-foreground mt-2">
              平均每次点击费用
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">总费用</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(totalCost)}</div>
            <Progress value={Math.min((totalCost / 10000) * 100, 100)} className="mt-2" />
            <p className="text-sm text-muted-foreground mt-2">
              累计广告费用
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="accounts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="accounts">账户管理</TabsTrigger>
          <TabsTrigger value="campaigns">广告系列</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Google Ads 账户</CardTitle>
              <CardDescription>管理您的 Google Ads 账户</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {accounts.map((account: any) => (
                  <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(account.status)}
                      <div>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-sm text-gray-500">ID: {account.id}</p>
                        <p className="text-sm text-gray-500">
                          货币: {account.currency} | 时区: {account.timeZone}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={account.status === 'ENABLED' ? 'default' : 'secondary'}>
                        {account.status}
                      </Badge>
                      <Button 
                        size="sm" 
                        variant={selectedAccount === account.id ? 'default' : 'outline'}
                        onClick={((: any): any) => setSelectedAccount(account.id)}
                      >
                        选择
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          {currentAccount ? (
            <Card>
              <CardHeader>
                <CardTitle>广告系列 - {currentAccount.name}</CardTitle>
                <CardDescription>
                  账户 {currentAccount.id} 的广告系列列表
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {currentAccount.campaigns.map((campaign: any) => (
                    <div key={campaign.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(campaign.status)}
                          <div>
                            <p className="font-medium">{campaign.name}</p>
                            <p className="text-sm text-gray-500">ID: {campaign.id}</p>
                          </div>
                        </div>
                        <Badge variant={campaign.status === 'ENABLED' ? 'default' : 'secondary'}>
                          {campaign.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">预算</p>
                          <p className="font-medium">{formatCurrency(campaign.budget, currentAccount.currency)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">展示次数</p>
                          <p className="font-medium">{formatNumber(campaign.impressions)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">点击次数</p>
                          <p className="font-medium">{formatNumber(campaign.clicks)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">费用</p>
                          <p className="font-medium">{formatCurrency(campaign.cost, currentAccount.currency)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-gray-500">请选择一个账户来查看广告系列</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Last Updated */}
      {stats?.lastRefresh && (
        <div className="mt-8 text-center text-sm text-gray-500">
          最后更新: {new Date(stats.lastRefresh).toLocaleString()}
        </div>
      )}
    </div>
  );
} 