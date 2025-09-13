'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { globalConfigurationManager } from '@/app/changelink/models/ConfigurationManager';
import { getDomainConfig } from '@/lib/domain-config';
import { EnhancedError } from '@/lib/utils/error-handling';

export default function OAuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();

  useEffect(() => {
    handleOAuthCallback();
  }, []);

  const handleOAuthCallback = async () => {
    try {
      const config = getDomainConfig();
      const code = searchParams.get('code');
      const state = searchParams.get('state'); // 账户ID
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setMessage(`授权失败: ${error}`);
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setMessage('缺少必要的授权参数');
        return;
      }

      // 获取账户信息以获取 client_id 和 client_secret
      const accounts = await globalConfigurationManager.getGoogleAdsAccounts();
      const account = accounts.find((acc: any) => acc.id === state);
      if (!account || !account.clientId || !account.clientSecret) {
        setStatus('error');
        setMessage('无法获取账户配置信息');
        return;
      }

      // 使用授权码获取访问令牌
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: account.clientId,
          client_secret: account.clientSecret,
          redirect_uri: config.oauthRedirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('获取访问令牌失败');
      }

      const tokenData = await tokenResponse.json();

      // 保存令牌到配置管理器
      await globalConfigurationManager.updateGoogleAdsAccount(state, {
        refreshToken: tokenData.refresh_token,
        isActive: true
      });

      setStatus('success');
      setMessage('Google Ads 账户授权成功！');

      // 3秒后关闭窗口
      setTimeout(() => {
        window.close();
      }, 3000);

    } catch (error) {
      console.error('OAuth回调处理失败:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : '授权处理失败');
    }
  };

  const handleClose = () => {
    window.close();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === 'loading' && <Loader2 className="h-12 w-12 animate-spin text-blue-600" />}
            {status === 'success' && <CheckCircle className="h-12 w-12 text-green-600" />}
            {status === 'error' && <XCircle className="h-12 w-12 text-red-600" />}
          </div>
          <CardTitle>
            {status === 'loading' && '处理授权中...'}
            {status === 'success' && '授权成功'}
            {status === 'error' && '授权失败'}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status !== 'loading' && (
            <Button onClick={handleClose} className="w-full">
              关闭窗口
            </Button>
          )}
          {status === 'success' && (
            <p className="text-sm text-gray-500 mt-2">
              窗口将在3秒后自动关闭
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}