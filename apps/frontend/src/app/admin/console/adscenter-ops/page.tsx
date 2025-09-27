"use client"

import { useState } from 'react'

type DeadLetter = { id: number; action_idx: number; action_type: string; error?: string }

export default function AdminAdscenterOps() {
  const [opId, setOpId] = useState('')
  const [loading, setLoading] = useState(false)
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [aggregate, setAggregate] = useState<any | null>(null)
  const [deadletters, setDeadletters] = useState<DeadLetter[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [filterActionType, setFilterActionType] = useState('')
  const [limit, setLimit] = useState(100)

  async function loadAll() {
    if (!opId) return
    setLoading(true); setMsg(null)
    try {
      const qs = new URLSearchParams()
      if (filterActionType.trim()) qs.set('actionType', filterActionType.trim())
      if (limit > 0) qs.set('limit', String(limit))
      const dlUrl = `/api/v1/console/adscenter/bulk-actions/deadletters?id=${encodeURIComponent(opId)}${qs.toString()?`&${qs.toString()}`:''}`
      const [s, a, d] = await Promise.all([
        fetch(`/api/v1/console/adscenter/bulk-actions/snapshots?id=${encodeURIComponent(opId)}`, { cache: 'no-store' }).then(r=>r.json()),
        fetch(`/api/v1/console/adscenter/bulk-actions/snapshot-aggregate?id=${encodeURIComponent(opId)}`, { cache: 'no-store' }).then(r=>r.json()),
        fetch(dlUrl, { cache: 'no-store' }).then(r=>r.json())
      ])
      setSnapshots(Array.isArray(s?.items) ? s.items : [])
      setAggregate(a || null)
      setDeadletters(Array.isArray(d?.items) ? d.items : [])
    } catch (e: any) {
      setMsg(`加载失败: ${e?.message || e}`)
    } finally { setLoading(false) }
  }

  async function retryOne(dlid: number) {
    setLoading(true); setMsg(null)
    try {
      const r = await fetch(`/api/v1/console/adscenter/bulk-actions/deadletters/retry`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: opId, dlid: String(dlid) }) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setMsg('已触发重试')
      await loadAll()
    } catch (e: any) { setMsg(`重试失败: ${e?.message || e}`) } finally { setLoading(false) }
  }

  async function retryBatch(actionType?: string, limit?: number) {
    setLoading(true); setMsg(null)
    try {
      const r = await fetch(`/api/v1/console/adscenter/bulk-actions/deadletters/retry-batch`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: opId, actionType, limit }) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setMsg('批量重试已触发')
      await loadAll()
    } catch (e: any) { setMsg(`批量重试失败: ${e?.message || e}`) } finally { setLoading(false) }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Adscenter 批量操作审计/重试</h1>
      <div className="flex items-center gap-3">
        <input value={opId} onChange={(e)=>setOpId(e.target.value)} placeholder="输入 operationId" className="px-3 py-1.5 border rounded w-[360px]" />
        <input value={filterActionType} onChange={(e)=>setFilterActionType(e.target.value)} placeholder="筛选 ActionType（可选）" className="px-3 py-1.5 border rounded w-[220px]" />
        <input type="number" min={1} max={500} value={limit} onChange={(e)=>setLimit(Number(e.target.value)||100)} placeholder="Limit" className="px-3 py-1.5 border rounded w-[100px]" />
        <button disabled={!opId||loading} onClick={loadAll} className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200">加载</button>
        <button disabled={!opId||loading} onClick={()=>{ if (confirm(`确认批量重试？limit=${limit}${filterActionType?`, actionType=${filterActionType}`:''}`)) retryBatch(filterActionType||undefined, limit||20) }} className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">批量重试</button>
        {loading && <span className="text-gray-500 text-sm">处理中...</span>}
      </div>
      {msg && <div className="text-sm text-gray-700">{msg}</div>}

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">聚合快照</h2>
        <pre className="p-3 text-sm bg-gray-50 border rounded overflow-auto">{JSON.stringify(aggregate || {}, null, 2)}</pre>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">执行快照（最近）</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {snapshots.slice(0, 20).map((it, idx) => (
            <pre key={idx} className="p-3 text-xs bg-gray-50 border rounded overflow-auto">{JSON.stringify(it, null, 2)}</pre>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">死信列表</h2>
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2 border">ID</th>
              <th className="p-2 border">ActionIdx</th>
              <th className="p-2 border">Type</th>
              <th className="p-2 border">Error</th>
              <th className="p-2 border">操作</th>
            </tr>
          </thead>
          <tbody>
            {deadletters.map(dl => (
              <tr key={dl.id}>
                <td className="p-2 border">{dl.id}</td>
                <td className="p-2 border">{dl.action_idx}</td>
                <td className="p-2 border">{dl.action_type}</td>
                <td className="p-2 border">{dl.error}</td>
                <td className="p-2 border"><button disabled={loading} onClick={()=>retryOne(dl.id)} className="px-2 py-1 rounded bg-blue-600 text-white">重试</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
