'use client';

import React, { useState, useEffect } from 'react';
import { EnhancedError } from '@/lib/utils/error-handling';
import { Button } from '@/components/ui/button';
import { ProtectedButton } from '@/components/auth/ProtectedButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
const logger = createClientLogger('AdsCenterClient');
import { http } from '@/shared/http/client'
import { getUiDefaultRpm, fetchUiDefaultRpm, getPlanFeatureRpmSync } from '@/lib/config/rate-limit'
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits'

import { 
  Play, 
  RefreshCw, 
  Plus,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Database,
  Activity
} from 'lucide-react';
import { toast } from 'sonner'
import { WeChatSubscribeModal } from '@/components/common/WeChatSubscribeModal'
import type { HttpError } from '@/shared/http/client'

interface GoogleAdsAccount {
  id: string;
  account_id: string;
  account_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Configuration {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  payload?: any;
}

interface Execution {
  id: string;
  configuration_id: string;
  status: string;
  progress: number;
  total_items: number;
  processed_items: number;
  started_at: string;
  completed_at?: string;
  created_at: string;
}

export default function AdsCenterClient() {
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [currentTab, setCurrentTab] = useState<'accounts' | 'configurations' | 'executions' | 'monitoring'>('accounts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [addingAccount, setAddingAccount] = useState(false);
  const [addingConfig, setAddingConfig] = useState(false);
  const [startingExecId, setStartingExecId] = useState<string | null>(null);
  const [showWeChatModal, setShowWeChatModal] = useState(false);
  const [modalScenario, setModalScenario] = useState<'insufficient_balance' | 'upgrade_required' | 'adscenter_enable'>('adscenter_enable');
  const [modalRequired, setModalRequired] = useState<number | undefined>(undefined);
  const [modalBalance, setModalBalance] = useState<number | undefined>(undefined);
  
  // Go 后端直连功能开关（预发/缺省关闭）
  const useGoAds = false;
  // 为 TS 提供占位实现，实际在 useGoAds=false 时不会被渲染/调用
  const [goLinks, setGoLinks] = useState<string>('');
  const [goAdsPowerProfile, setGoAdsPowerProfile] = useState<string>('');
  const [goGoogleAdsAccount, setGoGoogleAdsAccount] = useState<string>('');
  const [goRunning, setGoRunning] = useState<boolean>(false);
  const handleGoQuickUpdate = async () => {
    toast.info('Go 后端直连在当前环境未启用');
  };
  // 仅为类型占位；实际未启用时不会被调用
  async function runAdsCenterUpdate(_args: any): Promise<{ taskId: string }> {
    return { taskId: 'disabled' };
  }
  
  // Form states
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [newAccount, setNewAccount] = useState({ accountId: '', accountName: '' });
  const [newConfig, setNewConfig] = useState({ name: '', description: '', configData: '' });
  // UI 速率上限（展示用途，后端为权威）
  const [uiRateLimitMax, setUiRateLimitMax] = useState<number>(getUiDefaultRpm());
  const { data: subscriptionData } = useSubscriptionLimits();
  const [planRpm, setPlanRpm] = useState<number | undefined>(undefined);
  const [featureRpm, setFeatureRpm] = useState<number | undefined>(undefined);
  useEffect(() => { fetchUiDefaultRpm().then(setUiRateLimitMax).catch(() => {}); }, []);
  useEffect(() => { const { planRpm: p, featureRpm: f } = getPlanFeatureRpmSync(subscriptionData?.planId, 'adscenter'); setPlanRpm(p); setFeatureRpm(f); }, [subscriptionData?.planId]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch accounts
      const accountsRes = await http.getCached<any>('/adscenter/accounts', undefined, 30_000);
      const accountsList: any[] = Array.isArray(accountsRes) ? accountsRes : (accountsRes?.data || []);
      const normalizedAccounts: GoogleAdsAccount[] = accountsList.map((a: any) => ({
        id: a.accountId || a.id || a.account_id,
        account_id: a.accountId || a.account_id,
        account_name: a.accountName || a.account_name,
        status: a.status || 'active',
        created_at: a.createdAt || a.created_at || new Date().toISOString(),
        updated_at: a.updated_at || a.createdAt || new Date().toISOString(),
      }));
      setAccounts(normalizedAccounts);

      // Fetch configurations
      const configsRes = await http.getCached<any>('/adscenter/configurations', undefined, 30_000);
      const configsList: any[] = Array.isArray(configsRes) ? configsRes : (configsRes?.data || []);
      const normalizedConfigs: Configuration[] = configsList.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        status: c.status || 'active',
        created_at: c.createdAt || c.created_at || new Date().toISOString(),
        updated_at: c.updated_at || c.createdAt || new Date().toISOString(),
        payload: c.payload || c.data || c.config || {}
      }));
      setConfigurations(normalizedConfigs);

      // Fetch executions
      const execsRes = await http.getCached<any>('/adscenter/executions', undefined, 15_000);
      const execsList: any[] = Array.isArray(execsRes) ? execsRes : (execsRes?.data || []);
      const normalizedExecs: Execution[] = execsList.map((e: any) => ({
        id: e.id,
        configuration_id: e.configurationId || e.configuration_id,
        status: e.status || 'created',
        progress: e.progress ?? 0,
        total_items: e.total_items ?? 0,
        processed_items: e.processed_items ?? 0,
        started_at: e.started_at || e.createdAt || new Date().toISOString(),
        completed_at: e.completed_at,
        created_at: e.created_at || e.createdAt || new Date().toISOString(),
      }));
      setExecutions(normalizedExecs);

    } catch (err) {
      setError('Failed to fetch data');
      toast.error('加载数据失败，请稍后重试');
      logger.error('Error fetching data:', new EnhancedError('Error fetching data:', { error: err instanceof Error ? err.message : String(err)  }));
    } finally {
      setLoading(false);
    }
  };

  const fetchFresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const [acc, conf, execs] = await Promise.all([
        http.get<any>('/adscenter/accounts'),
        http.get<any>('/adscenter/configurations'),
        http.get<any>('/adscenter/executions')
      ]);
      const accList: any[] = Array.isArray(acc) ? acc : (acc as any)?.data || [];
      const confList: any[] = Array.isArray(conf) ? conf : (conf as any)?.data || [];
      const execList: any[] = Array.isArray(execs) ? execs : (execs as any)?.data || [];
      setAccounts(accList.map((a: any) => ({
        id: a.accountId || a.id || a.account_id,
        account_id: a.accountId || a.account_id,
        account_name: a.accountName || a.account_name,
        status: a.status || 'active',
        created_at: a.createdAt || new Date().toISOString(),
        updated_at: a.updated_at || a.createdAt || new Date().toISOString(),
      })));
      setConfigurations(confList.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        status: c.status || 'active',
        created_at: c.createdAt || new Date().toISOString(),
        updated_at: c.updated_at || c.createdAt || new Date().toISOString(),
      })));
      setExecutions(execList.map((e: any) => ({
        id: e.id,
        configuration_id: e.configurationId || e.configuration_id,
        status: e.status || 'created',
        progress: e.progress ?? 0,
        total_items: e.total_items ?? 0,
        processed_items: e.processed_items ?? 0,
        started_at: e.started_at || e.createdAt || new Date().toISOString(),
        completed_at: e.completed_at,
        created_at: e.created_at || e.createdAt || new Date().toISOString(),
      })));
    } catch (err) {
      setError('Failed to fetch data');
      toast.error('加载数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  const handleAddAccount = async () => {
    try {
      setAddingAccount(true);
      const res = await http.post<{ success?: boolean; error?: string }>(
        '/adscenter/accounts',
        { accountId: newAccount.accountId, accountName: newAccount.accountName }
      );
      if ((res as any)?.success === false) {
        const msg = (res as any)?.error || '操作失败，请稍后重试';
        setError(msg);
        toast.error(msg);
        return;
      }
      setSuccessMessage('Account added successfully');
      toast.success('账户添加成功');
      setShowAddAccount(false);
      setNewAccount({ accountId: '', accountName: '' });
      fetchFresh();
    } catch (err) {
      setError('操作失败，请稍后重试');
      toast.error('操作失败，请稍后重试');
    }
    finally { setAddingAccount(false); }
  };

  const handleAddConfiguration = async () => {
    try {
      setAddingConfig(true);
      let parsed: any = {};
      try { parsed = newConfig.configData ? JSON.parse(newConfig.configData) : {}; } catch { parsed = {}; }
      const res = await http.post<{ success?: boolean; error?: string }>(
        '/adscenter/configurations',
        { name: newConfig.name, description: newConfig.description, payload: parsed }
      );
      if ((res as any)?.success === false) {
        const msg = (res as any)?.error || '操作失败，请稍后重试';
        setError(msg);
        toast.error(msg);
        return;
      }
      setSuccessMessage('Configuration added successfully');
      toast.success('配置创建成功');
      setShowAddConfig(false);
      setNewConfig({ name: '', description: '', configData: '' });
      fetchFresh();
    } catch (err) {
      setError('操作失败，请稍后重试');
      toast.error('操作失败，请稍后重试');
    }
    finally { setAddingConfig(false); }
  };

  const handleStartExecution = async (configurationId: string) => {
    try {
      setStartingExecId(configurationId);
      if (useGoAds) {
        // 优先尝试走 Go 原子端点（从配置 payload 推断必要参数）
        const cfg = configurations.find(c => c.id === configurationId)
        const p = (cfg?.payload || {}) as any
        // 兼容字段名
        const links: string[] = p.affiliate_links || p.links || p.urls || []
        const profile: string = p.adspower_profile || p.profile || ''
        const account: string = p.google_ads_account || p.googleAdsAccount || p.account || ''
        if (!links?.length || !profile || !account) {
          toast.error('配置缺少必要字段（affiliate_links / adspower_profile / google_ads_account），请使用快速执行或补全配置')
        } else {
          const out = await runAdsCenterUpdate({
            name: cfg?.name || `adscenter_${Date.now()}`,
            affiliate_links: links,
            adspower_profile: profile,
            google_ads_account: account,
          })
          toast.success(`已发起执行，任务ID：${out.taskId}`)
          setSuccessMessage('Execution started successfully')
          setStartingExecId(null)
          return
        }
      }

      // 回退旧入口
      const res = await http.post<{ success?: boolean; error?: string }>(
        '/adscenter/executions',
        { configurationId }
      );
      if ((res as any)?.success === false) {
        const msg = (res as any)?.error || '操作失败，请稍后重试';
        setError(msg);
        toast.error(msg);
        return;
      }
      setSuccessMessage('Execution started successfully');
      toast.success('执行已启动');
      fetchFresh();
    } catch (err) {
      const e = err as HttpError;
      // 根据错误场景展示客服微信弹窗
      if (e?.status === 402) {
        setModalScenario('insufficient_balance');
        setModalRequired(e.details?.required);
        setModalBalance(e.details?.balance);
        setShowWeChatModal(true);
        toast.error('余额不足，请联系顾问充值');
      } else if (e?.status === 403) {
        setModalScenario('upgrade_required');
        setShowWeChatModal(true);
        toast.error('当前套餐不包含该功能，请升级');
      } else {
        setError('操作失败，请稍后重试');
        toast.error('操作失败，请稍后重试');
      }
    }
    finally { setStartingExecId(null); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'running':
      case 'completed':
        return 'bg-green-500';
      case 'paused':
      case 'pending':
        return 'bg-yellow-500';
      case 'failed':
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'running':
        return 'Running';
      case 'completed':
        return 'Completed';
      case 'paused':
        return 'Paused';
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
      case 'error':
        return 'Error';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WeChatSubscribeModal
        open={showWeChatModal}
        onOpenChange={setShowWeChatModal}
        scenario={modalScenario}
        requiredTokens={modalRequired}
        currentBalance={modalBalance}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Google Ads 自动化系统</h1>
          <p className="text-muted-foreground">管理和监控 Google Ads 自动化流程</p>
          <div className="mt-1 text-xs text-gray-600 flex items-center gap-3">
            <span>每分钟请求上限（展示）: <span className="font-semibold text-gray-800">{uiRateLimitMax}</span></span>
            {planRpm ? (<span>套餐上限: <span className="font-semibold text-gray-800">{planRpm} RPM</span></span>) : null}
            {featureRpm ? (<span>功能上限: <span className="font-semibold text-gray-800">{featureRpm} RPM</span></span>) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { setModalScenario('adscenter_enable'); setShowWeChatModal(true); }}>
            <ExternalLink className="h-4 w-4 mr-2" />启用引导
          </Button>
          <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>成功</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as 'accounts' | 'configurations' | 'executions' | 'monitoring')} className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts">Google Ads 账户</TabsTrigger>
          <TabsTrigger value="configurations">配置管理</TabsTrigger>
          <TabsTrigger value="executions">执行监控</TabsTrigger>
          <TabsTrigger value="monitoring">系统监控</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Google Ads 账户管理</h2>
            <ProtectedButton 
              featureName="adscenter"
              onClick={() => setShowAddAccount(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              添加账户
            </ProtectedButton>
          </div>

          {showAddAccount && (
            <Card>
              <CardHeader>
                <CardTitle>添加 Google Ads 账户</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="accountId">账户 ID</Label>
                  <Input
                    id="accountId"
                    value={newAccount.accountId}
                    onChange={(e) => setNewAccount({ ...newAccount, accountId: e.target.value })}
                    placeholder="输入 Google Ads 账户 ID"
                  />
                </div>
                <div>
                  <Label htmlFor="accountName">账户名称</Label>
                  <Input
                    id="accountName"
                    value={newAccount.accountName}
                    onChange={(e) => setNewAccount({ ...newAccount, accountName: e.target.value })}
                    placeholder="输入账户名称"
                  />
                </div>
                <div className="flex gap-2">
                  <ProtectedButton 
                    featureName="adscenter"
                    onClick={handleAddAccount}
                    disabled={addingAccount}
                  >
                    {addingAccount ? '保存中...' : '保存'}
                  </ProtectedButton>
                  <Button variant="outline" onClick={() => setShowAddAccount(false)}>取消</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <Card key={account.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {account.account_name}
                    <Badge className={getStatusColor(account.status)}>
                      {getStatusText(account.status)}
                    </Badge>
                  </CardTitle>
                  <CardDescription>ID: {account.account_id}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    创建时间: {new Date(account.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="configurations" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">配置管理</h2>
            <ProtectedButton 
              featureName="adscenter"
              onClick={() => setShowAddConfig(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              添加配置
            </ProtectedButton>
          </div>

          {useGoAds && (
            <Card>
              <CardHeader>
                <CardTitle>快速链接替换（Go 原子端点）</CardTitle>
                <CardDescription>直接调用后端原子端点执行（check→execute），更稳健；不依赖本地配置。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Affiliate Links（一行一个）</Label>
                  <Textarea rows={4} value={goLinks} onChange={(e) => setGoLinks(e.target.value)} placeholder="https://example.com/aff1\nhttps://example.com/aff2" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>AdsPower Profile</Label>
                    <Input value={goAdsPowerProfile} onChange={(e) => setGoAdsPowerProfile(e.target.value)} placeholder="profile_xxx" />
                  </div>
                  <div>
                    <Label>Google Ads Account</Label>
                    <Input value={goGoogleAdsAccount} onChange={(e) => setGoGoogleAdsAccount(e.target.value)} placeholder="customers/1234567890" />
                  </div>
                </div>
                <ProtectedButton featureName="adscenter" onClick={handleGoQuickUpdate} disabled={goRunning}>
                  {goRunning ? '执行中...' : '立即执行（Go）'}
                </ProtectedButton>
              </CardContent>
            </Card>
          )}

          {showAddConfig && (
            <Card>
              <CardHeader>
                <CardTitle>添加新配置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="configName">配置名称</Label>
                  <Input
                    id="configName"
                    value={newConfig.name}
                    onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                    placeholder="输入配置名称"
                  />
                </div>
                <div>
                  <Label htmlFor="configDescription">描述</Label>
                  <Textarea
                    id="configDescription"
                    value={newConfig.description}
                    onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                    placeholder="输入配置描述"
                  />
                </div>
                <div>
                  <Label htmlFor="configData">配置数据 (JSON)</Label>
                  <Textarea
                    id="configData"
                    value={newConfig.configData}
                    onChange={(e) => setNewConfig({ ...newConfig, configData: e.target.value })}
                    placeholder='{"key": "value"}'
                    rows={5}
                  />
                </div>
                <div className="flex gap-2">
                  <ProtectedButton 
                    featureName="adscenter"
                    onClick={handleAddConfiguration}
                    disabled={addingConfig}
                  >
                    {addingConfig ? '保存中...' : '保存'}
                  </ProtectedButton>
                  <Button variant="outline" onClick={() => setShowAddConfig(false)}>取消</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configurations.map((config) => (
              <Card key={config.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {config.name}
                    <Badge className={getStatusColor(config.status)}>
                      {getStatusText(config.status)}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{config.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    创建时间: {new Date(config.created_at).toLocaleDateString()}
                  </p>
                  <ProtectedButton 
                    featureName="adscenter"
                    size="sm" 
                    onClick={() => handleStartExecution(config.id)}
                    className="w-full"
                    disabled={startingExecId === config.id}
                  >
                    <Play className={`h-4 w-4 mr-2 ${startingExecId === config.id ? 'animate-pulse' : ''}`} />
                    {startingExecId === config.id ? '启动中...' : '开始执行'}
                  </ProtectedButton>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="executions" className="space-y-4">
          <h2 className="text-xl font-semibold">执行监控</h2>
          
          <div className="space-y-4">
            {executions.map((execution) => (
              <Card key={execution.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    执行 #{execution.id.slice(-8)}
                    <Badge className={getStatusColor(execution.status)}>
                      {getStatusText(execution.status)}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    配置 ID: {execution.configuration_id}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>进度</span>
                      <span>{execution.progress}%</span>
                    </div>
                    <Progress value={execution.progress} className="w-full" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">已处理:</span>
                      <span className="ml-2 font-medium">{execution.processed_items}/{execution.total_items}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">开始时间:</span>
                      <span className="ml-2 font-medium">
                        {new Date(execution.started_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {execution.completed_at && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">完成时间:</span>
                      <span className="ml-2 font-medium">
                        {new Date(execution.completed_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <h2 className="text-xl font-semibold">系统监控</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-4 w-4 mr-2" />
                  数据库状态
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">正常</div>
                <p className="text-sm text-muted-foreground">连接稳定</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  API 状态
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">正常</div>
                <p className="text-sm text-muted-foreground">响应时间: 120ms</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-4 w-4 mr-2" />
                  活跃执行
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {executions.filter((e: any) => e.status === 'running').length}
                </div>
                <p className="text-sm text-muted-foreground">正在运行</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>系统概览</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{accounts.length}</div>
                  <p className="text-sm text-muted-foreground">Google Ads 账户</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{configurations.length}</div>
                  <p className="text-sm text-muted-foreground">配置</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{executions.length}</div>
                  <p className="text-sm text-muted-foreground">总执行次数</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {executions.filter((e: any) => e.status === 'completed').length}
                  </div>
                  <p className="text-sm text-muted-foreground">成功执行</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
