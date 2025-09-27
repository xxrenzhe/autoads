"use client";

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AdminDashboardLayout } from '@/components/layout/DashboardLayout';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';

type Row = { date: string; total: number; success: number; fail: number };

// 避免在构建期对该页面进行静态预渲染（包含仅客户端图表组件）
export const dynamic = 'force-dynamic';

export default function AutoClickHistoryPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [userId, setUserId] = useState('')
  const [scheduleId, setScheduleId] = useState('')

  async function load() {
    setLoading(true)
    const params = new URLSearchParams({ days: String(days) })
    if (userId) params.set('userId', userId)
    if (scheduleId) params.set('scheduleId', scheduleId)
    try {
      const res = await fetch(`/ops/api/v1/console/autoclick/history?${params}`)
      const data = await res.json()
      const arr = (data?.data || []) as any[]
      const mapped: Row[] = arr.map(it => ({ date: it.date, total: it.total, success: it.success, fail: it.fail }))
      setRows(mapped)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <AdminDashboardLayout title="AutoClick 历史统计" description="最近30天每日执行汇总">
      <div className="space-y-4">
        <div className={`${UI_CONSTANTS.cards.simple} p-4 grid grid-cols-1 md:grid-cols-4 gap-3`}>
          <input className="border rounded px-3 py-2" placeholder="用户ID（可选）" value={userId} onChange={e => setUserId(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="计划ID（可选）" value={scheduleId} onChange={e => setScheduleId(e.target.value)} />
          <select className="border rounded px-3 py-2" value={days} onChange={e => setDays(Number(e.target.value))}>
            <option value={7}>7天</option>
            <option value={14}>14天</option>
            <option value={30}>30天</option>
          </select>
          <div className="flex gap-2">
            <button className={UI_CONSTANTS.buttons.primary} onClick={load}>查询</button>
          </div>
        </div>

        <div className={`${UI_CONSTANTS.cards.simple} p-4 h-[320px]`}>
          {loading ? (
            <div className="text-gray-500">加载中...</div>
          ) : rows.length === 0 ? (
            <div className="text-gray-500">暂无数据</div>
          ) : (
            <SSRFreeChart data={rows} />
          )}
        </div>

        <div className={`${UI_CONSTANTS.cards.simple} p-0 overflow-hidden`}>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">日期</th>
                <th className="px-3 py-2 text-right">总数</th>
                <th className="px-3 py-2 text-right">成功</th>
                <th className="px-3 py-2 text-right">失败</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.date} className="border-t">
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2 text-right">{r.total}</td>
                  <td className="px-3 py-2 text-right">{r.success}</td>
                  <td className="px-3 py-2 text-right">{r.fail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminDashboardLayout>
  );
}

// 动态加载图表，禁用SSR以避免构建期Recharts在SSR环境的问题
const SSRFreeChart = dynamic(
  () => import('./ssr-free-chart').then(m => m.SSRFreeChart),
  { ssr: false }
);
