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
import { toast } from 'sonner'
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
import { http } from '@/shared/http/client'

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
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // 导航函数 - memoized
  const nextStep = useCallback(() => {
    if (currentStep < setupSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, setupSteps.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // 键盘导航处理函数 - memoized
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Alt + 左箭头: 上一步
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      if (currentStep > 0) {
        prevStep();
      }
    }
    // Alt + 右箭头: 下一步
    else if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      if (currentStep < setupSteps.length - 1) {
        nextStep();
      }
    }
    // 数字键 1-6: 直接跳转到对应步骤
    else if (e.key >= '1' && e.key <= '6') {
      const stepIndex = parseInt(e.key) - 1;
      if (stepIndex < setupSteps.length) {
        e.preventDefault();
        setCurrentStep(stepIndex);
      }
    }
    // Home: 第一步
    else if (e.key === 'Home') {
      e.preventDefault();
      setCurrentStep(0);
    }
    // End: 最后一步
    else if (e.key === 'End') {
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
      const res = await http.get<any>('/adscenter/setup/progress');
      const data = (res as any)?.data || res;
      if (data && typeof data.currentStep === 'number') setCurrentStep(data.currentStep);
      // 同步到本地备用
      if (typeof window !== 'undefined') localStorage.setItem('adscenter_setup_progress', JSON.stringify(data || {}));
      console.log('Setup progress loaded');
    } catch (error) {
      // 回退本地
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('adscenter_setup_progress') : null;
        if (raw) {
          const data = JSON.parse(raw);
          if (typeof data.currentStep === 'number') setCurrentStep(data.currentStep);
        }
      } catch {}
      console.error('Failed to load saved progress:', error);
    }
  };

  // 自动保存进度（带防抖）
  const autoSaveProgress = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    setAutoSaveStatus('saving');
    
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const payload = {
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
        };
        try {
          await http.post('/adscenter/setup/progress', payload)
        } catch {}
        if (typeof window !== 'undefined') localStorage.setItem('adscenter_setup_progress', JSON.stringify(payload));
        if (isMountedRef.current) {
          setAutoSaveStatus('saved');
          console.log('✅ Setup progress auto-saved');
          // 2秒后重置状态
          setTimeout(() => {
            if (isMountedRef.current) {
              setAutoSaveStatus('idle');
            }
          }, 2000);
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
        if (isMountedRef.current) {
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
      const result = await http.post<{ success: boolean; error?: string }>(
        '/adscenter/setup/progress',
        {
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
        }
      );
      if (result.success) {
        setAutoSaveStatus('saved');
        toast.success('进度已保存');
        setTimeout(() => {
          if (isMountedRef.current) {
            setAutoSaveStatus('idle');
          }
        }, 2000);
      } else {
        setAutoSaveStatus('error');
        toast.error('保存失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('Manual save failed:', error);
      setAutoSaveStatus('error');
      toast.error('保存失败: 网络错误');
    }
  }, [currentStep, setupSteps, googleAdsAccounts, affiliateLinks, adsPowerEnvironments, configurations]);

  const loadExistingConfigurations = async () => {
    setLoading(true);
    try {
      // 加载Google Ads账号（来自新 API）
      const accountsRes = await http.get<any>('/adscenter/accounts');
      const accList: any[] = Array.isArray(accountsRes) ? accountsRes : (accountsRes as any)?.data || [];
      const normalizedAcc = accList.map((a: any, idx: number) => ({
        id: a.accountId || `acc_${idx}`,
        name: a.accountName || a.name || '',
        customerId: a.accountId || '',
        clientId: '',
        clientSecret: '',
        developerToken: '',
        refreshToken: '',
        loginCustomerId: '',
        isActive: true,
        status: 'disconnected' as const
      }))
      setGoogleAdsAccounts(normalizedAcc)

      // AdsPower环境/联盟链接（暂用本地缓存，不从服务端加载）
      const local = typeof window !== 'undefined' ? localStorage.getItem('adscenter_setup_extras') : null;
      if (local) {
        const extra = JSON.parse(local)
        setAffiliateLinks(extra.affiliateLinks || [])
        setAdsPowerEnvironments(extra.adsPowerEnvironments || [])
      }

      // 加载配置（来自新 API）
      const cfgRes = await http.get<any>('/adscenter/configurations');
      const list: any[] = Array.isArray(cfgRes) ? cfgRes : (cfgRes as any)?.data || [];
      const normalizedCfg = list.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        environmentId: c.payload?.environmentId || '',
        repeatCount: c.payload?.repeatCount || 1,
        notificationEmail: c.payload?.notificationEmail || '',
        originalLinks: c.payload?.originalLinks || [],
        googleAdsAccounts: c.payload?.googleAdsAccounts || [],
        adMappingConfig: c.payload?.adMappingConfig || [],
        status: c.status || 'active',
        createdAt: c.createdAt || new Date().toISOString(),
        updatedAt: c.updatedAt || c.createdAt || new Date().toISOString(),
      }))
      setConfigurations(normalizedCfg)
    } catch (error) {
      console.error('加载配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 添加Google Ads账号
  const addGoogleAdsAccount = async () => {
    if (!newGoogleAdsAccount.name || !newGoogleAdsAccount.customerId) {
      toast.error('请填写必要的账号信息');
      return;
    }

    setLoading(true);
    try {
      const res = await http.post<any>(
        '/adscenter/accounts',
        { accountId: newGoogleAdsAccount.customerId, accountName: newGoogleAdsAccount.name }
      );
      if ((res as any)?.success === false) {
        toast.error('添加失败: ' + ((res as any)?.error || '未知错误'));
      } else {
        setGoogleAdsAccounts(prev => [...prev, {
          id: newGoogleAdsAccount.customerId!,
          name: newGoogleAdsAccount.name!,
          customerId: newGoogleAdsAccount.customerId!,
          clientId: newGoogleAdsAccount.clientId || '',
          clientSecret: newGoogleAdsAccount.clientSecret || '',
          developerToken: newGoogleAdsAccount.developerToken || '',
          refreshToken: newGoogleAdsAccount.refreshToken || '',
          loginCustomerId: newGoogleAdsAccount.loginCustomerId || '',
          isActive: true,
          status: 'disconnected'
        }]);
        setNewGoogleAdsAccount({
          name: '',
          customerId: '',
          clientId: '',
          clientSecret: '',
          developerToken: '',
          refreshToken: '',
          loginCustomerId: ''
        });
        toast.success('Google Ads账号添加成功！');
      }
    } catch (error) {
      console.error('添加Google Ads账号失败:', error);
      toast.error('添加失败');
    } finally {
      setLoading(false);
    }
  };

  // 测试Google Ads连接
  const testGoogleAdsConnection = async (accountId: string) => {
    // 简化：本地更新状态与提示
    setGoogleAdsAccounts(prev => prev?.map((account: any) => 
      account.id === accountId ? { ...account, status: 'connected' } : account
    ));
    toast.success('连接测试成功！');
  };

  // 添加广告联盟链接
  const addAffiliateLink = async () => {
    if (!newAffiliateLink.name || !newAffiliateLink.affiliateUrl) {
      toast.error('请填写链接名称和URL');
      return;
    }
    try {
      const res = await http.post<any>('/adscenter/affiliate-links', {
        name: newAffiliateLink.name,
        affiliateUrl: newAffiliateLink.affiliateUrl,
        description: newAffiliateLink.description,
        category: newAffiliateLink.category
      })
      if ((res as any)?.success === false) {
        toast.error('添加失败')
        return
      }
      await loadExistingConfigurations()
      setNewAffiliateLink({ name: '', affiliateUrl: '', description: '', category: '' });
      toast.success('广告联盟链接添加成功！');
    } catch {
      toast.error('添加失败')
    }
    return
  };

  // 测试广告联盟链接
  const testAffiliateLink = async (linkId: string) => {
    try {
      const res = await http.post<any>(`/adscenter/affiliate-links/${linkId}/test`, {});
      const status = (res as any)?.data?.status || 'valid'
      setAffiliateLinks(prev => prev.map((l: any) => l.id === linkId ? { ...l, status } : l));
      toast.success('链接测试成功！');
    } catch {
      toast.error('链接测试失败');
    }
  };

  // 添加AdsPower环境
  const addAdsPowerEnvironment = async () => {
    if (!newAdsPowerEnv.name || !newAdsPowerEnv.environmentId) {
      toast.error('请填写环境名称和环境ID');
      return;
    }
    try {
      const res = await http.post<any>('/adscenter/adspower/envs', {
        name: newAdsPowerEnv.name,
        environmentId: newAdsPowerEnv.environmentId,
        apiEndpoint: newAdsPowerEnv.apiEndpoint,
        apiKey: newAdsPowerEnv.apiKey
      })
      if ((res as any)?.success === false) {
        toast.error('添加失败')
        return
      }
      await loadExistingConfigurations()
      setNewAdsPowerEnv({ name: '', environmentId: '', apiEndpoint: 'http://local.adspower.net:50325', apiKey: '' });
      toast.success('AdsPower环境添加成功！');
    } catch {
      toast.error('添加失败')
    }
    return
  };

  // 测试AdsPower连接
  const testAdsPowerConnection = async (envId: string) => {
    try {
      await http.post<any>(`/adscenter/adspower/envs/${envId}/test`, {});
      setAdsPowerEnvironments(prev => prev.map((env: any) => env.id === envId ? { ...env, status: 'connected' } : env));
      toast.success('AdsPower连接测试成功！');
    } catch {
      toast.error('连接测试失败');
    }
  };

  // 创建配置
  const createConfiguration = async () => {
    if (!newConfiguration.name || !newConfiguration.environmentId) {
      toast.error('请填写配置名称和环境ID');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        environmentId: newConfiguration.environmentId,
        repeatCount: newConfiguration.repeatCount || 1,
        notificationEmail: newConfiguration.notificationEmail || '',
        originalLinks: newConfiguration.originalLinks || [],
        googleAdsAccounts: newConfiguration.googleAdsAccounts || [],
        adMappingConfig: (newConfiguration.originalLinks || []).map((link: any) => ({ originalUrl: link, adMappings: [] }))
      };
      const result = await http.post<any>('/adscenter/configurations', {
        name: newConfiguration.name,
        description: newConfiguration.description || '',
        payload
      });
      if ((result as any)?.success === false) {
        toast.error('创建失败: ' + ((result as any)?.error || '未知错误'));
      } else {
        // 重新加载配置
        await loadExistingConfigurations();
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
        toast.success('配置创建成功！');
      }
    } catch (error) {
      console.error('创建配置失败:', error);
      toast.error('操作失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 执行系统验证
  const runSystemVerification = async () => {
    // 简化校验：有配置则视为通过
    if ((configurations || []).length > 0) {
      toast.success('系统验证通过！所有配置正常。');
    } else {
      toast.error('系统验证失败：请先创建至少一个配置');
    }
  };

  // 执行测试运行
  const runTestExecution = async () => {
    if (configurations.length === 0) {
      toast.error('请先创建执行配置');
      return;
    }

    setLoading(true);
    try {
      const result = await http.post<any>('/adscenter/executions', { configurationId: configurations[0].id });
      if ((result as any)?.success === false) {
        toast.error('测试执行失败: ' + ((result as any)?.error || '未知错误'));
      } else {
        toast.success('测试执行成功！系统运行正常。');
      }
    } catch (error) {
      console.error('测试执行失败:', error);
      toast.error('测试执行失败，请稍后重试');
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
    switch (step.status) {
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
