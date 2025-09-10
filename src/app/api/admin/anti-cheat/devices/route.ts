import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20),
  sort: z.string().default('lastSeenAt'),
  order: z.enum(['ASC', 'DESC']).default('DESC'),
  q: z.string().optional(),
  isSuspicious: z.enum(['true', 'false']).optional(),
})

export async function GET(request: NextRequest) {
  try {
    // 检查管理员权限
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = querySchema.parse(Object.fromEntries(searchParams))
    
    const { page, perPage, sort, order, q, isSuspicious } = query
    const offset = (page - 1) * perPage

    // 构建查询条件
    const where: any = {}
    
    if (q) {
      where.OR = [
        { fingerprint: { contains: q } },
        { userAgent: { contains: q } },
        { firstIP: { contains: q } },
        { lastIP: { contains: q } },
        { user: { email: { contains: q } } }
      ]
    }
    
    if (isSuspicious !== undefined) {
      where.isSuspicious = isSuspicious === 'true'
    }

    // 获取总数
    const [total, devices] = await Promise.all([
      prisma.userDevice.count({ where }),
      prisma.userDevice.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              createdAt: true
            }
          }
        },
        orderBy: { [sort]: order },
        skip: offset,
        take: perPage
      })
    ])

    // 统计数据
    const stats = await prisma.userDevice.groupBy({
      by: ['isSuspicious'],
      _count: true
    })

    const suspiciousCount = stats.find(s => s.isSuspicious)?._count || 0
    const normalCount = stats.find(s => !s.isSuspicious)?._count || 0

    return NextResponse.json({
      data: devices,
      total,
      page,
      perPage,
      stats: {
        total,
        suspicious: suspiciousCount,
        normal: normalCount,
        suspiciousRate: total > 0 ? Math.round((suspiciousCount / total) * 100) : 0
      }
    })
  } catch (error) {
    console.error('获取设备列表失败:', error)
    return NextResponse.json(
      { error: '获取设备列表失败' },
      { status: 500 }
    )
  }
}

// 标记可疑设备
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { deviceId, isSuspicious, reason } = await request.json()

    const device = await prisma.userDevice.update({
      where: { id: deviceId },
      data: { isSuspicious }
    })

    // 记录安全事件
    if (isSuspicious) {
      await prisma.securityThreat.create({
        data: {
          type: 'DEVICE_MARKED_SUSPICIOUS',
          severity: 'MEDIUM',
          description: `设备被标记为可疑: ${reason || '管理员手动标记'}`,
          indicators: [device.fingerprint],
          affectedResources: [device.userId],
          recommendedActions: ['Monitor user activity', 'Investigate device behavior'],
          notes: reason || '管理员手动标记'
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('更新设备状态失败:', error)
    return NextResponse.json(
      { error: '更新设备状态失败' },
      { status: 500 }
    )
  }
}