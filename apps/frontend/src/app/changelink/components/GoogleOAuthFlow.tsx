'use client';

import React, { useState, useEffect } from 'react';
import { 
  ExternalLink, 
  Copy, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Key, 
  Shield,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
// TODO: Replace with proper modal component
// import { AccessibleModal } from './AccessibilityEnhancements';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('GoogleOAuthFlow');

interface GoogleOAuthFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onTokenReceived: (refreshToken: string) => void;
  clientId?: string;
  clientSecret?: string;
}

interface OAuthStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  component?: React.ReactNode;
}

export const GoogleOAuthFlow: React.FC<GoogleOAuthFlowProps> = ({
  isOpen,
  onClose,
  onTokenReceived,
  clientId = '',
  clientSecret = ''
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [authCode, setAuthCode] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [isExchangingToken, setIsExchangingToken] = useState(false);
  const [error, setError] = useState('');
  const [copiedText, setCopiedText] = useState('');

  // OAuth配置
  const redirectUri = 'urn:ietf:wg:oauth:2.0:oob'; // 用于桌面应用的特殊重定向URI
  const scope = 'https://www.googleapis.com/auth/adwords';
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent(scope)}&` +
    `response_type=code&` +
    `access_type=offline&` +
    `prompt=consent`;

  const steps: OAuthStep[] = [
    {
      id: 'setup',
      title: '准备OAuth认证',
      description: '确认客户端ID和密钥已正确配置',
      status: clientId && clientSecret ? 'completed' : 'pending'
    },
    {
      id: 'authorize',
      title: '获取授权码',
      description: '在Google授权页面获取授权码',
      status: 'pending'
    },
    {
      id: 'exchange',
      title: '交换刷新令牌',
      description: '使用授权码获取刷新令牌',
      status: 'pending'
    },
    {
      id: 'complete',
      title: '完成认证',
      description: '保存刷新令牌并完成配置',
      status: 'pending'
    }
  ];

  const [stepStatuses, setStepStatuses] = useState<Record<string, OAuthStep['status']>>(
    steps.reduce((acc, step: any) => ({ ...acc, [step.id]: step.status }), {})
  );

  useEffect(() => {
    // 更新步骤状态
    const newStatuses = { ...stepStatuses };
    
    if (clientId && clientSecret) {
      newStatuses.setup = 'completed';
      if (currentStep === 0) setCurrentStep(1);
    }
    
    if (authCode) {
      newStatuses.authorize = 'completed';
    }
    
    if (refreshToken) {
      newStatuses.exchange = 'completed';
      newStatuses.complete = 'completed';
    }
    
    setStepStatuses(newStatuses);
  }, [authCode, refreshToken]);
  
  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      setTimeout(() => setCopiedText(''), 2000);
    } catch (error) {
      logger.error('Failed to copy to clipboard:', new EnhancedError('Failed to copy to clipboard:', { error: error instanceof Error ? error.message : String(error)  }));
    }
  };

  const handleExchangeToken = async () => {
    if (!authCode.trim()) {
      setError('请输入授权码');
      return;
    }

    setIsExchangingToken(true);
    setError('');

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: authCode,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || '令牌交换失败');
      }

      const tokenData = await response.json();
      
      if (tokenData.refresh_token) {
        setRefreshToken(tokenData.refresh_token);
        setCurrentStep(3);
      } else {
        throw new Error('未收到刷新令牌，请确保在授权时选择了"离线访问"');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '令牌交换失败');
    } finally {
      setIsExchangingToken(false);
    }
  };

  const handleComplete = () => {
    onTokenReceived(refreshToken);
    onClose();
  };

  const getStepIcon = (status: OAuthStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-md">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-blue-800 mb-2">OAuth认证准备</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    在开始OAuth流程之前，请确保您已经：
                  </p>
                  <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                    <li>在Google Cloud Console中创建了OAuth 2.0客户端</li>
                    <li>获取了客户端ID和客户端密钥</li>
                    <li>配置了正确的重定向URI</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  客户端ID
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={clientId}
                    readOnly
                    className="bg-gray-50"
                  />
                  <Badge variant={clientId ? 'default' : 'secondary'}>
                    {clientId ? '已配置' : '未配置'}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  客户端密钥
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    value={clientSecret}
                    readOnly
                    className="bg-gray-50"
                  />
                  <Badge variant={clientSecret ? 'default' : 'secondary'}>
                    {clientSecret ? '已配置' : '未配置'}
                  </Badge>
                </div>
              </div>
            </div>

            {clientId && clientSecret && (
              <div className="flex justify-end">
                <Button onClick={() => setCurrentStep(1)}>
                  开始授权流程
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="bg-yellow-50 p-4 rounded-md">
              <div className="flex items-start gap-3">
                <Key className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">获取授权码</h4>
                  <p className="text-sm text-yellow-700 mb-3">
                    点击下方按钮打开Google授权页面，完成授权后复制授权码。
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  步骤1: 打开授权页面
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => window.open(authUrl, '_blank')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    打开Google授权页面
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyToClipboard(authUrl, 'authUrl')}
                  >
                    {copiedText === 'authUrl' ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <label htmlFor="authCode" className="block text-sm font-medium text-gray-700 mb-2">
                  步骤2: 输入授权码
                </label>
                <Input
                  id="authCode"
                  type="text"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  placeholder="粘贴从Google获取的授权码"
                />
                <p className="text-xs text-gray-500 mt-1">
                  在授权页面完成授权后，Google会显示一个授权码，请复制并粘贴到这里
                </p>
              </div>
            </div>

            {authCode && (
              <div className="flex justify-end">
                <Button onClick={() => setCurrentStep(2)}>
                  下一步：交换令牌
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-md">
              <div className="flex items-start gap-3">
                <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-blue-800 mb-2">交换刷新令牌</h4>
                  <p className="text-sm text-blue-700">
                    使用授权码获取刷新令牌，这个令牌将用于长期访问Google Ads API。
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  授权码
                </label>
                <Input
                  type="text"
                  value={authCode}
                  onChange={((e: any): any) => setAuthCode(e.target.value)}
                  placeholder="请输入授权码"
                />
              </div>

              {error && (
                <div className="bg-red-50 p-3 rounded-md">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-800">{error}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleExchangeToken}
                disabled={!authCode || isExchangingToken}
              >
                {isExchangingToken ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    交换中...
                  </>
                ) : (
                  <>
                    获取刷新令牌
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-md">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-green-800 mb-2">认证完成</h4>
                  <p className="text-sm text-green-700">
                    成功获取刷新令牌！您现在可以使用这个令牌访问Google Ads API。
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                刷新令牌
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  value={refreshToken}
                  readOnly
                  className="bg-gray-50"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={((: any): any) => handleCopyToClipboard(refreshToken, 'refreshToken')}
                >
                  {copiedText === 'refreshToken' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                请妥善保管这个刷新令牌，它将用于长期访问您的Google Ads账户
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleComplete}>
                完成配置
                <CheckCircle className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      default:
        return null as any;
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Google OAuth 2.0 认证</h2>
          <button onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="space-y-6">
            {/* 步骤指示器 */}
            <div className="flex items-center justify-between">
              {steps.map((step, index: any) => (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    stepStatuses[step.id] === 'completed' 
                      ? 'bg-green-100 border-green-500' 
                      : currentStep === index
                        ? 'bg-blue-100 border-blue-500'
                        : 'bg-gray-100 border-gray-300'
                  }`}>
                    {stepStatuses[step.id] === 'completed' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <span className={`text-xs font-medium ${
                        currentStep === index ? 'text-blue-600' : 'text-gray-500'
                      }`}>
                        {index + 1}
                      </span>
                    )}
                  </div>
                  
                  {index < steps.length - 1 && (
                    <div className={`w-12 h-0.5 mx-2 ${
                      stepStatuses[step.id] === 'completed' 
                        ? 'bg-green-500' 
                        : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>

            {/* 当前步骤信息 */}
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900">
                {steps[currentStep]?.title}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {steps[currentStep]?.description}
              </p>
            </div>

            {/* 步骤内容 */}
            <div className="min-h-[300px]">
              {renderStepContent()}
            </div>

            {/* 帮助信息 */}
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="text-sm font-medium text-gray-700 mb-2">需要帮助？</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <p>• 确保您的Google账户有权限访问要管理的Google Ads账户</p>
                <p>• 如果遇到"access_denied"错误，请检查OAuth客户端配置</p>
                <p>• 刷新令牌只会在首次授权时提供，请妥善保存</p>
                <p>• 如需重新获取刷新令牌，请撤销应用授权后重新进行OAuth流程</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
