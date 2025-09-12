import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma, SubscriptionStatus } from '@/lib/db';
import { createSecureHandler } from '@/lib/utils/api-security';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users - Get list of users with pagination and filtering (optimized)
 */
async function handleGET(request: NextRequest, { validatedData, user }: any) {
  const { 
    page = 1, 
    limit = 25, 
    sortBy = 'createdAt', 
    sortOrder = 'DESC', 
    role, 
    status, 
    q, 
    hasSubscription,
    includeDetails = false // New parameter for conditional data loading
  } = validatedData.query;

  // Build filter conditions
  const where: any = {};
  if (role) where.role = role;
  if (status) where.status = status;
  
  // Optimized search using full-text search when available
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }
  
  // Handle hasSubscription filter
  if (hasSubscription !== undefined) {
    if (hasSubscription === 'true') {
      where.subscriptions = {
        some: { status: 'ACTIVE' }
      };
    } else {
      where.subscriptions = {
        none: { status: 'ACTIVE' }
      };
    }
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Base select fields (always included)
  const baseSelect = {
    id: true,
    email: true,
    name: true,
    role: true,
    status: true,
    tokenBalance: true,
    createdAt: true,
    lastLoginAt: true,
  };

  // Extended select fields (only when needed)
  const extendedSelect = includeDetails ? {
    ...baseSelect,
    tokenUsedThisMonth: true,
    avatar: true,
    emailVerified: true,
    subscriptions: {
      select: {
        id: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        plan: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      where: { status: SubscriptionStatus.ACTIVE },
      orderBy: { currentPeriodEnd: 'desc' as const },
      take: 1
    },
    _count: {
      select: {
        subscriptions: true,
        payments: true,
        tokenTransactions: true,
      }
    }
  } : baseSelect;

  // Get users with pagination
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: extendedSelect,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.user.count({ where })
  ]);

  return NextResponse.json({
    items: users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    includeDetails
  });
}

/**
 * POST /api/admin/users - Create new user
 */
async function handlePOST(request: NextRequest, { validatedData, user }: any) {
  const { name, email, role = 'USER', status = 'ACTIVE', tokenBalance = 0 } = validatedData.body;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 });
  }

  // Create new user
  const newUser = await prisma.user.create({
    data: {
      email,
      name,
      role,
      status,
      tokenBalance,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      tokenBalance: true,
      createdAt: true,
    }
  });

  return NextResponse.json(newUser, { status: 201 });
}

// Apply rate limiting for admin users endpoint
export const GET = createSecureHandler({
  requireAuth: true,
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute for admin operations
    keyGenerator: (req: NextRequest) => {
      const session = req.headers.get('authorization') || 'anonymous';
      return `admin-users:${session}`;
    }
  },
  validation: {
    query: [
      { field: 'page', type: 'number', required: false, min: 1, default: 1 },
      { field: 'limit', type: 'number', required: false, min: 1, max: 100, default: 25 },
      { field: 'sortBy', type: 'string', required: false, default: 'createdAt' },
      { field: 'sortOrder', type: 'string', required: false, enum: ['ASC', 'DESC'], default: 'DESC' },
      { field: 'role', type: 'string', required: false, enum: ['USER', 'ADMIN', 'SUPER_ADMIN'] },
      { field: 'status', type: 'string', required: false, enum: ['ACTIVE', 'INACTIVE', 'BANNED'] },
      { field: 'hasSubscription', type: 'string', required: false, enum: ['true', 'false'] },
      { field: 'q', type: 'string', required: false, max: 100 },
      { field: 'includeDetails', type: 'boolean', required: false, default: false }
    ]
  },
  handler: handleGET
});

export const POST = createSecureHandler({
  requireAuth: true,
  rateLimit: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 user creation requests per hour
    keyGenerator: (req: NextRequest) => {
      const session = req.headers.get('authorization') || 'anonymous';
      return `admin-users-create:${session}`;
    }
  },
  validation: {
    body: [
      { field: 'name', type: 'string', required: true, min: 1, max: 100 },
      { field: 'email', type: 'email', required: true },
      { field: 'role', type: 'string', required: false, enum: ['USER', 'ADMIN'] },
      { field: 'status', type: 'string', required: false, enum: ['ACTIVE', 'INACTIVE', 'BANNED'] },
      { field: 'tokenBalance', type: 'number', required: false, min: 0 }
    ]
  },
  handler: handlePOST
});