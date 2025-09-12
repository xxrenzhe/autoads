import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { requireAdmin } from '@/lib/middleware/enhanced-auth-middleware';
import { SimpleSecurityMonitor } from '@/lib/security/simple-security-middleware';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Schema for updating restrictions
const updateRestrictionSchema = z.object({
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
});

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/admin/restrictions/[id] - Get a specific restriction
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    // Check admin permissions
    const authResult = await requireAdmin(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { id } = context.params;

    const restriction = await prisma.userRestriction.findUnique({
      where: { id },
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
    });

    if (!restriction) {
      return NextResponse.json(
        { error: 'Restriction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: restriction });
  } catch (error) {
    console.error('Error fetching restriction:', error);
    return NextResponse.json(
      { error: 'Failed to fetch restriction' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/restrictions/[id] - Update a restriction
 */
export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    // Check admin permissions
    const authResult = await requireAdmin(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { id } = context.params;
    const body = await request.json();
    const validatedData = updateRestrictionSchema.parse(body);

    // Check if restriction exists
    const existingRestriction = await prisma.userRestriction.findUnique({
      where: { id },
    });

    if (!existingRestriction) {
      return NextResponse.json(
        { error: 'Restriction not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    if (validatedData.isActive !== undefined) {
      updateData.isActive = validatedData.isActive;
    }
    if (validatedData.expiresAt) {
      updateData.expiresAt = new Date(validatedData.expiresAt);
    }

    // Update the restriction
    const updatedRestriction = await prisma.userRestriction.update({
      where: { id },
      data: updateData,
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

    // If deactivating, log the event
    if (validatedData.isActive === false && existingRestriction.isActive) {
      await SimpleSecurityMonitor.recordEvent(
        existingRestriction.userId,
        'restriction_removed',
        `Restriction removed by admin: ${existingRestriction.type}`,
        'medium',
        { restrictionId: id, type: existingRestriction.type }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: updatedRestriction,
      message: 'Restriction updated successfully' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating restriction:', error);
    return NextResponse.json(
      { error: 'Failed to update restriction' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/restrictions/[id] - Delete/deactivate a restriction
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    // Check admin permissions
    const authResult = await requireAdmin(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { id } = context.params;

    // Check if restriction exists
    const restriction = await prisma.userRestriction.findUnique({
      where: { id },
    });

    if (!restriction) {
      return NextResponse.json(
        { error: 'Restriction not found' },
        { status: 404 }
      );
    }

    // Instead of deleting, mark as inactive
    await prisma.userRestriction.update({
      where: { id },
      data: { isActive: false },
    });

    // Log the event
    await SimpleSecurityMonitor.recordEvent(
      restriction.userId,
      'restriction_removed',
      `Restriction removed by admin: ${restriction.type}`,
      'medium',
      { restrictionId: id, type: restriction.type }
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Restriction deactivated successfully' 
    });
  } catch (error) {
    console.error('Error deactivating restriction:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate restriction' },
      { status: 500 }
    );
  }
}