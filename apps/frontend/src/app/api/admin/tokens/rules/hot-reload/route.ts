import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { tokenRuleService } from '@/lib/services/token-rule-service';
import { Logger } from '@/lib/core/Logger';

const logger = new Logger('ADMIN-TOKENS-RULES-HOT-RELOAD-ROUTE');
/**
 * Hot-reload token rules from configuration
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await auth();
    
    if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('Token rules hot-reload initiated', {
      userId: session.user.id,
      userEmail: session.user.email,
    });

    // Perform hot-reload
    const result = await tokenRuleService.hotReload();

    if (result.success) {
      logger.info('Token rules hot-reload completed successfully', {
        userId: session.user.id,
        reloadedRules: result.reloadedRules,
      });

      return NextResponse.json({
        success: true,
        message: result.message,
        data: {
          reloadedRules: result.reloadedRules,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      logger.error('Token rules hot-reload failed', {
        userId: session.user.id,
        error: result.message,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Hot-reload failed',
          message: result.message,
        },
        { status: 500 }
      );
    }

  } catch (error) {
    logger.error('Token rules hot-reload error:', error instanceof Error ? error.message : String(error));
    
    return NextResponse.json(
      {
        success: false,
        error: 'Hot-reload failed',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}

/**
 * Get hot-reload status and cache information
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await auth();
    
    if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all rules to show current cache status
    const rules = await tokenRuleService.getAllRules();

    return NextResponse.json({
      success: true,
      data: {
        totalRules: rules.length,
        environmentRules: rules.filter(r => r.source === 'environment').length,
        databaseRules: rules.filter(r => r.source === 'database').length,
        activeRules: rules.filter(r => r.isActive).length,
        lastUpdate: new Date().toISOString(),
        rules: rules.map(rule => ({
          id: rule.id,
          feature: rule.feature,
          method: rule.method,
          cost: rule.cost,
          source: rule.source,
          isActive: rule.isActive,
        })),
      },
    });

  } catch (error) {
    logger.error('Failed to get hot-reload status:', error instanceof Error ? error.message : String(error));
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get status',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}