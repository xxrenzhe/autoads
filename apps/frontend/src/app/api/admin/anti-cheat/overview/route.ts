import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { subDays, startOfDay, endOfDay } from 'date-fns';

/**
 * GET /api/admin/anti-cheat/overview
 * Get anti-cheat overview statistics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    const startDate = startOfDay(subDays(new Date(), days));
    const endDate = endOfDay(new Date());

    // Get basic statistics
    const [
      totalUsers,
      newUsers,
      totalDevices,
      suspiciousDevices,
      totalCheckIns,
      shareRewards
    ] = await Promise.all([
      // Total users
      prisma.user.count({
        where: {
          status: 'ACTIVE'
        }
      }),
      
      // New users in the period
      prisma.user.count({
        where: {
          createdAt: {
            gte: startDate
          },
          status: 'ACTIVE'
        }
      }),
      
      // Total devices
      prisma.userDevice.count(),
      
      // Suspicious devices
      prisma.userDevice.count({
        where: {
          isSuspicious: true
        }
      }),
      
      // Total check-ins
      prisma.checkIn.count({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      
      // Share rewards claimed - TODO: implement share rewards feature
      // prisma.shareReward.count({
      //   where: {
      //     createdAt: {
      //       gte: startDate,
      //       lte: endDate
      //     }
      //   }
      // })
      0 // Placeholder until share rewards feature is implemented
    ]);

    // Get suspicious activities
    const suspiciousActivities = await prisma.userDevice.findMany({
      where: {
        OR: [
          // Multiple accounts per device
          {
            user: {
              devices: {
                some: {
                  userId: {
                    not: { equals: prisma.userDevice.fields.userId }
                  }
                }
              }
            }
          },
          // New accounts with high activity
          {
            user: {
              createdAt: {
                gte: startDate
              },
              checkIns: {
                some: {
                  date: {
                    gte: startDate
                  }
                }
              }
            }
          },
          // Marked as suspicious
          {
            isSuspicious: true
          }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
            tokenBalance: true,
            checkIns: {
              select: {
                id: true,
                date: true
              }
            }
          }
        }
      },
      orderBy: {
        lastSeenAt: 'desc'
      },
      take: 50
    });

    // Calculate suspicious scores
    const devicesWithScores = suspiciousActivities.map((device: any) => {
      let score = 0;
      const reasons: string[] = [];

      // Check for multiple accounts
      const accountCount = (device as any).user?.devices?.length || 1;
      if (accountCount > 1) {
        score += 30;
        reasons.push(`多账号 (${accountCount}个)`);
      }

      // Check if new account with check-ins
      const isNewAccount = new Date((device as any).user?.createdAt || 0) > startDate;
      const checkInCount = (device as any).user?.checkIns?.length || 0;
      if (isNewAccount && checkInCount > 0) {
        score += 20;
        reasons.push('新账号活跃');
      }

      // Check for suspicious behavior patterns
      if (device.isSuspicious) {
        score += 50;
        reasons.push('已标记可疑');
      }

      // High frequency check-ins (more than 3 in 24 hours)
      if (checkInCount > 3) {
        score += 15;
        reasons.push('高频签到');
      }

      return {
        ...device,
        suspiciousScore: score,
        reasons,
        accountCount,
        checkInCount
      };
    });

    // Get IP-based statistics
    const ipStats = await prisma.$queryRaw`
      SELECT 
        first_ip,
        COUNT(DISTINCT user_id) as user_count,
        COUNT(*) as device_count,
        MAX(last_seen_at) as last_seen
      FROM user_devices
      WHERE first_ip IS NOT NULL
      GROUP BY first_ip
      HAVING COUNT(DISTINCT user_id) > 1
      ORDER BY user_count DESC
      LIMIT 20
    ` as Array<{
      first_ip: string;
      user_count: number;
      device_count: number;
      last_seen: Date;
    }>;

    // Get platform distribution - TODO: implement share rewards feature
    const platformStats: any[] = []; // Placeholder until share rewards feature is implemented

    return NextResponse.json({
      overview: {
        totalUsers,
        newUsers,
        totalDevices,
        suspiciousDevices,
        suspiciousRate: totalDevices > 0 ? (suspiciousDevices / totalDevices * 100).toFixed(2) : 0,
        totalCheckIns,
        shareRewards,
        period: `${days}天`
      },
      suspiciousDevices: devicesWithScores,
      ipStats,
      platformStats,
      summary: {
        highRiskDevices: devicesWithScores.filter((d: any) => d.suspiciousScore >= 80).length,
        mediumRiskDevices: devicesWithScores.filter((d: any) => d.suspiciousScore >= 50 && d.suspiciousScore < 80).length,
        lowRiskDevices: devicesWithScores.filter((d: any) => d.suspiciousScore < 50).length
      }
    });
  } catch (error) {
    console.error('获取防作弊概览失败:', error);
    return NextResponse.json(
      { error: '获取防作弊概览失败' },
      { status: 500 }
    );
  }
}
