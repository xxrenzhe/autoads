"use client";

import React from 'react'
import { useParams } from 'next/navigation'
import { useLiveExecution } from '@/hooks/useLiveExecution'
import { UI_CONSTANTS } from '@/components/ui/ui-constants'

export default function ExecutionV2Detail() {
  const params = useParams() as { id?: string }
  const id = (params?.id || '') as string
  const { event, connected, error } = useLiveExecution(id)
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className={UI_CONSTANTS.cards.default + ' p-6'}>
        <div className="text-lg font-semibold mb-2">统一进度（/api/v2/stream/tasks/{id}）</div>
        <div className="text-sm text-gray-600 mb-3">任务ID：{id}</div>
        <div className="text-sm mb-2">连接：{connected ? 'SSE已连接' : '未连接'} {error && <span className="text-red-600">{error}</span>}</div>
        <div className="text-sm">状态：{event?.status || 'unknown'}</div>
        <div className="text-sm">进度：{event?.progress ?? 0}%（{event?.processedItems ?? 0}/{event?.totalItems ?? 0}）</div>
        <div className="text-xs text-gray-500 mt-2">feature: {event?.feature || '-'}</div>
      </div>
    </div>
  )
}

