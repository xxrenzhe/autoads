'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { EnhancedError } from '@/lib/utils/error-handling';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { getDomainConfig, getGoogleOAuthConfig } from '@/lib/domain-config';
const logger = createClientLogger('GoogleAdsOAuthFlow');

import { 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Settings,
  Shield,
  Key,
  Users,
  AlertTriangle
} from 'lucide-react';

interface GoogleAdsOAuthFlowProps {
  onAuthSuccess?: (credentials: unknown) => void;
  onAuthError?: (error: string) => void;
}

export function GoogleAdsOAuthFlow({ onAuthSuccess, onAuthError }: .*Props) {
  const [authStep, setAuthStep] = useState<'config' | 'auth' | 'callback' | 'success' | 'error'>('config');
  const [oauthConfig, setOauthConfig] = useState({
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    developerToken: '',
    scopes: [
      'https://www.googleapis.com/auth/adwords',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  });

  // 初始化OAuth配置
  useEffect(() => {
    const config = getDomainConfig();
    const oauthSettings = getGoogleOAuthConfig();
    
    setOauthConfig(prev => ({
      ...prev,
      redirectUri: config.oauthRedirectUri,
      clientId: oauthSettings.clientId || '',
      developerToken: oauthSettings.developerToken || ''
    }));
  }, []);
  const [authUrl, setAuthUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<unknown[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  // 处理OAuth回调
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (code && state) => {
      handleOAuthCallback(code, state, error || undefined);
    }
  }, []);

  // 处理OAuth回调
  const handleOAuthCallback = async (code: string, state: string, error?: string) => {
    setIsLoading(true);
    setAuthStep('callback');

    try {
      const response = await fetch('/api/adscenter/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state, error })
      });

      const result = await response.json();

      if (result.success) => {
        setAuthStep('success');
        setAccounts(result.accounts || []);
        onAuthSuccess?.(result.credentials);
      } else {
        setAuthStep('error');
        setError(result.error || 'Authentication failed');
        onAuthError?.(result.error || 'Authentication failed');
      }
    } catch (error) {
      setAuthStep('error');
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setError(errorMessage);
      onAuthError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 生成OAuth授权URL
  const generateAuthUrl = useCallback(async () => {
    if (!oauthConfig.clientId || !oauthConfig.clientSecret || !oauthConfig.developerToken) => {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/adscenter/oauth/auth-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(oauthConfig)
      });

      const result = await response.json();

      if (result.success) => {
        setAuthUrl(result.authUrl);
        setAuthStep('auth');
      } else {
        setError(result.error || 'Failed to generate auth URL');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate auth URL';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [oauthConfig, onAuthError]);
  
  // 验证账户
  const validateAccount = useCallback(async (customerId: string) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/adscenter/oauth/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customerId })
      });

      const result = await response.json();

      if (result.success) => {
        setSelectedAccount(customerId);
        onAuthSuccess?.(result.credentials);
      } else {
        setError(result.error || 'Account validation failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Account validation failed';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [onAuthSuccess]);
  
  // 刷新令牌
  const refreshToken = useCallback(async (customerId: string) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/adscenter/oauth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customerId })
      });

      const result = await response.json();

      if (result.success) => {
        onAuthSuccess?.(result.credentials);
      } else {
        setError(result.error || 'Token refresh failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Token refresh failed';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [onAuthSuccess]);
  
  // 删除账户
  const removeAccount = useCallback(async (customerId: string) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/adscenter/oauth/remove', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customerId })
      });

      const result = await response.json();

      if (result.success) => {
        setAccounts(prev => prev.filter((account: any) => (account as any).customerId !== customerId));
        if (selectedAccount === customerId) => {
          setSelectedAccount(null);
        }
      } else {
        setError(result.error || 'Failed to remove account');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove account';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccount]);
  
  // 加载已保存的账户
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const response = await fetch('/api/adscenter/oauth/accounts');
        const result = await response.json();

        if (result.success) => {
          setAccounts(result.accounts || []);
        }
      } catch (error) {
      logger.error('Failed to fetch accounts:', new EnhancedError('Failed to fetch accounts:', { error: error instanceof Error ? error.message : String(error)  }));
    }
    };

    loadAccounts();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Key className="w-5 h-5 mr-2" />
            Google Ads OAuth 认证
          </CardTitle>
          <CardDescription>
            配置Google Ads API访问凭据以启用自动化功能
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={authStep} onValueChange={((value: any): any) => setAuthStep(value as 'config' | 'auth' | 'callback' | 'success' | 'error')}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="config">配置</TabsTrigger>
              <TabsTrigger value="auth">授权</TabsTrigger>
              <TabsTrigger value="success">成功</TabsTrigger>
              <TabsTrigger value="error">错误</TabsTrigger>
            </TabsList>

            {/* 配置步骤 */}
            <TabsContent value="config" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="clientId">Client ID</Label>
                  <Input
                    id="clientId"
                    type="text"
                    placeholder="Enter your Google Ads API Client ID"
                    value={oauthConfig.clientId}
                    onChange={((e: any) => setOauthConfig(prev: any) => ({ ...prev, clientId: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="clientSecret">Client Secret</Label>
                  <Input
                    id="clientSecret"
                    type="password"
                    placeholder="Enter your Google Ads API Client Secret"
                    value={oauthConfig.clientSecret}
                    onChange={((e: any) => setOauthConfig(prev: any) => ({ ...prev, clientSecret: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="developerToken">Developer Token</Label>
                  <Input
                    id="developerToken"
                    type="password"
                    placeholder="Enter your Google Ads Developer Token"
                    value={oauthConfig.developerToken}
                    onChange={((e: any) => setOauthConfig(prev: any) => ({ ...prev, developerToken: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="redirectUri">Redirect URI</Label>
                  <Input
                    id="redirectUri"
                    type="text"
                    placeholder="http://localhost:3000/adscenter"
                    value={oauthConfig.redirectUri}
                    onChange={((e: any) => setOauthConfig(prev: any) => ({ ...prev, redirectUri: e.target.value }))}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    在Google Cloud Console中配置的OAuth重定向URI
                  </p>
                </div>

                <div>
                  <Label>API Scopes</Label>
                  <div className="space-y-2 mt-2">
                    {oauthConfig.scopes.map((scope, index: any) => (
                      <div key={index} className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm">{scope}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={generateAuthUrl} 
                  disabled={isLoading || !oauthConfig.clientId || !oauthConfig.clientSecret || !oauthConfig.developerToken}
                  className="w-full"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                  生成授权链接
                </Button>
              </div>
            </TabsContent>

            {/* 授权步骤 */}
            <TabsContent value="auth" className="space-y-4">
              <Alert>
                <ExternalLink className="h-4 w-4" />
                <AlertDescription>
                  点击下面的按钮打开Google OAuth授权页面。授权完成后，您将被重定向回此页面。
                </AlertDescription>
              </Alert>

              <Button 
                onClick={() => window.open(authUrl, '_blank')}
                className="w-full"
                size="lg"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                在Google中授权
              </Button>

              <div className="text-center">
                <p className="text-sm text-gray-500">
                  或者复制以下链接到浏览器地址栏：
                </p>
                <code className="block mt-2 p-2 bg-gray-100 rounded text-xs break-all">
                  {authUrl}
                </code>
              </div>
            </TabsContent>

            {/* 成功步骤 */}
            <TabsContent value="success" className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  OAuth认证成功！您已成功连接到Google Ads API。
                </AlertDescription>
              </Alert>

              {accounts.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-medium">可用的Google Ads账户</h3>
                  <div className="space-y-2">
                    {accounts?.filter(Boolean)?.map((account: any) => {
                      const acc = account as any;
                      return (
                        <div key={acc.customerId} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium">{acc.customerName}</div>
                            <div className="text-sm text-gray-500">ID: {acc.customerId}</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={acc.testAccount ? 'secondary' : 'default'}>
                              {acc.testAccount ? '测试账户' : '生产账户'}
                            </Badge>
                            <Button
                              size="sm"
                              onClick={() => validateAccount(acc.customerId)}
                              disabled={isLoading}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              验证
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => refreshToken(acc.customerId)}
                              disabled={isLoading}
                            >
                              <RefreshCw className="w-4 h-4 mr-1" />
                              刷新
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeAccount(acc.customerId)}
                              disabled={isLoading}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              删除
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* 错误步骤 */}
            <TabsContent value="error" className="space-y-4">
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  OAuth认证失败：{error}
                </AlertDescription>
              </Alert>

              <Button 
                onClick={() => setAuthStep('config')}
                className="w-full"
              >
                <Settings className="w-4 h-4 mr-2" />
                重新配置
              </Button>
            </TabsContent>
          </Tabs>

          {/* 错误提示 */}
          {error && authStep !== 'error' && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 加载状态 */}
          {isLoading && (
            <div className="flex items-center justify-center p-4">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              <span>处理中...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 安全提示 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            安全说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>• 所有凭据都使用AES-256加密存储在本地</p>
            <p>• 访问令牌会自动刷新，无需手动干预</p>
            <p>• 您可以随时删除账户连接以撤销访问权限</p>
            <p>• 系统仅请求必要的最小权限范围</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 