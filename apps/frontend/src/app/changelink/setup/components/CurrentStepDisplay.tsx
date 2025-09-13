'use client';

import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SetupProgressIndicator } from './SetupProgressIndicator';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  required: boolean;
}

interface CurrentStepDisplayProps {
  setupSteps: SetupStep[];
  currentStep: number;
  onStepClick: (index: number) => void;
}

export const CurrentStepDisplay = memo(({ setupSteps, currentStep, onStepClick }: .*Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>配置进度</span>
          <Badge variant="outline" className="text-sm">
            {currentStep + 1} / {setupSteps.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SetupProgressIndicator 
          setupSteps={setupSteps}
          currentStep={currentStep}
          onStepClick={onStepClick}
        />
      </CardContent>
    </Card>
  );
});

CurrentStepDisplay.displayName = 'CurrentStepDisplay';