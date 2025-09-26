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
  // Batchopen stats (monitoring)
  const [boStats, setBoStats] = useState<any>(null);
  const fetchBoStats = async () => {
    try {
      const res = await fetch('/api/batchopen/stats', { cache: 'no-store' })
      if (res.ok) setBoStats(await res.json());
    } catch {}
  }
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

  // --- Diagnostics (plan/execute) ---
  const [diagMetrics, setDiagMetrics] = useState<any>({ impressions: 0, ctr: 0, qualityScore: 0, dailyBudget: 0, budgetPacing: 0 });
  const [diagLoading, setDiagLoading] = useState<boolean>(false);
  const [diagResult, setDiagResult] = useState<any>(null);
  const [planResult, setPlanResult] = useState<any>(null);
  const [validateResult, setValidateResult] = useState<any>(null);
  const [planText, setPlanText] = useState<string>("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  // --- Preflight (OAS) ---
  const [preflightLanding, setPreflightLanding] = useState<string>("");
  const [preflightRes, setPreflightRes] = useState<any>(null);
  const summarizePreflight = (res: any) => {
    const checks = Array.isArray(res?.checks) ? res.checks : []
    const counts = checks.reduce((acc: any, c: any) => {
      const s = (c?.severity || '').toLowerCase()
      acc[s] = (acc[s] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    return counts
  }
  const sevClass = (sev: string) => {
    switch ((sev||'').toLowerCase()) {
      case 'ok': return 'text-green-600'
      case 'info': return 'text-blue-600'
      case 'warn': return 'text-yellow-600'
      case 'error': return 'text-red-600'
      case 'skip': return 'text-gray-500'
      default: return 'text-gray-600'
    }
  }
  const runPreflight = async () => {
    try {
      setDiagLoading(true);
      const accId = selectedAccount || accounts?.[0]?.id || ''
      const body: any = { accountId: accId, validateOnly: true }
      if (preflightLanding && preflightLanding.trim()) body.landingUrl = preflightLanding.trim()
      const res = await fetch('/api/adscenter/preflight', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      setPreflightRes(data)
      if (res.ok) toast.success('Pre-flight 检查完成')
      else toast.error('Pre-flight 检查失败')
    } catch { toast.error('Pre-flight 请求失败') } finally { setDiagLoading(false) }
  }
  // --- Keyword expand (OAS) ---
  const [kwDomain, setKwDomain] = useState<string>("");
  const [kwSeed, setKwSeed] = useState<string>("");
  const [kwItems, setKwItems] = useState<any[]>([]);
  const runKeywordExpand = async () => {
    try {
      setDiagLoading(true);
      const body: any = { seedDomain: kwDomain.trim(), seedKeywords: kwSeed.trim() ? [kwSeed.trim()] : [], validateOnly: true }
      const res = await fetch('/api/adscenter/keywords/expand', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const data = await res.json()
      setKwItems(Array.isArray(data.items) ? data.items : [])
      if (res.ok) toast.success('关键词扩展完成')
      else toast.error('关键词扩展失败')
    } catch { toast.error('关键词扩展请求失败') } finally { setDiagLoading(false) }
  }
  const onDiagChange = (k: string, v: string) => {
    const num = Number(v);
    setDiagMetrics((m: any) => ({ ...m, [k]: isNaN(num) ? v : num }));
  };
  const autoFill = async () => {
    try {
      setDiagLoading(true);
      const accId = selectedAccount || accounts?.[0]?.id || ''
      const res = await http.get<any>(`/adscenter/diagnose/metrics`, { accountId: accId })
      setDiagMetrics((m: any) => ({ ...m, ...res }))
      toast.success('已自动填充诊断指标（预设/Stub）')
    } catch { toast.error('自动填充失败') } finally { setDiagLoading(false) }
  }
  const doDiagnose = async () => {
    try {
      setDiagLoading(true);
      const out = await http.post<any>('/adscenter/diagnose', { metrics: diagMetrics });
      setDiagResult(out);
      toast.success('诊断完成');
    } catch (e) {
      toast.error('诊断失败');
    } finally { setDiagLoading(false); }
  };
  const doPlan = async () => {
    try {
      setDiagLoading(true);
      const out = await http.post<any>('/adscenter/diagnose/plan', { metrics: diagMetrics });
      setPlanResult(out);
      try { setPlanText(JSON.stringify(out?.plan ?? {}, null, 2)); } catch { setPlanText(''); }
      toast.success('已生成计划（校验模式）');
    } catch (e) {
      toast.error('生成计划失败');
    } finally { setDiagLoading(false); }
  };
  const doValidate = async () => {
    try {
      setDiagLoading(true);
      // 如果没有现成计划，先生成
      let plan = planResult?.plan;
      if (!plan) {
        const out = await http.post<any>('/adscenter/diagnose/plan', { metrics: diagMetrics });
        setPlanResult(out);
        plan = out?.plan;
      }
      // 优先使用编辑器中的计划
      if (planText && planText.trim()) {
        try { plan = JSON.parse(planText) } catch { toast.error('计划 JSON 无法解析'); return; }
      }
      if (!plan) { toast.error('无可用计划'); return }
      const res = await http.post<any>('/adscenter/bulk-actions/validate', plan);
      setValidateResult(res);
      if (res?.ok) toast.success('校验通过'); else toast.error('校验存在问题');
    } catch (e) {
      toast.error('计划校验失败');
    } finally { setDiagLoading(false); }
  };
  const doExecute = async () => {
    try {
      setDiagLoading(true);
      // 强制先校验，若存在错误则阻止执行
      if (!validateResult) {
        await doValidate();
      }
      if (validateResult && validateResult.ok === false) {
        toast.error('计划存在错误，请修复后再执行');
        return;
      }
      // 若用户修改了计划，直接入队；否则走 diagnose/execute（自动生成）
      if (planText && planText.trim()) {
        let plan: any = null;
        try { plan = JSON.parse(planText) } catch { toast.error('计划 JSON 无法解析'); return; }
        const out = await http.post<any>('/adscenter/bulk-actions', plan);
        toast.success(`计划已入队：${out?.operationId || ''}`);
      } else {
        const out = await http.post<any>('/adscenter/diagnose/execute', { metrics: diagMetrics });
        toast.success(`计划已入队：${out?.operationId || ''}`);
      }
    } catch (e) {
      toast.error('入队执行失败');
    } finally { setDiagLoading(false); }
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
          <Card>
            <CardHeader>
              <CardTitle>Pre-flight 检查（OAS 对齐）</CardTitle>
              <CardDescription>校验环境/授权/结构/预算/落地可达性等</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="min-w-28">Landing URL（可选）</Label>
                <Input value={preflightLanding} onChange={(e)=>setPreflightLanding(e.target.value)} placeholder="https://example.com" />
                <Button variant="secondary" onClick={runPreflight} disabled={diagLoading}>Pre-flight</Button>
              </div>
              {preflightRes && (
                <div className="text-sm">
                  <div className="mb-2 flex items-center gap-4">
                    <div>结果：<span className="font-medium">{preflightRes.summary}</span>（checks: {Array.isArray(preflightRes.checks) ? preflightRes.checks.length : 0}）</div>
                    {(() => { const c = summarizePreflight(preflightRes); return (
                      <div className="flex items-center gap-3">
                        <span className="text-green-600">ok:{c.ok||0}</span>
                        <span className="text-yellow-600">warn:{c.warn||0}</span>
                        <span className="text-red-600">error:{c.error||0}</span>
                        <span className="text-gray-500">skip:{c.skip||0}</span>
                      </div>
                    )})()}
                  </div>
                  <div className="max-h-64 overflow-auto border rounded">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr><th className="px-2 py-1 text-left">code</th><th className="px-2 py-1 text-left">severity</th><th className="px-2 py-1 text-left">message</th></tr>
                      </thead>
                      <tbody>
                        {(preflightRes.checks||[]).map((c:any, i:number)=> (
                          <tr key={i} className="border-t">
                            <td className="px-2 py-1 font-mono">{c.code}</td>
                            <td className={`px-2 py-1 ${sevClass(c.severity)}`}>{c.severity}</td>
                            <td className="px-2 py-1">{c.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>关键词扩展（最小实现）</CardTitle>
              <CardDescription>基于种子域与关键词生成候选；过滤搜索量>1000且竞争度非HIGH</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="min-w-24">种子域</Label>
                <Input className="w-64" value={kwDomain} onChange={(e)=>setKwDomain(e.target.value)} placeholder="example.com" />
                <Label className="min-w-24">种子词（可选）</Label>
                <Input className="w-48" value={kwSeed} onChange={(e)=>setKwSeed(e.target.value)} placeholder="shoe" />
                <Button variant="secondary" onClick={runKeywordExpand} disabled={diagLoading}>Expand</Button>
              </div>
              {kwItems?.length>0 && (
                <div className="max-h-64 overflow-auto border rounded">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr><th className="px-2 py-1 text-left">keyword</th><th className="px-2 py-1 text-left">avgMonthlySearches</th><th className="px-2 py-1 text-left">competition</th></tr>
                    </thead>
                    <tbody>
                      {kwItems.slice(0,20).map((k:any,i:number)=> (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1">{k.keyword}</td>
                          <td className="px-2 py-1">{k.avgMonthlySearches}</td>
                          <td className="px-2 py-1">{k.competition}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Batchopen 执行指标（最小）</span>
                <Button variant="outline" size="sm" onClick={fetchBoStats}>刷新</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {boStats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-bold text-purple-600">{boStats.inflight ?? 0}</div>
                    <div className="text-xs text-muted-foreground">当前并发</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{boStats.cacheHits ?? 0}</div>
                    <div className="text-xs text-muted-foreground">缓存命中</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">{boStats.cacheMiss ?? 0}</div>
                    <div className="text-xs text-muted-foreground">缓存未命中</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{boStats.cacheHitRate ?? (() => { const h=boStats.cacheHits||0,m=boStats.cacheMiss||0; const t=h+m; return t>0 ? Math.round((h*100)/t) : 0 })()}%</div>
                    <div className="text-xs text-muted-foreground">命中率</div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">点击刷新获取最新指标</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>诊断与一键执行</CardTitle>
              <CardDescription>输入核心指标，生成优化建议或直接生成/执行批量操作计划（预览）。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="md:col-span-1 col-span-2">
                  <Label htmlFor="account">账户</Label>
                  <select id="account" className="w-full border rounded px-2 py-1 text-sm" value={selectedAccount} onChange={(e)=>setSelectedAccount(e.target.value)}>
                    <option value="">默认</option>
                    {accounts.map((a) => (<option key={a.id} value={a.id}>{a.account_name || a.id}</option>))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="impr">近7天曝光</Label>
                  <Input id="impr" type="number" value={diagMetrics.impressions}
                    onChange={(e)=>onDiagChange('impressions', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="ctr">CTR(%)</Label>
                  <Input id="ctr" type="number" step="0.1" value={diagMetrics.ctr}
                    onChange={(e)=>onDiagChange('ctr', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="qs">质量得分</Label>
                  <Input id="qs" type="number" step="1" value={diagMetrics.qualityScore}
                    onChange={(e)=>onDiagChange('qualityScore', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="budget">日预算</Label>
                  <Input id="budget" type="number" step="1" value={diagMetrics.dailyBudget}
                    onChange={(e)=>onDiagChange('dailyBudget', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pacing">预算进度(0..1)</Label>
                  <Input id="pacing" type="number" step="0.1" value={diagMetrics.budgetPacing}
                    onChange={(e)=>onDiagChange('budgetPacing', e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={autoFill} disabled={diagLoading}>自动填充</Button>
                <Button variant="secondary" onClick={doDiagnose} disabled={diagLoading}>诊断</Button>
                <Button variant="outline" onClick={doPlan} disabled={diagLoading}>生成计划(校验)</Button>
                <Button variant="outline" onClick={doValidate} disabled={diagLoading}>校验计划</Button>
                <ProtectedButton featureName="adscenter" onClick={doExecute} disabled={diagLoading || (validateResult && validateResult.ok === false)}>一键执行</ProtectedButton>
              </div>
              {diagResult && (
                <div className="text-xs bg-muted p-2 rounded">
                  <div className="font-semibold mb-1">诊断结果</div>
                  {/* 结构化展示规则与建议 */}
                  <div className="space-y-1">
                    {(Array.isArray(diagResult?.rules) ? diagResult.rules : []).map((r: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <span className={`px-1 rounded ${r.severity==='error' ? 'bg-red-600 text-white' : r.severity==='warn' ? 'bg-yellow-600 text-white' : 'bg-gray-500 text-white'}`}>{r.severity || 'info'}</span>
                        <span className="font-mono">{r.code}</span>
                        <span className="text-muted-foreground">{r.message}</span>
                      </div>
                    ))}
                    {(Array.isArray(diagResult?.suggestedActions) ? diagResult.suggestedActions : []).length > 0 && (
                      <div className="mt-2">
                        <div className="font-semibold">建议动作</div>
                        <ul className="list-disc pl-5">
                          {diagResult.suggestedActions.map((a: any, i: number) => (
                            <li key={i}><span className="font-mono">{a.action}</span> — {a.reason || ''}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {planResult && (
                <div className="text-xs bg-muted p-2 rounded">
                  <div className="font-semibold mb-1">计划(校验)</div>
                  <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(planResult, null, 2)}</pre>
                  <div className="mt-2">
                    <Label htmlFor="planEditor">编辑计划 JSON（支持 ADJUST_BUDGET / ADJUST_CPC）</Label>
                    <Textarea id="planEditor" rows={8} value={planText} onChange={(e)=>setPlanText(e.target.value)} />
                  </div>
                </div>
              )}
              {validateResult && (
                <div className="text-xs bg-muted p-2 rounded">
                  <div className="font-semibold mb-1">校验结果 {validateResult.ok ? '(通过)' : '(存在问题)'} </div>
                  {/* 高亮 violations */}
                  {(Array.isArray(validateResult?.violations) ? validateResult.violations : []).map((v: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <span className={`px-1 rounded ${v.severity==='error' ? 'bg-red-600 text-white' : v.severity==='warn' ? 'bg-yellow-600 text-white' : 'bg-gray-500 text-white'}`}>{v.severity || 'info'}</span>
                      <span className="font-mono">{v.code}</span>
                      <span className="text-muted-foreground">{v.message}</span>
                      {v.field && <span className="font-mono text-gray-400">({v.field})</span>}
                    </div>
                  ))}
                  <pre className="overflow-auto whitespace-pre-wrap mt-2">{JSON.stringify(validateResult, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
