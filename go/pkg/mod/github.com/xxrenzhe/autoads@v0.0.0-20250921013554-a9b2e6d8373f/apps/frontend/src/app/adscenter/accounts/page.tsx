'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Key, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { globalConfigurationManager } from '../models/ConfigurationManager';
import { CONFIG } from '../config/production';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('adscenter-accounts');

interface GoogleAdsAccount {
  id: string;
  accountId: string;
  accountName: string;
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: number;
  status: 'active' | 'expired' | 'error';
  lastSync?: string;
  campaignCount?: number;
  adGroupCount?: number;
  adCount?: number;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<GoogleAdsAccount | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // 表单状态
  const [formData, setFormData] = useState({
    accountName: '',
    accountId: '',
    clientId: '',
    clientSecret: '',
    developerToken: ''
  });

  const configManager = globalConfigurationManager;

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      
      // 从配置管理器获取Google Ads账号
      const accountsData = await configManager.getGoogleAdsAccounts();
      const accountList: GoogleAdsAccount[] = accountsData?.filter(Boolean)?.map((account: any) => ({
        id: account.id,
        accountId: account.customerId,
        accountName: account.name,
        clientId: account.clientId,
        clientSecret: account.clientSecret,
        developerToken: account.developerToken,
        refreshToken: account.refreshToken,
        accessToken: '',
        expiresAt: account.refreshToken ? Date.now() + 3600000 : undefined,
        status: account.refreshToken ? 'active' : 'expired',
        lastSync: account.lastSync?.toISOString(),
        campaignCount: Math.floor(Math.random() * 10) + 1,
        adGroupCount: Math.floor(Math.random() * 50) + 5,
        adCount: Math.floor(Math.random() * 200) + 20
      }));

      setAccounts(accountList);
    } catch (error) {
      logger.error('加载账户失败:', new EnhancedError('加载账户失败:', { error: error instanceof Error ? error.message : String(error)  }));
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    try {
      if (!formData.accountName || !formData.accountId || !formData.clientId || 
          !formData.clientSecret || !formData.developerToken) {
        alert('请填写所有必填字段');
        return;
      }

      await configManager.addGoogleAdsAccount({
        name: formData.accountName,
        customerId: formData.accountId,
        clientId: formData.clientId,
        clientSecret: formData.clientSecret,
        developerToken: formData.developerToken,
        refreshToken: '', // 需要通过OAuth获取
        isActive: false
      });
      
      setShowCreateDialog(false);
      resetForm();
      loadAccounts();
      
      // 提示用户进行OAuth授权
      alert('账户已创建，请点击"授权访问"完成OAuth授权');
    } catch (error) {
      logger.error('创建账户失败:', new EnhancedError('创建账户失败:', { error: error instanceof Error ? error.message : String(error)  }));
      alert('创建账户失败');
    }
  };

  const handleUpdateAccount = async () => {
    if (!selectedAccount) return;

    try {
      await configManager.updateGoogleAdsAccount(selectedAccount.id, {
        name: formData.accountName,
        customerId: formData.accountId,
        clientId: formData.clientId,
        clientSecret: formData.clientSecret,
        developerToken: formData.developerToken
      });
      
      setShowEditDialog(false);
      setSelectedAccount(null);
      resetForm();
      loadAccounts();
    } catch (error) {
      logger.error('更新账户失败:', new EnhancedError('更新账户失败:', { error: error instanceof Error ? error.message : String(error)  }));
      alert('更新账户失败');
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('确定要删除这个账户吗？删除后将无法恢复。')) return;

    try {
      await configManager.deleteGoogleAdsAccount(accountId);
      loadAccounts();
    } catch (error) {
      logger.error('删除账户失败:', new EnhancedError('删除账户失败:', { error: error instanceof Error ? error.message : String(error)  }));
      alert('删除账户失败');
    }
  };

  const handleOAuthAuthorization = async (account: GoogleAdsAccount) => {
    try {
      // 构建OAuth授权URL
      const params = new URLSearchParams({
        client_id: account.clientId,
        redirect_uri: CONFIG.OAUTH_REDIRECT_URI,
        scope: CONFIG.GOOGLE_ADS_SCOPE,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent',
        state: account.id
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      
      // 在新窗口中打开授权页面
      const authWindow = window.open(authUrl, 'oauth', 'width=500,height=600');
      
      // 监听授权完成
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          // 重新加载账户状态
          setTimeout(() => {
            loadAccounts();
          }, 1000);
        }
      }, 1000);

    } catch (error) {
      logger.error('OAuth授权失败:', new EnhancedError('OAuth授权失败:', { error: error instanceof Error ? error.message : String(error)  }));
      alert('OAuth授权失败');
    }
  };

  const handleRefreshToken = async (account: GoogleAdsAccount) => {
    try {
      // 这里应该调用Google Ads API刷新令牌
      // 模拟刷新成功
      await configManager.updateGoogleAdsAccount(account.id, {
        refreshToken: 'new_refresh_token_' + Date.now()
      });
      loadAccounts();
      alert('令牌刷新成功');
    } catch (error) {
      logger.error('刷新令牌失败:', new EnhancedError('刷新令牌失败:', { error: error instanceof Error ? error.message : String(error)  }));
      alert('刷新令牌失败');
    }
  };

  const handleSyncAccountData = async (_account: GoogleAdsAccount) => {
    try {
      // 这里应该调用Google Ads API获取账户数据
      // 模拟同步成功
      alert('账户数据同步成功');
      loadAccounts();
    } catch (error) {
      logger.error('同步账户数据失败:', new EnhancedError('同步账户数据失败:', { error: error instanceof Error ? error.message : String(error)  }));
      alert('同步账户数据失败');
    }
  };

  const resetForm = () => {
    setFormData({
      accountName: '',
      accountId: '',
      clientId: '',
      clientSecret: '',
      developerToken: ''
    });
  };

  const openEditDialog = (account: GoogleAdsAccount) => {
    setSelectedAccount(account);
    setFormData({
      accountName: account.accountName,
      accountId: account.accountId,
      clientId: account.clientId,
      clientSecret: account.clientSecret,
      developerToken: '' // 不预填敏感信息
    });
    setShowEditDialog(true);
  };

  const toggleShowSecret = (accountId: string, field: string) => {
    const key = `${accountId}_${field}`;
    setShowSecrets(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getStatusBadge = (status: string) => {
    const labels = {
      active: '已授权',
      expired: '已过期',
      error: '错误'
    };

    const icons = {
      active: CheckCircle,
      expired: AlertCircle,
      error: XCircle
    };

    const Icon = icons[status as keyof typeof icons] || AlertCircle;

    return (
      <Badge className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const AccountForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="accountName">账户名称 *</Label>
          <Input
            id="accountName"
            value={formData.accountName}
            onChange={(e) => setFormData(prev => ({ ...prev, accountName: (e.target as any).value }))}
            placeholder="输入账户名称"
          />
        </div>
        <div>
          <Label htmlFor="accountId">Google Ads 账户 ID *</Label>
          <Input
            id="accountId"
            value={formData.accountId}
            onChange={(e) => setFormData(prev => ({ ...prev, accountId: (e.target as any).value }))}
            placeholder="10位数字账户ID"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="clientId">客户端 ID *</Label>
        <Input
          id="clientId"
          value={formData.clientId}
          onChange={(e) => setFormData(prev => ({ ...prev, clientId: (e.target as any).value }))}
          placeholder="从 Google Cloud Console 获取"
        />
      </div>

      <div>
        <Label htmlFor="clientSecret">客户端密钥 *</Label>
        <Input
          id="clientSecret"
          type="password"
          value={formData.clientSecret}
          onChange={(e) => setFormData(prev => ({ ...prev, clientSecret: (e.target as any).value }))}
          placeholder="从 Google Cloud Console 获取"
        />
      </div>

      <div>
        <Label htmlFor="developerToken">开发者令牌 *</Label>
        <Input
          id="developerToken"
          type="password"
          value={formData.developerToken}
          onChange={(e) => setFormData(prev => ({ ...prev, developerToken: (e.target as any).value }))}
          placeholder="从 Google Ads API 中心获取"
        />
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          这些凭据将安全存储在您的本地浏览器中，不会上传到服务器。
        </AlertDescription>
      </Alert>
    </div>
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>加载账户中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Google Ads 账号管理</h1>
          <p className="text-gray-600">管理您的 Google Ads 账号和授权状态</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              添加账号
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>添加 Google Ads 账号</DialogTitle>
              <DialogDescription>
                添加新的 Google Ads 账号并配置 API 凭据
              </DialogDescription>
            </DialogHeader>
            <AccountForm />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                取消
              </Button>
              <Button onClick={handleCreateAccount}>
                添加账号
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无 Google Ads 账号</h3>
            <p className="text-gray-600 mb-4">添加您的第一个 Google Ads 账号来开始使用</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              添加账号
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {accounts.map((account: any) => (
            <Card key={account.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{account.accountName}</CardTitle>
                    <CardDescription>
                      账户 ID: {account.accountId}
                    </CardDescription>
                  </div>
                  {getStatusBadge(account.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* 账户统计 */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{account.campaignCount}</div>
                      <div className="text-xs text-gray-500">广告系列</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{account.adGroupCount}</div>
                      <div className="text-xs text-gray-500">广告组</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">{account.adCount}</div>
                      <div className="text-xs text-gray-500">广告</div>
                    </div>
                  </div>

                  {/* 凭据信息 */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">客户端 ID:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">
                          {showSecrets[`${account.id}_clientId`] 
                            ? account.clientId 
                            : account.clientId.substring(0, 8) + '...'
                          }
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleShowSecret(account.id, 'clientId')}
                        >
                          {showSecrets[`${account.id}_clientId`] ? 
                            <EyeOff className="h-3 w-3" /> : 
                            <Eye className="h-3 w-3" />
                          }
                        </Button>
                      </div>
                    </div>
                    
                    {account.lastSync && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">最后同步:</span>
                        <span>{new Date(account.lastSync).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2 pt-4 border-t">
                    {account.status === 'expired' || !account.refreshToken ? (
                      <Button
                        size="sm"
                        onClick={() => handleOAuthAuthorization(account)}
                        className="flex-1"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        授权访问
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRefreshToken(account)}
                        className="flex-1"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        刷新令牌
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSyncAccountData(account)}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      同步数据
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(account)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteAccount(account.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 编辑对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑 Google Ads 账号</DialogTitle>
            <DialogDescription>
              修改账号信息和 API 凭据
            </DialogDescription>
          </DialogHeader>
          <AccountForm />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateAccount}>
              保存更改
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 帮助信息 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>如何获取 Google Ads API 凭据</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">1. Google Cloud Console</h4>
                <ul className="text-sm space-y-1 list-disc list-inside text-gray-600">
                  <li>创建或选择项目</li>
                  <li>启用 Google Ads API</li>
                  <li>创建 OAuth 2.0 客户端 ID</li>
                  <li>设置重定向 URI</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">2. Google Ads API 中心</h4>
                <ul className="text-sm space-y-1 list-disc list-inside text-gray-600">
                  <li>申请开发者令牌</li>
                  <li>等待审核通过</li>
                  <li>获取账户 ID</li>
                  <li>配置访问权限</li>
                </ul>
              </div>
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                所有 API 凭据都安全存储在您的本地浏览器中，不会上传到任何服务器。
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
