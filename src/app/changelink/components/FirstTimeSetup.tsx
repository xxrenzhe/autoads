'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  AlertCircle, 
  Settings, 
  Database, 
  Globe, 
  Key,
  ArrowRight,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { localStorageCompatibility as localStorageService } from '@/lib/local-storage-compatibility';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  completed: boolean;
}

interface SetupData {
  user: {
    username: string;
    email: string;
  };
  adspower: {
    apiUrl: string;
    testEnvironmentId: string;
  };
  googleAds: {
    clientId: string;
    clientSecret: string;
    developerToken: string;
  };
  notifications: {
    email: string;
    enableNotifications: boolean;
  };
}

export default function FirstTimeSetup({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState<SetupData>({
    user: {
      username: '',
      email: ''
    },
    adspower: {
      apiUrl: 'http://local.adspower.net:50325',
      testEnvironmentId: ''
    },
    googleAds: {
      clientId: '',
      clientSecret: '',
      developerToken: ''
    },
    notifications: {
      email: '',
      enableNotifications: true
    }
  });

  const [steps, setSteps] = useState<SetupStep[]>([
    {
      id: 'welcome',
      title: '欢迎使用 ChangeLink',
      description: '让我们开始配置您的自动化系统',
      icon: CheckCircle,
      completed: false
    },
    {
      id: 'settings',
      title: '系统设置',
      description: '配置系统基本参数',
      icon: Settings,
      completed: false
    },
    {
      id: 'user',
      title: '用户信息',
      description: '设置您的基本信息',
      icon: Database,
      completed: false
    },
    {
      id: 'adspower',
      title: 'AdsPower 配置',
      description: '配置 AdsPower API 连接',
      icon: Globe,
      completed: false
    },
    {
      id: 'googleads',
      title: 'Google Ads 配置',
      description: '配置 Google Ads API 凭据',
      icon: Key,
      completed: false
    },
    {
      id: 'complete',
      title: '配置完成',
      description: '开始使用 ChangeLink',
      icon: CheckCircle,
      completed: false
    }
  ]);
  const progress = ((currentStep + 1) / steps.length) * 100;

  const validateCurrentStep = (): boolean => {
    switch (steps[currentStep].id) {
      case 'welcome':
        return true;
      case 'user':
        return setupData.user.username.trim() !== '' && setupData.user.email.trim() !== '';
      case 'adspower':
        return setupData.adspower.apiUrl.trim() !== '' && setupData.adspower.testEnvironmentId.trim() !== '';
      case 'googleads':
        return setupData.googleAds.clientId.trim() !== '' && 
               setupData.googleAds.clientSecret.trim() !== '' && 
               setupData.googleAds.developerToken.trim() !== '';
      case 'complete':
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) {
      return;
    }

    if (currentStep < steps.length - 1) {
      // 标记当前步骤为完成
      const newSteps = [...steps];
      newSteps[currentStep].completed = true;
      setSteps(newSteps);
      
      setCurrentStep(currentStep + 1);
    } else {
      // 最后一步，完成设置
      await completeSetup();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeSetup = async () => {
    setLoading(true);
    try {
      // 创建用户记录
      const userId = `user_${Date.now()}`;
      await localStorageService.create('users', { 
        id: userId,
        username: setupData.user.username,
        email: setupData.user.email
      });
      // 保存配置到本地存储 (敏感数据)
      const secureConfig = {
        userId,
        adspower: setupData.adspower,
        googleAds: setupData.googleAds,
        notifications: setupData.notifications,
        setupCompleted: true,
        setupDate: new Date().toISOString()
      };

      localStorage.setItem('adscenter_secure_config', JSON.stringify(secureConfig));
      localStorage.setItem('adscenter_setup_completed', 'true');

      // 标记最后一步完成
      const newSteps = [...steps];
      newSteps[currentStep].completed = true;
      setSteps(newSteps);

      // 延迟一下让用户看到完成状态
      setTimeout(() => {
        onComplete();
      }, 1500);

    } catch (error) {
      console.error('设置完成失败:', error);
      alert('设置完成失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const testAdsPowerConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${setupData.adspower.apiUrl}/api/v1/user/list`);
      if (response.ok) {
        alert('AdsPower 连接测试成功！');
      } else {
        alert('AdsPower 连接测试失败，请检查 API 地址');
      }
    } catch (error) {
      alert('AdsPower 连接测试失败，请检查 API 地址和网络连接');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
              <Settings className="w-12 h-12 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">欢迎使用 ChangeLink</h2>
              <p className="text-gray-600 mb-4">
                ChangeLink 是一个强大的自动化工具，帮助您管理 Google Ads 推广链接。
              </p>
              <p className="text-sm text-gray-500">
                我们将引导您完成初始配置，整个过程大约需要 5 分钟。
              </p>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                所有敏感数据（如 API 密钥）将安全存储在您的本地浏览器中，不会上传到服务器。
              </AlertDescription>
            </Alert>
          </div>
        );

      case 'user':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">用户信息</h2>
              <p className="text-gray-600 mb-6">请提供您的基本信息以创建用户账户。</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">用户名 *</Label>
                <Input
                  id="username"
                  value={setupData.user.username}
                  onChange={(e) => setSetupData(prev => ({
                    ...prev,
                    user: { ...prev.user, username: e.target.value }
                  }))}
                  placeholder="输入您的用户名"
                />
              </div>
              
              <div>
                <Label htmlFor="email">邮箱地址 *</Label>
                <Input
                  id="email"
                  type="email"
                  value={setupData.user.email}
                  onChange={(e) => setSetupData(prev => ({
                    ...prev,
                    user: { ...prev.user, email: e.target.value }
                  }))}
                  placeholder="输入您的邮箱地址"
                />
                <p className="text-sm text-gray-500 mt-1">
                  邮箱将用于接收执行报告和系统通知
                </p>
              </div>
            </div>
          </div>
        );

      case 'adspower':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">AdsPower 配置</h2>
              <p className="text-gray-600 mb-6">配置 AdsPower API 连接以控制指纹浏览器。</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="apiUrl">API 地址 *</Label>
                <Input
                  id="apiUrl"
                  value={setupData.adspower.apiUrl}
                  onChange={(e) => setSetupData(prev => ({
                    ...prev,
                    adspower: { ...prev.adspower, apiUrl: e.target.value }
                  }))}
                  placeholder="http://local.adspower.net:50325"
                />
                <p className="text-sm text-gray-500 mt-1">
                  AdsPower 本地 API 地址，通常为默认值
                </p>
              </div>
              
              <div>
                <Label htmlFor="testEnvironmentId">测试环境 ID *</Label>
                <Input
                  id="testEnvironmentId"
                  value={setupData.adspower.testEnvironmentId}
                  onChange={(e) => setSetupData(prev => ({
                    ...prev,
                    adspower: { ...prev.adspower, testEnvironmentId: e.target.value }
                  }))}
                  placeholder="输入一个可用的环境 ID"
                />
                <p className="text-sm text-gray-500 mt-1">
                  用于测试连接的 AdsPower 环境 ID
                </p>
              </div>

              <Button 
                onClick={testAdsPowerConnection} 
                variant="outline" 
                disabled={loading || !setupData.adspower.apiUrl}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
                测试连接
              </Button>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                请确保 AdsPower 客户端正在运行，并且本地 API 服务已启用。
              </AlertDescription>
            </Alert>
          </div>
        );

      case 'googleads':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Google Ads 配置</h2>
              <p className="text-gray-600 mb-6">配置 Google Ads API 凭据以管理广告账户。</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="clientId">客户端 ID *</Label>
                <Input
                  id="clientId"
                  value={setupData.googleAds.clientId}
                  onChange={(e) => setSetupData(prev => ({
                    ...prev,
                    googleAds: { ...prev.googleAds, clientId: e.target.value }
                  }))}
                  placeholder="输入 Google Ads API 客户端 ID"
                />
              </div>
              
              <div>
                <Label htmlFor="clientSecret">客户端密钥 *</Label>
                <Input
                  id="clientSecret"
                  type="password"
                  value={setupData.googleAds.clientSecret}
                  onChange={(e) => setSetupData(prev => ({
                    ...prev,
                    googleAds: { ...prev.googleAds, clientSecret: e.target.value }
                  }))}
                  placeholder="输入 Google Ads API 客户端密钥"
                />
              </div>

              <div>
                <Label htmlFor="developerToken">开发者令牌 *</Label>
                <Input
                  id="developerToken"
                  type="password"
                  value={setupData.googleAds.developerToken}
                  onChange={(e) => setSetupData(prev => ({
                    ...prev,
                    googleAds: { ...prev.googleAds, developerToken: e.target.value }
                  }))}
                  placeholder="输入 Google Ads 开发者令牌"
                />
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                这些凭据将安全存储在您的本地浏览器中。请从 Google Cloud Console 获取这些信息。
              </AlertDescription>
            </Alert>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">如何获取 Google Ads API 凭据：</h4>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                <li>访问 Google Cloud Console</li>
                <li>创建或选择项目</li>
                <li>启用 Google Ads API</li>
                <li>创建 OAuth 2.0 客户端 ID</li>
                <li>申请开发者令牌</li>
              </ol>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">配置完成！</h2>
              <p className="text-gray-600 mb-4">
                恭喜！您已成功完成 ChangeLink 的初始配置。
              </p>
              <p className="text-sm text-gray-500">
                现在您可以开始创建配置并运行自动化任务了。
              </p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg text-left">
              <h4 className="font-medium mb-2">接下来您可以：</h4>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>创建您的第一个配置</li>
                <li>添加 Google Ads 账户</li>
                <li>设置定时任务</li>
                <li>监控执行状态</li>
              </ul>
            </div>
          </div>
        );

      default:
        return null as any;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* 进度条 */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">设置进度</span>
            <span className="text-sm text-gray-500">{currentStep + 1} / {steps.length}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* 步骤指示器 */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = step.completed;
              
              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center space-y-2 ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isActive
                        ? 'bg-blue-100 border-2 border-blue-600'
                        : isCompleted
                        ? 'bg-green-100 border-2 border-green-600'
                        : 'bg-gray-100 border-2 border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium hidden sm:block">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 主要内容 */}
        <Card>
          <CardContent className="p-8">
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* 导航按钮 */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            上一步
          </Button>

          <Button
            onClick={handleNext}
            disabled={!validateCurrentStep() || loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : currentStep === steps.length - 1 ? (
              '开始使用'
            ) : (
              <>
                下一步
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}