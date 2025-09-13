'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Globe, 
  Monitor, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Beaker,
  Trash2,
  Plus,
  Edit,
  Save
} from 'lucide-react';
import { globalAdsPowerService } from '../models/AdsPowerService';
import { globalLocalStorageService } from '@/lib/local-storage-service';

interface AdsPowerEnvironment {
  id: string;
  name: string;
  apiUrl: string;
  lastUsed?: Date;
  status: 'connected' | 'disconnected' | 'testing' | 'error';
  isActive?: boolean;
  proxyConfig?: {
    enabled: boolean;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  };
  browserSettings?: {
    headless: boolean;
    openTabs: number;
    timeout: number;
    autoRecover: boolean;
  };
}

interface AdsPowerConfig {
  defaultApiUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  environments: AdsPowerEnvironment[];
}

export default function AdsPowerConfiguration() {
  const [config, setConfig] = useState<AdsPowerConfig>({
    defaultApiUrl: 'http://local.adspower.net:50325',
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 2000,
    environments: []
  });
  const [_, setIsLoading] = useState(false);
  const [testingEnvironment, setTestingEnvironment] = useState<string | null>(null);
  const [editingEnvironment, setEditingEnvironment] = useState<string | null>(null);
  const [newEnvironment, setNewEnvironment] = useState<Partial<AdsPowerEnvironment>>({});

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      const savedConfig = globalLocalStorageService.get<AdsPowerConfig>('adspower-config');
      if (savedConfig) => {
        setConfig(savedConfig);
      }
      
      // 检查连接状态
      await checkEnvironmentStatus();
    } catch (error) {
      // console.error('加载AdsPower配置失败:', error);
    }
  };

  const saveConfiguration = async () => {
    try {
      await globalLocalStorageService.set('adspower-config', config);
      
      // 更新全局服务配置
      globalAdsPowerService['config'] = {
        apiUrl: config.defaultApiUrl,
        timeout: config.timeout,
        maxRetries: config.maxRetries,
        retryDelay: config.retryDelay
      };
      
      return true;
    } catch (error) {
      // console.error('保存AdsPower配置失败:', error);
      return false;
    }
  };

  const checkEnvironmentStatus = async () => {
    try {
      const environments = await globalAdsPowerService.getEnvironmentList();
      
      setConfig(prev => ({
        ...prev,
        environments: prev.environments?.filter(Boolean)?.map((env: any) => ({
          ...env,
          status: environments.some(e => e.id === env.id) ? 'connected' : 'disconnected'
        }))
      }));
    } catch (error) {
      // console.error('检查环境状态失败:', error);
    }
  };

  const testEnvironmentConnection = async (environmentId: string) => {
    setTestingEnvironment(environmentId);
    
    try {
      const validation = await globalAdsPowerService.validateEnvironment(environmentId);
      
      setConfig(prev => ({
        ...prev,
        environments: prev.environments?.filter(Boolean)?.map((env: any) => 
          env.id === environmentId 
            ? { 
                ...env, 
                status: validation.valid ? 'connected' : 'error',
                lastUsed: new Date()
              }
            : env
        )
      }));
      
      return validation.valid;
    } catch (error) {
      setConfig(prev => ({
        ...prev,
        environments: prev.environments?.filter(Boolean)?.map((env: any) => 
          env.id === environmentId 
            ? { ...env, status: 'error' }
            : env
        )
      }));
      
      return false;
    } finally {
      setTestingEnvironment(null);
    }
  };

  const addEnvironment = async () => {
    if (!newEnvironment.name || !newEnvironment.id) return;

    const environment: AdsPowerEnvironment = {
      id: newEnvironment.id,
      name: newEnvironment.name,
      apiUrl: newEnvironment.apiUrl || config.defaultApiUrl,
      status: 'disconnected',
      proxyConfig: newEnvironment.proxyConfig,
      browserSettings: newEnvironment.browserSettings
    };

    setConfig(prev => ({
      ...prev,
      environments: [...prev.environments, environment]
    }));

    setNewEnvironment({});
    await saveConfiguration();
  };

  const updateEnvironment = async (environmentId: string, updates: Partial<AdsPowerEnvironment>) => {
    setConfig(prev => ({
      ...prev,
      environments: prev.environments?.filter(Boolean)?.map((env: any) => 
        env.id === environmentId ? { ...env, ...updates } : env
      )
    }));

    await saveConfiguration();
  };

  const deleteEnvironment = async (environmentId: string) => {
    setConfig(prev => ({
      ...prev,
      environments: prev.environments.filter((env: any) => env.id !== environmentId)
    }));

    await saveConfiguration();
  };

  const toggleEnvironmentActive = async (environmentId: string) => {
    const environment = config.environments.find((env: any) => env.id === environmentId);
    if (!environment) return;

    await updateEnvironment(environmentId, { isActive: !environment.isActive });
  };

  const getStatusIcon = (status: string) => {
    switch (status) => {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'testing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) => {
      case 'connected':
        return '已连接';
      case 'testing':
        return '测试中';
      case 'error':
        return '连接失败';
      default:
        return '未连接';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) => {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'testing':
        return 'bg-blue-100 text-blue-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* 全局设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>AdsPower 全局设置</span>
          </CardTitle>
          <CardDescription>
            配置AdsPower API连接和全局参数
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">默认API地址</Label>
              <Input
                id="apiUrl"
                value={config.defaultApiUrl}
                onChange={((e: any) => setConfig(prev: any) => ({ ...prev, defaultApiUrl: e.target.value }))}
                placeholder="http://local.adspower.net:50325"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timeout">超时时间 (毫秒)</Label>
              <Input
                id="timeout"
                type="number"
                value={config.timeout}
                onChange={((e: any) => setConfig(prev: any) => ({ ...prev, timeout: parseInt(e.target.value) }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxRetries">最大重试次数</Label>
              <Input
                id="maxRetries"
                type="number"
                value={config.maxRetries}
                onChange={((e: any) => setConfig(prev: any) => ({ ...prev, maxRetries: parseInt(e.target.value) }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="retryDelay">重试延迟 (毫秒)</Label>
              <Input
                id="retryDelay"
                type="number"
                value={config.retryDelay}
                onChange={((e: any) => setConfig(prev: any) => ({ ...prev, retryDelay: parseInt(e.target.value) }))}
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button onClick={saveConfiguration}>
              <Save className="h-4 w-4 mr-2" />
              保存设置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 环境管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Globe className="h-5 w-5" />
              <span>浏览器环境管理</span>
            </div>
            <Button onClick={checkEnvironmentStatus} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新状态
            </Button>
          </CardTitle>
          <CardDescription>
            管理AdsPower浏览器环境配置
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 添加新环境 */}
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-medium mb-4">添加新环境</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>环境ID</Label>
                <Input
                  value={newEnvironment.id || ''}
                  onChange={((e: any) => setNewEnvironment(prev: any) => ({ ...prev, id: e.target.value }))}
                  placeholder="输入环境ID"
                />
              </div>
              
              <div className="space-y-2">
                <Label>环境名称</Label>
                <Input
                  value={newEnvironment.name || ''}
                  onChange={((e: any) => setNewEnvironment(prev: any) => ({ ...prev, name: e.target.value }))}
                  placeholder="输入环境名称"
                />
              </div>
              
              <div className="space-y-2">
                <Label>API地址 (可选)</Label>
                <Input
                  value={newEnvironment.apiUrl || ''}
                  onChange={((e: any) => setNewEnvironment(prev: any) => ({ ...prev, apiUrl: e.target.value }))}
                  placeholder="使用默认地址"
                />
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <Button onClick={addEnvironment}>
                <Plus className="h-4 w-4 mr-2" />
                添加环境
              </Button>
            </div>
          </div>

          {/* 环境列表 */}
          <div className="space-y-4">
            {config.environments.map((environment: any) => (
              <div key={environment.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(environment.status)}
                    <div>
                      <h3 className="font-medium">{environment.name}</h3>
                      <p className="text-sm text-gray-500">ID: {environment.id}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(environment.status)}>
                      {getStatusText(environment.status)}
                    </Badge>
                    
                    <Switch
                      checked={environment.isActive}
                      onCheckedChange={() => toggleEnvironmentActive(environment.id)}
                    />
                    
                    {testingEnvironment === environment.id ? (
                      <Button size="sm" disabled>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => testEnvironmentConnection(environment.id)}
                      >
                        <Beaker className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setEditingEnvironment(
                        editingEnvironment === environment.id ? null : environment.id
                      )}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => deleteEnvironment(environment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* 详细信息 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-gray-600">API地址:</Label>
                    <p>{environment.apiUrl}</p>
                  </div>
                  
                  <div>
                    <Label className="text-gray-600">最后使用:</Label>
                    <p>{environment.lastUsed ? environment.lastUsed.toLocaleString() : '从未使用'}</p>
                  </div>
                </div>

                {/* 高级设置 */}
                {editingEnvironment === environment.id && (
                  <div className="mt-4 pt-4 border-t">
                    <Tabs defaultValue="browser" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="browser">浏览器设置</TabsTrigger>
                        <TabsTrigger value="proxy">代理设置</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="browser" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>无头模式</Label>
                            <Switch
                              checked={environment.browserSettings?.headless || false}
                              onCheckedChange={((checked: boolean: any): any) => 
                                updateEnvironment(environment.id, {
                                  browserSettings: { 
                                    headless: checked,
                                    openTabs: environment.browserSettings?.openTabs || 1,
                                    timeout: environment.browserSettings?.timeout || 30000,
                                    autoRecover: environment.browserSettings?.autoRecover || false
                                  }
                                })
                              }
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>打开标签数</Label>
                            <Input
                              type="number"
                              value={environment.browserSettings?.openTabs || 1}
                              onChange={(e) => 
                                updateEnvironment(environment.id, {
                                  browserSettings: { 
                                    headless: environment.browserSettings?.headless || false,
                                    openTabs: parseInt(e.target.value),
                                    timeout: environment.browserSettings?.timeout || 30000,
                                    autoRecover: environment.browserSettings?.autoRecover || false
                                  }
                                })
                              }
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>超时时间 (秒)</Label>
                            <Input
                              type="number"
                              value={(environment.browserSettings?.timeout || 30) / 1000}
                              onChange={(e) => 
                                updateEnvironment(environment.id, {
                                  browserSettings: { 
                                    headless: environment.browserSettings?.headless || false,
                                    openTabs: environment.browserSettings?.openTabs || 1,
                                    timeout: parseInt(e.target.value) * 1000,
                                    autoRecover: environment.browserSettings?.autoRecover || false
                                  }
                                })
                              }
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>自动恢复</Label>
                            <Switch
                              checked={environment.browserSettings?.autoRecover || false}
                              onCheckedChange={((checked: boolean: any): any) => 
                                updateEnvironment(environment.id, {
                                  browserSettings: { 
                                    headless: environment.browserSettings?.headless || false,
                                    openTabs: environment.browserSettings?.openTabs || 1,
                                    timeout: environment.browserSettings?.timeout || 30000,
                                    autoRecover: checked
                                  }
                                })
                              }
                            />
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="proxy" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>启用代理</Label>
                            <Switch
                              checked={environment.proxyConfig?.enabled || false}
                              onCheckedChange={((checked: boolean: any): any) => 
                                updateEnvironment(environment.id, {
                                  proxyConfig: { 
                                    enabled: checked,
                                    host: environment.proxyConfig?.host || '',
                                    port: environment.proxyConfig?.port || 8080,
                                    username: environment.proxyConfig?.username || '',
                                    password: environment.proxyConfig?.password || ''
                                  }
                                })
                              }
                            />
                          </div>
                          
                          {environment.proxyConfig?.enabled && (
                            <>
                              <div className="space-y-2">
                                <Label>代理主机</Label>
                                <Input
                                  value={environment.proxyConfig?.host || ''}
                                  onChange={(e) => 
                                    updateEnvironment(environment.id, {
                                      proxyConfig: { 
                                        enabled: environment.proxyConfig?.enabled || false,
                                        host: e.target.value,
                                        port: environment.proxyConfig?.port || 8080,
                                        username: environment.proxyConfig?.username || '',
                                        password: environment.proxyConfig?.password || ''
                                      }
                                    })
                                  }
                                  placeholder="proxy.example.com"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label>代理端口</Label>
                                <Input
                                  type="number"
                                  value={environment.proxyConfig?.port || ''}
                                  onChange={(e) => 
                                    updateEnvironment(environment.id, {
                                      proxyConfig: { 
                                        enabled: environment.proxyConfig?.enabled || false,
                                        host: environment.proxyConfig?.host || '',
                                        port: parseInt(e.target.value),
                                        username: environment.proxyConfig?.username || '',
                                        password: environment.proxyConfig?.password || ''
                                      }
                                    })
                                  }
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label>用户名</Label>
                                <Input
                                  value={environment.proxyConfig?.username || ''}
                                  onChange={(e) => 
                                    updateEnvironment(environment.id, {
                                      proxyConfig: { 
                                        enabled: environment.proxyConfig?.enabled || false,
                                        host: environment.proxyConfig?.host || '',
                                        port: environment.proxyConfig?.port || 8080,
                                        username: e.target.value,
                                        password: environment.proxyConfig?.password || ''
                                      }
                                    })
                                  }
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label>密码</Label>
                                <Input
                                  type="password"
                                  value={environment.proxyConfig?.password || ''}
                                  onChange={(e) => 
                                    updateEnvironment(environment.id, {
                                      proxyConfig: { 
                                        enabled: environment.proxyConfig?.enabled || false,
                                        host: environment.proxyConfig?.host || '',
                                        port: environment.proxyConfig?.port || 8080,
                                        username: environment.proxyConfig?.username || '',
                                        password: e.target.value
                                      }
                                    })
                                  }
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </div>
            ))}
            
            {config.environments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Monitor className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>暂无配置的浏览器环境</p>
                <p className="text-sm">点击上方"添加新环境"开始配置</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}