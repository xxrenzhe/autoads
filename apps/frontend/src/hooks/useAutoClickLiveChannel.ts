'use client';

import { useEffect, useState } from 'react';

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

  useEffect(() => {
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
      es.onerror = () => { setConnected(false); setError('连接中断'); try { es?.close() } catch {} setTimeout(() => { /* auto reconnect by effect rerun */ }, 3000) }
    } catch (e:any) { setError(String(e?.message || e)); setConnected(false) }
    return () => { try { es?.close() } catch {} }
  }, [filter?.userId, filter?.scheduleId, filter?.executionId])

  return { events, connected, error }
}

