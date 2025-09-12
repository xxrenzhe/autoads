'use client';

import React, { memo, useCallback } from 'react';
import { Globe, TestTube } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AdsPowerEnvironment {
  id: string;
  name: string;
  environmentId: string;
  apiEndpoint: string;
  apiKey?: string;
  isActive: boolean;
  status: 'connected' | 'disconnected' | 'error';
}

interface AdsPowerStepProps {
  environments: AdsPowerEnvironment[];
  newEnvironment: Partial<AdsPowerEnvironment>;
  loading: boolean;
  onEnvironmentChange: (env: Partial<AdsPowerEnvironment>) => void;
  onAddEnvironment: () => void;
  onTestConnection: (envId: string) => void;
}

export const AdsPowerStep = memo(({ 
  environments, 
  newEnvironment, 
  loading, 
  onEnvironmentChange, 
  onAddEnvironment, 
  onTestConnection 
}: AdsPowerStepProps) => {
  const handleInputChange = useCallback((field: keyof AdsPowerEnvironment, value: string) => {
    onEnvironmentChange({ ...newEnvironment, [field]: value });
  }, [newEnvironment, onEnvironmentChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Globe className="h-5 w-5 mr-2" />
          AdsPower环境配置
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 现有环境列表 */}
        {environments.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">已配置的环境</h4>
            <div className="space-y-2">
              {environments?.filter(Boolean)?.map(env => (
                <div key={env.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{env.name}</div>
                    <div className="text-sm text-gray-600">环境ID: {env.environmentId}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={env.status === 'connected' ? 'default' : 'secondary'}>
                      {env.status === 'connected' ? '已连接' : '未连接'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onTestConnection(env.id)}
                      disabled={loading}
                    >
                      <TestTube className="h-4 w-4 mr-1" />
                      测试
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 添加新环境表单 */}
        <div>
          <h4 className="font-medium mb-3">添加新的AdsPower环境</h4>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">环境名称（Environment Name）*<br/><span className="text-xs text-gray-500">自定义的AdsPower浏览器环境标识</span></label>
                <input
                  type="text"
                  value={newEnvironment.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="主要浏览器环境"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">环境ID（Environment ID）*<br/><span className="text-xs text-gray-500">AdsPower分配的唯一环境标识符</span></label>
                <input
                  type="text"
                  value={newEnvironment.environmentId || ''}
                  onChange={(e) => handleInputChange('environmentId', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="j1nqjy0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">API端点（API Endpoint）<br/><span className="text-xs text-gray-500">AdsPower API服务地址</span></label>
                <input
                  type="text"
                  value={newEnvironment.apiEndpoint || ''}
                  onChange={(e) => handleInputChange('apiEndpoint', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="http://local.adspower.net:50325"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">API密钥（API Key）<br/><span className="text-xs text-gray-500">API访问认证密钥（可选）</span></label>
                <input
                  type="password"
                  value={newEnvironment.apiKey || ''}
                  onChange={(e) => handleInputChange('apiKey', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="可选，如果需要认证"
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Button
              onClick={onAddEnvironment}
              disabled={loading}
              className="flex items-center"
            >
              <Globe className="h-4 w-4 mr-2" />
              {loading ? '添加中...' : '添加环境'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

AdsPowerStep.displayName = 'AdsPowerStep';