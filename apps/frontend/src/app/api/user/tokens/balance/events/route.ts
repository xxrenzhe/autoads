import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { getRedisClient } from '@/lib/cache/redis-client'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }
  const userId = session.user.id

  const stream = new ReadableStream({
    start: async (controller) => {
      const encoder = new TextEncoder()

      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // 初始事件（可选）
      send({ type: 'connected', userId })

      // 订阅Redis通道
      const channel = 'token:balance:updated'
      const redis = getRedisClient()
      const onMessage = (ch: string, message: string) => {
        try {
          if (ch !== channel) return
          const payload = JSON.parse(message)
          if (payload?.userId === userId) {
            send({ type: 'balance_updated', ...payload })
          }
        } catch {}
      }
      try {
        if (redis.subscribe) await redis.subscribe(channel)
        if (redis.on) redis.on('message', onMessage)
      } catch {}

      // 断开时清理
      const abort = () => {
        try {
          if (redis.off) redis.off('message', onMessage)
          if (redis.unsubscribe) redis.unsubscribe(channel)
        } catch {}
        controller.close()
      }
      // @ts-ignore - NextRequest doesn't expose signal type fully here
      request.signal?.addEventListener?.('abort', abort)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
