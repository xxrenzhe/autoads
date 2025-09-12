import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { requireAdmin } from '@/lib/middleware/enhanced-auth-middleware';
import { SimpleSecurityMonitor } from '@/lib/security/simple-security-middleware';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Schema for creating a restriction
const createRestrictionSchema = z.object({
  userId: z.string(),
  type: z.enum(['api_limit', 'batch_limit', 'account_suspend', 'login_block', 'feature_access']),
  reason: z.string().min(1),
  durationHours: z.number().min(1).max(720).default(24), // Max 30 days
});

// Schema for updating restrictions
const updateRestrictionSchema = z.object({
  isActive: z.boolean().optional(),
  expiresAt: z.date().optional(),
});

/**
 * GET /api/admin/restrictions - List all restrictions
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const authResult = await requireAdmin(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where: any = {};
    if (userId) {
      where.userId = userId;
    }
    if (activeOnly) {
      where.isActive = true;
      where.expiresAt = { gte: new Date() };
    }

    const restrictions = await prisma.userRestriction.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ success: true, data: restrictions });
  } catch (error) {
    console.error('Error fetching restrictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch restrictions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/restrictions - Create a new restriction
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const authResult = await requireAdmin(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const body = await request.json();
    const validatedData = createRestrictionSchema.parse(body);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: validatedData.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create the restriction using the security monitor
    await SimpleSecurityMonitor.restrictUser(
      validatedData.userId,
      validatedData.type,
      validatedData.reason,
      validatedData.durationHours
    );

    // Get the created restriction
    const restriction = await prisma.userRestriction.findFirst({
      where: {
        userId: validatedData.userId,
        type: validatedData.type.toUpperCase() as any,
        reason: validatedData.reason,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ 
      success: true, 
      data: restriction,
      message: 'User restriction created successfully' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating restriction:', error);
    return NextResponse.json(
      { error: 'Failed to create restriction' },
      { status: 500 }
    );
  }
}