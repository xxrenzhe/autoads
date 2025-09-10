import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/prisma';
import { Logger } from '@/lib/core/Logger';
import { tokenRuleService } from '@/lib/services/token-rule-service';

const logger = new Logger('ADMIN-TOKENS-RULES-[ID]-ROUTE');
/**
 * Update a token rule
 */
export async function PUT(
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
    const body = await request.json();
    const { cost, isActive, reason } = body;

    if (cost !== undefined) {
      // Update token rule cost using the service
      await tokenRuleService.updateTokenRule(
        id,
        cost,
        session.user.id,
        reason || 'Rule cost updated'
      );

      return NextResponse.json({
        success: true,
        message: 'Token rule updated successfully with hot-reload',
        data: { id, cost },
      });
    }

    if (isActive !== undefined) {
      // Toggle rule status using the service
      await tokenRuleService.toggleRuleStatus(
        id,
        isActive,
        session.user.id
      );

      return NextResponse.json({
        success: true,
        message: `Rule ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: { id, isActive },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'No changes made',
    });

  } catch (error) {
    logger.error('Failed to update token rule:', error instanceof Error ? error.message : String(error));
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update token rule',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}

/**
 * Delete a token rule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authentication
    const session = await auth();
    
    if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Super Admin required' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Prevent deletion of system default rules
    if (id.includes('-default') || id.includes('-http') || id.includes('-puppeteer')) {
      return NextResponse.json(
        { error: 'Cannot delete system default rules' },
        { status: 400 }
      );
    }

    const existingRule = await prisma.tokenRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return NextResponse.json(
        { error: 'Token rule not found' },
        { status: 404 }
      );
    }

    // Delete the rule and its history
    await prisma.$transaction([
      prisma.tokenRuleHistory.deleteMany({
        where: { ruleId: id },
      }),
      prisma.tokenRule.delete({
        where: { id },
      }),
    ]);

    logger.info(`Token rule deleted: ${id}`, {
      userId: session.user.id,
      deletedRule: existingRule,
    });

    return NextResponse.json({
      success: true,
      message: 'Token rule deleted successfully',
    });

  } catch (error) {
    logger.error('Failed to delete token rule:', error instanceof Error ? error.message : String(error));
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete token rule',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}