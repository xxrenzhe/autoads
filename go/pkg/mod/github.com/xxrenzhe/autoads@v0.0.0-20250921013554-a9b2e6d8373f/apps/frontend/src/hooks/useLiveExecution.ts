'use client';

import { useEffect, useRef, useState } from 'react'

export type ExecutionUpdate = {
  type: 'execution_update'
  id: string
  feature?: 'batchopen' | 'autoclick' | 'adscenter' | string
  status: 'pending'|'running'|'completed'|'failed'|'cancelled'|string
  progress?: number
  processedItems?: number
  totalItems?: number
  ts?: number
  [k: string]: any
}

export function useLiveExecution(taskId?: string) {
  const [event, setEvent] = useState<ExecutionUpdate | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastKeyRef = useRef<string>("")

  useEffect(() => {
    // 清理轮询
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (!taskId) return
    const url = `/api/v2/stream/tasks/${encodeURIComponent(taskId)}`
    let es: EventSource | null = null
    try {
      es = new EventSource(url)
      es.onopen = () => { setConnected(true); setError(null) }
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          const key = `${data?.id}:${data?.progress}`
          if (key !== lastKeyRef.current) { lastKeyRef.current = key; setEvent(data) }
        } catch {}
      }
      es.onerror = () => {
        setConnected(false)
        setError('SSE 连接中断，切换轮询')
        try { es?.close() } catch {}
        // 降级轮询
        const poll = async () => {
          try {
            const resp = await fetch(`/api/v2/tasks/${encodeURIComponent(taskId)}`, { headers: { 'accept': 'application/json' } })
            if (!resp.ok) return
            const data = await resp.json()
            const key = `${data?.id}:${data?.progress}`
            if (key !== lastKeyRef.current) { lastKeyRef.current = key; setEvent(data) }
          } catch {}
        }
        pollRef.current = setInterval(poll, 3000)
        poll()
      }
    } catch (e: any) {
      setError(String(e?.message || e))
      setConnected(false)
    }
    return () => { try { es?.close() } catch {} }
  }, [taskId])

  useEffect(() => () => { if (pollRef.current) { clearInterval(pollRef.current) } }, [])

  return { event, connected, error }
}

