'use client';

import React, { memo, useCallback } from 'react';
import { Users, TestTube } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface GoogleAdsAccount {
  id: string;
  name: string;
  customerId: string;
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  loginCustomerId?: string;
  isActive: boolean;
  status: 'connected' | 'disconnected' | 'error';
}

interface GoogleAdsStepProps {
  accounts: GoogleAdsAccount[];
  newAccount: Partial<GoogleAdsAccount>;
  loading: boolean;
  onAccountChange: (account: Partial<GoogleAdsAccount>) => void;
  onAddAccount: () => void;
  onTestConnection: (accountId: string) => void;
}

export const GoogleAdsStep = memo(({ 
  accounts, 
  newAccount, 
  loading, 
  onAccountChange, 
  onAddAccount, 
  onTestConnection 
}: GoogleAdsStepProps) => {
  const handleInputChange = useCallback((field: keyof GoogleAdsAccount, value: string) => {
    onAccountChange({ ...newAccount, [field]: value });
  }, [newAccount, onAccountChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="h-5 w-5 mr-2" />
          Google Ads账号配置
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 现有账号列表 */}
        {accounts.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">已配置的账号</h4>
            <div className="space-y-2">
              {accounts?.filter(Boolean)?.map((account: any) => (
                <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{account.name}</div>
                    <div className="text-sm text-gray-600">Customer ID: {account.customerId}</div>
                    {account.loginCustomerId && (
                      <div className="text-sm text-gray-500">
                        Login Customer ID: {account.loginCustomerId.split('\n').filter((id: any) => id.trim()).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={account.status === 'connected' ? 'default' : 'secondary'}>
                      {account.status === 'connected' ? '已连接' : '未连接'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onTestConnection(account.id)}
                      disabled={loading}
                    >
                      <TestTube className="h-4 w-4 mr-1" />
                      测试
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 添加新账号表单 */}
        <div>
          <h4 className="font-medium mb-3">添加新的Google Ads账号</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">账号名称（Account Name）*<br/><span className="text-xs text-gray-500">自定义的Google Ads账号标识名称</span></label>
              <input
                type="text"
                value={newAccount.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="我的Google Ads账号"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">登录客户ID（Login Customer ID）*<br/><span className="text-xs text-gray-500">MCC账户ID，格式：123-456-7890</span></label>
              <input
                type="text"
                value={newAccount.loginCustomerId || ''}
                onChange={((e: any): any) => handleInputChange('loginCustomerId', e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="123-456-7890"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">客户端ID（Client ID）*<br/><span className="text-xs text-gray-500">OAuth 2.0客户端ID</span></label>
              <input
                type="text"
                value={newAccount.clientId || ''}
                onChange={((e: any): any) => handleInputChange('clientId', e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="123456789-abc123def456.apps.googleusercontent.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">客户端密钥（Client Secret）*<br/><span className="text-xs text-gray-500">OAuth 2.0客户端密钥</span></label>
              <input
                type="password"
                value={newAccount.clientSecret || ''}
                onChange={((e: any): any) => handleInputChange('clientSecret', e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="请输入Client Secret"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">开发者令牌（Developer Token）*<br/><span className="text-xs text-gray-500">Google Ads API开发者访问令牌</span></label>
              <input
                type="text"
                value={newAccount.developerToken || ''}
                onChange={((e: any): any) => handleInputChange('developerToken', e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="ABcdeFG1234567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">刷新令牌（Refresh Token）<br/><span className="text-xs text-gray-500">用于API访问的长期凭证（可选）</span></label>
              <input
                type="password"
                value={newAccount.refreshToken || ''}
                onChange={((e: any): any) => handleInputChange('refreshToken', e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="请输入Refresh Token（可选）"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">客户ID列表（Customer IDs）*<br/><span className="text-xs text-gray-500">要管理的客户账户ID，每行一个</span></label>
              <textarea
                value={newAccount.customerId || ''}
                onChange={((e: any): any) => handleInputChange('customerId', e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="123-456-7890&#10;234-567-8901&#10;345-678-9012"
                rows={3}
              />
            </div>
          </div>

          <div className="mt-4">
            <Button
              onClick={onAddAccount}
              disabled={loading}
              className="flex items-center"
            >
              <Users className="h-4 w-4 mr-2" />
              {loading ? '添加中...' : '添加账号'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

GoogleAdsStep.displayName = 'GoogleAdsStep';
