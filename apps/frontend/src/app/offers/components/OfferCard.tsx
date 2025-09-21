// apps/frontend/src/app/offers/components/OfferCard.tsx
"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, BarChart2, Zap, Loader2 } from "lucide-react";
import { useState } from "react";

type Offer = {
  id: string;
  name: string;
  originalUrl: string;
  status: string;
  siterankScore?: number;
  createdAt: string;
};

type OfferCardProps = {
  offer: Offer;
};

const statusConfig = {
    evaluating: { text: '评估中', color: 'bg-yellow-500' },
    optimizing: { text: '优化中', color: 'bg-blue-500' },
    scaling: { text: '放大中', color: 'bg-green-500' },
    archived: { text: '已归档', color: 'bg-gray-500' },
};

export function OfferCard({ offer }: OfferCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { text, color } = statusConfig[offer.status as keyof typeof statusConfig] || statusConfig.archived;

  const handleStartWorkflow = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/workflows/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            // The template_id for "new offer onboarding" will be standardized.
            template_id: 'new-offer-onboarding', 
            offer_id: offer.id 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start workflow');
      }
      
      const result = await response.json();
      console.log('Workflow started:', result);
      // Here you might want to show a success notification to the user
      alert(`工作流已启动: ${result.workflow_instance_id}`);

    } catch (error) {
      console.error(error);
      alert('启动工作流失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
            <CardTitle className="text-xl font-bold">{offer.name}</CardTitle>
            <span className={`px-2 py-1 text-xs font-semibold text-white rounded-full ${color}`}>
                {text}
            </span>
        </div>
        <CardDescription className="flex items-center pt-2">
            <Globe className="h-4 w-4 mr-2" />
            <a href={offer.originalUrl} target="_blank" rel="noopener noreferrer" className="truncate text-blue-500 hover:underline">
                {offer.originalUrl}
            </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="flex items-center text-sm text-gray-600">
            <BarChart2 className="h-4 w-4 mr-2" />
            <span>Siterank得分: {offer.siterankScore ?? 'N/A'}</span>
        </div>
        {/* More details can be added here */}
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleStartWorkflow} disabled={isLoading || offer.status !== 'evaluating'}>
            {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Zap className="mr-2 h-4 w-4" />
            )}
            {isLoading ? '启动中...' : '进入工作流'}
        </Button>
      </CardFooter>
    </Card>
  );
}
