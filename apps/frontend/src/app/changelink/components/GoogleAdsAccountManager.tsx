'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { EnhancedError } from '@/lib/utils/error-handling';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  RefreshCw, 
  ExternalLink, 
  Trash2, 
  Settings, 
  Users, 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Download,
  Upload,
  Search,
  Filter
} from 'lucide-react';

interface GoogleAdsAccount {
  id: string;
  name: string;
  customerId: string;
  managerId?: string;
  status: 'active' | 'suspended' | 'pending' | 'inactive';
  accessLevel: 'admin' | 'standard' | 'readonly';
  lastSync?: string;
  campaignsCount?: number;
  budget?: number;
  currency?: string;
}

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

const GoogleAdsAccountManager: React.FC = () => {
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<GoogleAdsAccount | null>(null);
  const [oauthConfig, setOauthConfig] = useState<OAuthConfig>({
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    scopes: ['https://www.googleapis.com/auth/adwords']
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  // 初始化账户列表
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/adscenter/oauth/accounts');
      if (!response.ok) {
        throw new Error('Failed to load accounts');
      }
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  // 开始 OAuth 认证流程
  const startOAuthFlow = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const response = await fetch('/api/adscenter/oauth/auth-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: oauthConfig.clientId,
          redirectUri: oauthConfig.redirectUri,
          scopes: oauthConfig.scopes
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start OAuth flow');
      }

      const data = await response.json();
      if (data.authUrl) {
        window.open(data.authUrl, '_blank', 'width=600,height=700');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start OAuth flow');
    } finally {
      setIsAuthenticating(false);
    }
  }, [oauthConfig]);
  // 验证 OAuth 令牌
  const validateToken = useCallback(async (accountId: string) => {
    setError(null);
    try {
      const response = await fetch('/api/adscenter/oauth/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId }),
      });

      if (!response.ok) {
        throw new Error('Token validation failed');
      }

      const data = await response.json();
      if (data.valid) {
        setSuccess('Token is valid');
        loadAccounts(); // 刷新账户列表
      } else {
        setError('Token is invalid or expired');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token validation failed');
    }
  }, [oauthConfig]);
  // 刷新 OAuth 令牌
  const refreshToken = useCallback(async (accountId: string) => {
    setError(null);
    try {
      const response = await fetch('/api/adscenter/oauth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      if (data.success) {
        setSuccess('Token refreshed successfully');
        loadAccounts();
      } else {
        setError('Token refresh failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token refresh failed');
    }
  }, [oauthConfig]);
  // 同步账户数据
  const syncAccountData = useCallback(async (accountId: string) => {
    setError(null);
    setSyncProgress(0);
    
    try {
      const response = await fetch('/api/adscenter/oauth/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'sync',
          accountId 
        }),
      });

      if (!response.ok) {
        throw new Error('Account sync failed');
      }

      // 模拟进度更新
      const interval = setInterval(() => {
        setSyncProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 200);

      const data = await response.json();
      if (data.success) {
        setSuccess('Account data synced successfully');
        loadAccounts();
      } else {
        setError('Account sync failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account sync failed');
    }
  }, [oauthConfig]);
  // 删除账户
  const deleteAccount = useCallback(async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this account?')) {
      return;
    }

    setError(null);
    try {
      const response = await fetch('/api/adscenter/oauth/accounts', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      setSuccess('Account deleted successfully');
      loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    }
  }, [oauthConfig]);
  // 导出账户配置
  const exportAccounts = useCallback(() => {
    const dataStr = JSON.stringify(accounts, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'google-ads-accounts.json';
    link.click();
    URL.revokeObjectURL(url);
    setSuccess('Accounts exported successfully');
  }, [oauthConfig]);
  // 导入账户配置
  const importAccounts = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedAccounts = JSON.parse(e.target?.result as string);
        setAccounts(importedAccounts);
        setSuccess('Accounts imported successfully');
      } catch (err) {
        setError('Invalid file format');
      }
    };
    reader.readAsText(file);
  }, []);

  // 过滤账户
  const filteredAccounts = accounts.filter((account: any) => {
    const matchesSearch = account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         account.customerId.includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || account.status === filterStatus;
    return matchesSearch && matchesStatus;
  });
  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-gray-100 text-gray-800'
    };
    return <Badge className={variants[status as keyof typeof variants] || variants.inactive}>{status}</Badge>;
  };

  const getAccessLevelBadge = (level: string) => {
    const variants = {
      admin: 'bg-purple-100 text-purple-800',
      standard: 'bg-blue-100 text-blue-800',
      readonly: 'bg-gray-100 text-gray-800'
    };
    return <Badge className={variants[level as keyof typeof variants] || variants.readonly}>{level}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* 标题和操作按钮 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Google Ads Account Manager</h2>
          <p className="text-gray-600">Manage Google Ads accounts and OAuth authentication</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadAccounts} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportAccounts}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".json"
              onChange={importAccounts}
              className="hidden"
            />
            <Button asChild>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                Import
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* 消息提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="oauth">OAuth Setup</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* 账户列表标签页 */}
        <TabsContent value="accounts" className="space-y-4">
          {/* 搜索和过滤 */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search accounts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* 账户列表 */}
          <div className="grid gap-4">
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p>Loading accounts...</p>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No accounts found</p>
                  <p className="text-sm text-gray-500">Add your first Google Ads account to get started</p>
                </CardContent>
              </Card>
            ) : (
              filteredAccounts.map((account) => (
                <Card key={account.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{account.name}</h3>
                          {getStatusBadge(account.status)}
                          {getAccessLevelBadge(account.accessLevel)}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">Customer ID: {account.customerId}</p>
                        {account.managerId && (
                          <p className="text-sm text-gray-600 mb-2">Manager ID: {account.managerId}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          {account.campaignsCount && (
                            <span>{account.campaignsCount} campaigns</span>
                          )}
                          {account.budget && (
                            <span>{account.currency} {account.budget.toLocaleString()}</span>
                          )}
                          {account.lastSync && (
                            <span>Last sync: {new Date(account.lastSync).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => validateToken(account.id)}
                        >
                          <Shield className="w-4 h-4 mr-1" />
                          Validate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => refreshToken(account.id)}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Refresh
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncAccountData(account.id)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Sync
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedAccount(account)}
                        >
                          <Settings className="w-4 h-4 mr-1" />
                          Settings
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteAccount(account.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* OAuth 设置标签页 */}
        <TabsContent value="oauth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>OAuth Configuration</CardTitle>
              <CardDescription>
                Configure Google Ads API OAuth credentials and authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Client ID</label>
                  <Input
                    value={oauthConfig.clientId}
                    onChange={(e) => setOauthConfig(prev => ({ ...prev, clientId: e.target.value }))}
                    placeholder="Enter your Google Ads API client ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Client Secret</label>
                  <Input
                    type="password"
                    value={oauthConfig.clientSecret}
                    onChange={(e) => setOauthConfig(prev => ({ ...prev, clientSecret: e.target.value }))}
                    placeholder="Enter your Google Ads API client secret"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Redirect URI</label>
                <Input
                  value={oauthConfig.redirectUri}
                  onChange={(e) => setOauthConfig(prev => ({ ...prev, redirectUri: e.target.value }))}
                  placeholder="https://your-domain.com/api/adscenter/oauth/callback"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Scopes</label>
                <Input
                  value={oauthConfig.scopes.join(' ')}
                  onChange={(e) => setOauthConfig(prev => ({ ...prev, scopes: e.target.value.split(' ') }))}
                  placeholder="https://www.googleapis.com/auth/adwords"
                />
              </div>
              <Button 
                onClick={startOAuthFlow} 
                disabled={isAuthenticating || !oauthConfig.clientId || !oauthConfig.clientSecret}
                className="w-full"
              >
                {isAuthenticating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Start OAuth Flow
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 设置标签页 */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Configure account management settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Auto-sync accounts</h4>
                  <p className="text-sm text-gray-600">Automatically sync account data every hour</p>
                </div>
                <Button variant="outline" size="sm">Enable</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Token refresh</h4>
                  <p className="text-sm text-gray-600">Automatically refresh expired tokens</p>
                </div>
                <Button variant="outline" size="sm">Enable</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Email notifications</h4>
                  <p className="text-sm text-gray-600">Receive notifications for account status changes</p>
                </div>
                <Button variant="outline" size="sm">Enable</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 同步进度 */}
      {syncProgress > 0 && syncProgress < 100 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Syncing account data...</span>
            </div>
            <Progress value={syncProgress} className="w-full" />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GoogleAdsAccountManager;
