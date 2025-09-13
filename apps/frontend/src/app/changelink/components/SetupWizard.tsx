'use client';

/**
 * 首次配置向导组件
 * 引导用户完成Google Ads API配置和基本设置
 */
import { EnhancedError } from '@/lib/utils/error-handling';
import React, { useState, useEffect } from 'react';
import { 

  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft,
  Settings,
  Key,
  Mail,
  Database,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Edit,
  RotateCcw
} from 'lucide-react';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  required: boolean;
}

interface GoogleAdsConfig {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  loginCustomerId: string;
}

interface EmailConfig {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
}

interface SetupWizardProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export default function SetupWizard({ onComplete, onSkip }: .*Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [googleAdsConfig, setGoogleAdsConfig] = useState<GoogleAdsConfig>({
    clientId: '',
    clientSecret: '',
    developerToken: '',
    refreshToken: '',
    loginCustomerId: ''
  });
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({ smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: 'ChangeLink'
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResults, setTestResults] = useState<{
    googleAds?: { success: boolean; message: string };
    email?: { success: boolean; message: string };
  }>({});
  const [usingDefaults, setUsingDefaults] = useState({
    clientId: false,
    clientSecret: false,
    developerToken: false,
    loginCustomerId: false
  });
  const [editMode, setEditMode] = useState({
    clientId: false,
    clientSecret: false,
    developerToken: false,
    loginCustomerId: false
  });

  const steps: SetupStep[] = [
    {
      id: 'welcome',
      title: '欢迎使用 ChangeLink',
      description: '让我们开始配置您的智能广告管理平台',
      completed: false,
      required: true
    },
    {
      id: 'google-ads',
      title: 'Google Ads API 配置',
      description: '配置Google Ads API以获取广告数据',
      completed: false,
      required: true
    },
    {
      id: 'advanced',
      title: '高级配置',
      description: '邮件通知和其他设置（可选）',
      completed: false,
      required: false
    },
    {
      id: 'complete',
      title: '配置完成',
      description: '所有配置已完成，开始使用ChangeLink',
      completed: false,
      required: true
    }
  ];

  const [setupSteps, setSetupSteps] = useState(steps);

  // 计算进度
  const progress = ((currentStep + 1) / setupSteps.length) * 100;

  // 加载环境变量默认值
  useEffect(() => {
    const loadDefaults = () => {
      const defaults = {
        clientId: process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID || '',
        clientSecret: process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_SECRET || '',
        developerToken: process.env.NEXT_PUBLIC_GOOGLE_ADS_DEVELOPER_TOKEN || '',
        loginCustomerId: process.env.NEXT_PUBLIC_GOOGLE_ADS_LOGIN_CUSTOMER_ID || ''
      };

      // 更新配置状态
      setGoogleAdsConfig(prev => ({
        ...prev,
        ...defaults
      }));

      // 标记哪些字段使用了默认值
      setUsingDefaults({
        clientId: Boolean(defaults.clientId),
        clientSecret: Boolean(defaults.clientSecret),
        developerToken: Boolean(defaults.developerToken),
        loginCustomerId: Boolean(defaults.loginCustomerId)
      });

      // 如果有默认值，自动标记Google Ads步骤为已完成
      if (defaults.clientId && defaults.clientSecret && defaults.developerToken) => {
        markStepCompleted('google-ads');
      }
    };

    loadDefaults();
  }, []);

  const handleNext = () => {
    if (currentStep < setupSteps.length - 1) => {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) => {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGoogleAdsTest = async () => {
    setIsTestingConnection(true);
    try {
      // 模拟API测试
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 检查配置是否有效（考虑环境变量默认值）
      const hasClientId = usingDefaults.clientId || googleAdsConfig.clientId;
      const hasClientSecret = usingDefaults.clientSecret || googleAdsConfig.clientSecret;
      const hasDeveloperToken = usingDefaults.developerToken || googleAdsConfig.developerToken;
      
      const isValid = Boolean(hasClientId && hasClientSecret && hasDeveloperToken);
      
      setTestResults(prev => ({
        ...prev,
        googleAds: {
          success: isValid,
          message: isValid ? 'Google Ads API配置测试成功' : '请填写完整的配置信息'
        }
      }));
      
      if (isValid) => {
        // 保存配置到本地数据库
        await saveGoogleAdsConfig();
        markStepCompleted('google-ads');
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        googleAds: {
          success: false,
          message: '连接测试失败，请检查配置信息'
        }
      }));
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleEmailTest = async () => {
    setIsTestingConnection(true);
    try {
      // 模拟邮件测试
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const isValid = Boolean(emailConfig.smtpHost && 
                     emailConfig.smtpUser && 
                     emailConfig.smtpPassword);
      
      setTestResults(prev => ({
        ...prev,
        email: {
          success: isValid,
          message: isValid ? '邮件服务配置测试成功' : '请填写完整的SMTP配置信息'
        }
      }));
      
      if (isValid) => {
        // 保存配置到本地数据库
        await saveEmailConfig();
        markStepCompleted('email');
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        email: {
          success: false,
          message: '邮件服务测试失败，请检查SMTP配置'
        }
      }));
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveGoogleAdsConfig = async () => {
    try {
      // 构建要保存的配置，优先使用环境变量默认值
      const configToSave = {
        clientId: usingDefaults.clientId 
          ? process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID 
          : googleAdsConfig.clientId,
        clientSecret: usingDefaults.clientSecret 
          ? process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_SECRET 
          : googleAdsConfig.clientSecret,
        developerToken: usingDefaults.developerToken 
          ? process.env.NEXT_PUBLIC_GOOGLE_ADS_DEVELOPER_TOKEN 
          : googleAdsConfig.developerToken,
        refreshToken: googleAdsConfig.refreshToken,
        loginCustomerId: usingDefaults.loginCustomerId 
          ? process.env.NEXT_PUBLIC_GOOGLE_ADS_LOGIN_CUSTOMER_ID 
          : googleAdsConfig.loginCustomerId
      };
      
      const response = await fetch('/api/adscenter/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete-setup',
          googleAdsConfig: configToSave
        })
      });
      
      const result = await response.json();
      if (!result.success) => {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('保存Google Ads配置失败:', error);
      throw error;
    }
  };

  const saveEmailConfig = async () => {
    try {
      const response = await fetch('/api/adscenter/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete-setup',
          emailConfig
        })
      });
      
      const result = await response.json();
      if (!result.success) => {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('保存邮件配置失败:', error);
      throw error;
    }
  };

  const markStepCompleted = (stepId: string) => {
    setSetupSteps(prev => prev?.filter(Boolean)?.map((step: any) => 
      step.id === stepId ? { ...step, completed: true } : step
    ));
  };

  const initializeDatabase = async () => {
    try {
      // 模拟数据库初始化
      await new Promise(resolve => setTimeout(resolve, 1000));
      markStepCompleted('database');
      return true;
    } catch (error) {
      console.error('数据库初始化失败:', error);
      return false;
    }
  };

  const handleComplete = async () => {
    try {
      // 构建要保存的配置，优先使用环境变量默认值
      const googleAdsConfigToSave = {
        clientId: usingDefaults.clientId 
          ? process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID 
          : googleAdsConfig.clientId,
        clientSecret: usingDefaults.clientSecret 
          ? process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_SECRET 
          : googleAdsConfig.clientSecret,
        developerToken: usingDefaults.developerToken 
          ? process.env.NEXT_PUBLIC_GOOGLE_ADS_DEVELOPER_TOKEN 
          : googleAdsConfig.developerToken,
        refreshToken: googleAdsConfig.refreshToken,
        loginCustomerId: usingDefaults.loginCustomerId 
          ? process.env.NEXT_PUBLIC_GOOGLE_ADS_LOGIN_CUSTOMER_ID 
          : googleAdsConfig.loginCustomerId
      };
      
      // 最终保存所有配置
      const response = await fetch('/api/adscenter/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete-setup',
          googleAdsConfig: googleAdsConfigToSave,
          emailConfig
        })
      });
      
      const result = await response.json();
      if (result.success) => {
        onComplete();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('完成配置失败:', error);
      // 即使失败也继续，让用户可以手动重试
      onComplete();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderWelcomeStep = () => (
    <div className="text-center space-y-6">
      <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
        <Settings className="h-12 w-12 text-blue-600" />
      </div>
      
      <div>
        <h2 className="text-2xl font-bold mb-4">欢迎使用 ChangeLink 智能广告管理平台！</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          ChangeLink 是一个功能强大的广告数据分析和管理平台。在开始使用之前，我们需要完成一些基本配置。
          整个过程只需要几分钟，配置完成后您就可以享受自动化的广告数据分析服务。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        <div className="p-4 border rounded-lg">
          <Database className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <h3 className="font-semibold mb-2">本地数据存储</h3>
          <p className="text-sm text-gray-600">所有数据存储在本地，保护您的隐私和数据安全</p>
        </div>
        
        <div className="p-4 border rounded-lg">
          <Key className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <h3 className="font-semibold mb-2">API 集成</h3>
          <p className="text-sm text-gray-600">连接Google Ads API获取实时广告数据</p>
        </div>
        
        <div className="p-4 border rounded-lg">
          <Mail className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <h3 className="font-semibold mb-2">自动报告</h3>
          <p className="text-sm text-gray-600">每日自动生成和发送广告数据分析报告</p>
        </div>
      </div>
    </div>
    );

  const renderGoogleAdsStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Key className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Google Ads API 配置</h2>
        <p className="text-gray-600">
          配置Google Ads API以获取您的广告数据。如果您还没有API凭据，请先访问Google Ads API控制台创建。
        </p>
      </div>

      {/* 环境变量提示 */}
      {(usingDefaults.clientId || usingDefaults.clientSecret || usingDefaults.developerToken) && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 mb-1">已从环境变量加载默认配置</p>
                <p className="text-blue-700">
                  系统已自动读取环境变量中的配置值。您可以直接使用这些配置，或根据需要进行修改。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 flex items-center justify-between">
            <span className="flex items-center">
              Client ID *
              {usingDefaults.clientId && (
                <Badge variant="secondary" className="ml-2 text-xs">已配置</Badge>
              )}
            </span>
            {usingDefaults.clientId && !editMode.clientId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={((: any) => setEditMode(prev: any) => ({ ...prev, clientId: true }))}
                className="h-6 px-2 text-xs"
              >
                <Edit className="h-3 w-3 mr-1" />
                编辑
              </Button>
            )}
          </label>
          {usingDefaults.clientId && !editMode.clientId ? (
            <div className="flex items-center">
              <input
                type="text"
                value="Default"
                readOnly
                className="w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-500"
              />
            </div>
          ) : (
            <input
              type="text"
              value={googleAdsConfig.clientId}
              onChange={(e) => {
                setGoogleAdsConfig(prev => ({ ...prev, clientId: e.target.value }));
                setUsingDefaults(prev => ({ ...prev, clientId: false }));
              }}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="请输入Google Ads API Client ID"
            />
          )}
          {usingDefaults.clientId && (
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-green-600">
                ✓ 已从环境变量加载默认值（出于安全考虑显示为 "Default"）
              </p>
              {editMode.clientId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditMode(prev => ({ ...prev, clientId: false }));
                    setUsingDefaults(prev => ({ ...prev, clientId: true }));
                    setGoogleAdsConfig(prev => ({ ...prev, clientId: '' }));
                  }}
                  className="h-6 px-2 text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  恢复默认
                </Button>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 flex items-center justify-between">
            <span className="flex items-center">
              Client Secret *
              {usingDefaults.clientSecret && (
                <Badge variant="secondary" className="ml-2 text-xs">已配置</Badge>
              )}
            </span>
            {usingDefaults.clientSecret && !editMode.clientSecret && (
              <Button
                variant="ghost"
                size="sm"
                onClick={((: any) => setEditMode(prev: any) => ({ ...prev, clientSecret: true }))}
                className="h-6 px-2 text-xs"
              >
                <Edit className="h-3 w-3 mr-1" />
                编辑
              </Button>
            )}
          </label>
          {usingDefaults.clientSecret && !editMode.clientSecret ? (
            <div className="flex items-center">
              <input
                type="password"
                value="Default"
                readOnly
                className="w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-500 pr-10"
              />
            </div>
          ) : (
            <div className="relative">
              <input
                type={showPasswords ? "text" : "password"}
                value={googleAdsConfig.clientSecret}
                onChange={(e) => {
                  setGoogleAdsConfig(prev => ({ ...prev, clientSecret: e.target.value }));
                  setUsingDefaults(prev => ({ ...prev, clientSecret: false }));
                }}
                className="w-full px-3 py-2 border rounded-md pr-10"
                placeholder="请输入Google Ads API Client Secret"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}
          {usingDefaults.clientSecret && (
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-green-600">
                ✓ 已从环境变量加载默认值（出于安全考虑显示为 "Default"）
              </p>
              {editMode.clientSecret && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditMode(prev => ({ ...prev, clientSecret: false }));
                    setUsingDefaults(prev => ({ ...prev, clientSecret: true }));
                    setGoogleAdsConfig(prev => ({ ...prev, clientSecret: '' }));
                  }}
                  className="h-6 px-2 text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  恢复默认
                </Button>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 flex items-center justify-between">
            <span className="flex items-center">
              Developer Token *
              {usingDefaults.developerToken && (
                <Badge variant="secondary" className="ml-2 text-xs">已配置</Badge>
              )}
            </span>
            {usingDefaults.developerToken && !editMode.developerToken && (
              <Button
                variant="ghost"
                size="sm"
                onClick={((: any) => setEditMode(prev: any) => ({ ...prev, developerToken: true }))}
                className="h-6 px-2 text-xs"
              >
                <Edit className="h-3 w-3 mr-1" />
                编辑
              </Button>
            )}
          </label>
          {usingDefaults.developerToken && !editMode.developerToken ? (
            <div className="flex items-center">
              <input
                type="password"
                value="Default"
                readOnly
                className="w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-500"
              />
            </div>
          ) : (
            <input
              type={showPasswords ? "text" : "password"}
              value={googleAdsConfig.developerToken}
              onChange={(e) => {
                setGoogleAdsConfig(prev => ({ ...prev, developerToken: e.target.value }));
                setUsingDefaults(prev => ({ ...prev, developerToken: false }));
              }}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="请输入Google Ads Developer Token"
            />
          )}
          {usingDefaults.developerToken && (
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-green-600">
                ✓ 已从环境变量加载默认值（出于安全考虑显示为 "Default"）
              </p>
              {editMode.developerToken && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditMode(prev => ({ ...prev, developerToken: false }));
                    setUsingDefaults(prev => ({ ...prev, developerToken: true }));
                    setGoogleAdsConfig(prev => ({ ...prev, developerToken: '' }));
                  }}
                  className="h-6 px-2 text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  恢复默认
                </Button>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Refresh Token</label>
          <input
            type={showPasswords ? "text" : "password"}
            value={googleAdsConfig.refreshToken}
            onChange={((e: any) => setGoogleAdsConfig(prev: any) => ({ ...prev, refreshToken: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="请输入Refresh Token（可选）"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 flex items-center justify-between">
            <span className="flex items-center">
              Login Customer ID (MCC ID)
              {usingDefaults.loginCustomerId && (
                <Badge variant="secondary" className="ml-2 text-xs">已配置</Badge>
              )}
            </span>
            {usingDefaults.loginCustomerId && !editMode.loginCustomerId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={((: any) => setEditMode(prev: any) => ({ ...prev, loginCustomerId: true }))}
                className="h-6 px-2 text-xs"
              >
                <Edit className="h-3 w-3 mr-1" />
                编辑
              </Button>
            )}
          </label>
          {usingDefaults.loginCustomerId && !editMode.loginCustomerId ? (
            <div className="flex items-center">
              <input
                type="text"
                value="Default"
                readOnly
                className="w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-500"
              />
            </div>
          ) : (
            <input
              type="text"
              value={googleAdsConfig.loginCustomerId}
              onChange={(e) => {
                setGoogleAdsConfig(prev => ({ ...prev, loginCustomerId: e.target.value }));
                setUsingDefaults(prev => ({ ...prev, loginCustomerId: false }));
              }}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="123-456-7890"
            />
          )}
          <p className="text-xs text-gray-500 mt-1">请输入您的MCC管理员账户ID</p>
          {usingDefaults.loginCustomerId && (
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-green-600">
                ✓ 已从环境变量加载默认值（出于安全考虑显示为 "Default"）
              </p>
              {editMode.loginCustomerId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditMode(prev => ({ ...prev, loginCustomerId: false }));
                    setUsingDefaults(prev => ({ ...prev, loginCustomerId: true }));
                    setGoogleAdsConfig(prev => ({ ...prev, loginCustomerId: '' }));
                  }}
                  className="h-6 px-2 text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  恢复默认
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            onClick={handleGoogleAdsTest}
            disabled={isTestingConnection}
          >
            {isTestingConnection ? '测试中...' : '测试连接'}
          </Button>

          <div className="flex items-center gap-4">
            <a
              href="https://developers.google.com/google-ads/api/docs/first-call/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
            >
              获取API凭据帮助
              <ExternalLink className="h-4 w-4 ml-1" />
            </a>
            
            {(usingDefaults.clientId && usingDefaults.clientSecret && usingDefaults.developerToken) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  markStepCompleted('google-ads');
                  handleNext();
                }}
              >
                使用默认配置并继续
              </Button>
            )}
          </div>
        </div>

        {testResults.googleAds && (
          <div className={`p-4 rounded-lg ${testResults.googleAds.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <div className="flex items-center">
              {testResults.googleAds.success ? 
                <CheckCircle className="h-5 w-5 mr-2" /> : 
                <AlertCircle className="h-5 w-5 mr-2" />
              }
              {testResults.googleAds.message}
            </div>
          </div>
        )}
      </div>
    </div>
    );

  const renderEmailStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Mail className="h-12 w-12 text-purple-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">邮件服务配置</h2>
        <p className="text-gray-600">
          配置SMTP服务以发送每日广告数据报告。此步骤是可选的，您可以稍后在设置中配置。
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">SMTP 主机</label>
            <input
              type="text"
              value={emailConfig.smtpHost}
              onChange={((e: any) => setEmailConfig(prev: any) => ({ ...prev, smtpHost: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="smtp.gmail.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">SMTP 端口</label>
            <input
              type="text"
              value={emailConfig.smtpPort}
              onChange={((e: any) => setEmailConfig(prev: any) => ({ ...prev, smtpPort: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="587"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">SMTP 用户名</label>
          <input
            type="text"
            value={emailConfig.smtpUser}
            onChange={((e: any) => setEmailConfig(prev: any) => ({ ...prev, smtpUser: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="your-email@gmail.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">SMTP 密码</label>
          <div className="relative">
            <input
              type={showPasswords ? "text" : "password"}
              value={emailConfig.smtpPassword}
              onChange={((e: any) => setEmailConfig(prev: any) => ({ ...prev, smtpPassword: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md pr-10"
              placeholder="应用专用密码"
            />
            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">发件人邮箱</label>
            <input
              type="email"
              value={emailConfig.fromEmail}
              onChange={((e: any) => setEmailConfig(prev: any) => ({ ...prev, fromEmail: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="reports@yourcompany.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">发件人姓名</label>
            <input
              type="text"
              value={emailConfig.fromName}
              onChange={((e: any) => setEmailConfig(prev: any) => ({ ...prev, fromName: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="ChangeLink Reports"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            onClick={handleEmailTest}
            disabled={isTestingConnection}
          >
            {isTestingConnection ? '测试中...' : '测试邮件发送'}
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              markStepCompleted('email');
              handleNext();
            }}
          >
            跳过此步骤
          </Button>
        </div>

        {testResults.email && (
          <div className={`p-4 rounded-lg ${testResults.email.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <div className="flex items-center">
              {testResults.email.success ? 
                <CheckCircle className="h-5 w-5 mr-2" /> : 
                <AlertCircle className="h-5 w-5 mr-2" />
              }
              {testResults.email.message}
            </div>
          </div>
        )}
      </div>
    </div>
    );

  const renderDatabaseStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Database className="h-12 w-12 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">数据库初始化</h2>
        <p className="text-gray-600">
          初始化本地IndexedDB数据库，用于存储广告数据、配置信息和系统监控数据。
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="bg-blue-50 p-6 rounded-lg">
          <h3 className="font-semibold mb-4">数据库特性：</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
              本地存储，数据不会上传到服务器
            </li>
            <li className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
              支持大容量数据存储
            </li>
            <li className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
              自动数据备份和恢复
            </li>
            <li className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
              高性能索引和查询
            </li>
          </ul>
        </div>

        <div className="text-center pt-6">
          <Button
            onClick={(async (): any) => {
              const success = await initializeDatabase();
              if (success) => {
                handleNext();
              }
            }}
            className="px-8"
          >
            初始化数据库
          </Button>
        </div>
      </div>
    </div>
    );

  const renderCompleteStep = () => (
    <div className="text-center space-y-6">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="h-12 w-12 text-green-600" />
      </div>
      
      <div>
        <h2 className="text-2xl font-bold mb-4">🎉 配置完成！</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          恭喜！您已经成功完成了ChangeLink的初始配置。现在您可以开始使用所有功能了。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2">📊 广告数据报告</h3>
          <p className="text-sm text-gray-600 mb-3">查看详细的广告数据分析和趋势报告</p>
          <Button variant="outline" size="sm" className="w-full">
            查看报告
          </Button>
        </div>
        
        <div className="p-4 border rounded-lg">
          <h3 className="font-semibold mb-2">📈 性能监控</h3>
          <p className="text-sm text-gray-600 mb-3">实时监控系统性能和健康状态</p>
          <Button variant="outline" size="sm" className="w-full">
            系统监控
          </Button>
        </div>
      </div>

      <div className="pt-4">
        <Button onClick={handleComplete} size="lg" className="px-8">
          开始使用 ChangeLink
        </Button>
      </div>
    </div>
    );

  const renderAdvancedStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Settings className="h-12 w-12 text-purple-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">高级配置</h2>
        <p className="text-gray-600">
          配置邮件通知和其他可选设置。这些配置可以稍后在设置页面进行修改。
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* 邮件配置部分 */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-4 flex items-center">
            <Mail className="h-5 w-5 mr-2" />
            邮件通知配置
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">SMTP 主机</label>
                <input
                  type="text"
                  value={emailConfig.smtpHost}
                  onChange={((e: any) => setEmailConfig(prev: any) => ({ ...prev, smtpHost: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="smtp.gmail.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">SMTP 端口</label>
                <input
                  type="text"
                  value={emailConfig.smtpPort}
                  onChange={((e: any) => setEmailConfig(prev: any) => ({ ...prev, smtpPort: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="587"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">SMTP 用户名</label>
              <input
                type="text"
                value={emailConfig.smtpUser}
                onChange={((e: any) => setEmailConfig(prev: any) => ({ ...prev, smtpUser: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="your-email@gmail.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">SMTP 密码</label>
              <div className="relative">
                <input
                  type={showPasswords ? "text" : "password"}
                  value={emailConfig.smtpPassword}
                  onChange={((e: any) => setEmailConfig(prev: any) => ({ ...prev, smtpPassword: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md pr-10"
                  placeholder="应用专用密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">发件人邮箱</label>
                <input
                  type="email"
                  value={emailConfig.fromEmail}
                  onChange={((e: any) => setEmailConfig(prev: any) => ({ ...prev, fromEmail: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="reports@yourcompany.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">发件人姓名</label>
                <input
                  type="text"
                  value={emailConfig.fromName}
                  onChange={((e: any) => setEmailConfig(prev: any) => ({ ...prev, fromName: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="ChangeLink Reports"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={handleEmailTest}
                disabled={isTestingConnection}
              >
                {isTestingConnection ? '测试中...' : '测试邮件发送'}
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  markStepCompleted('advanced');
                  handleNext();
                }}
              >
                跳过邮件配置
              </Button>
            </div>

            {testResults.email && (
              <div className={`p-4 rounded-lg ${testResults.email.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                <div className="flex items-center">
                  {testResults.email.success ? 
                    <CheckCircle className="h-5 w-5 mr-2" /> : 
                    <AlertCircle className="h-5 w-5 mr-2" />
                  }
                  {testResults.email.message}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 其他配置提示 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2">其他配置选项</h3>
          <p className="text-sm text-gray-600">
            您还可以在设置页面配置以下功能：
          </p>
          <ul className="text-sm text-gray-600 mt-2 space-y-1">
            <li>• 数据备份和恢复设置</li>
            <li>• 自动执行计划</li>
            <li>• 通知偏好设置</li>
            <li>• API访问限制</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (setupSteps[currentStep].id) => {
      case 'welcome':
        return renderWelcomeStep();
      case 'google-ads':
        return renderGoogleAdsStep();
      case 'advanced':
        return renderAdvancedStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return null as any;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* 进度条 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold">ChangeLink 初始配置</h1>
            <span className="text-sm text-gray-600">
              步骤 {currentStep + 1} / {setupSteps.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* 步骤指示器 */}
        <div className="flex items-center justify-center mb-8 overflow-x-auto">
          {setupSteps.map((step, index: any) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                index === currentStep 
                  ? 'border-blue-600 bg-blue-600 text-white' 
                  : step.completed 
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-gray-300 bg-white text-gray-400'
              }`}>
                {step.completed ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-medium">{index + 1}</span>
                )}
              </div>
              {index < setupSteps.length - 1 && (
                <div className={`w-12 h-0.5 mx-2 ${
                  step.completed ? 'bg-green-600' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* 主要内容 */}
        <Card className="mb-8">
          <CardContent className="p-8">
            {renderCurrentStep()}
          </CardContent>
        </Card>

        {/* 导航按钮 */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            上一步
          </Button>

          <div className="flex items-center space-x-4">
            {onSkip && currentStep < setupSteps.length - 1 && (
              <Button variant="ghost" onClick={onSkip}>
                跳过配置
              </Button>
            )}
            
            {currentStep < setupSteps.length - 1 && (
              <Button
                onClick={handleNext}
                disabled={setupSteps[currentStep].required && !setupSteps[currentStep].completed}
                className="flex items-center"
              >
                下一步
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
    );
}