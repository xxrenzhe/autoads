'use client';

import React from 'react';
import Link from 'next/link';
import { OnboardingStep } from '@/lib/api/billing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingChecklistProps {
  steps: OnboardingStep[];
  completedStepIds: string[];
}

export default function OnboardingChecklist({ steps, completedStepIds }: OnboardingChecklistProps) {
  // Sort steps by their step number
  const sortedSteps = [...steps].sort((a, b) => a.step - b.step);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Getting Started Guide</CardTitle>
        <CardDescription>Complete these steps to learn the basics and earn free tokens!</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {sortedSteps.map((step) => {
            const isCompleted = completedStepIds.includes(step.id);
            return (
              <li key={step.id} className="flex items-start">
                <div className="flex-shrink-0 mr-4 mt-1">
                  {isCompleted ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-grow">
                  <h4 className={cn("font-semibold", isCompleted && "text-muted-foreground line-through")}>
                    {step.title}
                  </h4>
                  <p className={cn("text-sm text-muted-foreground", isCompleted && "line-through")}>
                    {step.description}
                  </p>
                  {!isCompleted && (
                    <Link href={step.targetUrl}>
                      <span className="text-sm text-primary hover:underline">
                        Go to page → (+{step.rewardTokens} Tokens)
                      </span>
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
