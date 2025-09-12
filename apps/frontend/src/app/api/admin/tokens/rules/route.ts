import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/prisma';
import { Logger } from '@/lib/core/Logger';
import { tokenRuleService } from '@/lib/services/token-rule-service';

const logger = new Logger('ADMIN-TOKENS-RULES-ROUTE');
/**
 * Get all token consumption rules
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

    // Get all rules from the service
    const allRules = await tokenRuleService.getAllRules();

    // Get usage statistics for each rule
    const rulesWithStats = await Promise.all(
      allRules.map(async (rule) => {
        // Get 24h usage
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const usage24h = await prisma.tokenTransaction.count({
          where: {
            createdAt: {
              gte: twentyFourHoursAgo,
            },
            metadata: {
              path: ['feature'],
              equals: rule.feature,
            },
          },
        });

        // Get total usage
        const usageTotal = await prisma.tokenTransaction.count({
          where: {
            metadata: {
              path: ['feature'],
              equals: rule.feature,
            },
          },
        });

        return {
          id: rule.id,
          feature: rule.feature,
          method: rule.method,
          cost: rule.cost,
          description: rule.source === 'environment' 
            ? `${rule.feature.toUpperCase()} ${rule.method} 模式消费`
            : 'Custom rule',
          isActive: rule.isActive,
          lastModified: new Date().toISOString(),
          modifiedBy: rule.source === 'environment' ? 'system' : 'admin',
          usage24h,
          usageTotal,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: rulesWithStats,
    });

  } catch (error) {
    logger.error('Failed to get token rules:', error instanceof Error ? error.message : String(error));
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get token rules',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}

/**
 * Create a new token rule override
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

    const body = await request.json();
    const { feature, method, cost, description, reason } = body;

    // Validate input
    if (!feature || cost === undefined || cost < 0) {
      return NextResponse.json(
        { error: 'Invalid input: feature and cost are required' },
        { status: 400 }
      );
    }

    // Create token rule using the service
    const ruleId = await tokenRuleService.createTokenRule(
      feature,
      method || 'default',
      cost,
      description || `${feature} token consumption rule`,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      data: { id: ruleId },
    });

  } catch (error) {
    logger.error('Failed to create token rule:', error instanceof Error ? error.message : String(error));
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create token rule',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}