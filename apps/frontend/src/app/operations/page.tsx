"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, RefreshCw, Grid, Wand2, GitBranch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function OperationsHubPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<string>('adscenter');
  const queryTab = useMemo(() => (sp?.get('tab') || '').toLowerCase(), [sp]);
  useEffect(() => { if (queryTab === 'batchopen' || queryTab === 'adscenter') setTab(queryTab || 'adscenter'); }, [queryTab]);
  const onTabChange = (val: string) => {
    setTab(val);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', val);
    router.replace(url.pathname + '?' + url.searchParams.toString());
  };

  return (
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Operations</h1>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="adscenter">批量与诊断</TabsTrigger>
          <TabsTrigger value="batchopen">真实点击/仿真</TabsTrigger>
        </TabsList>

        <TabsContent value="adscenter">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Grid className="h-5 w-5 text-blue-600" /> 批量矩阵与诊断（Adscenter）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              以 Offer 为中心的一站式批量操作：预检、计划、验证、入队、执行与回滚。支持 ROTATE_LINK / ADJUST_CPC / AB 测试等。
            </p>
            <div className="flex items-center gap-3">
              <Link href="/adscenter">
                <Button><Wand2 className="h-4 w-4 mr-2" />进入 Adscenter</Button>
              </Link>
              <Link href="/adscenter/bulk-actions">
                <Button variant="outline">查看批量计划/执行历史</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 全局分片进度总览 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>全局分片进度（最近20个操作汇总）</CardTitle>
          </CardHeader>
          <CardContent>
            <GlobalShardOverview />
          </CardContent>
        </Card>

        {/* 最近执行历史（概览） */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>最近执行历史</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentBulkActions />
          </CardContent>
        </Card>

        {/* 失败分片快速定位 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>失败分片快速定位</CardTitle>
          </CardHeader>
          <CardContent>
            <FailedShardsQuickList />
          </CardContent>
        </Card>

        {/* 回滚历史汇总 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>回滚历史汇总（最近20个操作）</CardTitle>
          </CardHeader>
          <CardContent>
            <RollbackSummary />
          </CardContent>
        </Card>

        {/* 失败原因 Top K（基于动作审计） */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>失败原因 Top K（最近20个操作）</CardTitle>
          </CardHeader>
          <CardContent>
            <FailureTopK />
          </CardContent>
        </Card>

        {/* 失败原因 Top K（按实体类型维度） */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>失败原因 Top K（按实体类型维度）</CardTitle>
          </CardHeader>
          <CardContent>
            <FailureTopKByEntity />
          </CardContent>
        </Card>

        {/* 回滚趋势（近7天） */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>回滚趋势（近7天）</CardTitle>
          </CardHeader>
          <CardContent>
            <RollbackTrend7d />
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="batchopen">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-green-600" /> 真实点击 / 仿真（Batchopen）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              配置国家曲线、UA、Referer 与时区，进行落地可用性检测与点击仿真，支持失败重试与任务追踪。
            </p>
            <div className="flex items-center gap-3">
              <Link href="/batchopen">
                <Button variant="outline"><GitBranch className="h-4 w-4 mr-2" />打开 Batchopen</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-purple-600" /> 相关设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
            <li>换链接频控：在 Settings → 链接轮换 中调整频控与回退策略</li>
            <li>通知节流：在 Settings → 通知与预警 中配置节流/置信度与通道</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// 子组件：最近批量执行历史（简要列表）
function RecentBulkActions() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [shards, setShards] = useState<Record<string, { queued: number; running: number; completed: number; failed: number; total: number }>>({})
  const [loadingShard, setLoadingShard] = useState<Record<string, boolean>>({})
  const [auditOpen, setAuditOpen] = useState<Record<string, boolean>>({})
  const [auditLoading, setAuditLoading] = useState<Record<string, boolean>>({})
  const [auditData, setAuditData] = useState<Record<string, { count: number; latest: any[] }>>({})
  const load = async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/v1/adscenter/bulk-actions?limit=10', { headers: { 'accept': 'application/json' } })
      if (!resp.ok) throw new Error(String(resp.status))
      const j = await resp.json()
      setItems(Array.isArray(j.items) ? j.items : [])
    } catch { /* noop */ }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  if (loading && items.length === 0) return <div className="text-sm text-muted-foreground">加载中...</div>
  if (items.length === 0) return <div className="text-sm text-muted-foreground">暂无数据</div>
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead><tr className="text-left border-b"><th className="py-2 pr-4">ID</th><th className="py-2 pr-4">状态</th><th className="py-2 pr-4">创建时间</th><th className="py-2 pr-4">分片进度</th><th className="py-2 pr-4">动作审计</th><th className="py-2 pr-4">推进</th><th className="py-2 pr-4">查看</th></tr></thead>
        <tbody>
          {items.map((op: any, i: number) => (
            <tr key={(op.operationId||i)+''} className="border-b align-top">
              <td className="py-2 pr-4 whitespace-nowrap">{op.operationId}</td>
              <td className="py-2 pr-4 whitespace-nowrap">{op.status}</td>
              <td className="py-2 pr-4 whitespace-nowrap">{op.createdAt ? new Date(op.createdAt).toLocaleString() : ''}</td>
              <td className="py-2 pr-4">
                <button
                  className="px-2 py-0.5 border rounded text-xs"
                  onClick={async ()=>{
                    const id = op.operationId as string
                    setOpen(o=>({ ...o, [id]: !o[id] }))
                    if (!open[op.operationId]) {
                      setLoadingShard(m=>({ ...m, [id]: true }))
                      try {
                        const r = await fetch(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(id)}/shards`, { headers: { 'accept':'application/json' } })
                        const j = await r.json()
                        const list = Array.isArray(j?.items) ? j.items : (Array.isArray(j)? j: [])
                        const stat = { queued:0, running:0, completed:0, failed:0, total:0 }
                        for (const sh of list) {
                          const s = String(sh.status||'').toLowerCase()
                          if (s==='queued') stat.queued++
                          else if (s==='running') stat.running++
                          else if (s==='completed') stat.completed++
                          else if (s==='failed') stat.failed++
                          stat.total++
                        }
                        setShards(x=>({ ...x, [id]: stat }))
                      } catch { /* noop */ }
                      finally { setLoadingShard(m=>({ ...m, [id]: false })) }
                    }
                  }}
                >{open[op.operationId] ? '收起' : '查看'}</button>
                {open[op.operationId] && (
                  <div className="mt-2 text-xs text-gray-700">
                    {loadingShard[op.operationId] ? '加载中...' : (
                      shards[op.operationId] ? (
                        <div>
                          <span className="mr-2">总数：{shards[op.operationId].total}</span>
                          <span className="mr-2">排队：{shards[op.operationId].queued}</span>
                          <span className="mr-2">运行：{shards[op.operationId].running}</span>
                          <span className="mr-2">完成：{shards[op.operationId].completed}</span>
                          <span className="mr-2">失败：{shards[op.operationId].failed}</span>
                        </div>
                      ) : '无分片信息'
                    )}
                  </div>
                )}
              </td>
              <td className="py-2 pr-4">
                <button
                  className="px-2 py-0.5 border rounded text-xs"
                  onClick={async ()=>{
                    const id = op.operationId as string
                    setAuditOpen(o=>({ ...o, [id]: !o[id] }))
                    if (!auditOpen[id]) {
                      setAuditLoading(m=>({ ...m, [id]: true }))
                      try {
                        const r = await fetch(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(id)}/audits`, { headers: { 'accept':'application/json' } })
                        const j = await r.json()
                        const list = Array.isArray(j?.items) ? j.items : []
                        const latest = list.slice(-3).map((a:any)=>a)
                        setAuditData(d=>({ ...d, [id]: { count: list.length, latest } }))
                      } catch { /* noop */ }
                      finally { setAuditLoading(m=>({ ...m, [id]: false })) }
                    }
                  }}
                >{auditOpen[op.operationId] ? '收起' : '查看'}</button>
                {auditOpen[op.operationId] && (
                  <div className="mt-2 text-xs text-gray-700">
                    {auditLoading[op.operationId] ? '加载中...' : (
                      auditData[op.operationId] ? (
                        <div>
                          <div className="mb-1">总条目：{auditData[op.operationId].count}</div>
                          <ul className="list-disc pl-5 space-y-1">
                            {auditData[op.operationId].latest.map((a:any, idx:number)=>(
                              <li key={idx}>
                                <span className="font-mono">{String(a?.kind||'')}</span>
                                {a?.snapshot?.type && <> — <span className="font-mono">{String(a.snapshot.type)}</span></>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : '无审计信息'
                    )}
                  </div>
                )}
              </td>
              <td className="py-2 pr-4">
                <button
                  className="px-2 py-0.5 border rounded text-xs"
                  onClick={async ()=>{
                    try {
                      await fetch(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(op.operationId)}/execute-next`, { method: 'POST' })
                      // 轻量刷新当前行分片统计
                      const r = await fetch(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(op.operationId)}/shards`, { headers: { 'accept':'application/json' } })
                      const sj = await r.json()
                      const list = Array.isArray(sj?.items) ? sj.items : (Array.isArray(sj)? sj: [])
                      const stat = { queued:0, running:0, completed:0, failed:0, total:0 }
                      for (const sh of list) { const s = String(sh.status||'').toLowerCase(); if (s==='queued') stat.queued++; else if (s==='running') stat.running++; else if (s==='completed') stat.completed++; else if (s==='failed') stat.failed++; stat.total++ }
                      setShards(x=>({ ...x, [op.operationId]: stat }))
                    } catch { /* noop */ }
                  }}
                >执行下一片</button>
              </td>
              <td className="py-2 pr-4"><a className="text-blue-600 hover:underline" href={`/adscenter/bulk-actions/${op.operationId}`}>详情</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// 子组件：全局分片进度总览（汇总最近 N 个操作的分片状态）
function GlobalShardOverview() {
  const [loading, setLoading] = useState(false)
  const [stat, setStat] = useState<{ queued: number; running: number; completed: number; failed: number; total: number }>({ queued:0, running:0, completed:0, failed:0, total:0 })
  const [ops, setOps] = useState<number>(0)
  const [maxN, setMaxN] = useState<number>(1)

  const load = async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/v1/adscenter/bulk-actions?limit=20', { headers: { 'accept': 'application/json' } })
      if (!resp.ok) throw new Error(String(resp.status))
      const j = await resp.json()
      const items = Array.isArray(j?.items) ? j.items : []
      setOps(items.length)
      const agg = { queued:0, running:0, completed:0, failed:0, total:0 }
      // fetch shards per op sequentially to avoid swarm
      for (const op of items) {
        try {
          const r = await fetch(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(op.operationId)}/shards`, { headers: { 'accept':'application/json' } })
          const sj = await r.json()
          const list = Array.isArray(sj?.items) ? sj.items : (Array.isArray(sj)? sj: [])
          for (const sh of list) {
            const s = String(sh.status||'').toLowerCase()
            if (s==='queued') agg.queued++
            else if (s==='running') agg.running++
            else if (s==='completed') agg.completed++
            else if (s==='failed') agg.failed++
            agg.total++
          }
        } catch { /* noop */ }
      }
      setStat(agg)
    } catch { /* noop */ }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  return (
    <div className="text-sm">
      <div className="flex items-center gap-3 mb-2">
        <div>采样操作数：<span className="font-semibold">{ops}</span></div>
        <button className="px-2 py-1 border rounded text-xs" onClick={load} disabled={loading}>{loading? '刷新中...' : '刷新'}</button>
        <div className="ml-2 flex items-center gap-2">
          <span>推进全局</span>
          <select className="border rounded px-1 py-0.5 text-xs" value={maxN} onChange={e=>setMaxN(Number(e.target.value)||1)}>
            <option value={1}>1</option>
            <option value={3}>3</option>
            <option value={10}>10</option>
          </select>
          <button className="px-2 py-1 border rounded text-xs" onClick={async ()=>{ try { await fetch(`/api/v1/adscenter/bulk-actions/execute-tick?max=${encodeURIComponent(String(maxN))}`, { method: 'POST' }); await load() } catch { /* noop */ } }}>执行</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div>总分片：<span className="font-semibold">{stat.total}</span></div>
        <div>排队：<span className="font-semibold">{stat.queued}</span></div>
        <div>运行：<span className="font-semibold">{stat.running}</span></div>
        <div>完成：<span className="font-semibold">{stat.completed}</span></div>
        <div>失败：<span className="font-semibold">{stat.failed}</span></div>
      </div>
    </div>
  )
}

// 子组件：失败分片快速定位
function FailedShardsQuickList() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<{ opId: string; failed: number }[]>([])
  const [limit, setLimit] = useState(20)
  const load = async () => {
    setLoading(true)
    try {
      const resp = await fetch(`/api/v1/adscenter/bulk-actions?limit=${encodeURIComponent(String(limit))}`, { headers: { 'accept': 'application/json' } })
      if (!resp.ok) throw new Error(String(resp.status))
      const j = await resp.json()
      const items = Array.isArray(j?.items) ? j.items : []
      const out: { opId: string; failed: number }[] = []
      for (const op of items) {
        try {
          const r = await fetch(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(op.operationId)}/shards`, { headers: { 'accept':'application/json' } })
          const sj = await r.json()
          const list = Array.isArray(sj?.items) ? sj.items : (Array.isArray(sj)? sj: [])
          const failed = list.reduce((n:number, sh:any)=> n + (String(sh.status||'').toLowerCase()==='failed'?1:0), 0)
          if (failed > 0) out.push({ opId: op.operationId, failed })
        } catch { /* noop */ }
      }
      setRows(out)
    } catch { setRows([]) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [limit])
  return (
    <div className="text-sm">
      <div className="flex items-center gap-3 mb-2">
        <div>采样操作数：
          <select className="border rounded px-1 py-0.5 text-xs ml-1" value={limit} onChange={e=>setLimit(Number(e.target.value)||20)}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <button className="px-2 py-1 border rounded text-xs" onClick={load} disabled={loading}>{loading? '刷新中...' : '刷新'}</button>
      </div>
      {rows.length === 0 ? <div className="text-muted-foreground">暂无失败分片</div> : (
        <table className="min-w-full border text-xs">
          <thead className="bg-gray-50"><tr><th className="p-2 text-left">操作ID</th><th className="p-2 text-left">失败分片数</th><th className="p-2 text-left">操作</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.opId} className="border-b">
                <td className="p-2">{r.opId}</td>
                <td className="p-2">{r.failed}</td>
                <td className="p-2">
                  <a className="text-blue-600 hover:underline mr-2" href={`/adscenter/bulk-actions/${r.opId}`}>详情/回滚</a>
                  <button className="px-2 py-0.5 border rounded" onClick={async ()=>{ try { await fetch(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(r.opId)}/execute-next`, { method: 'POST' }); await load() } catch { /* noop */ } }}>推进一片</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// 子组件：回滚历史汇总（统计最近 N 个操作内回滚执行次数，并列出最新回滚）
function RollbackSummary() {
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState(0)
  const [latest, setLatest] = useState<{ opId: string; when: string }[]>([])
  const [limit, setLimit] = useState(20)
  const load = async () => {
    setLoading(true)
    try {
      const resp = await fetch(`/api/v1/adscenter/bulk-actions?limit=${encodeURIComponent(String(limit))}`, { headers: { 'accept':'application/json' } })
      const j = await resp.json(); const items = Array.isArray(j?.items) ? j.items : []
      let total = 0
      const recent: { opId: string; when: string }[] = []
      for (const op of items) {
        try {
          const r = await fetch(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(op.operationId)}/audits`, { headers: { 'accept':'application/json' } })
          const aj = await r.json(); const list = Array.isArray(aj?.items) ? aj.items : []
          list.forEach((a:any) => {
            const k = String(a?.kind||'')
            if (k === 'rollback_exec') {
              total++
              if (recent.length < 5) recent.push({ opId: op.operationId, when: a?.createdAt || '' })
            }
          })
        } catch { /* noop */ }
      }
      setCount(total); setLatest(recent)
    } catch { setCount(0); setLatest([]) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [limit])
  return (
    <div className="text-sm">
      <div className="flex items-center gap-3 mb-2">
        <div>采样操作数：
          <select className="border rounded px-1 py-0.5 text-xs ml-1" value={limit} onChange={e=>setLimit(Number(e.target.value)||20)}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <button className="px-2 py-1 border rounded text-xs" onClick={load} disabled={loading}>{loading? '刷新中...' : '刷新'}</button>
      </div>
      <div className="mb-2">总回滚次数：<span className="font-semibold">{count}</span></div>
      {latest.length > 0 && (
        <ul className="list-disc pl-5 text-xs">
          {latest.map((x,i)=>(
            <li key={i}><a className="text-blue-600 hover:underline" href={`/adscenter/bulk-actions/${x.opId}`}>#{x.opId}</a> — {x.when ? new Date(x.when).toLocaleString() : ''}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// 子组件：失败原因 Top K（基于动作审计 latest 片段）
function FailureTopK() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<{ type: string; reason: string; count: number }[]>([])
  const [limit, setLimit] = useState(20)
  const load = async () => {
    setLoading(true)
    try {
      const resp = await fetch(`/api/v1/adscenter/bulk-actions?limit=${encodeURIComponent(String(limit))}`, { headers: { 'accept':'application/json' } })
      const j = await resp.json(); const items = Array.isArray(j?.items) ? j.items : []
      const map: Record<string, number> = {}
      for (const op of items) {
        try {
          const r = await fetch(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(op.operationId)}/audits`, { headers: { 'accept':'application/json' } })
          const aj = await r.json(); const list = Array.isArray(aj?.items) ? aj.items : []
          list.forEach((a:any) => {
            const snap = a?.snapshot || {}
            const reason = snap?.error || snap?.message || snap?.reason || ''
            const typ = snap?.type || ''
            if (reason && String(a?.kind||'')==='other') {
              const key = String(typ)+'\u0001'+String(reason)
              map[key] = (map[key]||0) + 1
            }
          })
        } catch { /* noop */ }
      }
      const arr = Object.entries(map).map(([k,count])=>{ const [type,reason]=k.split('\u0001'); return { type, reason, count } }).sort((a,b)=>b.count-a.count).slice(0,10)
      setRows(arr)
    } catch { setRows([]) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [limit])
  return (
    <div className="text-sm">
      <div className="flex items-center gap-3 mb-2">
        <div>采样操作数：
          <select className="border rounded px-1 py-0.5 text-xs ml-1" value={limit} onChange={e=>setLimit(Number(e.target.value)||20)}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <button className="px-2 py-1 border rounded text-xs" onClick={load} disabled={loading}>{loading? '刷新中...' : '刷新'}</button>
      </div>
      {rows.length === 0 ? <div className="text-muted-foreground">暂无失败原因数据</div> : (
        <table className="min-w-full border text-xs">
          <thead className="bg-gray-50"><tr><th className="p-2 text-left">动作类型</th><th className="p-2 text-left">原因</th><th className="p-2 text-left">计数</th></tr></thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} className="border-b"><td className="p-2">{r.type||'-'}</td><td className="p-2">{r.reason}</td><td className="p-2">{r.count}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// 子组件：失败原因 Top K（按实体类型维度）
function FailureTopKByEntity() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<{ entity: string; reason: string; count: number }[]>([])
  const [limit, setLimit] = useState(20)
  const load = async () => {
    setLoading(true)
    try {
      const resp = await fetch(`/api/v1/adscenter/bulk-actions?limit=${encodeURIComponent(String(limit))}`, { headers: { 'accept': 'application/json' } })
      const j = await resp.json(); const items = Array.isArray(j?.items) ? j.items : []
      const map: Record<string, number> = {}
      for (const op of items) {
        try {
          const r = await fetch(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(op.operationId)}/audits`, { headers: { 'accept':'application/json' } })
          const aj = await r.json(); const list = Array.isArray(aj?.items) ? aj.items : []
          list.forEach((a:any) => {
            const snap = a?.snapshot || {}
            const reason = snap?.error || snap?.message || snap?.reason || ''
            // 估算实体类型：优先 snapshot.entityType，其次 params/filter内包含的 id 名称
            let ent = snap?.entityType || ''
            const p = snap?.params || {}
            const f = snap?.filter || {}
            const guess = (obj:any): string => {
              const keys = Object.keys(obj||{})
              if (keys.find(k=>k.toLowerCase().includes('campaign'))) return 'campaign'
              if (keys.find(k=>k.toLowerCase().includes('adgroup'))) return 'ad_group'
              if (keys.find(k=>k.toLowerCase().includes('keyword'))) return 'keyword'
              return ''
            }
            if (!ent) ent = guess(p) || guess(f) || ''
            if (reason && ent && String(a?.kind||'')==='other') {
              const key = String(ent)+'\u0001'+String(reason)
              map[key] = (map[key]||0) + 1
            }
          })
        } catch { /* noop */ }
      }
      const arr = Object.entries(map).map(([k,count])=>{ const [entity,reason]=k.split('\u0001'); return { entity, reason, count } }).sort((a,b)=>b.count-a.count).slice(0,10)
      setRows(arr)
    } catch { setRows([]) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [limit])
  return (
    <div className="text-sm">
      <div className="flex items-center gap-3 mb-2">
        <div>采样操作数：
          <select className="border rounded px-1 py-0.5 text-xs ml-1" value={limit} onChange={e=>setLimit(Number(e.target.value)||20)}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <button className="px-2 py-1 border rounded text-xs" onClick={load} disabled={loading}>{loading? '刷新中...' : '刷新'}</button>
      </div>
      {rows.length === 0 ? <div className="text-muted-foreground">暂无失败原因数据</div> : (
        <table className="min-w-full border text-xs">
          <thead className="bg-gray-50"><tr><th className="p-2 text-left">实体类型</th><th className="p-2 text-left">原因</th><th className="p-2 text-left">计数</th></tr></thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} className="border-b"><td className="p-2">{r.entity||'-'}</td><td className="p-2">{r.reason}</td><td className="p-2">{r.count}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// 子组件：回滚趋势（近7天，基于最近 N 操作的审计记录）
function RollbackTrend7d() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<{ date: string; count: number }[]>([])
  const [limit, setLimit] = useState(50)
  const load = async () => {
    setLoading(true)
    try {
      const resp = await fetch(`/api/v1/adscenter/bulk-actions?limit=${encodeURIComponent(String(limit))}`, { headers: { 'accept':'application/json' } })
      const j = await resp.json(); const items = Array.isArray(j?.items) ? j.items : []
      const map: Record<string, number> = {}
      const now = new Date()
      const sevenAgo = new Date(now.getTime() - 7*24*3600*1000)
      for (const op of items) {
        try {
          const r = await fetch(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(op.operationId)}/audits`, { headers: { 'accept':'application/json' } })
          const aj = await r.json(); const list = Array.isArray(aj?.items) ? aj.items : []
          list.forEach((a:any) => {
            if (String(a?.kind||'') === 'rollback_exec') {
              const ts = a?.createdAt || a?.timestamp || ''
              if (!ts) return
              const d = new Date(ts)
              if (isNaN(d.getTime()) || d < sevenAgo) return
              const key = d.toISOString().slice(0,10)
              map[key] = (map[key]||0) + 1
            }
          })
        } catch { /* noop */ }
      }
      const keys = Object.keys(map).sort()
      const arr = keys.map(k=>({ date: k, count: map[k] }))
      setRows(arr)
    } catch { setRows([]) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [limit])
  return (
    <div className="text-sm">
      <div className="flex items-center gap-3 mb-2">
        <div>采样操作数：
          <select className="border rounded px-1 py-0.5 text-xs ml-1" value={limit} onChange={e=>setLimit(Number(e.target.value)||50)}>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <button className="px-2 py-1 border rounded text-xs" onClick={load} disabled={loading}>{loading? '刷新中...' : '刷新'}</button>
      </div>
      {rows.length === 0 ? <div className="text-muted-foreground">近7天无回滚活动</div> : (
        <table className="min-w-full border text-xs">
          <thead className="bg-gray-50"><tr><th className="p-2 text-left">日期</th><th className="p-2 text-left">回滚次数</th></tr></thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} className="border-b"><td className="p-2">{r.date}</td><td className="p-2">{r.count}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
