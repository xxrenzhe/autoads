import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { tokenRuleService } from '@/lib/services/token-rule-service';
import { Logger } from '@/lib/core/Logger';

const logger = new Logger('ADMIN-TOKENS-RULES-[ID]-HISTORY-ROUTE');
/**
 * Get token rule change history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authentication
    const session = await auth();
    
    if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Get rule history using the service
    const formattedHistory = await tokenRuleService.getRuleHistory(id);

    return NextResponse.json({
      success: true,
      data: formattedHistory,
    });

  } catch (error) {
    logger.error('Failed to get token rule history:', error instanceof Error ? error.message : String(error));
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get token rule history',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}