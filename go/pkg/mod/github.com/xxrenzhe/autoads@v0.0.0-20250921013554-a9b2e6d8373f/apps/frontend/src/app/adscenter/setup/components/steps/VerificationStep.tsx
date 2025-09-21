'use client';

import React, { memo } from 'react';
import { Zap, TestTube, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface VerificationStepProps {
  loading: boolean;
  configurations: any[];
  onRunSystemVerification: () => void;
  onRunTestExecution: () => void;
}

export const VerificationStep = memo(({ 
  loading, 
  configurations, 
  onRunSystemVerification, 
  onRunTestExecution 
}: VerificationStepProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Zap className="h-5 w-5 mr-2" />
          系统验证测试
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center py-8">
          <Zap className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">系统验证</h3>
          <p className="text-gray-600 mb-6">
            验证所有配置是否正确，确保系统可以正常运行
          </p>
          
          <div className="flex justify-center space-x-4">
            <Button
              onClick={onRunSystemVerification}
              disabled={loading}
              className="flex items-center"
            >
              <TestTube className="h-4 w-4 mr-2" />
              {loading ? '验证中...' : '运行系统验证'}
            </Button>
            
            <Button
              onClick={onRunTestExecution}
              disabled={loading || configurations.length === 0}
              variant="outline"
              className="flex items-center"
            >
              <Play className="h-4 w-4 mr-2" />
              {loading ? '测试中...' : '执行测试运行'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

VerificationStep.displayName = 'VerificationStep';