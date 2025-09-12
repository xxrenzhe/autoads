import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config'
import { AdminUtils } from '@/lib/utils/admin-utils'

export async function GET(request: NextRequest) {
  try {
    // 获取当前会话
    const session = await auth()
    
    if (!session?.userId) {
      return NextResponse.json({
        isAuthenticated: false,
        isAdmin: false,
        isSuperAdmin: false,
        user: null
      })
    }

    // 检查管理员状态
    const [isAdmin, isSuperAdmin, adminUser] = await Promise.all([
      AdminUtils.isAdmin(session.userId),
      AdminUtils.isSuperAdmin(session.userId),
      AdminUtils.getAdminUser(session.userId)
    ])

    return NextResponse.json({
      isAuthenticated: true,
      isAdmin,
      isSuperAdmin,
      user: adminUser
    })

  } catch (error) {
    console.error('Error checking admin auth status:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      isAuthenticated: false,
      isAdmin: false,
      isSuperAdmin: false,
      user: null
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action } = await request.json()

    switch (action) {
      case 'update_last_login':
        // 更新最后登录时间
        const isAdmin = await AdminUtils.isAdmin(session.userId)
        if (!isAdmin) {
          return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
        }

        await AdminUtils.logAdminAction(
          session.userId,
          'admin_login',
          'auth',
          { timestamp: new Date().toISOString() }
        )

        return NextResponse.json({ success: true })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in admin auth API:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}