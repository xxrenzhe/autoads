'use client';

/**
 * 完整设置向导页面
 * 引导用户完成整个系统配置流程，确保生产环境可用
 * 
 * 配置流程：
 * 1. Google Ads账号配置和授权
 * 2. 广告联盟链接配置
 * 3. AdsPower环境配置
 * 4. 关联配置创建
 * 5. 自动化任务设置
 * 6. 系统验证和测试
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight,
  ArrowLeft,
  Play,
  Pause,
  RefreshCw,
  Eye,
  EyeOff,
  TestTube,
  Link as LinkIcon,
  Globe,
  Clock,
  Users,
  Database,
  Zap,
  FileText
} from 'lucide-react';

// Import memoized components
import {
  ConfigurationProgress,
  CurrentStepDisplay,
  SetupSidebar,
  KeyboardHelpModal,
  StepNavigation,
  GoogleAdsStep,
  AffiliateLinksStep,
  AdsPowerStep,
  ConfigurationStep,
  AutomationStep,
  VerificationStep
} from './components';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  required: boolean;
}

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

interface AffiliateLink {
  id: string;
  name: string;
  affiliateUrl: string;
  description?: string;
  category?: string;
  isActive: boolean;
  status: 'valid' | 'invalid' | 'untested';
}

interface AdsPowerEnvironment {
  id: string;
  name: string;
  environmentId: string;
  apiEndpoint: string;
  apiKey?: string;
  isActive: boolean;
  status: 'connected' | 'disconnected' | 'error';
}

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
  adMappingConfig: Array<{
    originalUrl: string;
    adMappings: Array<{
      adId: string;
      executionNumber: number;
      campaignId?: string;
      adGroupId?: string;
    }>;
  }>;
  status: 'active' | 'paused' | 'stopped';
  createdAt: string;
  updatedAt: string;
  lastExecuted?: string;
}

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  // Refs for debouncing
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  
  // 配置数据状态
  const [googleAdsAccounts, setGoogleAdsAccounts] = useState<GoogleAdsAccount[]>([]);
  const [affiliateLinks, setAffiliateLinks] = useState<AffiliateLink[]>([]);
  const [adsPowerEnvironments, setAdsPowerEnvironments] = useState<AdsPowerEnvironment[]>([]);
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  
  // 表单状态
  const [newGoogleAdsAccount, setNewGoogleAdsAccount] = useState<Partial<GoogleAdsAccount>>({
    name: '',
    customerId: '',
    clientId: '',
    clientSecret: '',
    developerToken: '',
    refreshToken: '',
    loginCustomerId: ''
  });
  
  const [newAffiliateLink, setNewAffiliateLink] = useState<Partial<AffiliateLink>>({
    name: '',
    affiliateUrl: '',
    description: '',
    category: ''
  });
  
  const [newAdsPowerEnv, setNewAdsPowerEnv] = useState<Partial<AdsPowerEnvironment>>({
    name: '',
    environmentId: '',
    apiEndpoint: 'http://local.adspower.net:50325',
    apiKey: ''
  });
  
  const [newConfiguration, setNewConfiguration] = useState<Partial<Configuration>>({
    name: '',
    description: '',
    environmentId: '',
    repeatCount: 1,
    notificationEmail: '',
    originalLinks: [],
    googleAdsAccounts: [],
    adMappingConfig: []
  });

  // 设置步骤定义
  const setupSteps: SetupStep[] = [
    {
      id: 'google-ads',
      title: 'Google Ads账号配置',
      description: '配置Google Ads API访问凭据，获取广告数据',
      status: googleAdsAccounts.length > 0 ? 'completed' : 'pending',
      required: true
    },
    {
      id: 'affiliate-links',
      title: '广告联盟链接配置',
      description: '添加需要处理的广告联盟链接',
      status: affiliateLinks.length > 0 ? 'completed' : 'pending',
      required: true
    },
    {
      id: 'adspower-env',
      title: 'AdsPower环境配置',
      description: '配置AdsPower浏览器环境，支持链接访问',
      status: adsPowerEnvironments.length > 0 ? 'completed' : 'pending',
      required: true
    },
    {
      id: 'configurations',
      title: '执行配置创建',
      description: '创建自动化执行配置，整合所有组件',
      status: configurations.length > 0 ? 'completed' : 'pending',
      required: true
    },
    {
      id: 'automation',
      title: '自动化任务设置',
      description: '配置定时或手动执行任务',
      status: 'pending',
      required: false
    },
    {
      id: 'verification',
      title: '系统验证测试',
      description: '验证整个系统配置是否正确',
      status: 'pending',
      required: true
    }
  ];

  // 计算完成进度 - memoized
  const completedSteps = setupSteps.filter((step: any) => step.status === 'completed').length;
  const totalRequiredSteps = setupSteps.filter((step: any) => step.required).length;
  const completedRequiredSteps = setupSteps.filter((step: any) => step.required && step.status === 'completed').length;
  const progressPercentage = totalRequiredSteps > 0 ? Math.round((completedRequiredSteps / totalRequiredSteps) * 100) : 0;

  // 加载现有配置和保存的进度
  useEffect(() => {
    loadExistingConfigurations();
    loadSavedProgress();
    
    // 清理函数
    return () => {
      isMountedRef.current = false;
      if (autoSaveTimeoutRef.current) => {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // 导航函数 - memoized
  const nextStep = useCallback(() => {
    if (currentStep < setupSteps.length - 1) => {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, setupSteps.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) => {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // 键盘导航处理函数 - memoized
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Alt + 左箭头: 上一步
    if (e.altKey && e.key === 'ArrowLeft') => {
      e.preventDefault();
      if (currentStep > 0) => {
        prevStep();
      }
    }
    // Alt + 右箭头: 下一步
    else if (e.altKey && e.key === 'ArrowRight') => {
      e.preventDefault();
      if (currentStep < setupSteps.length - 1) => {
        nextStep();
      }
    }
    // 数字键 1-6: 直接跳转到对应步骤
    else if (e.key >= '1' && e.key <= '6') => {
      const stepIndex = parseInt(e.key) - 1;
      if (stepIndex < setupSteps.length) => {
        e.preventDefault();
        setCurrentStep(stepIndex);
      }
    }
    // Home: 第一步
    else if (e.key === 'Home') => {
      e.preventDefault();
      setCurrentStep(0);
    }
    // End: 最后一步
    else if (e.key === 'End') => {
      e.preventDefault();
      setCurrentStep(setupSteps.length - 1);
    }
  }, [currentStep, setupSteps.length, prevStep, nextStep]);

  // 键盘导航事件监听
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // 加载保存的进度
  const loadSavedProgress = async () => {
    try {
      const response = await fetch('/api/adscenter/setup/progress?action=load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      if (result.success && result.data) => {
        // 恢复当前步骤
        setCurrentStep(result.data.currentStep);
        console.log('Setup progress loaded successfully');
      }
    } catch (error) {
      console.error('Failed to load saved progress:', error);
    }
  };

  // 自动保存进度（带防抖）
  const autoSaveProgress = useCallback(() => {
    if (autoSaveTimeoutRef.current) => {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    setAutoSaveStatus('saving');
    
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch('/api/adscenter/setup/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            currentStep,
            setupSteps: setupSteps?.filter(Boolean)?.map((step: any) => ({
              ...step,
              status: step.id === 'google-ads' && googleAdsAccounts.length > 0 ? 'completed' :
                     step.id === 'affiliate-links' && affiliateLinks.length > 0 ? 'completed' :
                     step.id === 'adspower-env' && adsPowerEnvironments.length > 0 ? 'completed' :
                     step.id === 'configurations' && configurations.length > 0 ? 'completed' :
                     step.status
            })),
            formData: {
              googleAdsAccounts,
              affiliateLinks,
              adsPowerEnvironments,
              configurations
            }
          })
        });

        const result = await response.json();
        if (result.success && isMountedRef.current) => {
          setAutoSaveStatus('saved');
          console.log('✅ Setup progress auto-saved');
          // 2秒后重置状态
          setTimeout(() => {
            if (isMountedRef.current) => {
              setAutoSaveStatus('idle');
            }
          }, 2000);
        } else if (isMountedRef.current) => {
          setAutoSaveStatus('error');
          console.error('❌ Auto-save failed:', result.error);
          // 显示错误提示（仅在持续错误时）
          setTimeout(() => {
            if (isMountedRef.current && autoSaveStatus === 'error') => {
              setAutoSaveStatus('idle');
            }
          }, 3000);
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
        if (isMountedRef.current) => {
          setAutoSaveStatus('error');
        }
      }
    }, 1000); // 1秒防抖
  }, [currentStep, setupSteps, googleAdsAccounts, affiliateLinks, adsPowerEnvironments, configurations]);

  // 监听需要保存的状态变化
  useEffect(() => {
    autoSaveProgress();
  }, [currentStep, googleAdsAccounts.length, affiliateLinks.length, adsPowerEnvironments.length, configurations.length]);

  // 手动保存函数
  const manualSave = useCallback(async () => {
    setAutoSaveStatus('saving');
    try {
      const response = await fetch('/api/adscenter/setup/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          currentStep,
          setupSteps: setupSteps?.filter(Boolean)?.map((step: any) => ({
            ...step,
            status: step.id === 'google-ads' && googleAdsAccounts.length > 0 ? 'completed' :
                   step.id === 'affiliate-links' && affiliateLinks.length > 0 ? 'completed' :
                   step.id === 'adspower-env' && adsPowerEnvironments.length > 0 ? 'completed' :
                   step.id === 'configurations' && configurations.length > 0 ? 'completed' :
                   step.status
          })),
          formData: {
            googleAdsAccounts,
            affiliateLinks,
            adsPowerEnvironments,
            configurations
          }
        })
      });

      const result = await response.json();
      if (result.success) => {
        setAutoSaveStatus('saved');
        alert('✅ 进度已保存');
        setTimeout(() => {
          if (isMountedRef.current) => {
            setAutoSaveStatus('idle');
          }
        }, 2000);
      } else {
        setAutoSaveStatus('error');
        alert('❌ 保存失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('Manual save failed:', error);
      setAutoSaveStatus('error');
      alert('❌ 保存失败: 网络错误');
    }
  }, [currentStep, setupSteps, googleAdsAccounts, affiliateLinks, adsPowerEnvironments, configurations]);

  const loadExistingConfigurations = async () => {
    setLoading(true);
    try {
      // 加载Google Ads账号
      const googleAdsResponse = await fetch('/api/adscenter/settings?type=google-ads-accounts');
      if (googleAdsResponse.ok) => {
        const result = await googleAdsResponse.json();
        if (result.success) => {
          setGoogleAdsAccounts(result.data || []);
        }
      }

      // 加载广告联盟链接
      const affiliateResponse = await fetch('/api/adscenter/settings?type=affiliate-links');
      if (affiliateResponse.ok) => {
        const result = await affiliateResponse.json();
        if (result.success) => {
          setAffiliateLinks(result.data || []);
        }
      }

      // 加载AdsPower环境
      const adsPowerResponse = await fetch('/api/adscenter/settings?type=adspower-environments');
      if (adsPowerResponse.ok) => {
        const result = await adsPowerResponse.json();
        if (result.success) => {
          setAdsPowerEnvironments(result.data || []);
        }
      }

      // 加载配置
      const configurationsResponse = await fetch('/api/adscenter/settings?type=configurations');
      if (configurationsResponse.ok) => {
        const result = await configurationsResponse.json();
        if (result.success) => {
          setConfigurations(result.data.configurations || []);
        }
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 添加Google Ads账号
  const addGoogleAdsAccount = async () => {
    if (!newGoogleAdsAccount.name || !newGoogleAdsAccount.customerId) => {
      alert('请填写必要的账号信息');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/adscenter/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'google-ads-account',
          data: {
            ...newGoogleAdsAccount,
            status: 'disconnected'
          }
        })
      });

      const result = await response.json();
      if (result.success) => {
        setGoogleAdsAccounts(prev => [...prev, result.data]);
        setNewGoogleAdsAccount({
          name: '',
          customerId: '',
          clientId: '',
          clientSecret: '',
          developerToken: '',
          refreshToken: '',
          loginCustomerId: ''
        });
        alert('Google Ads账号添加成功！');
      } else {
        alert('添加失败: ' + result.error);
      }
    } catch (error) {
      console.error('添加Google Ads账号失败:', error);
      alert('添加失败');
    } finally {
      setLoading(false);
    }
  };

  // 测试Google Ads连接
  const testGoogleAdsConnection = async (accountId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/adscenter/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-google-ads-connection',
          accountId
        })
      });

      const result = await response.json();
      
      // 更新账号状态
      setGoogleAdsAccounts(prev => prev?.filter(Boolean)?.map((account: any) => 
        account.id === accountId 
          ? { ...account, status: result.success ? 'connected' : 'error' }
          : account
      ));

      alert(result.success ? '连接测试成功！' : '连接测试失败: ' + result.error);
    } catch (error) {
      console.error('测试连接失败:', error);
      alert('测试连接失败');
    } finally {
      setLoading(false);
    }
  };

  // 添加广告联盟链接
  const addAffiliateLink = async () => {
    if (!newAffiliateLink.name || !newAffiliateLink.affiliateUrl) => {
      alert('请填写链接名称和URL');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/adscenter/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'affiliate-link',
          data: {
            ...newAffiliateLink,
            status: 'untested'
          }
        })
      });

      const result = await response.json();
      if (result.success) => {
        setAffiliateLinks(prev => [...prev, result.data]);
        setNewAffiliateLink({
          name: '',
          affiliateUrl: '',
          description: '',
          category: ''
        });
        alert('广告联盟链接添加成功！');
      } else {
        alert('添加失败: ' + result.error);
      }
    } catch (error) {
      console.error('添加广告联盟链接失败:', error);
      alert('添加失败');
    } finally {
      setLoading(false);
    }
  };

  // 测试广告联盟链接
  const testAffiliateLink = async (linkId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/adscenter/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-affiliate-link',
          linkId
        })
      });

      const result = await response.json();
      
      // 更新链接状态
      setAffiliateLinks(prev => prev?.filter(Boolean)?.map((link: any) => 
        link.id === linkId 
          ? { ...link, status: result.success ? 'valid' : 'invalid' }
          : link
      ));

      alert(result.success ? '链接测试成功！' : '链接测试失败: ' + result.error);
    } catch (error) {
      console.error('测试链接失败:', error);
      alert('测试链接失败');
    } finally {
      setLoading(false);
    }
  };

  // 添加AdsPower环境
  const addAdsPowerEnvironment = async () => {
    if (!newAdsPowerEnv.name || !newAdsPowerEnv.environmentId) => {
      alert('请填写环境名称和环境ID');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/adscenter/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'adspower-environment',
          data: {
            ...newAdsPowerEnv,
            status: 'disconnected'
          }
        })
      });

      const result = await response.json();
      if (result.success) => {
        setAdsPowerEnvironments(prev => [...prev, result.data]);
        setNewAdsPowerEnv({
          name: '',
          environmentId: '',
          apiEndpoint: 'http://local.adspower.net:50325',
          apiKey: ''
        });
        alert('AdsPower环境添加成功！');
      } else {
        alert('添加失败: ' + result.error);
      }
    } catch (error) {
      console.error('添加AdsPower环境失败:', error);
      alert('添加失败');
    } finally {
      setLoading(false);
    }
  };

  // 测试AdsPower连接
  const testAdsPowerConnection = async (envId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/adscenter/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-adspower-connection',
          environmentId: envId
        })
      });

      const result = await response.json();
      
      // 更新环境状态
      setAdsPowerEnvironments(prev => prev?.filter(Boolean)?.map((env: any) => 
        env.id === envId 
          ? { ...env, status: result.success ? 'connected' : 'error' }
          : env
      ));

      alert(result.success ? 'AdsPower连接测试成功！' : '连接测试失败: ' + result.error);
    } catch (error) {
      console.error('测试AdsPower连接失败:', error);
      alert('测试连接失败');
    } finally {
      setLoading(false);
    }
  };

  // 创建配置
  const createConfiguration = async () => {
    if (!newConfiguration.name || !newConfiguration.environmentId) => {
      alert('请填写配置名称和环境ID');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/adscenter/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'configuration',
          action: 'create',
          data: {
            ...newConfiguration,
            status: 'active',
            adMappingConfig: newConfiguration.originalLinks?.filter(Boolean)?.map((linkId: any) => ({
              originalUrl: linkId,
              adMappings: []
            })) || []
          }
        })
      });

      const result = await response.json();
      if (result.success) => {
        setConfigurations(prev => [...prev, result.data]);
        setNewConfiguration({
          name: '',
          description: '',
          environmentId: '',
          repeatCount: 1,
          notificationEmail: '',
          originalLinks: [],
          googleAdsAccounts: [],
          adMappingConfig: []
        });
        alert('配置创建成功！');
      } else {
        alert('创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建配置失败:', error);
      alert('创建失败');
    } finally {
      setLoading(false);
    }
  };

  // 执行系统验证
  const runSystemVerification = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/adscenter/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'system-verification'
        })
      });

      const result = await response.json();
      
      if (result.success) => {
        alert('系统验证通过！所有配置正常。');
      } else {
        alert('系统验证失败: ' + result.error);
      }
    } catch (error) {
      console.error('系统验证失败:', error);
      alert('系统验证失败');
    } finally {
      setLoading(false);
    }
  };

  // 执行测试运行
  const runTestExecution = async () => {
    if (configurations.length === 0) => {
      alert('请先创建执行配置');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/adscenter/execution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-execution',
          configurationId: configurations[0].id
        })
      });

      const result = await response.json();
      
      if (result.success) => {
        alert('测试执行成功！系统运行正常。');
      } else {
        alert('测试执行失败: ' + result.error);
      }
    } catch (error) {
      console.error('测试执行失败:', error);
      alert('测试执行失败');
    } finally {
      setLoading(false);
    }
  };

  // 表单处理函数 - memoized
  const handleGoogleAdsAccountChange = useCallback((account: Partial<GoogleAdsAccount>) => {
    setNewGoogleAdsAccount(account);
  }, []);

  const handleAffiliateLinkChange = useCallback((link: Partial<AffiliateLink>) => {
    setNewAffiliateLink(link);
  }, []);

  const handleAdsPowerEnvChange = useCallback((env: Partial<AdsPowerEnvironment>) => {
    setNewAdsPowerEnv(env);
  }, []);

  const handleConfigurationChange = useCallback((config: Partial<Configuration>) => {
    setNewConfiguration(config);
  }, []);

  const getStepStatus = useCallback((step: SetupStep) => {
    switch (step.status) => {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'in-progress':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Settings className="h-8 w-8 mr-3" />
              系统设置向导
            </h1>
            <p className="text-gray-600 mt-2">完成系统配置，确保生产环境正常运行</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/adscenter/setup/configinfo"
              target="_blank"
              className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
            >
              <FileText className="h-4 w-4" />
              查看配置文档
            </Link>
            
            {/* 自动保存状态指示器 */}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              {autoSaveStatus === 'saving' && (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>保存中...</span>
                </>
              )}
              {autoSaveStatus === 'saved' && (
                <>
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span className="text-green-600">已保存</span>
                </>
              )}
              {autoSaveStatus === 'error' && (
                <>
                  <AlertCircle className="h-3 w-3 text-red-500" />
                  <span className="text-red-600">保存失败</span>
                </>
              )}
            </div>
            
            {/* 手动保存按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={manualSave}
              disabled={autoSaveStatus === 'saving'}
              className="text-gray-600 hover:text-gray-800"
              aria-label="手动保存进度"
            >
              <span className="text-xs">保存进度</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
              className="text-gray-600 hover:text-gray-800"
              aria-label="显示键盘快捷键帮助"
            >
              <span className="text-xs">快捷键</span>
            </Button>
          </div>
        </div>
      </div>

  
      {/* 进度指示器 */}
      <CurrentStepDisplay 
        setupSteps={setupSteps}
        currentStep={currentStep}
        onStepClick={setCurrentStep}
      />

      {/* 配置内容 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 主要配置区域 */}
        <div className="lg:col-span-2">
          {/* 步骤1: Google Ads账号配置 */}
          {currentStep === 0 && (
            <GoogleAdsStep
              accounts={googleAdsAccounts}
              newAccount={newGoogleAdsAccount}
              loading={loading}
              onAccountChange={handleGoogleAdsAccountChange}
              onAddAccount={addGoogleAdsAccount}
              onTestConnection={testGoogleAdsConnection}
            />
          )}

          {/* 步骤2: 广告联盟链接配置 */}
          {currentStep === 1 && (
            <AffiliateLinksStep
              links={affiliateLinks}
              newLink={newAffiliateLink}
              loading={loading}
              onLinkChange={handleAffiliateLinkChange}
              onAddLink={addAffiliateLink}
              onTestLink={testAffiliateLink}
            />
          )}

          {/* 步骤3: AdsPower环境配置 */}
          {currentStep === 2 && (
            <AdsPowerStep
              environments={adsPowerEnvironments}
              newEnvironment={newAdsPowerEnv}
              loading={loading}
              onEnvironmentChange={handleAdsPowerEnvChange}
              onAddEnvironment={addAdsPowerEnvironment}
              onTestConnection={testAdsPowerConnection}
            />
          )}

          {/* 步骤4: 关联配置创建 */}
          {currentStep === 3 && (
            <ConfigurationStep
              configurations={configurations}
              newConfiguration={newConfiguration}
              loading={loading}
              googleAdsAccounts={googleAdsAccounts}
              affiliateLinks={affiliateLinks}
              adsPowerEnvironments={adsPowerEnvironments}
              onConfigurationChange={handleConfigurationChange}
              onCreateConfiguration={createConfiguration}
            />
          )}

          {/* 步骤5: 自动化任务设置 */}
          {currentStep === 4 && (
            <AutomationStep />
          )}

          {/* 步骤6: 系统验证测试 */}
          {currentStep === 5 && (
            <VerificationStep
              loading={loading}
              configurations={configurations}
              onRunSystemVerification={runSystemVerification}
              onRunTestExecution={runTestExecution}
            />
          )}
        </div>

        {/* 侧边栏 - 配置摘要 */}
        <div className="space-y-6">
          <SetupSidebar
            setupSteps={setupSteps}
            currentStep={currentStep}
            googleAdsAccounts={googleAdsAccounts}
            affiliateLinks={affiliateLinks}
            adsPowerEnvironments={adsPowerEnvironments}
            configurations={configurations}
          />
        </div>
      </div>

      {/* 导航按钮 */}
      <StepNavigation
        currentStep={currentStep}
        totalSteps={setupSteps.length}
        onPrev={prevStep}
        onNext={nextStep}
      />

      {/* 键盘快捷键帮助模态框 */}
      <KeyboardHelpModal
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </div>
  );
}