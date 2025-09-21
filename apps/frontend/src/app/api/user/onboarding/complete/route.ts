// apps/frontend/src/app/api/user/onboarding/complete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { Logger } from '@/lib/core/Logger';
import { publishEvent } from '@/lib/events/publish';
import { prisma } from '@/lib/db';

const logger = new Logger('ONBOARDING-COMPLETE-ROUTE');

interface OnboardingCompletePayload {
  stepId: string;
}

/**
 * Handles the completion of an onboarding step.
 * This endpoint validates the step and publishes an OnboardingStepCompleted event.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { userId } = session;

    const { stepId }: OnboardingCompletePayload = await request.json();
    if (!stepId) {
      return NextResponse.json({ error: 'Missing stepId' }, { status: 400 });
    }

    // 1. Verify that the step is valid and exists in our read model.
    const checklistStep = await prisma.onboardingChecklist.findUnique({
      where: { id: stepId },
    });
    if (!checklistStep) {
      return NextResponse.json({ error: 'Invalid stepId' }, { status: 404 });
    }

    // 2. Verify that the user has not already completed this step.
    const existingProgress = await prisma.userChecklistProgress.findUnique({
      where: {
        userId_stepId: {
          userId,
          stepId,
        },
      },
    });
    if (existingProgress?.isCompleted) {
      return NextResponse.json({ error: 'Step already completed' }, { status: 409 });
    }

    // 3. Publish the event.
    await publishEvent('OnboardingStepCompleted', {
      userId,
      stepId,
      rewardTokens: checklistStep.rewardTokens,
    });

    logger.info(`'OnboardingStepCompleted' event published for user ${userId}, step ${stepId}`);

    // 4. Respond to the client immediately.
    return NextResponse.json({
      success: true,
      message: 'Step completion recorded. Your reward is being processed.',
    });

  } catch (error) {
    logger.error('Failed to process onboarding step completion:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
