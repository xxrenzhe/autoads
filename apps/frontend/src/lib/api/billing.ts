// apps/frontend/src/lib/api/billing.ts

// --- Type Definitions ---

export interface OnboardingStep {
  id: string;
  step: number;
  title: string;
  description: string;
  targetUrl: string;
  rewardTokens: number;
}

export interface OnboardingStatusResponse {
  steps: OnboardingStep[];
  completedStepIds: string[];
}

export interface TokenBalance {
  balance: number;
}


/**
 * Fetches the user's onboarding status, including all steps and their completion progress.
 * @returns A promise that resolves to an OnboardingStatusResponse object.
 */
export async function getOnboardingStatus(): Promise<OnboardingStatusResponse> {
  const response = await fetch('/api/billing/onboarding', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch onboarding status' }));
    throw new Error(errorData.message || 'An unknown error occurred');
  }

  return response.json();
}

/**
 * Marks an onboarding step as complete for the current user and triggers the token reward.
 * @param stepId - The ID of the step to complete.
 * @returns A promise that resolves when the operation is successful.
 */
export async function completeOnboardingStep(stepId: string): Promise<void> {
  const response = await fetch(`/api/billing/onboarding/steps/${stepId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `Failed to complete step ${stepId}` }));
    throw new Error(errorData.message || 'An unknown error occurred');
  }

  // A 204 No Content response will not have a body to parse
  return;
}

/**
 * Fetches the current user's token balance.
 * @returns A promise that resolves to a TokenBalance object.
 */
export async function getTokenBalance(): Promise<TokenBalance> {
    const response = await fetch('/api/billing/tokens/balance', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch token balance' }));
        throw new Error(errorData.message || 'An unknown error occurred');
    }

    return response.json();
}
