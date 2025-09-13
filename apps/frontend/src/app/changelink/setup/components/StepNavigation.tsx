'use client';

import React, { memo } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
}

export const StepNavigation = memo(({ 
  currentStep, 
  totalSteps, 
  onPrev, 
  onNext 
}: .*Props) {
  return (
    <div className="flex justify-between" role="navigation" aria-label="页面导航">
      <Button
        variant="outline"
        onClick={onPrev}
        disabled={currentStep === 0}
        className="flex items-center"
        aria-label="上一步"
        accessKey="p"
        title="快捷键: Alt + P"
      >
        <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
        上一步
      </Button>
      
      <Button
        onClick={onNext}
        disabled={currentStep === totalSteps - 1}
        className="flex items-center"
        aria-label="下一步"
        accessKey="n"
        title="快捷键: Alt + N"
      >
        下一步
        <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
      </Button>
    </div>
  );
});

StepNavigation.displayName = 'StepNavigation';