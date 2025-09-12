import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { OptimizedConfigurationService } from '@/lib/services/optimized/config-service'
import { validateAdminPermissions } from '@/lib/admin/auth-service'

const configService = new OptimizedConfigurationService()

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 检查管理员权限
    const permissionResult = await validateAdminPermissions(session.userId, ['config:read'])
    if (!permissionResult.hasAllPermissions) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const includeSecrets = searchParams.get('includeSecrets') === 'true'

    const configs = await configService.getConfigs(category || undefined)
    
    // 过滤敏感信息
    const filteredConfigs = configs.map(config => ({
      ...config,
      value: (config.isSecret && !includeSecrets) || 
             (config.isSecret && session.user.role !== 'SUPER_ADMIN')
        ? '***HIDDEN***'
        : config.value
    }))

    // 获取统计信息
    const stats = await configService.getConfigStatistics()

    return NextResponse.json({
      configs: filteredConfigs,
      statistics: stats
    })
  } catch (error) {
    console.error('获取配置失败:', error)
    return NextResponse.json(
      { error: '获取配置失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 检查超级管理员权限
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true }
    })
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const body = await request.json()
    const { key, value, type, category, description, isSecret, isHotReload, validationType } = body

    // 验证必填字段
    if (!key || !value || !type || !category) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      )
    }

    await configService.createConfig({
      key,
      value,
      type,
      category,
      description,
      isSecret: isSecret || false,
      isHotReload: isHotReload || false,
      validationType
    }, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('创建配置失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建配置失败' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 检查管理员权限
    const permissionResult = await validateAdminPermissions(session.userId, ['config:write'])
    if (!permissionResult.hasAllPermissions) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const body = await request.json()
    const { updates, reason } = body

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: '无效的更新数据' },
        { status: 400 }
      )
    }

    await configService.bulkUpdateConfigs(
      updates,
      session.user.id,
      reason
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('批量更新配置失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '批量更新配置失败' },
      { status: 500 }
    )
  }
}