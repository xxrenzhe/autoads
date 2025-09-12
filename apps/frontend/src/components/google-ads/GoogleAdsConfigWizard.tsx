'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Wand2, 
  Settings, 
  Link, 
  Clock, 
  Target, 
  CheckCircle, 
  XCircle,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

interface AffiliateLinkConfig {
  id: string;
  name: string;
  originalUrl: string;
  affiliateUrl: string;
  trackingParameters: string;
  urlSuffix: string;
  isActive: boolean;
  priority: number;
  conditions: {
    urlPatterns: string[];
    campaignIds: string[];
    adGroupIds: string[];
    adTypes: string[];
  };
}

interface AccountConfig {
  accountId: string;
  accountName: string;
  affiliateLinks: AffiliateLinkConfig[];
  updateSchedule: {
    enabled: boolean;
    frequency: 'hourly' | 'daily' | 'weekly';
    time: string;
    timezone: string;
  };
  executionOrder: 'priority' | 'random' | 'roundrobin';
  defaultUrlSuffix: string;
  globalTrackingParams: string;
}

interface GoogleAdsConfigWizardProps {
  initialConfig?: Partial<AccountConfig>;
  onSave: (config: AccountConfig) => Promise<void>;
  onCancel: () => void;
  onOAuthStart?: () => void;
  isAuthenticated?: boolean;
  availableAccounts?: Array<{id: string, name: string}>;
}

export function GoogleAdsConfigWizard({ 
  initialConfig, 
  onSave, 
  onCancel, 
  onOAuthStart,
  isAuthenticated = false,
  availableAccounts = []
}: GoogleAdsConfigWizardProps) {
  const [activeStep, setActiveStep] = useState<'auth' | 'account' | 'basic' | 'links' | 'schedule' | 'review'>('auth');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [config, setConfig] = useState<AccountConfig>({
    accountId: initialConfig?.accountId || '',
    accountName: initialConfig?.accountName || '',
    affiliateLinks: initialConfig?.affiliateLinks || [],
    updateSchedule: initialConfig?.updateSchedule || {
      enabled: false,
      frequency: 'daily',
      time: '09:00',
      timezone: 'America/New_York',
    },
    executionOrder: initialConfig?.executionOrder || 'priority',
    defaultUrlSuffix: initialConfig?.defaultUrlSuffix || '',
    globalTrackingParams: initialConfig?.globalTrackingParams || '',
  });

  const [newLink, setNewLink] = useState<Partial<AffiliateLinkConfig>>({
    name: '',
    originalUrl: '',
    affiliateUrl: '',
    trackingParameters: '',
    urlSuffix: '',
    isActive: true,
    priority: 1,
    conditions: {
      urlPatterns: [],
      campaignIds: [],
      adGroupIds: [],
      adTypes: [],
    },
  });

  const handleSaveConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await onSave(config);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save configuration');
    } finally {
      setIsLoading(false);
    }
  }, [config, onSave]);

  const addAffiliateLink = useCallback(() => {
    if (!newLink.name || !newLink.originalUrl || !newLink.affiliateUrl) {
      setError('Please fill in all required fields for the affiliate link');
      return;
    }

    const link: AffiliateLinkConfig = {
      id: Math.random().toString(36).substring(7),
      name: newLink.name!,
      originalUrl: newLink.originalUrl!,
      affiliateUrl: newLink.affiliateUrl!,
      trackingParameters: newLink.trackingParameters || '',
      urlSuffix: newLink.urlSuffix || '',
      isActive: newLink.isActive!,
      priority: newLink.priority!,
      conditions: newLink.conditions!,
    };

    setConfig(prev => ({
      ...prev,
      affiliateLinks: [...prev.affiliateLinks, link],
    }));

    setNewLink({
      name: '',
      originalUrl: '',
      affiliateUrl: '',
      trackingParameters: '',
      urlSuffix: '',
      isActive: true,
      priority: 1,
      conditions: {
        urlPatterns: [],
        campaignIds: [],
        adGroupIds: [],
        adTypes: [],
      },
    });
    setError(null);
  }, [newLink]);

  const removeAffiliateLink = useCallback((linkId: string) => {
    setConfig(prev => ({
      ...prev,
      affiliateLinks: prev.affiliateLinks.filter(link => link.id !== linkId),
    }));
  }, []);

  const nextStep = useCallback(() => {
    const steps = ['auth', 'account', 'basic', 'links', 'schedule', 'review'];
    const currentIndex = steps.indexOf(activeStep);
    if (currentIndex < steps.length - 1) {
      setActiveStep(steps[currentIndex + 1] as any);
    }
  }, [activeStep]);

  const prevStep = useCallback(() => {
    const steps = ['auth', 'account', 'basic', 'links', 'schedule', 'review'];
    const currentIndex = steps.indexOf(activeStep);
    if (currentIndex > 0) {
      setActiveStep(steps[currentIndex - 1] as any);
    }
  }, [activeStep]);

  const isStepComplete = useCallback((step: string) => {
    switch (step) {
      case 'auth':
        return isAuthenticated;
      case 'account':
        return config.accountId && config.accountName;
      case 'basic':
        return true;
      case 'links':
        return config.affiliateLinks.length > 0;
      case 'schedule':
        return true;
      case 'review':
        return true;
      default:
        return false;
    }
  }, [isAuthenticated, config]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Indicator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Wand2 className="w-5 h-5 mr-2" />
            Google Ads 配置向导
          </CardTitle>
          <CardDescription>
            设置 Google Ads 账户和自动化链接更新规则
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            {['auth', 'account', 'basic', 'links', 'schedule', 'review'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    activeStep === step
                      ? 'bg-blue-600 text-white'
                      : isStepComplete(step)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {isStepComplete(step) ? <CheckCircle className="w-4 h-4" /> : index + 1}
                </div>
                {index < 5 && (
                  <div
                    className={`w-16 h-1 mx-2 ${
                      isStepComplete(step) ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {error && (
            <Alert className="mb-4">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs value={activeStep} onValueChange={(value) => setActiveStep(value as any)}>
            <TabsList className="hidden">
              <TabsTrigger value="auth">认证</TabsTrigger>
              <TabsTrigger value="account">账户</TabsTrigger>
              <TabsTrigger value="basic">基础设置</TabsTrigger>
              <TabsTrigger value="links">链接配置</TabsTrigger>
              <TabsTrigger value="schedule">调度设置</TabsTrigger>
              <TabsTrigger value="review">确认</TabsTrigger>
            </TabsList>

            {/* Authentication Step */}
            <TabsContent value="auth" className="space-y-4">
              <div className="text-center space-y-4">
                {isAuthenticated ? (
                  <div className="space-y-4">
                    <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
                    <h3 className="text-lg font-medium text-green-600">认证成功</h3>
                    <p className="text-gray-600">您已成功连接到 Google Ads 账户</p>
                    <Button onClick={nextStep}>
                      下一步
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                      <Settings className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-medium">连接 Google Ads 账户</h3>
                    <p className="text-gray-600">
                      需要授权访问您的 Google Ads 账户以配置自动化链接更新
                    </p>
                    <Button onClick={onOAuthStart} size="lg">
                      开始认证
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Account Selection Step */}
            <TabsContent value="account" className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">选择 Google Ads 账户</h3>
                
                <div>
                  <Label htmlFor="accountSelect">选择账户</Label>
                  <Select
                    value={config.accountId}
                    onValueChange={(value) => {
                      const selectedAccount = availableAccounts.find(acc => acc.id === value);
                      setConfig(prev => ({
                        ...prev,
                        accountId: value,
                        accountName: selectedAccount?.name || '',
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择 Google Ads 账户" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {config.accountId && (
                  <div>
                    <Label htmlFor="accountName">显示名称</Label>
                    <Input
                      id="accountName"
                      placeholder="为此配置输入一个友好的名称"
                      value={config.accountName}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        accountName: e.target.value
                      }))}
                    />
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={prevStep}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    上一步
                  </Button>
                  <Button onClick={nextStep} disabled={!config.accountId || !config.accountName}>
                    下一步
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Basic Settings */}
            <TabsContent value="basic" className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">基础设置</h3>
                
                <div>
                  <Label htmlFor="executionOrder">执行顺序</Label>
                  <Select
                    value={config.executionOrder}
                    onValueChange={(value) => setConfig(prev => ({
                      ...prev,
                      executionOrder: value as 'priority' | 'random' | 'roundrobin'
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="priority">按优先级</SelectItem>
                      <SelectItem value="random">随机</SelectItem>
                      <SelectItem value="roundrobin">轮询</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500 mt-1">
                    选择链接分配给广告的顺序策略
                  </p>
                </div>

                <div>
                  <Label htmlFor="defaultUrlSuffix">默认 URL 后缀</Label>
                  <Input
                    id="defaultUrlSuffix"
                    placeholder="例如: ?utm_source=google&utm_medium=cpc"
                    value={config.defaultUrlSuffix}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      defaultUrlSuffix: e.target.value
                    }))}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    将添加到所有更新链接的默认参数
                  </p>
                </div>

                <div>
                  <Label htmlFor="globalTrackingParams">全局跟踪参数 (JSON格式)</Label>
                  <Textarea
                    id="globalTrackingParams"
                    placeholder={`{"utm_source": "google", "utm_medium": "cpc"}`}
                    value={config.globalTrackingParams}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      globalTrackingParams: e.target.value
                    }))}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    全局跟踪参数，将与所有链接合并
                  </p>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={prevStep}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    上一步
                  </Button>
                  <Button onClick={nextStep}>
                    下一步
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Link Configuration */}
            <TabsContent value="links" className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">添加联盟链接配置</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="linkName">配置名称 *</Label>
                    <Input
                      id="linkName"
                      placeholder="例如: Amazon产品链接"
                      value={newLink.name}
                      onChange={(e) => setNewLink(prev => ({
                        ...prev,
                        name: e.target.value
                      }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="priority">优先级</Label>
                    <Input
                      id="priority"
                      type="number"
                      min="1"
                      max="10"
                      value={newLink.priority}
                      onChange={(e) => setNewLink(prev => ({
                        ...prev,
                        priority: parseInt(e.target.value) || 1
                      }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="originalUrl">原始 URL 模式 *</Label>
                    <Input
                      id="originalUrl"
                      placeholder="例如: https://example.com/product/.*"
                      value={newLink.originalUrl}
                      onChange={(e) => setNewLink(prev => ({
                        ...prev,
                        originalUrl: e.target.value
                      }))}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      支持正则表达式匹配
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="affiliateUrl">联盟链接 *</Label>
                    <Input
                      id="affiliateUrl"
                      placeholder="例如: https://affiliate.com/product?id=123"
                      value={newLink.affiliateUrl}
                      onChange={(e) => setNewLink(prev => ({
                        ...prev,
                        affiliateUrl: e.target.value
                      }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="trackingParams">跟踪参数</Label>
                    <Input
                      id="trackingParams"
                      placeholder="例如: utm_campaign=spring_sale"
                      value={newLink.trackingParameters}
                      onChange={(e) => setNewLink(prev => ({
                        ...prev,
                        trackingParameters: e.target.value
                      }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="urlSuffix">URL 后缀</Label>
                    <Input
                      id="urlSuffix"
                      placeholder="例如: ?ref=affiliate123"
                      value={newLink.urlSuffix}
                      onChange={(e) => setNewLink(prev => ({
                        ...prev,
                        urlSuffix: e.target.value
                      }))}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={newLink.isActive}
                    onCheckedChange={(checked) => setNewLink(prev => ({
                      ...prev,
                      isActive: checked
                    }))}
                  />
                  <Label htmlFor="isActive">启用此配置</Label>
                </div>

                <Button onClick={addAffiliateLink} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  添加配置
                </Button>

                {/* 已配置的链接 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">已配置的链接 ({config.affiliateLinks.length})</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {config.affiliateLinks.map((link) => (
                      <div key={link.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{link.name}</div>
                          <div className="text-sm text-gray-500 truncate">
                            {link.originalUrl} → {link.affiliateUrl}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant={link.isActive ? 'default' : 'secondary'}>
                              {link.isActive ? '启用' : '禁用'}
                            </Badge>
                            <Badge variant="outline">优先级: {link.priority}</Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeAffiliateLink(link.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={prevStep}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    上一步
                  </Button>
                  <Button onClick={nextStep} disabled={config.affiliateLinks.length === 0}>
                    下一步
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Schedule Settings */}
            <TabsContent value="schedule" className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">调度设置</h3>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="scheduleEnabled"
                    checked={config.updateSchedule.enabled}
                    onCheckedChange={(checked) => setConfig(prev => ({
                      ...prev,
                      updateSchedule: {
                        ...prev.updateSchedule,
                        enabled: checked
                      }
                    }))}
                  />
                  <Label htmlFor="scheduleEnabled">启用自动更新</Label>
                </div>

                {config.updateSchedule.enabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="frequency">更新频率</Label>
                      <Select
                        value={config.updateSchedule.frequency}
                        onValueChange={(value) => setConfig(prev => ({
                          ...prev,
                          updateSchedule: {
                            ...prev.updateSchedule,
                            frequency: value as 'hourly' | 'daily' | 'weekly'
                          }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">每小时</SelectItem>
                          <SelectItem value="daily">每天</SelectItem>
                          <SelectItem value="weekly">每周</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="time">执行时间</Label>
                      <Input
                        id="time"
                        type="time"
                        value={config.updateSchedule.time}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          updateSchedule: {
                            ...prev.updateSchedule,
                            time: e.target.value
                          }
                        }))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="timezone">时区</Label>
                      <Select
                        value={config.updateSchedule.timezone}
                        onValueChange={(value) => setConfig(prev => ({
                          ...prev,
                          updateSchedule: {
                            ...prev.updateSchedule,
                            timezone: value
                          }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/New_York">纽约时间</SelectItem>
                          <SelectItem value="America/Los_Angeles">洛杉矶时间</SelectItem>
                          <SelectItem value="Europe/London">伦敦时间</SelectItem>
                          <SelectItem value="Asia/Shanghai">北京时间</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={prevStep}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    上一步
                  </Button>
                  <Button onClick={nextStep}>
                    下一步
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Review */}
            <TabsContent value="review" className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">配置确认</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>账户名称</Label>
                    <div className="text-sm text-gray-600">{config.accountName}</div>
                  </div>
                  <div>
                    <Label>账户ID</Label>
                    <div className="text-sm text-gray-600">{config.accountId}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>执行顺序</Label>
                    <div className="text-sm text-gray-600">
                      {config.executionOrder === 'priority' && '按优先级'}
                      {config.executionOrder === 'random' && '随机'}
                      {config.executionOrder === 'roundrobin' && '轮询'}
                    </div>
                  </div>
                  <div>
                    <Label>自动更新</Label>
                    <div className="text-sm text-gray-600">
                      {config.updateSchedule.enabled ? '启用' : '禁用'}
                    </div>
                  </div>
                </div>

                {config.updateSchedule.enabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>更新频率</Label>
                      <div className="text-sm text-gray-600">
                        {config.updateSchedule.frequency === 'hourly' && '每小时'}
                        {config.updateSchedule.frequency === 'daily' && '每天'}
                        {config.updateSchedule.frequency === 'weekly' && '每周'}
                      </div>
                    </div>
                    <div>
                      <Label>执行时间</Label>
                      <div className="text-sm text-gray-600">
                        {config.updateSchedule.time} ({config.updateSchedule.timezone})
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <Label>默认 URL 后缀</Label>
                  <div className="text-sm text-gray-600">
                    {config.defaultUrlSuffix || '无'}
                  </div>
                </div>

                <div>
                  <Label>联盟链接配置 ({config.affiliateLinks.length})</Label>
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                    {config.affiliateLinks.map((link) => (
                      <div key={link.id} className="p-2 bg-gray-50 rounded text-sm">
                        <div className="font-medium">{link.name}</div>
                        <div className="text-gray-600 truncate">
                          {link.originalUrl} → {link.affiliateUrl}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant={link.isActive ? 'default' : 'secondary'}>
                            {link.isActive ? '启用' : '禁用'}
                          </Badge>
                          <Badge variant="outline">优先级: {link.priority}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={prevStep}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    上一步
                  </Button>
                  <div className="space-x-2">
                    <Button variant="outline" onClick={onCancel}>
                      取消
                    </Button>
                    <Button onClick={handleSaveConfig} disabled={isLoading}>
                      <Save className="w-4 h-4 mr-2" />
                      {isLoading ? '保存中...' : '保存配置'}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}