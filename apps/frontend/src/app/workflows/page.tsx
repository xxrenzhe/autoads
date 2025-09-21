'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlayCircle, Loader2 } from 'lucide-react';
import { getWorkflowTemplates, startWorkflow, WorkflowTemplate } from '@/lib/api/workflows';

export default function WorkflowsPage() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingWorkflowId, setStartingWorkflowId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getWorkflowTemplates();
        setTemplates(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load workflow templates.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  const handleStartWorkflow = async (templateId: string) => {
    setStartingWorkflowId(templateId);
    try {
      const result = await startWorkflow(templateId);
      // In a real app, you would use a toast notification library here
      alert(`Successfully started workflow: "${result.templateId}"! Your new workflow ID is ${result.id}.`);
      // Optionally, navigate to a page showing the user's active workflows
    } catch (err: any) {
      alert(`Error starting workflow: ${err.message}`);
    } finally {
      setStartingWorkflowId(null);
    }
  };
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-2">Loading Templates...</p>
        </div>
      );
    }

    if (error) {
      return <p className="text-red-500 text-center py-20">{error}</p>;
    }

    if (templates.length === 0) {
        return <p className="text-center text-muted-foreground py-20">No workflow templates are available at the moment.</p>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div key={template.id} className="bg-card border rounded-lg shadow-sm flex flex-col p-6">
            <h2 className="text-xl font-semibold mb-2">{template.name}</h2>
            <p className="text-muted-foreground flex-grow mb-4">{template.description}</p>
            <Button
              onClick={() => handleStartWorkflow(template.id)}
              disabled={startingWorkflowId === template.id}
            >
              {startingWorkflowId === template.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              {startingWorkflowId === template.id ? 'Starting...' : 'Start Workflow'}
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Workflow Templates</h1>
        {/* Placeholder for future buttons like "View My Workflows" */}
      </div>
      {renderContent()}
    </div>
  );
}
