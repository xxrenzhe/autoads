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

      // 初始事件
      send({ type: 'connected', userId })

      // Redis 订阅
      const channel = 'adscenter:executions:updates'
      const redis = getRedisClient()
      const onMessage = (ch: string, message: string) => {
        try {
          if (ch !== channel) return
          const payload = JSON.parse(message)
          if (payload?.userId === userId) {
            send({ type: 'execution_update', ...payload })
          }
        } catch {}
      }
      try {
        await redis.subscribe(channel)
        if (redis.on) redis.on('message', onMessage)
      } catch {}

      const abort = () => {
        try {
          if (redis.off) redis.off('message', onMessage)
          if (redis.unsubscribe) redis.unsubscribe(channel)
        } catch {}
        controller.close()
      }
      // @ts-ignore
      request.signal?.addEventListener?.('abort', abort)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  })
}

