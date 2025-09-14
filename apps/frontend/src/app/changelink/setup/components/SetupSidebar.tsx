'use client';

import React, { memo } from 'react';
import { Settings, Eye, Database, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
  isActive: boolean;
}

interface AffiliateLink {
  id: string;
  name: string;
  isActive: boolean;
}

interface AdsPowerEnvironment {
  id: string;
  name: string;
  isActive: boolean;
}

interface Configuration {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'stopped';
}

interface SetupSidebarProps {
  setupSteps: SetupStep[];
  currentStep: number;
  googleAdsAccounts: GoogleAdsAccount[];
  affiliateLinks: AffiliateLink[];
  adsPowerEnvironments: AdsPowerEnvironment[];
  configurations: Configuration[];
}

export const SetupSidebar = memo(({ 
  setupSteps, 
  currentStep, 
  googleAdsAccounts,
  affiliateLinks,
  adsPowerEnvironments,
  configurations
}: SetupSidebarProps) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>配置摘要</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Google Ads账号</span>
            <Badge variant={googleAdsAccounts.length > 0 ? 'default' : 'secondary'}>
              {googleAdsAccounts.length}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">广告联盟链接</span>
            <Badge variant={affiliateLinks.length > 0 ? 'default' : 'secondary'}>
              {affiliateLinks.length}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">AdsPower环境</span>
            <Badge variant={adsPowerEnvironments.length > 0 ? 'default' : 'secondary'}>
              {adsPowerEnvironments.length}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">执行配置</span>
            <Badge variant={configurations.length > 0 ? 'default' : 'secondary'}>
              {configurations.length}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => (window.location.href = '/adscenter/executions')}
          >
            <Eye className="h-4 w-4 mr-2" />
            查看执行记录
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => (window.location.href = '/adscenter/reports')}
          >
            <Database className="h-4 w-4 mr-2" />
            查看数据报表
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => (window.location.href = '/adscenter')}
          >
            <Settings className="h-4 w-4 mr-2" />
            高级设置
          </Button>
        </CardContent>
      </Card>
    </div>
  );
});

SetupSidebar.displayName = 'SetupSidebar';
