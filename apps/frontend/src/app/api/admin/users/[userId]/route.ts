import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { PermissionService } from '@/lib/services/permission-service'
import { UserService } from '@/lib/services/user-service'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to read user details
    const hasPermission = await PermissionService.hasPermission(session.userId, 'users', 'read')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get user details with relations
    const user = await UserService.getUserById(params.userId, true)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user behavior statistics
    const behaviorStats = await UserService.getUserBehaviorStats(params.userId)

    return NextResponse.json({
      user,
      behaviorStats
    })

  } catch (error) {
    console.error('Error fetching user details:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to update users
    const hasPermission = await PermissionService.hasPermission(session.userId, 'users', 'write')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { name, role, status, tokenBalance, preferences } = body

    // Get current user to check permissions for role changes
    const currentUser = await UserService.getUserById(params.userId)
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only SUPER_ADMIN can modify SUPER_ADMIN users or assign ADMIN/SUPER_ADMIN roles
    const isSuperAdmin = await PermissionService.isSuperAdmin(session.userId)
    
    if (currentUser.role === 'SUPER_ADMIN' && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only SUPER_ADMIN can modify SUPER_ADMIN users' },
        { status: 403 }
      )
    }

    if ((role === 'ADMIN' || role === 'SUPER_ADMIN') && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only SUPER_ADMIN can assign admin roles' },
        { status: 403 }
      )
    }

    // Cannot modify yourself to prevent lockout
    if (params.userId === session.userId && (role || status)) {
      return NextResponse.json(
        { error: 'Cannot modify your own role or status' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (role !== undefined) updateData.role = role
    if (status !== undefined) updateData.status = status
    if (tokenBalance !== undefined) updateData.tokenBalance = tokenBalance
    if (preferences !== undefined) updateData.preferences = preferences

    // Update user
    const updatedUser = await UserService.updateUser(params.userId, updateData)

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      )
    }

    // Record admin action
    await UserService.recordBehavior(session.userId, 'admin', 'user_updated', {
      success: true,
      tokensConsumed: 0,
      metadata: {
        updatedUserId: params.userId,
        updatedFields: Object.keys(updateData),
        previousRole: currentUser.role,
        newRole: role || currentUser.role
      }
    })

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        status: updatedUser.status,
        tokenBalance: updatedUser.tokenBalance,
        updatedAt: updatedUser.updatedAt
      }
    })

  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to delete users
    const hasPermission = await PermissionService.hasPermission(session.userId, 'users', 'delete')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get target user info
    const targetUser = await UserService.getUserById(params.userId)
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only SUPER_ADMIN can delete other SUPER_ADMIN users
    const isSuperAdmin = await PermissionService.isSuperAdmin(session.userId)
    if (targetUser.role === 'SUPER_ADMIN' && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only SUPER_ADMIN can delete SUPER_ADMIN users' },
        { status: 403 }
      )
    }

    // Cannot delete yourself
    if (params.userId === session.userId) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
    }

    // Delete user using UserService
    await UserService.deleteUser(params.userId)

    // Record admin action
    await UserService.recordBehavior(session.userId, 'admin', 'user_deleted', {
      success: true,
      tokensConsumed: 0,
      metadata: {
        deletedUserId: params.userId,
        deletedUserEmail: targetUser.email,
        deletedUserRole: targetUser.role
      }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}