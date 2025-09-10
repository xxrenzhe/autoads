'use client';

import React, { memo } from 'react';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  required: boolean;
}

interface ConfigurationProgressProps {
  setupSteps: SetupStep[];
  completedSteps: number;
  totalRequiredSteps: number;
  completedRequiredSteps: number;
  progressPercentage: number;
}

export const ConfigurationProgress = memo(({ 
  setupSteps, 
  completedSteps, 
  totalRequiredSteps, 
  completedRequiredSteps, 
  progressPercentage 
}: ConfigurationProgressProps) => {
  return (
    <div 
      className="p-4 space-y-4"
      role="region"
      aria-labelledby="progress-overview-title"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 id="progress-overview-title" className="text-lg font-semibold text-gray-900">
            配置进度 {progressPercentage}%
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            已完成 {completedRequiredSteps} / {totalRequiredSteps} 个必需步骤
          </p>
        </div>
      </div>
      
      {/* 进度条 */}
      <div 
        className="w-full bg-gray-200 rounded-full h-3"
        role="progressbar"
        aria-valuenow={progressPercentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`配置进度 ${progressPercentage}%`}
      >
        <div 
          className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  );
});

ConfigurationProgress.displayName = 'ConfigurationProgress';