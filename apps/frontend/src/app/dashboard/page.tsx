'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Zap, GitBranch, Briefcase } from 'lucide-react';
import { OnboardingStatusResponse, getOnboardingStatus } from '@/lib/api/billing';
import OnboardingChecklist from '@/components/user/OnboardingChecklist';

// This is a placeholder for the summary data structure
interface DashboardSummary {
  offerCount: number;
  activeWorkflows: number;
  tokenBalance: number;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch both summary and onboarding status in parallel
        const [summaryResponse, onboardingData] = await Promise.all([
          axios.get('/api/user/summary').catch(err => {
            console.error("Failed to fetch summary", err);
            // Return a default/error state for summary if it fails
            return { data: { offerCount: 0, activeWorkflows: 0, tokenBalance: 0 } };
          }),
          getOnboardingStatus().catch(err => {
            console.error("Failed to fetch onboarding status", err);
            // Return null if onboarding status fails, so the component doesn't render
            return null;
          })
        ]);
        
        setSummary(summaryResponse.data);
        if (onboardingData) {
          setOnboardingStatus(onboardingData);
        }

      } catch (err: any) {
        setError('Failed to load dashboard data.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="ml-2">Loading Dashboard...</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-center py-10">{error}</p>;
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Token Balance</CardTitle>
                    <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {summary ? summary.tokenBalance.toLocaleString() : '...'}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {summary ? summary.activeWorkflows : '...'}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Managed Offers</CardTitle>
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {summary ? summary.offerCount : '...'}
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
      
      {onboardingStatus && (
        <div>
          <OnboardingChecklist 
            steps={onboardingStatus.steps} 
            completedStepIds={onboardingStatus.completedStepIds} 
          />
        </div>
      )}
    </div>
  );
}
