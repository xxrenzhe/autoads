'use client';

import React, { memo } from 'react';
import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const AutomationStep = memo(() => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Clock className="h-5 w-5 mr-2" />
          自动化任务设置
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center py-8">
          <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">自动化任务配置</h3>
          <p className="text-gray-600 mb-4">
            配置定时任务或手动执行任务，自动更新Google Ads链接
          </p>
          <Button
            onClick={((: any): any) => window.location.href = '/adscenter/scheduling'}
            className="flex items-center mx-auto"
          >
            <Clock className="h-4 w-4 mr-2" />
            前往任务调度页面
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

AutomationStep.displayName = 'AutomationStep';