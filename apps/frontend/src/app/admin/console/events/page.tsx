"use client"

import { useEffect, useState } from 'react'

type EventItem = {
  id: number
  eventId: string
  eventName: string
  aggregateType: string
  aggregateId: string
  occurredAt: string
  payload: string
}

export default function AdminConsoleEvents() {
  const [items, setItems] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(false)
  const [eventName, setEventName] = useState('')
  const [aggregateType, setAggregateType] = useState('')
  const [aggregateId, setAggregateId] = useState('')
  const [sinceHours, setSinceHours] = useState(24)
  const [limit, setLimit] = useState(100)
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<EventItem | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setLoading(true); setMessage(null)
    try {
      const qs = new URLSearchParams()
      if (eventName.trim()) qs.set('eventName', eventName.trim())
      if (aggregateType.trim()) qs.set('aggregateType', aggregateType.trim())
      if (aggregateId.trim()) qs.set('aggregateId', aggregateId.trim())
      if (sinceHours > 0) qs.set('sinceHours', String(sinceHours))
      if (limit > 0) qs.set('limit', String(limit))
      if (offset > 0) qs.set('offset', String(offset))
      const r = await fetch(`/api/v1/console/events?${qs.toString()}`, { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch (e: any) { setMessage(e?.message || '加载失败') } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">事件存储（最新）</h1>
      <div className="flex flex-wrap items-center gap-2">
        <input value={eventName} onChange={(e)=>setEventName(e.target.value)} placeholder="eventName" className="px-2 py-1 border rounded" />
        <input value={aggregateType} onChange={(e)=>setAggregateType(e.target.value)} placeholder="aggregateType" className="px-2 py-1 border rounded" />
        <input value={aggregateId} onChange={(e)=>setAggregateId(e.target.value)} placeholder="aggregateId" className="px-2 py-1 border rounded" />
        <input type="number" min={1} max={2160} value={sinceHours} onChange={(e)=>setSinceHours(Number(e.target.value)||24)} placeholder="sinceHours" className="px-2 py-1 border rounded w-[120px]" />
        <input type="number" min={1} max={500} value={limit} onChange={(e)=>setLimit(Number(e.target.value)||100)} placeholder="limit" className="px-2 py-1 border rounded w-[100px]" />
        <input type="number" min={0} value={offset} onChange={(e)=>setOffset(Number(e.target.value)||0)} placeholder="offset" className="px-2 py-1 border rounded w-[100px]" />
        <button disabled={loading} onClick={load} className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200">刷新</button>
        <button disabled={loading} onClick={() => {
          const qs = new URLSearchParams()
          if (eventName.trim()) qs.set('eventName', eventName.trim())
          if (aggregateType.trim()) qs.set('aggregateType', aggregateType.trim())
          if (aggregateId.trim()) qs.set('aggregateId', aggregateId.trim())
          if (sinceHours > 0) qs.set('sinceHours', String(sinceHours))
          if (limit > 0) qs.set('limit', String(limit))
          if (offset > 0) qs.set('offset', String(offset))
          window.open(`/api/v1/console/events/export?${qs.toString()}`, '_blank')
        }} className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">导出CSV</button>
      </div>
      {message && <div className="text-sm text-red-600">{message}</div>}
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border">Time</th>
              <th className="p-2 border">Event</th>
              <th className="p-2 border">Aggregate</th>
              <th className="p-2 border">EventID</th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it)=> (
              <tr key={it.id} className="hover:bg-gray-50">
                <td className="p-2 border whitespace-nowrap">{it.occurredAt}</td>
                <td className="p-2 border">{it.eventName}</td>
                <td className="p-2 border">{it.aggregateType}/{it.aggregateId}</td>
                <td className="p-2 border">{it.eventId}</td>
                <td className="p-2 border"><button className="px-2 py-1 rounded bg-blue-600 text-white" onClick={()=>setSelected(it)}>详情</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={loading || offset<=0} onClick={()=>{ setOffset(Math.max(0, offset - limit)); setTimeout(load, 0) }} className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200">上一页</button>
        <button disabled={loading || items.length<limit} onClick={()=>{ setOffset(offset + limit); setTimeout(load, 0) }} className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200">下一页</button>
        <span className="text-xs text-gray-600">offset={offset} limit={limit}</span>
      </div>
      {selected && (
        <div className="border rounded p-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">事件详情 #{selected.id}</h2>
            <button className="px-2 py-1 rounded bg-gray-200" onClick={()=>setSelected(null)}>关闭</button>
          </div>
          <pre className="text-xs overflow-auto mt-2">{JSON.stringify(selected, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
