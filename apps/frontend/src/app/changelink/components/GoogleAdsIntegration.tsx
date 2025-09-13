'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { EnhancedError } from '@/lib/utils/error-handling';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
const logger = createClientLogger('GoogleAdsIntegration');

import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Target,
  DollarSign,
  Users,
  MousePointer,
  Zap,
  Settings,
  Plus,
  Play,
  Pause,
  Edit,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Eye,
  Download,
  Upload,
  Search,
  Filter,
  Calendar,
  Globe,
  Smartphone,
  Monitor,
  ShoppingCart,
  Video,
  Image,
  FileText
} from 'lucide-react';

// Types
interface Campaign {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  advertisingChannelType: string;
  startDate: string;
  endDate?: string;
  biddingStrategyType: string;
}

interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  roas: number;
  qualityScore: number;
}

interface OptimizationRecommendation {
  type: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  expectedImpact: {
    metric: string;
    change: number;
    direction: 'INCREASE' | 'DECREASE';
  };
  implementation: {
    action: string;
    parameters: Record<string, unknown>;
  };
}

interface AdGroup {
  id: string;
  name: string;
  campaign: string;
  status: string;
  type: string;
}

interface Ad {
  id: string;
  name: string;
  adGroup: string;
  status: string;
  type: string;
  finalUrls: string[];
  headlines?: string[];
  descriptions?: string[];
}

export function GoogleAdsIntegration() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [performance, setPerformance] = useState<CampaignPerformance[]>([]);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedAdGroup, setSelectedAdGroup] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // API Functions
  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    try {
      const response = await fetch(`/api/google-ads?${new URLSearchParams(endpoint)}`, {
        method: 'GET',
        ...options
      });
      if (!response.ok) => {
        throw new Error(`API Error: ${response.statusText}`);
      }

      try {


      return await response.json();


      } catch (error) {


        console.error(error);


        return false;


      }
    } catch (error) {
      logger.error('API call failed:', new EnhancedError('API call failed:', { error: error instanceof Error ? error.message : String(error)  }));
      throw error;
    }
  }, []);

  const apiPost = useCallback(async (action: string, data: unknown) => {
    try {
      const response = await fetch('/api/google-ads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, data })
      });

      if (!response.ok) => {
        throw new Error(`API Error: ${response.statusText}`);
      }

      try {


      return await response.json();


      } catch (error) {


        console.error(error);


        return false;


      }
    } catch (error) {
      logger.error('API POST failed:', new EnhancedError('API POST failed:', { error: error instanceof Error ? error.message : String(error)  }));
      throw error;
    }
  }, []);

  // Data Loading Functions
  const loadCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await apiCall('action=campaigns');
      setCampaigns(result.campaigns || []);
    } catch (error: unknown) => {
      setError('加载广告系列失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  }, [apiCall]);

  const loadPerformance = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        action: 'performance',
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      const result = await apiCall(params.toString());
      setPerformance(result.performance || []);
    } catch (error: unknown) => {
      setError('加载表现数据失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  }, [apiCall]);

  const loadRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await apiCall('action=recommendations');
      setRecommendations(result.recommendations || []);
    } catch (error: unknown) => {
      setError('加载优化建议失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  }, [apiCall]);

  const loadAdGroups = useCallback(async (campaignId: string) => {
    if (!campaignId) return;
    
    setIsLoading(true);
    setError('');
    try {
      const result = await apiPost('get-ad-groups', { campaignId });
      setAdGroups(result.adGroups || []);
    } catch (error: unknown) => {
      setError('加载广告组失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  }, [apiPost]);

  const loadAds = useCallback(async (adGroupId: string) => {
    if (!adGroupId) return;
    
    setIsLoading(true);
    setError('');
    try {
      const result = await apiPost('get-ads', { adGroupId });
      setAds(result.ads || []);
    } catch (error: unknown) => {
      setError('加载广告失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  }, [apiPost]);

  // Action Functions
  const pauseCampaign = useCallback(async (campaignId: string) => {
    try {
      await apiPost('pause-campaign', { campaignId });
      await loadCampaigns();
    } catch (error: unknown) => {
      setError('暂停广告系列失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }, [apiPost, loadCampaigns]);
  const enableCampaign = useCallback(async (campaignId: string) => {
    try {
      await apiPost('enable-campaign', { campaignId });
      await loadCampaigns();
    } catch (error: unknown) => {
      setError('启用广告系列失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }, [apiPost, loadCampaigns]);
  const applyRecommendation = useCallback(async (recommendation: OptimizationRecommendation) => {
    try {
      // This would implement the recommendation
      logger.info('Applying recommendation:', recommendation);
      // In a real implementation, this would call the appropriate API
      await loadRecommendations();
    } catch (error: unknown) => {
      setError('应用建议失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }, [loadRecommendations]);
  // Effects
  useEffect(() => {
    loadCampaigns();
    loadPerformance();
    loadRecommendations();
  }, [loadCampaigns, loadPerformance, loadRecommendations]);

  useEffect(() => {
    if (selectedCampaign) => {
      loadAdGroups(selectedCampaign);
    }
  }, [selectedCampaign, loadAdGroups]);

  useEffect(() => {
    if (selectedAdGroup) => {
      loadAds(selectedAdGroup);
    }
  }, [selectedAdGroup, loadAds]);
  // Utility Functions
  const getStatusColor = (status: string) => {
    switch (status) => {
      case 'ENABLED':
        return 'text-green-600 bg-green-100';
      case 'PAUSED':
        return 'text-yellow-600 bg-yellow-100';
      case 'REMOVED':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getChannelTypeIcon = (type: string) => {
    switch (type) => {
      case 'SEARCH':
        return <Search className="h-4 w-4" />;
      case 'DISPLAY':
        return <Image className="h-4 w-4" />;
      case 'SHOPPING':
        return <ShoppingCart className="h-4 w-4" />;
      case 'VIDEO':
        return <Video className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) => {
      case 'HIGH':
        return 'text-red-600 bg-red-100';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-100';
      case 'LOW':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Google Ads 集成</h2>
          <p className="text-muted-foreground">实时管理Google Ads广告系列和优化</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={(async (): any) => {
            await loadCampaigns();
            await loadPerformance();
            await loadRecommendations();
          }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新建广告系列
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="campaigns">广告系列</TabsTrigger>
          <TabsTrigger value="performance">表现分析</TabsTrigger>
          <TabsTrigger value="recommendations">优化建议</TabsTrigger>
          <TabsTrigger value="ad-groups">广告组</TabsTrigger>
          <TabsTrigger value="ads">广告</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Performance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总广告系列</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaigns.length}</div>
                <p className="text-xs text-muted-foreground">
                  {campaigns.filter((c: any) => c.status === 'ENABLED').length} 个活跃
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总点击</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performance.reduce((sum, p: any) => sum + p.clicks, 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  平均CTR {formatPercentage(performance.reduce((sum, p: any) => sum + p.ctr, 0) / Math.max(performance.length, 1))}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总花费</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(performance.reduce((sum, p: any) => sum + p.cost, 0))}
                </div>
                <p className="text-xs text-muted-foreground">
                  平均CPC {formatCurrency(performance.reduce((sum, p: any) => sum + p.cpc, 0) / Math.max(performance.length, 1))}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">转化</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performance.reduce((sum, p: any) => sum + p.conversions, 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  转化率 {formatPercentage(performance.reduce((sum, p: any) => sum + p.conversionRate, 0) / Math.max(performance.length, 1))}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Campaigns */}
          <Card>
            <CardHeader>
              <CardTitle>最近广告系列</CardTitle>
              <CardDescription>最近创建和更新的广告系列</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaigns.slice(0, 5).map((campaign: any) => (
                  <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getChannelTypeIcon(campaign.advertisingChannelType)}
                      <div>
                        <h3 className="font-medium">{campaign.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {campaign.advertisingChannelType} • {campaign.biddingStrategyType}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(campaign.status)}>
                        {campaign.status === 'ENABLED' ? '活跃' : 
                         campaign.status === 'PAUSED' ? '暂停' : '已删除'}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => campaign.status === 'ENABLED' ? 
                          pauseCampaign(campaign.id) : enableCampaign(campaign.id)}
                      >
                        {campaign.status === 'ENABLED' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>广告系列管理</CardTitle>
              <CardDescription>查看和管理所有Google Ads广告系列</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaigns.map((campaign: any) => (
                  <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getChannelTypeIcon(campaign.advertisingChannelType)}
                      <div>
                        <h3 className="font-medium">{campaign.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          ID: {campaign.id} • 开始日期: {campaign.startDate}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {campaign.advertisingChannelType} • {campaign.biddingStrategyType}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(campaign.status)}>
                        {campaign.status === 'ENABLED' ? '活跃' : 
                         campaign.status === 'PAUSED' ? '暂停' : '已删除'}
                      </Badge>
                      
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedCampaign(campaign.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => campaign.status === 'ENABLED' ? 
                            pauseCampaign(campaign.id) : enableCampaign(campaign.id)}
                        >
                          {campaign.status === 'ENABLED' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          {/* Date Range Selector */}
          <Card>
            <CardHeader>
              <CardTitle>表现分析</CardTitle>
              <CardDescription>查看广告系列表现数据</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4 mb-6">
                <div>
                  <Label htmlFor="startDate">开始日期</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={dateRange.startDate}
                    onChange={((e: any) => setDateRange(prev: any) => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">结束日期</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={dateRange.endDate}
                    onChange={((e: any) => setDateRange(prev: any) => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
                <Button onClick={(async (): any) => await loadPerformance()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  更新数据
                </Button>
              </div>

              <div className="space-y-4">
                {performance.map((perf: any) => (
                  <div key={perf.campaignId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium">{perf.campaignName}</h3>
                      <Badge className={perf.roas > 4 ? 'text-green-600 bg-green-100' : 'text-yellow-600 bg-yellow-100'}>
                        ROAS: {perf.roas.toFixed(2)}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">展示次数:</span>
                        <span className="font-medium ml-2">{perf.impressions.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">点击次数:</span>
                        <span className="font-medium ml-2">{perf.clicks.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">花费:</span>
                        <span className="font-medium ml-2">{formatCurrency(perf.cost)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">转化:</span>
                        <span className="font-medium ml-2">{perf.conversions.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">CTR:</span>
                        <span className="font-medium ml-2">{formatPercentage(perf.ctr)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">CPC:</span>
                        <span className="font-medium ml-2">{formatCurrency(perf.cpc)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">转化率:</span>
                        <span className="font-medium ml-2">{formatPercentage(perf.conversionRate)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">质量得分:</span>
                        <span className="font-medium ml-2">{perf.qualityScore}/10</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>优化建议</CardTitle>
              <CardDescription>基于表现数据的智能优化建议</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendations.map((recommendation, index: any) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Badge className={getPriorityColor(recommendation.priority)}>
                          {recommendation.priority === 'HIGH' ? '高优先级' :
                           recommendation.priority === 'MEDIUM' ? '中优先级' : '低优先级'}
                        </Badge>
                        <Badge variant="outline">{recommendation.type}</Badge>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => applyRecommendation(recommendation)}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        应用建议
                      </Button>
                    </div>
                    
                    <p className="text-sm mb-3">{recommendation.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">预期影响:</span>
                        <span className="font-medium ml-2">
                          {recommendation.expectedImpact.metric} 
                          {recommendation.expectedImpact.direction === 'INCREASE' ? '+' : '-'}
                          {recommendation.expectedImpact.change}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">实施操作:</span>
                        <span className="font-medium ml-2">{recommendation.implementation.action}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ad Groups Tab */}
        <TabsContent value="ad-groups" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>广告组管理</CardTitle>
              <CardDescription>管理广告系列下的广告组</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label htmlFor="campaign-select">选择广告系列</Label>
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择广告系列" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((campaign: any) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                {adGroups.map((adGroup: any) => (
                  <div key={adGroup.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{adGroup.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        ID: {adGroup.id} • 类型: {adGroup.type}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(adGroup.status)}>
                        {adGroup.status === 'ENABLED' ? '活跃' : 
                         adGroup.status === 'PAUSED' ? '暂停' : '已删除'}
                      </Badge>
                      
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedAdGroup(adGroup.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ads Tab */}
        <TabsContent value="ads" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>广告管理</CardTitle>
              <CardDescription>管理广告组下的广告</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label htmlFor="ad-group-select">选择广告组</Label>
                <Select value={selectedAdGroup} onValueChange={setSelectedAdGroup}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择广告组" />
                  </SelectTrigger>
                  <SelectContent>
                    {adGroups.map((adGroup: any) => (
                      <SelectItem key={adGroup.id} value={adGroup.id}>
                        {adGroup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                {ads.map((ad: any) => (
                  <div key={ad.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium">{ad.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          ID: {ad.id} • 类型: {ad.type}
                        </p>
                      </div>
                      <Badge className={getStatusColor(ad.status)}>
                        {ad.status === 'ENABLED' ? '活跃' : 
                         ad.status === 'PAUSED' ? '暂停' : '已删除'}
                      </Badge>
                    </div>
                    
                    {ad.headlines && ad.headlines.length > 0 && (
                      <div className="mb-2">
                        <span className="text-sm text-muted-foreground">标题:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {ad.headlines.map((headline, index: any) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {headline}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {ad.descriptions && ad.descriptions.length > 0 && (
                      <div className="mb-2">
                        <span className="text-sm text-muted-foreground">描述:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {ad.descriptions.map((description, index: any) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {description}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4 mr-2" />
                        编辑
                      </Button>
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-2" />
                        预览
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span>加载中...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 