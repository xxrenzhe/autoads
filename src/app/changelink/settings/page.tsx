'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Shield, 
  Database, 
  Download, 
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Play,
  Pause,
  Save,
  Key
} from 'lucide-react';
import { globalConfigurationManager } from '../models/ConfigurationManager';
import { EnhancedError } from '@/lib/utils/error-handling';

export default function SimpleSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [exportData, setExportData] = useState<string>('');

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const stats = await globalConfigurationManager.getConfigurationStats();
      setConfig(stats);
    } catch (error) {
      console.error('加载配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportConfig = async () => {
    try {
      setLoading(true);
      const accounts = await globalConfigurationManager.getGoogleAdsAccounts();
      const links = await globalConfigurationManager.getAffiliateLinks();
      const associations = await globalConfigurationManager.getLinkAccountAssociations();
      
      const exportData = {
        accounts,
        links,
        associations,
        stats: config,
        exportTime: new Date().toISOString(),
        version: '1.0'
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `adscenter-config-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      setMessage({ type: 'success', text: '配置导出成功！' });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: `导出失败: ${error instanceof Error ? error.message : '未知错误'}` 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportConfig = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // 验证导入数据格式
      if (!importData.accounts || !importData.links || !importData.associations) {
        throw new Error('无效的配置文件格式');
      }
      
      // 导入数据
      for (const account of importData.accounts) {
        await globalConfigurationManager.addGoogleAdsAccount(account);
      }
      
      for (const link of importData.links) {
        await globalConfigurationManager.addAffiliateLink(link);
      }
      
      for (const association of importData.associations) {
        await globalConfigurationManager.addLinkAccountAssociation(association);
      }
      
      setMessage({ type: 'success', text: '配置导入成功！' });
      loadConfiguration();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: `导入失败: ${error instanceof Error ? error.message : '未知错误'}` 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    if (!confirm('确定要清除所有配置数据吗？此操作不可恢复！')) {
      return;
    }

    try {
      setLoading(true);
      // 这里应该实现清除数据的逻辑
      // 由于 ConfigurationManager 没有提供清除方法，这里只是模拟
      setMessage({ type: 'info', text: '数据清除功能需要后端支持' });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: `清除失败: ${error instanceof Error ? error.message : '未知错误'}` 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center">
          <Settings className="mr-3 h-8 w-8" />
          系统设置
        </h1>
        <p className="text-gray-600">管理系统配置、数据导入导出等</p>
      </div>

      {/* 消息提示 */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'success' && <CheckCircle className="h-4 w-4" />}
          {message.type === 'error' && <AlertCircle className="h-4 w-4" />}
          {message.type === 'info' && <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* 设置标签页 */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="import-export">导入导出</TabsTrigger>
          <TabsTrigger value="advanced">高级</TabsTrigger>
        </TabsList>

        {/* 系统概览 */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="mr-2 h-5 w-5" />
                  配置统计
                </CardTitle>
              </CardHeader>
              <CardContent>
                {config ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Google Ads 账户:</span>
                      <Badge>{config.totalAccounts}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>广告联盟链接:</span>
                      <Badge>{config.totalLinks}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>关联配置:</span>
                      <Badge>{config.totalAssociations}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>活跃关联:</span>
                      <Badge variant="outline">{config.activeAssociations}</Badge>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    加载中...
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5" />
                  安全信息
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">本地数据存储</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">TypeScript 类型安全</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">错误处理机制</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">建议定期备份数据</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 导入导出 */}
        <TabsContent value="import-export">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Download className="mr-2 h-5 w-5" />
                  导出配置
                </CardTitle>
                <CardDescription>
                  导出所有配置数据到 JSON 文件
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    导出的配置文件包含所有 Google Ads 账户、广告联盟链接和关联配置。
                  </p>
                  <Button onClick={handleExportConfig} disabled={loading}>
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    导出配置
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Upload className="mr-2 h-5 w-5" />
                  导入配置
                </CardTitle>
                <CardDescription>
                  从 JSON 文件导入配置数据
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    选择之前导出的配置文件进行导入。导入的数据将合并到现有配置中。
                  </p>
                  <div>
                    <Input 
                      type="file" 
                      accept=".json"
                      onChange={handleImportConfig}
                      disabled={loading}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 高级设置 */}
        <TabsContent value="advanced">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Key className="mr-2 h-5 w-5" />
                  数据管理
                </CardTitle>
                <CardDescription>
                  高级数据管理操作
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-red-50">
                    <h4 className="font-medium text-red-800 mb-2">危险操作</h4>
                    <p className="text-sm text-red-600 mb-3">
                      以下操作将永久删除数据，请谨慎操作。
                    </p>
                    <Button 
                      variant="destructive" 
                      onClick={handleClearData}
                      disabled={loading}
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      清除所有数据
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>系统信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div><strong>版本:</strong> ChangeLink v1.0</div>
                  <div><strong>框架:</strong> Next.js 14 + TypeScript</div>
                  <div><strong>数据库:</strong> 本地 IndexedDB</div>
                  <div><strong>最后更新:</strong> {new Date().toLocaleDateString()}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}