import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRedisClient } from '@/lib/cache/redis-client'

export const runtime = 'nodejs'

function unauthorized(msg: string) {
  return NextResponse.json({ success: false, error: msg }, { status: 401 })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // 简单的内部鉴权（共享密钥），来自环境变量 INTERNAL_API_TOKEN
  const token = req.headers.get('x-internal-token')
  const expected = process.env.INTERNAL_API_TOKEN
  if (!expected || !token || token !== expected) {
    return unauthorized('Invalid internal token')
  }

  const body = await req.json().catch(() => ({})) as any

  const updates: any = {}
  if (typeof body.status === 'string') updates.status = body.status
  if (typeof body.progress === 'number') updates.progress = Math.max(0, Math.min(100, Math.floor(body.progress)))
  if (typeof body.totalItems === 'number') updates.totalItems = Math.max(0, Math.floor(body.totalItems))
  if (typeof body.processedItems === 'number') updates.processedItems = Math.max(0, Math.floor(body.processedItems))
  if (body.startedAt) updates.startedAt = new Date(body.startedAt)
  if (body.completedAt) updates.completedAt = new Date(body.completedAt)
  const userId: string | undefined = body.userId

  try {
    // 更新规范化表（不校验用户，内部接口通过 userId 指定归属以推送 SSE）
    const exists = await prisma.adsExecution.findFirst({ where: { id: params.id } })
    if (exists) {
      await prisma.adsExecution.update({ where: { id: params.id }, data: updates })
    }

    // 发布通知（需 userId 用于下发到对应用户）
    if (userId) {
      try {
        const redis = getRedisClient()
        await redis.publish('adscenter:executions:updates', JSON.stringify({
          userId,
          id: params.id,
          status: updates.status,
          progress: updates.progress,
          totalItems: updates.totalItems,
          processedItems: updates.processedItems,
          startedAt: updates.startedAt?.toISOString?.(),
          completedAt: updates.completedAt?.toISOString?.()
        }))
      } catch {}
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Failed to update execution' }, { status: 500 })
  }
}

