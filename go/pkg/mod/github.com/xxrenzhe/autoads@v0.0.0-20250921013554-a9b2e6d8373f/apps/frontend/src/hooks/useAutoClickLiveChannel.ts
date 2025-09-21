'use client';

import { useEffect, useRef, useState } from 'react';

export interface LiveEvent {
  type: string;
  id?: string;
  scheduleId?: string;
  status?: string;
  progress?: number;
  processedItems?: number;
  totalItems?: number;
  timestamp?: number;
  [k: string]: any;
}

export function useAutoClickLiveChannel(filter?: { userId?: string; scheduleId?: string; executionId?: string }) {
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastEventKeyRef = useRef<string | null>(null)

  useEffect(() => {
    // 清理任何遗留的轮询
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null }

    const params = new URLSearchParams()
    if (filter?.userId) params.set('userId', filter.userId)
    if (filter?.scheduleId) params.set('scheduleId', filter.scheduleId)
    if (filter?.executionId) params.set('executionId', filter.executionId)
    const url = `/api/autoclick/live${params.toString() ? `?${params.toString()}` : ''}`
    let es: EventSource | null = null
    try {
      es = new EventSource(url)
      es.onopen = () => { setConnected(true); setError(null) }
      es.onmessage = (ev) => {
        try { const data = JSON.parse(ev.data); setEvents(prev => [data, ...prev].slice(0, 200)) } catch {}
      }
      es.onerror = () => {
        setConnected(false); setError('连接中断')
        try { es?.close() } catch {}
        // 启动降级轮询：每 3 秒拉取一次快照
        if (!pollTimerRef.current) {
          const buildSnapshotUrl = () => `/api/autoclick/snapshot${params.toString() ? `?${params.toString()}` : ''}`
          const poll = async () => {
            try {
              const resp = await fetch(buildSnapshotUrl(), { headers: { 'Accept': 'application/json' } })
              if (!resp.ok) return
              const json = await resp.json()
              const data = json?.data
              if (data && typeof data === 'object') {
                // 去重：基于 id+progress 组合
                const key = `${data.id || ''}:${data.progress || 0}`
                if (lastEventKeyRef.current !== key) {
                  lastEventKeyRef.current = key
                  setEvents(prev => [data as LiveEvent, ...prev].slice(0, 200))
                }
              }
            } catch {}
          }
          pollTimerRef.current = setInterval(poll, 3000)
          // 立即触发一次
          poll()
        }
      }
    } catch (e:any) { setError(String(e?.message || e)); setConnected(false) }
    return () => { try { es?.close() } catch {} }
  }, [filter?.userId, filter?.scheduleId, filter?.executionId])

  // 卸载时清理轮询
  useEffect(() => {
    return () => { if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null } }
  }, [])

  return { events, connected, error }
}
