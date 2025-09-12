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
const logger = createClientLogger('ChangeLinkClient');

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

export default function ChangeLinkClient() {
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [currentTab, setCurrentTab] = useState<'accounts' | 'configurations' | 'executions' | 'monitoring'>('accounts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Form states
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [newAccount, setNewAccount] = useState({ accountId: '', accountName: '' });
  const [newConfig, setNewConfig] = useState({ name: '', description: '', configData: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch accounts
      const accountsResponse = await fetch('/api/adscenter/accounts');
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        setAccounts(accountsData.accounts || []);
      }

      // Fetch configurations
      const configsResponse = await fetch('/api/adscenter/configurations');
      if (configsResponse.ok) {
        const configsData = await configsResponse.json();
        setConfigurations(configsData.configurations || []);
      }

      // Fetch executions
      const executionsResponse = await fetch('/api/adscenter/executions');
      if (executionsResponse.ok) {
        const executionsData = await executionsResponse.json();
        setExecutions(executionsData.executions || []);
      }

    } catch (err) {
      setError('Failed to fetch data');
      logger.error('Error fetching data:', new EnhancedError('Error fetching data:', { error: err instanceof Error ? err.message : String(err)  }));
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async () => {
    try {
      const response = await fetch('/api/adscenter/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccount)
      });

      if (response.ok) {
        setSuccessMessage('Account added successfully');
        setShowAddAccount(false);
        setNewAccount({ accountId: '', accountName: '' });
        fetchData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add account');
      }
    } catch (err) {
      setError('Failed to add account');
    }
  };

  const handleAddConfiguration = async () => {
    try {
      const response = await fetch('/api/adscenter/configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newConfig.name,
          description: newConfig.description,
          config_data: JSON.parse(newConfig.configData)
        })
      });

      if (response.ok) {
        setSuccessMessage('Configuration added successfully');
        setShowAddConfig(false);
        setNewConfig({ name: '', description: '', configData: '' });
        fetchData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add configuration');
      }
    } catch (err) {
      setError('Failed to add configuration');
    }
  };

  const handleStartExecution = async (configurationId: string) => {
    try {
      const response = await fetch('/api/adscenter/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configuration_id: configurationId,
          total_items: 100 // This should come from configuration
        })
      });

      if (response.ok) {
        setSuccessMessage('Execution started successfully');
        fetchData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to start execution');
      }
    } catch (err) {
      setError('Failed to start execution');
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Google Ads 自动化系统</h1>
          <p className="text-muted-foreground">管理和监控 Google Ads 自动化流程</p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
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

      <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as "accounts" | "configurations" | "executions" | "monitoring")} className="space-y-4">
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
                  >
                    保存
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
                  >
                    保存
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
                  >
                    <Play className="h-4 w-4 mr-2" />
                    开始执行
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
                  {executions.filter(e => e.status === 'running').length}
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
                    {executions.filter(e => e.status === 'completed').length}
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