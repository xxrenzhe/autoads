"use client";

import { Button } from "@/components/ui/button";
import { PlayCircle } from "lucide-react";

const workflowTemplates = [
  {
    id: "new-offer-launch",
    name: "New Offer Launch",
    description: "A guided workflow to evaluate, optimize, and scale a new offer.",
  },
  {
    id: "campaign-optimization",
    name: "Campaign Optimization",
    description: "Automatically analyze and optimize an existing Google Ads campaign.",
  },
];

export default function WorkflowsPage() {
  const handleStartWorkflow = (templateId) => {
    // This would typically be an API call
    alert(`Starting workflow: ${templateId}`);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Workflow Templates</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workflowTemplates.map((template) => (
          <div key={template.id} className="bg-white p-6 rounded-lg shadow-md flex flex-col">
            <h2 className="text-xl font-semibold mb-2">{template.name}</h2>
            <p className="text-gray-600 flex-grow">{template.description}</p>
            <Button
              className="mt-4"
              onClick={() => handleStartWorkflow(template.id)}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Start Workflow
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
