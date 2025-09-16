"use client";

import React, { useMemo, useRef } from 'react';
import { AdminDashboardLayout } from '@/components/layout/DashboardLayout';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';
import { useAdminAutoClickQueueState } from '@/lib/hooks/admin/useAdminAutoClickQueueState';

export default function AutoClickQueuePage() {
  const { data, loading, error, refresh } = useAdminAutoClickQueueState({ refreshMs: 5000 })
  const historyRef = useRef<{ ts: number; http: number; br: number; }[]>([])
  if (data) {
    const now = Date.now()
    historyRef.current.push({ ts: now, http: data.httpQueue, br: data.browserQueue })
    // 仅保留最近 60 个点（约 5 分钟）
    if (historyRef.current.length > 60) historyRef.current.shift()
  }

  const httpPressure = useMemo(() => {
    if (!data) return 0
    const w = Math.max(1, data.httpWorkers)
    return Math.round((data.httpQueue / (w * 3)) * 100)
  }, [data])
  const brPressure = useMemo(() => {
    if (!data) return 0
    const w = Math.max(1, data.browserWorkers)
    return Math.round((data.browserQueue / (w * 2)) * 100)
  }, [data])

  return (
    <AdminDashboardLayout title="AutoClick 队列面板" description="实时查看长期池队列与并发状况">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">每 5 秒自动刷新</div>
          <button className={UI_CONSTANTS.buttons.outline} onClick={refresh}>手动刷新</button>
        </div>

        {loading ? (
          <div className={`${UI_CONSTANTS.cards.simple} p-6 text-gray-600`}>加载中...</div>
        ) : error ? (
          <div className={`${UI_CONSTANTS.cards.simple} p-6 text-red-600`}>加载失败：{error}</div>
        ) : (
          <>
            {/* 概览卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={`${UI_CONSTANTS.cards.simple} p-4`}>
                <div className="text-xs text-gray-500">HTTP 队列</div>
                <div className="text-2xl font-semibold">{data?.httpQueue ?? 0}</div>
              </div>
              <div className={`${UI_CONSTANTS.cards.simple} p-4`}>
                <div className="text-xs text-gray-500">HTTP Workers</div>
                <div className="text-2xl font-semibold">{data?.httpWorkers ?? 0}</div>
              </div>
              <div className={`${UI_CONSTANTS.cards.simple} p-4`}>
                <div className="text-xs text-gray-500">Browser 队列</div>
                <div className="text-2xl font-semibold">{data?.browserQueue ?? 0}</div>
              </div>
              <div className={`${UI_CONSTANTS.cards.simple} p-4`}>
                <div className="text-xs text-gray-500">Browser Workers</div>
                <div className="text-2xl font-semibold">{data?.browserWorkers ?? 0}</div>
              </div>
            </div>

            {/* 轻量趋势（近 5 分钟） */}
            <div className={`${UI_CONSTANTS.cards.simple} p-4`}>
              <div className="text-sm font-medium text-gray-900 mb-2">近 5 分钟队列趋势（HTTP / Browser）</div>
              <div className="h-24 relative">
                {/* 简易迷你图：用 div 高度模拟折线（避免引入图表负担） */}
                <MiniSparkline points={historyRef.current.map(p => ({ http: p.http, br: p.br }))} />
              </div>
            </div>

            {/* 预警 */}
            {(httpPressure > 100 || brPressure > 100) && (
              <div className={`${UI_CONSTANTS.cards.simple} p-4 border-red-300 bg-red-50`}>
                <div className="text-sm font-medium text-red-700">队列积压预警</div>
                <div className="text-sm text-red-600 mt-1">
                  {httpPressure > 100 && <span className="mr-4">HTTP 队列压力 {httpPressure}%（建议调高 AutoClick_HTTP_Concurrency 或降低推进速率）</span>}
                  {brPressure > 100 && <span>Browser 队列压力 {brPressure}%（建议调高 AutoClick_Browser_Concurrency 或优先 HTTP）</span>}
                </div>
              </div>
            )}

            {/* 跳转到系统配置与问题URL */}
            <div className="flex items-center gap-2">
              <a href="/admin/system/autoclick" className={UI_CONSTANTS.buttons.outline}>调整并发配置</a>
              <a href="/admin/autoclick/problem-urls" className={UI_CONSTANTS.buttons.outline}>查看问题 URL</a>
            </div>
          </>
        )}
      </div>
    </AdminDashboardLayout>
  )
}

function MiniSparkline({ points }: { points: { http: number; br: number; }[] }) {
  // 渲染非常简化的双折线：用绝对定位的小段 div 表示
  const maxVal = Math.max(1, ...points.map(p => Math.max(p.http, p.br)))
  const width = 560
  const height = 96
  const leftPad = 4
  const topPad = 4
  const step = points.length > 1 ? (width - leftPad * 2) / (points.length - 1) : width
  return (
    <div className="w-full h-24 relative">
      {/* HTTP 线（蓝色） */}
      {points.map((p, i) => {
        if (i === 0) return null
        const x1 = leftPad + (i - 1) * step
        const x2 = leftPad + i * step
        const y1 = topPad + (height - topPad * 2) * (1 - (points[i - 1].http / maxVal))
        const y2 = topPad + (height - topPad * 2) * (1 - (p.http / maxVal))
        const style: React.CSSProperties = {
          position: 'absolute',
          left: Math.min(x1, x2),
          top: Math.min(y1, y2),
          width: Math.max(2, Math.abs(x2 - x1)),
          height: Math.max(2, Math.abs(y2 - y1)),
          background: 'linear-gradient(90deg, rgba(59,130,246,0.8), rgba(37,99,235,0.8))',
          opacity: 0.8,
        }
        return <div key={`h-${i}`} style={style} />
      })}
      {/* Browser 线（紫色） */}
      {points.map((p, i) => {
        if (i === 0) return null
        const x1 = leftPad + (i - 1) * step
        const x2 = leftPad + i * step
        const y1 = topPad + (height - topPad * 2) * (1 - (points[i - 1].br / maxVal))
        const y2 = topPad + (height - topPad * 2) * (1 - (p.br / maxVal))
        const style: React.CSSProperties = {
          position: 'absolute',
          left: Math.min(x1, x2),
          top: Math.min(y1, y2),
          width: Math.max(2, Math.abs(x2 - x1)),
          height: Math.max(2, Math.abs(y2 - y1)),
          background: 'linear-gradient(90deg, rgba(168,85,247,0.8), rgba(147,51,234,0.8))',
          opacity: 0.7,
        }
        return <div key={`b-${i}`} style={style} />
      })}
    </div>
  )
}

