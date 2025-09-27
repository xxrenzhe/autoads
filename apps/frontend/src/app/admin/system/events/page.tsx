'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type EventItem = {
  id: number
  eventId: string
  eventName: string
  aggregateType: string
  aggregateId: string
  occurredAt: string
}

export default function AdminSystemEventsPage() {
  const [items, setItems] = useState<EventItem[]>([])
  const [next, setNext] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  // filters
  const [type, setType] = useState<string>('')
  const [multiTypes, setMultiTypes] = useState<Record<string, boolean>>({})
  const [aggregateType, setAggregateType] = useState('')
  const [aggregateId, setAggregateId] = useState('')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  // columns
  const [cols, setCols] = useState<{ eventId: boolean; eventName: boolean; aggregateType: boolean; aggregateId: boolean; occurredAt: boolean }>({ eventId: true, eventName: true, aggregateType: true, aggregateId: true, occurredAt: true })

  const buildQS = (cursor?: string, limit = 50) => {
    const qs = new URLSearchParams({ limit: String(limit) })
    if (cursor) qs.set('cursor', cursor)
    // multi-types join by comma
    const picked = Object.entries(multiTypes).filter(([k,v])=>!!v).map(([k])=>k)
    if (picked.length > 0) qs.set('type', picked.join(','))
    else if (type) qs.set('type', type)
    if (aggregateType) qs.set('aggregateType', aggregateType)
    if (aggregateId) qs.set('aggregateId', aggregateId)
    if (since) qs.set('since', since)
    if (until) qs.set('until', until)
    return qs
  }

  const load = async (cursor?: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/ops/api/v1/console/events?${buildQS(cursor).toString()}`, { headers: { 'accept': 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setItems(prev => cursor ? [...prev, ...(data.items || [])] : (data.items || []))
      setNext(data.next || '')
    } catch (e) {
      // noop
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  // load event types for dropdown
  const [types, setTypes] = useState<{ name: string; count: number }[]>([])
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/ops/api/v1/console/events/types', { headers: { 'accept': 'application/json' } })
        const j = await r.json()
        setTypes(Array.isArray(j?.items) ? j.items : [])
      } catch { /* noop */ }
    })()
  }, [])

  // persist filters in localStorage
  useEffect(() => {
    try {
      const data = { type, multiTypes, aggregateType, aggregateId, since, until }
      localStorage.setItem('events.filters', JSON.stringify(data))
    } catch {}
  }, [type, multiTypes, aggregateType, aggregateId, since, until])
  useEffect(() => {
    try { localStorage.setItem('events.export.cols', JSON.stringify(cols)) } catch {}
  }, [cols])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('events.filters')
      if (raw) {
        const d = JSON.parse(raw)
        if (typeof d.type === 'string') setType(d.type)
        if (d.multiTypes && typeof d.multiTypes === 'object') setMultiTypes(d.multiTypes)
        if (typeof d.aggregateType === 'string') setAggregateType(d.aggregateType)
        if (typeof d.aggregateId === 'string') setAggregateId(d.aggregateId)
        if (typeof d.since === 'string') setSince(d.since)
        if (typeof d.until === 'string') setUntil(d.until)
      }
      const rawCols = localStorage.getItem('events.export.cols')
      if (rawCols) {
        const c = JSON.parse(rawCols)
        if (c && typeof c === 'object') setCols({ ...{ eventId: true, eventName: true, aggregateType: true, aggregateId: true, occurredAt: true }, ...c })
      }
    } catch {}
  }, [])

  const doExport = async (format: 'ndjson' | 'csv' = 'ndjson') => {
    try {
      setExporting(true)
      if (format === 'csv') {
        // client-side CSV respecting selected columns
        const qs = buildQS(undefined, 1000)
        const url = `/ops/api/v1/console/events?${qs.toString()}`
        const res = await fetch(url, { headers: { 'accept': 'application/json' } })
        const j = await res.json()
        const items = Array.isArray(j?.items) ? j.items : []
        const headers: string[] = []
        if (cols.eventId) headers.push('eventId')
        if (cols.eventName) headers.push('eventName')
        if (cols.aggregateType) headers.push('aggregateType')
        if (cols.aggregateId) headers.push('aggregateId')
        if (cols.occurredAt) headers.push('occurredAt')
        const lines: string[] = []
        lines.push(headers.join(','))
        const esc = (s: any) => {
          const v = String(s ?? '')
          if (v.includes(',') || v.includes('\n') || v.includes('"')) return '"'+v.replace(/"/g,'""')+'"'
          return v
        }
        for (const it of items) {
          const row: string[] = []
          if (cols.eventId) row.push(esc(it.eventId))
          if (cols.eventName) row.push(esc(it.eventName))
          if (cols.aggregateType) row.push(esc(it.aggregateType))
          if (cols.aggregateId) row.push(esc(it.aggregateId))
          if (cols.occurredAt) row.push(esc(it.occurredAt))
          lines.push(row.join(','))
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'events.csv'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } else {
        const qs = buildQS(undefined, 1000)
        qs.set('format', 'ndjson')
        const url = `/ops/api/v1/console/events/export?${qs.toString()}`
        const a = document.createElement('a')
        a.href = url
        a.download = 'events.ndjson'
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } finally { setExporting(false) }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">系统事件</h1>
      <Card>
        <CardHeader>
          <CardTitle>最近事件列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
            <div className="border rounded p-2">
              <div className="text-xs text-muted-foreground mb-1">类型（可多选）</div>
              <div className="max-h-36 overflow-auto space-y-1">
                <label className="block text-xs"><input type="radio" name="type_mode" defaultChecked onChange={()=>setMultiTypes({})} /> 单选</label>
                <select className="border rounded px-2 py-1 w-full mb-2" value={type} onChange={e=>setType(e.target.value)}>
                  <option value="">全部</option>
                  {types.map(t => (
                    <option key={t.name} value={t.name}>{t.name} ({t.count})</option>
                  ))}
                </select>
                <label className="block text-xs"><input type="radio" name="type_mode" onChange={()=>setType('')} /> 多选</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                  {types.map(t => (
                    <label key={t.name} className="text-xs flex items-center gap-1">
                      <input type="checkbox" checked={!!multiTypes[t.name]} onChange={e=>setMultiTypes(m=>({ ...m, [t.name]: e.target.checked }))} />{t.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <input className="border rounded px-2 py-1" placeholder="aggregateType" value={aggregateType} onChange={e=>setAggregateType(e.target.value)} />
            <input className="border rounded px-2 py-1" placeholder="aggregateId" value={aggregateId} onChange={e=>setAggregateId(e.target.value)} />
            <input type="datetime-local" className="border rounded px-2 py-1" value={since} onChange={e=>setSince(e.target.value)} />
            <input type="datetime-local" className="border rounded px-2 py-1" value={until} onChange={e=>setUntil(e.target.value)} />
            <div className="md:col-span-5 flex items-center gap-2">
              <Button variant="outline" onClick={()=>load()}>筛选</Button>
              <Button variant="outline" onClick={()=>{ setType(''); setAggregateType(''); setAggregateId(''); setSince(''); setUntil(''); load(); }}>重置</Button>
            </div>
          </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">时间</th>
                  <th className="py-2 pr-4">类型</th>
                  <th className="py-2 pr-4">聚合</th>
                  <th className="py-2 pr-4">聚合ID</th>
                  <th className="py-2 pr-4">事件ID</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={`${it.id}`} className="border-b hover:bg-gray-50">
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(it.occurredAt).toLocaleString()}</td>
                    <td className="py-2 pr-4">{it.eventName}</td>
                    <td className="py-2 pr-4">{it.aggregateType || '-'}</td>
                    <td className="py-2 pr-4">{it.aggregateId || '-'}</td>
                    <td className="py-2 pr-4">{it.eventId}</td>
                  </tr>
                ))}
                {items.length === 0 && !loading && (
                  <tr><td className="py-4 text-muted-foreground" colSpan={5}>暂无数据</td></tr>
                )}
              </tbody>
            </table>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Button onClick={() => load()} variant="outline" disabled={loading}>刷新</Button>
        <Button onClick={() => load(next)} disabled={!next || loading}>加载更多</Button>
        <Button onClick={()=>doExport('ndjson')} disabled={exporting}>导出 NDJSON</Button>
        <Button onClick={()=>doExport('csv')} variant="outline" disabled={exporting}>导出 CSV</Button>
        <span className="text-xs text-muted-foreground ml-2">快捷：
          <button className="ml-2 underline" onClick={()=>{ const d = new Date(); const until = d.toISOString(); const since = new Date(Date.now()-24*3600*1000).toISOString(); setSince(since); setUntil(until); load(); }}>近24小时</button>
          <button className="ml-2 underline" onClick={()=>{ const d = new Date(); const until = d.toISOString(); const since = new Date(Date.now()-7*24*3600*1000).toISOString(); setSince(since); setUntil(until); load(); }}>近7天</button>
        </span>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        导出列：
        <label className="ml-2"><input type="checkbox" checked={cols.eventId} onChange={e=>setCols(c=>({ ...c, eventId: e.target.checked }))}/> eventId</label>
        <label className="ml-2"><input type="checkbox" checked={cols.eventName} onChange={e=>setCols(c=>({ ...c, eventName: e.target.checked }))}/> eventName</label>
        <label className="ml-2"><input type="checkbox" checked={cols.aggregateType} onChange={e=>setCols(c=>({ ...c, aggregateType: e.target.checked }))}/> aggregateType</label>
        <label className="ml-2"><input type="checkbox" checked={cols.aggregateId} onChange={e=>setCols(c=>({ ...c, aggregateId: e.target.checked }))}/> aggregateId</label>
        <label className="ml-2"><input type="checkbox" checked={cols.occurredAt} onChange={e=>setCols(c=>({ ...c, occurredAt: e.target.checked }))}/> occurredAt</label>
      </div>
        </CardContent>
      </Card>
    </div>
  )
}
