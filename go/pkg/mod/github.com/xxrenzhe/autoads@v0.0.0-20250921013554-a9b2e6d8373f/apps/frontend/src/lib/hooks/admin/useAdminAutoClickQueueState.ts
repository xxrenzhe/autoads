"use client";

import { useEffect, useRef, useState } from 'react';

export interface QueueState {
  httpQueue: number;
  httpWorkers: number;
  browserQueue: number;
  browserWorkers: number;
}

export function useAdminAutoClickQueueState({ refreshMs = 5000 }: { refreshMs?: number } = {}) {
  const [data, setData] = useState<QueueState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  async function load() {
    try {
      const res = await fetch('/ops/api/v1/console/autoclick/queue/state', { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const d: QueueState = json?.data || json
      setData({
        httpQueue: Number(d?.httpQueue || 0),
        httpWorkers: Number(d?.httpWorkers || 0),
        browserQueue: Number(d?.browserQueue || 0),
        browserWorkers: Number(d?.browserWorkers || 0),
      })
      setError(null)
    } catch (e: any) {
      setError(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(load, refreshMs)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [refreshMs])

  return { data, loading, error, refresh: load }
}

