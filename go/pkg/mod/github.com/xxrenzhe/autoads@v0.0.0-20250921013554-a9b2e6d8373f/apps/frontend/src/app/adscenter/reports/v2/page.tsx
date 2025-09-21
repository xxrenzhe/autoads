"use client";

import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { UI_CONSTANTS } from '@/components/ui/ui-constants'

export default function ReportsV2() {
  const [summary, setSummary] = useState<any>(null)
  const [series, setSeries] = useState<any[]>([])
  const [top, setTop] = useState<any[]>([])
  useEffect(()=>{
    ;(async()=>{
      try {
        const [s, t, b] = await Promise.all([
          fetch('/api/v2/adscenter/analytics/summary').then(r=>r.json()),
          fetch('/api/v2/adscenter/analytics/timeseries').then(r=>r.json()),
          fetch('/api/v2/adscenter/analytics/breakdown').then(r=>r.json()),
        ])
        setSummary(s || {})
        setSeries(t?.series || [])
        setTop(b?.topAccounts || [])
      } catch {}
    })()
  },[])
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Card className="p-6">
        <div className="text-lg font-semibold mb-3">概览 KPI</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`${UI_CONSTANTS.cards.simple} p-4`}><div className="text-xs text-gray-500">执行任务</div><div className="text-2xl font-semibold">{summary?.tasks ?? 0}</div></div>
          <div className={`${UI_CONSTANTS.cards.simple} p-4`}><div className="text-xs text-gray-500">轮换次数</div><div className="text-2xl font-semibold">{summary?.rotations ?? 0}</div></div>
        </div>
      </Card>
      <Card className="p-6">
        <div className="text-lg font-semibold mb-3">近30天轮换时序</div>
        <div className="grid grid-cols-1 gap-2 text-sm text-gray-700">
          {series.map((p:any, i:number)=> <div key={i} className="flex justify-between border-b py-1"><span>{p.date}</span><span>{p.value}</span></div>)}
        </div>
      </Card>
      <Card className="p-6">
        <div className="text-lg font-semibold mb-3">账户 TopN</div>
        <div className="grid grid-cols-1 gap-2 text-sm text-gray-700">
          {top.map((p:any, i:number)=> <div key={i} className="flex justify-between border-b py-1"><span>{p.accountId}</span><span>{p.value}</span></div>)}
        </div>
      </Card>
    </div>
  )
}

