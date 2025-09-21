'use client';

import React, { memo } from 'react';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  required: boolean;
}

interface SetupProgressIndicatorProps {
  setupSteps: SetupStep[];
  currentStep: number;
  onStepClick: (index: number) => void;
}

export const SetupProgressIndicator = memo(({ 
  setupSteps, 
  currentStep, 
  onStepClick 
}: SetupProgressIndicatorProps) => {
  const getStepStatus = (step: SetupStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'in-progress':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const handleStepKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onStepClick(index);
    }
  };

  return (
    <div className="relative mb-8" role="navigation" aria-label="配置步骤导航">
      <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" aria-hidden="true">
        <div 
          className="h-0.5 bg-blue-500 transition-all duration-300"
          style={{ width: `${(currentStep / (setupSteps.length - 1)) * 100}%` }}
        />
      </div>
      
      <div className="relative flex justify-between">
        {setupSteps.map((step, index: any) => (
          <div key={step.id} className="flex flex-col items-center">
            {/* 步骤圆圈 */}
            <button
              type="button"
              onClick={() => onStepClick(index)}
              onKeyDown={(e) => handleStepKeyDown(e, index)}
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                index === currentStep 
                  ? 'border-blue-500 bg-blue-500 text-white shadow-lg transform scale-110' 
                  : step.status === 'completed' 
                    ? 'border-green-500 bg-green-500 text-white hover:bg-green-600' 
                    : index < currentStep
                      ? 'border-green-500 bg-green-50 text-green-600 hover:bg-green-100'
                      : 'border-gray-300 bg-white text-gray-400 hover:border-gray-400'
              }`}
              aria-label={`前往步骤 ${index + 1}: ${step.title}`}
              aria-current={index === currentStep ? 'step' : undefined}
              tabIndex={0}
            >
              {step.status === 'completed' ? (
                <CheckCircle className="h-5 w-5" aria-hidden="true" />
              ) : (
                <span className="text-sm font-semibold">{index + 1}</span>
              )}
            </button>
            
            {/* 步骤标题 */}
            <div className={`mt-3 text-center max-w-[140px] ${
              index === currentStep 
                ? 'text-blue-600 font-medium' 
                : step.status === 'completed'
                  ? 'text-green-600 font-medium'
                  : 'text-gray-500'
            }`}>
              <div className="text-sm font-medium leading-tight">{step.title}</div>
              {step.required && (
                <div className="text-xs text-gray-400 mt-1">必需</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

SetupProgressIndicator.displayName = 'SetupProgressIndicator';
