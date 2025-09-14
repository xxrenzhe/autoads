'use client';

import React, { useState, useEffect } from 'react';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Pause, 
  Download, 
  Upload,
  Eye,
  Copy,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  LayoutDashboard
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { http } from '@/shared/http/client'
import { toast } from 'sonner'

interface Configuration {
  id: string;
  name: string;
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

export default function ConfigurationsPage() {
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConfig, setSelectedConfig] = useState<Configuration | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    environmentId: '',
    repeatCount: 1,
    notificationEmail: '',
    originalLinks: [''],
    googleAdsAccounts: [{ accountId: '', accountName: '' }],
    adMappingConfig: [] as Array<{
      originalUrl: string;
      adMappings: Array<{
        adId: string;
        executionNumber: number;
        campaignId?: string;
        adGroupId?: string;
      }>;
    }>
  });

  useEffect(() => {
    loadConfigurations();
  }, []);
  
  const loadConfigurations = async () => {
    try {
      setLoading(true);
      const res = await http.get<any>('/adscenter/configurations');
      const list: any[] = Array.isArray(res) ? res : (res as any)?.data || [];
      const normalized = list.map((c: any) => {
        const payload = c.payload || {};
        return {
          id: c.id,
          name: c.name,
          environmentId: payload.environmentId || '',
          repeatCount: payload.repeatCount || 1,
          notificationEmail: payload.notificationEmail || '',
          originalLinks: Array.isArray(payload.originalLinks) ? payload.originalLinks : [],
          googleAdsAccounts: Array.isArray(payload.googleAdsAccounts) ? payload.googleAdsAccounts : [],
          adMappingConfig: Array.isArray(payload.adMappingConfig) ? payload.adMappingConfig : [],
          status: c.status || 'active',
          createdAt: c.createdAt || new Date().toISOString(),
          updatedAt: c.updatedAt || c.createdAt || new Date().toISOString(),
          lastExecuted: payload.lastExecuted,
        } as Configuration;
      });
      setConfigurations(normalized);
    } catch (error) {
      console.error('加载配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConfiguration = async () => {
    try {
      const payload = {
        environmentId: formData.environmentId,
        repeatCount: formData.repeatCount,
        notificationEmail: formData.notificationEmail,
        originalLinks: formData.originalLinks.filter((link: any) => link.trim()),
        googleAdsAccounts: formData.googleAdsAccounts.filter((acc: any) => acc.accountId.trim()),
        adMappingConfig: formData.originalLinks.filter((link: any) => link.trim()).map((link: any) => ({ originalUrl: link, adMappings: [] }))
      };
      const result = await http.post<any>(
        '/adscenter/configurations',
        { name: formData.name, description: '', payload }
      );

      if ((result as any)?.success === false) {
        alert('创建配置失败: ' + ((result as any)?.error || '未知错误'));
      } else {
        setShowCreateDialog(false);
        resetForm();
        loadConfigurations();
      }
    } catch (error) {
      console.error('创建配置失败:', error);
      alert('创建配置失败');
    }
  };

  const handleUpdateConfiguration = async () => {
    if (!selectedConfig) return;

    try {
      const payload = {
        environmentId: formData.environmentId,
        repeatCount: formData.repeatCount,
        notificationEmail: formData.notificationEmail,
        originalLinks: formData.originalLinks.filter((link: any) => link.trim()),
        googleAdsAccounts: formData.googleAdsAccounts.filter((acc: any) => acc.accountId.trim()),
        adMappingConfig: formData.originalLinks.filter((link: any) => link.trim()).map((link: any) => ({ originalUrl: link, adMappings: [] }))
      };
      const result = await http.put<any>(
        `/adscenter/configurations/${selectedConfig.id}`,
        { name: formData.name, payload }
      );

      if ((result as any)?.success === false) {
        alert('更新配置失败: ' + ((result as any)?.error || '未知错误'));
      } else {
        setShowEditDialog(false);
        setSelectedConfig(null);
        resetForm();
        loadConfigurations();
      }
    } catch (error) {
      console.error('更新配置失败:', error);
      alert('更新配置失败');
    }
  };

  const handleDeleteConfiguration = async (id: string) => {
    if (!confirm('确定要删除这个配置吗？')) return;

    try {
      const result = await http.delete<any>(`/adscenter/configurations/${id}`);
      if ((result as any)?.success === false) {
        alert('删除配置失败: ' + ((result as any)?.error || '未知错误'));
      } else {
        loadConfigurations();
      }
    } catch (error) {
      console.error('删除配置失败:', error);
      alert('删除配置失败');
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const result = await http.put<any>(
        `/adscenter/configurations/${id}`,
        { status }
      );
      if ((result as any)?.success === false) {
        alert('更新状态失败: ' + ((result as any)?.error || '未知错误'));
      } else {
        loadConfigurations();
      }
    } catch (error) {
      console.error('更新状态失败:', error);
      alert('更新状态失败');
    }
  };

  const handleExecuteConfiguration = async (id: string) => {
    try {
      const result = await http.post<any>('/adscenter/executions', { configurationId: id });
      if ((result as any)?.success === false) {
        alert('启动执行失败: ' + ((result as any)?.error || '未知错误'));
      } else {
        alert('执行已启动');
      }
    } catch (error) {
      console.error('启动执行失败:', error);
      alert('启动执行失败');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      environmentId: '',
      repeatCount: 1,
      notificationEmail: '',
      originalLinks: [''],
      googleAdsAccounts: [{ accountId: '', accountName: '' }],
      adMappingConfig: []
    });
  };

  const openEditDialog = (config: Configuration) => {
    setSelectedConfig(config);
    setFormData({
      name: config.name,
      environmentId: config.environmentId,
      repeatCount: config.repeatCount,
      notificationEmail: config.notificationEmail || '',
      originalLinks: config.originalLinks.length > 0 ? config.originalLinks : [''],
      googleAdsAccounts: config.googleAdsAccounts.length > 0 ? config.googleAdsAccounts : [{ accountId: '', accountName: '' }],
      adMappingConfig: config.adMappingConfig || []
    });
    setShowEditDialog(true);
  };

  const openViewDialog = (config: Configuration) => {
    setSelectedConfig(config);
    setShowViewDialog(true);
  };

  const addOriginalLink = () => {
    setFormData(prev => ({
      ...prev,
      originalLinks: [...prev.originalLinks, ''],
    }));
  };

  const removeOriginalLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      originalLinks: prev.originalLinks.filter((_, i: any) => i !== index),
    }));
  };

  const updateOriginalLink = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      originalLinks: prev.originalLinks.map((link, i: any) => i === index ? value : link),
    }));
  };

  const addGoogleAdsAccount = () => {
    setFormData(prev => ({
      ...prev,
      googleAdsAccounts: [...prev.googleAdsAccounts, { accountId: '', accountName: '' }]
    }));
  };

  const removeGoogleAdsAccount = (index: number) => {
    setFormData(prev => ({
      ...prev,
      googleAdsAccounts: prev.googleAdsAccounts.filter((_, i: any) => i !== index)
    }));
  };

  const updateGoogleAdsAccount = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      googleAdsAccounts: prev.googleAdsAccounts.map((acc, i: any) => 
        i === index ? { ...acc, [field]: value } : acc
      )
    }));
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      paused: 'secondary',
      stopped: 'destructive'
    } as const;

    const labels = {
      active: '活跃',
      paused: '暂停',
      stopped: '停止'
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const ConfigurationForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="basic">基础配置</TabsTrigger>
        <TabsTrigger value="links">链接管理</TabsTrigger>
        <TabsTrigger value="ads">Google Ads</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">配置名称</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: (e.target as any).value }))}
              placeholder="输入配置名称"
            />
          </div>
          <div>
            <Label htmlFor="environmentId">AdsPower 环境ID</Label>
            <Input
              id="environmentId"
              value={formData.environmentId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData(prev => ({ ...prev, environmentId: e.target.value }))}
              placeholder="输入环境ID"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="repeatCount">执行次数</Label>
            <Input
              id="repeatCount"
              type="number"
              min="1"
              max="10"
              value={formData.repeatCount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData(prev => ({ ...prev, repeatCount: parseInt(e.target.value) || 1 }))}
            />
          </div>
          <div>
            <Label htmlFor="notificationEmail">通知邮箱</Label>
            <Input
              id="notificationEmail"
              type="email"
              value={formData.notificationEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData(prev => ({ ...prev, notificationEmail: e.target.value }))}
              placeholder="输入邮箱地址"
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="links" className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>广告联盟链接</Label>
            <Button type="button" variant="outline" size="sm" onClick={addOriginalLink}>
              <Plus className="h-4 w-4 mr-1" />
              添加链接
            </Button>
          </div>
          {formData.originalLinks.map((link, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={link}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateOriginalLink(index, e.target.value)
                }
                placeholder="输入广告联盟链接"
              />
              {formData.originalLinks.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeOriginalLink(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="ads" className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>Google Ads 账户</Label>
            <Button type="button" variant="outline" size="sm" onClick={addGoogleAdsAccount}>
              <Plus className="h-4 w-4 mr-1" />
              添加账户
            </Button>
          </div>
          {formData.googleAdsAccounts.map((account, index) => (
            <div key={index} className="grid grid-cols-2 gap-2">
              <Input
                value={account.accountId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateGoogleAdsAccount(index, 'accountId', e.target.value)
                }
                placeholder="账户ID"
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    value={account.accountName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateGoogleAdsAccount(index, 'accountName', e.target.value)
                    }
                    placeholder="账户名称"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    账号名称是您自定义的易于识别的名称，用于在多个账号间进行区分。例如："主账号"、"品牌推广账号"等。
                    <br />
                    <span className="text-blue-600 font-medium">提示：</span>
                    这与"Login Customer ID (MCC ID)"不同 - MCC ID是Google Ads系统中管理多个客户账户的管理员账户标识符，而账号名称是您在ChangeLink系统中给这个管理员账户起的名字。
                  </p>
                </div>
                {formData.googleAdsAccounts.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeGoogleAdsAccount(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>加载配置中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${UI_CONSTANTS.gradients.hero}`}>
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <LayoutDashboard className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">配置管理</h1>
                <p className="text-lg text-gray-600">管理 AdsPower 环境和广告联盟链接配置</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={loadConfigurations} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    新建配置
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>创建新配置</DialogTitle>
                    <DialogDescription>
                      配置 AdsPower 环境和广告联盟链接的自动化处理
                    </DialogDescription>
                  </DialogHeader>
                  <ConfigurationForm />
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      取消
                    </Button>
                    <Button onClick={handleCreateConfiguration}>
                      创建配置
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {configurations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Settings className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">暂无配置</h3>
              <p className="text-gray-600 mb-4">创建您的第一个配置来开始自动化流程</p>
              <div className="flex gap-2">
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  创建配置
                </Button>
                <Button 
                  onClick={() => window.location.href = '/adscenter/setup'} 
                  variant="outline"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  使用设置向导
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {configurations.map((config) => (
              <Card key={config.id} className={UI_CONSTANTS.cards.featured + " hover:shadow-xl transition-all duration-300"}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{config.name}</CardTitle>
                      <CardDescription>
                        环境ID: {config.environmentId}
                      </CardDescription>
                    </div>
                    {getStatusBadge(config.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">执行次数:</span>
                      <span>{config.repeatCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">链接数量:</span>
                      <span>{config.originalLinks.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Google Ads账户:</span>
                      <span>{config.googleAdsAccounts.length}</span>
                    </div>
                    {config.lastExecuted && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">最后执行:</span>
                        <span>{new Date(config.lastExecuted).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openViewDialog(config)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(config)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExecuteConfiguration(config.id)}
                      disabled={config.status !== 'active'}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    {config.status === 'active' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(config.id, 'paused')}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(config.id, 'active')}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteConfiguration(config.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </div>

      {/* 编辑对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑配置</DialogTitle>
            <DialogDescription>
              修改配置信息
            </DialogDescription>
          </DialogHeader>
          <ConfigurationForm isEdit={true} />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateConfiguration}>
              保存更改
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 查看对话框 */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>配置详情</DialogTitle>
          </DialogHeader>
          {selectedConfig && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>配置名称</Label>
                  <p className="text-sm text-gray-600">{selectedConfig.name}</p>
                </div>
                <div>
                  <Label>状态</Label>
                  <div className="mt-1">{getStatusBadge(selectedConfig.status)}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>环境ID</Label>
                  <p className="text-sm text-gray-600">{selectedConfig.environmentId}</p>
                </div>
                <div>
                  <Label>执行次数</Label>
                  <p className="text-sm text-gray-600">{selectedConfig.repeatCount}</p>
                </div>
              </div>

              <div>
                <Label>广告联盟链接</Label>
                <div className="mt-1 space-y-1">
                  {selectedConfig.originalLinks.map((link, index) => (
                    <p key={index} className="text-sm text-gray-600 break-all">{link}</p>
                  ))}
                </div>
              </div>

              <div>
                <Label>Google Ads 账户</Label>
                <div className="mt-1 space-y-1">
                  {selectedConfig.googleAdsAccounts.map((account, index) => (
                    <p key={index} className="text-sm text-gray-600">
                      {account.accountName} ({account.accountId})
                    </p>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>创建时间</Label>
                  <p className="text-sm text-gray-600">
                    {new Date(selectedConfig.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label>更新时间</Label>
                  <p className="text-sm text-gray-600">
                    {new Date(selectedConfig.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
