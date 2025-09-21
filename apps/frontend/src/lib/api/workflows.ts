// apps/frontend/src/lib/api/workflows.ts

// --- Type Definitions ---
// These should ideally be in a shared types file (e.g., @/types/common.ts)
// For now, defining them here to match the backend service structure.

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
}

export interface UserWorkflowProgress {
  id: string;
  userId: string;
  templateId: string;
  currentStep: number;
  status: 'in_progress' | 'completed' | 'failed';
  context?: any;
  createdAt: string;
}


/**
 * Fetches the list of available workflow templates.
 * @returns A promise that resolves to an array of WorkflowTemplates.
 * @throws Will throw an error if the network request fails.
 */
export async function getWorkflowTemplates(): Promise<WorkflowTemplate[]> {
  const response = await fetch('/api/workflows/templates', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch workflow templates' }));
    throw new Error(errorData.message || 'An unknown error occurred');
  }

  return response.json();
}

/**
 * Fetches the list of active workflows for the current user.
 * @returns A promise that resolves to an array of UserWorkflowProgress objects.
 * @throws Will throw an error if the network request fails.
 */
export async function getUserWorkflows(): Promise<UserWorkflowProgress[]> {
    const response = await fetch('/api/workflows', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to fetch user workflows' }));
      throw new Error(errorData.message || 'An unknown error occurred');
    }
  
    return response.json();
  }

/**
 * Starts a new workflow for the current user.
 * @param templateId - The ID of the workflow template to start.
 * @returns A promise that resolves to the newly created UserWorkflowProgress object.
 * @throws Will throw an error if the network request fails.
 */
export async function startWorkflow(templateId: string): Promise<UserWorkflowProgress> {
  const response = await fetch('/api/workflows', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ templateId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to start workflow' }));
    throw new Error(errorData.message || 'An unknown error occurred');
  }

  return response.json();
}
