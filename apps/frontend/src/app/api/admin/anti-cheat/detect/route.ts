import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

// 检测可疑设备的规则
const SUSPICIOUS_PATTERNS = {
  // 同一设备超过5个账号
  MULTI_ACCOUNT_THRESHOLD: 5,
  // 同一IP超过10个账号
  MULTI_IP_THRESHOLD: 10,
  // 24小时内创建的账号
  NEW_ACCOUNT_HOURS: 24,
} as const

export async function GET(request: NextRequest) {
  try {
    // 检查管理员权限
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const suspiciousDevices = await prisma.userDevice.findMany({
      where: {
        OR: [
          // 同一设备的多个账号
          {
            user: {
              devices: {
                some: {
                  userId: {
                    not: { equals: prisma.userDevice.fields.userId },
                  },
                },
              },
            },
          },
          // 新注册的可疑账号
          {
            user: {
              createdAt: {
                gte: new Date(Date.now() - SUSPICIOUS_PATTERNS.NEW_ACCOUNT_HOURS * 60 * 60 * 1000),
              },
            },
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
            tokenBalance: true,
          },
        },
      },
      orderBy: {
        lastSeenAt: 'desc',
      },
    })

    // 过滤和分析可疑设备
    const analysisResults = await Promise.all(
      suspiciousDevices.map(async (device) => {
        // 计算该设备的账号数量
        const accountCount = await prisma.userDevice.count({
          where: {
            fingerprint: device.fingerprint,
          },
        })

        // 计算该IP的账号数量
        const ipCount = await prisma.userDevice.count({
          where: {
            firstIP: device.firstIP,
          },
        })

        // 计算可疑分数
        let suspiciousScore = 0
        let reasons: string[] = []

        if (accountCount > SUSPICIOUS_PATTERNS.MULTI_ACCOUNT_THRESHOLD) {
          suspiciousScore += 30
          reasons.push(`多账号 (${accountCount}个)`)
        }

        if (ipCount > SUSPICIOUS_PATTERNS.MULTI_IP_THRESHOLD) {
          suspiciousScore += 20
          reasons.push(`同IP多账号 (${ipCount}个)`)
        }

        if (
          device.user && 
          new Date().getTime() - new Date(device.user.createdAt).getTime() <
          SUSPICIOUS_PATTERNS.NEW_ACCOUNT_HOURS * 60 * 60 * 1000
        ) {
          suspiciousScore += 10
          reasons.push('新注册账号')
        }

        // 检查账号行为
        const checkInCount = await prisma.checkIn.count({
          where: {
            userId: device.userId,
          },
        })

        if (checkInCount > 0) {
          // 只签到不使用其他功能
          const apiUsage = await prisma.token_usage.count({
            where: {
              userId: device.userId,
              feature: {
                not: 'OTHER',
              },
            },
          })

          if (apiUsage === 0 && checkInCount > 3) {
            suspiciousScore += 25
            reasons.push('疑似签到刷币')
          }
        }

        return {
          ...device,
          accountCount,
          ipCount,
          suspiciousScore,
          reasons,
          isSuspicious: suspiciousScore >= 50,
        }
      })
    )

    // 按可疑分数排序
    analysisResults.sort((a, b) => b.suspiciousScore - a.suspiciousScore)

    return NextResponse.json({
      data: analysisResults,
      summary: {
        total: analysisResults.length,
        suspicious: analysisResults.filter((d: any) => d.isSuspicious).length,
        highRisk: analysisResults.filter((d: any) => d.suspiciousScore >= 80).length,
      },
    })
  } catch (error) {
    console.error('检测可疑设备失败:', error)
    return NextResponse.json(
      { error: '检测可疑设备失败' },
      { status: 500 }
    )
  }
}

// 批量标记设备状态
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { deviceIds, isSuspicious, reason } = await request.json()

    // 批量更新设备状态
    await prisma.userDevice.updateMany({
      where: {
        id: {
          in: deviceIds,
        },
      },
      data: {
        isSuspicious,
      },
    })

    // 记录安全事件
    if (isSuspicious) {
      await prisma.securityThreat.createMany({
        data: deviceIds.map((deviceId: string) => ({
          userId: '', // 这里需要根据deviceId查询userId
          type: 'DEVICE_BATCH_MARKED_SUSPICIOUS',
          severity: 'HIGH',
          description: `批量标记可疑设备: ${reason}`,
          metadata: {
            deviceIds,
            reason,
          },
        })),
      })
    }

    return NextResponse.json({ success: true, count: deviceIds.length })
  } catch (error) {
    console.error('批量更新设备状态失败:', error)
    return NextResponse.json(
      { error: '批量更新设备状态失败' },
      { status: 500 }
    )
  }
}
