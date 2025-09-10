'use client';

import React, { memo, useCallback } from 'react';
import { Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Configuration {
  id: string;
  name: string;
  description?: string;
  environmentId: string;
  repeatCount: number;
  notificationEmail?: string;
  originalLinks: string[];
  googleAdsAccounts: Array<{
    accountId: string;
    accountName: string;
  }>;
  status: 'active' | 'paused' | 'stopped';
}

interface GoogleAdsAccount {
  id: string;
  name: string;
}

interface AffiliateLink {
  id: string;
  name: string;
}

interface AdsPowerEnvironment {
  id: string;
  name: string;
  environmentId: string;
}

interface ConfigurationStepProps {
  configurations: Configuration[];
  newConfiguration: Partial<Configuration>;
  loading: boolean;
  googleAdsAccounts: GoogleAdsAccount[];
  affiliateLinks: AffiliateLink[];
  adsPowerEnvironments: AdsPowerEnvironment[];
  onConfigurationChange: (config: Partial<Configuration>) => void;
  onCreateConfiguration: () => void;
}

export const ConfigurationStep = memo(({ 
  configurations, 
  newConfiguration, 
  loading, 
  googleAdsAccounts,
  affiliateLinks,
  adsPowerEnvironments,
  onConfigurationChange,
  onCreateConfiguration
}: ConfigurationStepProps) => {
  const handleInputChange = useCallback((field: keyof Configuration, value: string | number | string[] | Array<{accountId: string; accountName: string}>) => {
    onConfigurationChange({ ...newConfiguration, [field]: value });
  }, [newConfiguration, onConfigurationChange]);

  const handleLinkToggle = useCallback((linkId: string, checked: boolean) => {
    const links = newConfiguration.originalLinks || [];
    if (checked) {
      handleInputChange('originalLinks', [...links, linkId]);
    } else {
      handleInputChange('originalLinks', links.filter(id => id !== linkId));
    }
  }, [newConfiguration.originalLinks, handleInputChange]);

  const handleAccountToggle = useCallback((accountId: string, accountName: string, checked: boolean) => {
    const accounts = newConfiguration.googleAdsAccounts || [];
    if (checked) {
      handleInputChange('googleAdsAccounts', [...accounts, { accountId, accountName }]);
    } else {
      handleInputChange('googleAdsAccounts', accounts.filter(acc => acc.accountId !== accountId));
    }
  }, [newConfiguration.googleAdsAccounts, handleInputChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Database className="h-5 w-5 mr-2" />
          关联配置创建
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 现有配置列表 */}
        {configurations.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">已创建的配置</h4>
            <div className="space-y-2">
              {configurations?.filter(Boolean)?.map(config => (
                <div key={config.id} className="p-3 border rounded-lg">
                  <div className="font-medium">{config.name}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    环境: {adsPowerEnvironments.find(env => env.id === config.environmentId)?.name || config.environmentId}
                  </div>
                  <div className="text-sm text-gray-600">
                    链接数: {config.originalLinks.length} | 账户数: {config.googleAdsAccounts.length}
                  </div>
                  <Badge variant={config.status === 'active' ? 'default' : 'secondary'} className="mt-2">
                    {config.status === 'active' ? '活跃' : '暂停'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 创建新配置表单 */}
        <div>
          <h4 className="font-medium mb-3">创建新的执行配置</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">配置名称（Configuration Name）*<br/><span className="text-xs text-gray-500">自定义的执行配置标识名称</span></label>
              <input
                type="text"
                value={newConfiguration.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="我的自动化配置"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">配置描述（Description）<br/><span className="text-xs text-gray-500">配置的详细说明和用途</span></label>
              <textarea
                value={newConfiguration.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                rows={3}
                placeholder="配置描述和用途说明"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">执行环境（Execution Environment）*<br/><span className="text-xs text-gray-500">选择用于自动化执行的AdsPower环境</span></label>
                <select
                  value={newConfiguration.environmentId || ''}
                  onChange={(e) => handleInputChange('environmentId', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">选择环境</option>
                  {adsPowerEnvironments?.filter(Boolean)?.map(env => (
                    <option key={env.id} value={env.id}>
                      {env.name} ({env.environmentId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">重复次数（Repeat Count）<br/><span className="text-xs text-gray-500">每个链接的重复执行次数（1-10次）</span></label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newConfiguration.repeatCount || 1}
                  onChange={(e) => handleInputChange('repeatCount', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">通知邮箱（Notification Email）<br/><span className="text-xs text-gray-500">执行结果通知的邮箱地址（可选）</span></label>
              <input
                type="email"
                value={newConfiguration.notificationEmail || ''}
                onChange={(e) => handleInputChange('notificationEmail', e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">联盟链接选择（Affiliate Links）<br/><span className="text-xs text-gray-500">选择需要自动更新的广告联盟链接</span></label>
              <div className="space-y-2">
                {affiliateLinks?.filter(Boolean)?.map(link => (
                  <label key={link.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newConfiguration.originalLinks?.includes(link.id) || false}
                      onChange={(e) => handleLinkToggle(link.id, e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">{link.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Google Ads账户（Google Ads Accounts）<br/><span className="text-xs text-gray-500">选择用于链接更新的Google Ads账户</span></label>
              <div className="space-y-2">
                {googleAdsAccounts?.filter(Boolean)?.map(account => (
                  <label key={account.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newConfiguration.googleAdsAccounts?.some(acc => acc.accountId === account.id) || false}
                      onChange={(e) => handleAccountToggle(account.id, account.name, e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">{account.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Button
              onClick={onCreateConfiguration}
              disabled={loading || !newConfiguration.name || !newConfiguration.environmentId || 
                       googleAdsAccounts.length === 0 || affiliateLinks.length === 0 || adsPowerEnvironments.length === 0}
              className="flex items-center"
            >
              <Database className="h-4 w-4 mr-2" />
              {loading ? '创建中...' : '创建配置'}
            </Button>
          </div>
        </div>

        {/* 快速跳转到配置管理 */}
        {configurations.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-blue-900">配置已创建</h4>
                <p className="text-sm text-blue-700">您可以前往配置管理页面进行详细设置和执行</p>
              </div>
              <Button
                onClick={() => window.location.href = '/adscenter/configurations'}
                variant="outline"
                className="text-blue-700 border-blue-300 hover:bg-blue-50"
              >
                前往配置管理
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

ConfigurationStep.displayName = 'ConfigurationStep';