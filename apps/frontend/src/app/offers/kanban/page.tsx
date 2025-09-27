"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listOffers, createOffer, updateOfferStatus, getOfferKPI, aggregateOfferKPI, listOfferAccounts, linkOfferAccount, unlinkOfferAccount } from '@/sdk/offer/client';
import { analyze as analyzeSiterank, getLatestByOffer as getLatestSiterank } from '@/sdk/siterank/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Offer = { id: string; userId: string; name: string; originalUrl: string; status: string; createdAt: string };

const STATUS_COLUMNS: Array<{ key: string; title: string }>= [
  { key: 'opportunity', title: '机会池' },
  { key: 'evaluating', title: '评估中' },
  { key: 'simulating', title: '仿真中' },
  { key: 'scaling', title: '放大中' },
  { key: 'declining', title: '衰退期' },
  { key: 'archived', title: '归档' },
];

const ALL_STATUSES = STATUS_COLUMNS.map(c=>c.key).concat(['optimizing']);

export default function OfferKanbanPage() {
  const [items, setItems] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string>('');
  const [draggingId, setDraggingId] = useState<string>('');
  const [scores, setScores] = useState<Record<string, number | undefined>>({});
  const [simCountry, setSimCountry] = useState('US');
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskOffer, setTaskOffer] = useState<Offer | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [trendOpen, setTrendOpen] = useState(false);
  const [trendOffer, setTrendOffer] = useState<Offer | null>(null);
  const [trend, setTrend] = useState<Array<{ date: string; avg: number }>>([]);
  const [trendMap, setTrendMap] = useState<Record<string, Array<{ date: string; avg: number }> | undefined>>({});
  const [taskTimer, setTaskTimer] = useState<any>(null);
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(10);
  const [anState, setAnState] = useState<Record<string, { start: number; degraded?: boolean }>>({});
  const [, setTick] = useState(0);
  const [sseAbort, setSseAbort] = useState<AbortController | null>(null);
  const [times, setTimes] = useState<Record<string, { resolveNav?: number; resolveStab?: number; sw?: number; ai?: number }>>({});
  const [rosc, setRosc] = useState<Record<string, number | undefined>>({});
  type KpiDay = { date: string; impressions: number; clicks: number; spend: number; revenue: number };
  const [kpiDays, setKpiDays] = useState<Record<string, Array<KpiDay> | undefined>>({});
  const [kpiRoscDays, setKpiRoscDays] = useState<Record<string, Array<{ date: string; rosc: number }> | undefined>>({});
  const [kpiSource, setKpiSource] = useState<Record<string, string|undefined>>({});
  const [kpiSyncing, setKpiSyncing] = useState<Record<string, boolean>>({});
  const [kpiUpdatedAt, setKpiUpdatedAt] = useState<Record<string, string|undefined>>({});
  const [acctOpen, setAcctOpen] = useState(false);
  const [acctOffer, setAcctOffer] = useState<Offer | null>(null);
  const [acctList, setAcctList] = useState<string[]>([]);
  const [acctNew, setAcctNew] = useState('');

  const grouped = useMemo(() => {
    const g: Record<string, Offer[]> = {};
    for (const s of ALL_STATUSES) g[s] = [];
    for (const o of items) {
      const s = (o.status||'').toLowerCase();
      (g[s] || (g[s]=[])).push(o);
    }
    return g;
  }, [items]);

  const load = async () => {
    try {
      setLoading(true);
      const list: any[] = await listOffers({ cache: 'no-store' }) as any;
      setItems(Array.isArray(list) ? list : []);
      // initialize scores map (if backend projected siterankScore)
      const sc: Record<string, number> = {} as any;
      for (const it of (list||[])) {
        const v = (it.siterankScore ?? it.SiterankScore);
        if (typeof v === 'number') sc[it.id] = v;
      }
      setScores(sc);
    } finally { setLoading(false) }
  };

  const create = async () => {
    if (!name || !url) return;
    setBusy('create');
    try {
      const idem = `offer-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      await createOffer({ name, originalUrl: url }, { headers: { 'X-Idempotency-Key': idem } });
      setName(''); setUrl('');
      setTimeout(load, 800);
    } finally { setBusy('') }
  };

  const moveTo = async (offer: Offer, to: string) => {
    if (busy) return;
    setBusy(offer.id);
    try {
      await updateOfferStatus(offer.id, to);
      setItems(prev => prev.map(it => it.id === offer.id ? { ...it, status: to } : it));
    } finally { setBusy('') }
  };

  const onDragStart = (id: string) => (e: React.DragEvent) => {
    setDraggingId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' };
  const onDropTo = (status: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggingId;
    if (!id) return;
    const offer = items.find(o => o.id === id);
    if (!offer || (offer.status||'').toLowerCase() === status) return;
    await moveTo(offer, status);
    setDraggingId('');
  };

  const runAnalyze = async (offer: Offer) => {
    if (busy) return;
    setBusy(`analyze:${offer.id}`);
    try {
      await analyzeSiterank(offer.id);
      // 记录分析开始时间，并启动轮询
      setAnState(prev => ({ ...prev, [offer.id]: { start: Date.now() } }));
      const deadline = Date.now() + 15000; // 15s 轮询上限
      const poll = async () => {
        try {
          const a: any = await getLatestSiterank(offer.id);
          if (a && (a.status === 'completed' || a.status === 'ok' || a.status === 'done')) {
            // 刷新分数与迷你趋势
            await refreshScore(offer);
            const res = typeof a.result === 'string' ? JSON.parse(a.result) : a.result;
            const degraded = !!(res && res.degraded);
            setAnState(prev => ({ ...prev, [offer.id]: { start: prev[offer.id]?.start || Date.now(), degraded } }));
            // 结束分析状态（延迟 1s 给用户一个“完成”感）
            setTimeout(() => setAnState(prev => { const cp = { ...prev }; delete cp[offer.id]; return cp }), 1000);
            return;
          }
        } catch {}
        if (Date.now() < deadline) setTimeout(poll, 1200);
        else setAnState(prev => { const cp = { ...prev }; delete cp[offer.id]; return cp });
      };
      poll();
    } catch (e:any) {
      alert(`启动评估失败：${e?.message||e}`);
    } finally {
      setBusy('');
    }
  };

  const refreshScore = async (offer: Offer) => {
    try {
      const a: any = await getLatestSiterank(offer.id);
      let score: number | undefined;
      if (a && a.result) {
        const r = typeof a.result === 'string' ? JSON.parse(a.result) : a.result;
        score = typeof r?.score === 'number' ? r.score : (typeof r?.opportunityScore === 'number' ? r.opportunityScore : undefined);
        // stage timings
        try {
          const rt = r?.resolve?.timings || {};
          const st = r?.stageTimings || {};
          setTimes(prev => ({ ...prev, [offer.id]: {
            resolveNav: typeof rt.navMs === 'number' ? rt.navMs : undefined,
            resolveStab: typeof rt.stabilizeMs === 'number' ? rt.stabilizeMs : undefined,
            sw: typeof st.swFetchMs === 'number' ? st.swFetchMs : undefined,
            ai: typeof st.aiScoreMs === 'number' ? st.aiScoreMs : undefined,
          }}));
        } catch {}
      }
      setScores(prev => ({ ...prev, [offer.id]: score }));
      // pre-load mini trend (7 days)
      try {
        const tr = await fetch(`/api/go/api/v1/siterank/${encodeURIComponent(offer.id)}/trend?days=7`, { cache: 'no-store' });
        if (tr.ok) {
          const tj = await tr.json();
          const pts = Array.isArray(tj.points) ? tj.points : [];
          setTrendMap(prev => ({ ...prev, [offer.id]: pts.map((p:any) => ({ date: p.date || p.Date || '', avg: Number(p.avgScore || p.avg || 0) })) }));
        }
      } catch {}
    } catch {}
  };

  const runSimulate = async (offer: Offer) => {
    if (busy) return;
    setBusy(`sim:${offer.id}`);
    try {
      const resp = await fetch('/api/go/api/v1/batchopen/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offerId: offer.id, simulationConfig: { country: simCountry } })
      });
      if (resp.status !== 202) throw new Error(String(resp.status));
      alert('已创建仿真任务（批量执行最小模板），稍后可在任务列表查看');
    } catch (e:any) {
      alert(`创建仿真任务失败：${e?.message||e}`);
    } finally { setBusy('') }
  };

  const viewTasks = async (offer: Offer) => {
    setTaskOffer(offer); setTaskOpen(true); setTasks([]); setTaskPage(1);
    try {
      const r = await fetch('/api/go/api/v1/batchopen/tasks', { cache: 'no-store' });
      const j = await r.json();
      const items = Array.isArray(j.items) ? j.items : (Array.isArray(j) ? j : []);
      const filtered = items.filter((x:any) => (x.offerId||x.offer_id) === offer.id);
      setTasks(filtered);
    } catch {}
  };

  const loadKPI = async (offer: Offer) => {
    try {
      const j = await getOfferKPI(offer.id);
      const ro = j?.summary?.rosc;
      if (typeof ro === 'number') setRosc(prev => ({ ...prev, [offer.id]: ro }));
      if (Array.isArray(j?.days)) {
        const arr = (j.days as Array<any>).map(d => ({
          date: String(d.date),
          impressions: Number(d.impressions||0),
          clicks: Number(d.clicks||0),
          spend: Number(d.spend||0),
          revenue: Number(d.revenue||0),
        })) as Array<KpiDay>;
        setKpiDays(prev => ({ ...prev, [offer.id]: arr }));
        setKpiRoscDays(prev => ({ ...prev, [offer.id]: arr.map(x => ({ date: x.date, rosc: (x.spend>0 ? (x.revenue/x.spend) : 0) })) }));
      }
      // display hint if synthetic
      const source = (j?.source || '').toString();
      if (source) setKpiSource(prev => ({ ...prev, [offer.id]: source }));
      if (j?.updatedAt) setKpiUpdatedAt(prev => ({ ...prev, [offer.id]: String(j.updatedAt) }));
      if (source && source !== 'real') {
        // 自动触发聚合写入真实日KPI，然后延迟刷新
        try {
          setKpiSyncing(prev => ({ ...prev, [offer.id]: true }));
          await aggregateOfferKPI(offer.id);
          setTimeout(async () => {
            try {
              const jj = await getOfferKPI(offer.id, { cache: 'no-store' });
              const ro2 = jj?.summary?.rosc;
              if (typeof ro2 === 'number') setRosc(prev => ({ ...prev, [offer.id]: ro2 }));
              if (Array.isArray(jj?.days)) {
                const arr2 = (jj.days as Array<any>).map(d => ({
                  date: String(d.date),
                  impressions: Number(d.impressions||0),
                  clicks: Number(d.clicks||0),
                  spend: Number(d.spend||0),
                  revenue: Number(d.revenue||0),
                })) as Array<KpiDay>;
                setKpiDays(prev => ({ ...prev, [offer.id]: arr2 }));
                setKpiRoscDays(prev => ({ ...prev, [offer.id]: arr2.map(x => ({ date: x.date, rosc: (x.spend>0 ? (x.revenue/x.spend) : 0) })) }));
              }
              const src2 = (jj?.source || '').toString();
              if (src2) setKpiSource(prev => ({ ...prev, [offer.id]: src2 }));
              if (jj?.updatedAt) setKpiUpdatedAt(prev => ({ ...prev, [offer.id]: String(jj.updatedAt) }));
            } finally {
              setKpiSyncing(prev => ({ ...prev, [offer.id]: false }));
            }
          }, 1500);
        } catch {
          setKpiSyncing(prev => ({ ...prev, [offer.id]: false }));
        }
      } else {
        setKpiSyncing(prev => ({ ...prev, [offer.id]: false }));
      }
    } catch {}
  };

  const viewTrend = async (offer: Offer) => {
    setTrendOffer(offer); setTrendOpen(true); setTrend([]);
    try {
      const r = await fetch(`/api/go/api/v1/siterank/${encodeURIComponent(offer.id)}/trend?days=30`, { cache: 'no-store' });
      if (!r.ok) return; const j = await r.json();
      const pts = Array.isArray(j.points) ? j.points : [];
      setTrend(pts.map((p:any) => ({ date: p.date || p.Date || '', avg: Number(p.avgScore || p.avg || 0) })));
    } catch {}
  };

  const openAccounts = async (offer: Offer) => {
    setAcctOffer(offer); setAcctOpen(true); setAcctList([]); setAcctNew('');
    try {
      const j = await listOfferAccounts(offer.id, { cache: 'no-store' });
      const ids = Array.isArray(j?.items) ? j.items.map(x=>x.accountId) : [];
      setAcctList(ids);
    } catch {}
  };
  const addAccount = async () => {
    if (!acctOffer || !acctNew) return;
    try {
      await linkOfferAccount(acctOffer.id, acctNew);
      setAcctList(prev => Array.from(new Set([acctNew, ...prev])));
      setAcctNew('');
    } catch (e:any) { alert(`添加失败: ${e?.message||e}`) }
  };
  const removeAccount = async (cid: string) => {
    if (!acctOffer) return;
    try { await unlinkOfferAccount(acctOffer.id, cid); setAcctList(prev => prev.filter(x=>x!==cid)); } catch {}
  };

  // polling for tasks when drawer is open
  useEffect(() => {
    if (taskOpen && taskOffer) {
      const tick = async () => {
        try {
          const r = await fetch('/api/go/api/v1/batchopen/tasks', { cache: 'no-store' });
          const j = await r.json();
          const items = Array.isArray(j.items) ? j.items : (Array.isArray(j) ? j : []);
          const filtered = items.filter((x:any) => (x.offerId||x.offer_id) === taskOffer.id);
          setTasks(filtered);
        } catch {}
      };
      tick();
      const h = setInterval(tick, 4000);
      setTaskTimer(h);
      return () => { clearInterval(h); setTaskTimer(null); };
    }
    return () => {};
  }, [taskOpen, taskOffer]);

  // heartbeat to刷新分析进度条
  useEffect(() => {
    const h = setInterval(() => setTick(t => (t+1)&0xff), 500);
    return () => clearInterval(h);
  }, []);

  // SSE: 监听通知，SiterankCompleted 到达时刷新当前进行中卡片评分
  useEffect(() => {
    try {
      if (sseAbort) { sseAbort.abort(); }
      const ac = new AbortController(); setSseAbort(ac);
      (async () => {
        const resp = await fetch('/api/go/api/v1/notifications/stream', { signal: ac.signal });
        if (!resp.ok || !resp.body) return;
        const reader = resp.body.getReader(); const dec = new TextDecoder();
        let buf = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n\n')) >= 0) {
            const evt = buf.slice(0, idx); buf = buf.slice(idx + 2);
            const lines = evt.split('\n');
            let type = 'message', data = '';
            for (const ln of lines) {
              if (ln.startsWith('event:')) type = ln.slice(6).trim();
              else if (ln.startsWith('data:')) data += ln.slice(5).trim();
            }
            if (type === 'new') {
              try {
                const j = JSON.parse(data || '{}');
                const t = (j.type || '').toString();
                const offerId = (j.offerId || '').toString();
                const step = (j.step || '').toString();
                if (t === 'WorkflowStarted') {
                  if (offerId) setAnState(prev => ({ ...prev, [offerId]: { start: Date.now() } }));
                } else if (t === 'WorkflowStepCompleted') {
                  if (offerId) {
                    setAnState(prev => ({ ...prev, [offerId]: { start: prev[offerId]?.start || Date.now() } }));
                    if (step === 'resolve') {
                      // set quick heartbeat to update UI
                      setTick(tk => (tk+1)&0xff);
                    }
                  }
                } else if (t === 'SiterankCompleted') {
                  // 刷新所有正在分析中的卡片评分
                  const ids = Object.keys(anState);
                  if (ids.length) {
                    // 顺序刷新，避免瞬时高并发
                    (async () => { for (const id of ids) { const o = items.find(x => x.id === id); if (o) await refreshScore(o); } })();
                  }
                }
              } catch {}
            }
          }
        }
      })();
      return () => { ac.abort(); };
    } catch { return () => {} }
  }, [JSON.stringify(Object.keys(anState)), JSON.stringify(items.map(i=>i.id))]);

  useEffect(() => { load() }, []);

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Offer 指挥中心（看板 MVP）</h1>
        <Button variant="outline" onClick={load} disabled={loading}>{loading ? '加载中…' : '刷新'}</Button>
      </div>

      <div className="bg-white p-4 rounded-md shadow mb-6">
        <div className="flex gap-2 items-center flex-wrap">
          <Input placeholder="Offer 名称" value={name} onChange={e=>setName(e.target.value)} className="w-64" />
          <Input placeholder="联盟 Offer URL" value={url} onChange={e=>setUrl(e.target.value)} className="w-96" />
          <Button onClick={create} disabled={!name || !url || !!busy}>{busy==='create' ? '创建中…' : '创建 Offer'}</Button>
          <span className="text-sm text-gray-500 ml-4">仿真默认国家：</span>
          <select value={simCountry} onChange={(e)=>setSimCountry(e.target.value)} className="border rounded h-9 px-2">
            {['US','GB','DE','FR','JP','SG'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {STATUS_COLUMNS.map(col => (
          <div key={col.key} className="bg-gray-50 rounded-md p-2 border"
               onDragOver={onDragOver}
               onDrop={onDropTo(col.key)}>
            <div className="font-medium text-sm mb-2">{col.title}</div>
            <div className="space-y-2">
              {(grouped[col.key] || []).map(o => {
                const sc = scores[o.id];
                const color = sc === undefined ? 'gray' : (sc >= 70 ? 'green' : (sc >= 40 ? 'amber' : 'red'));
                const borderCls = color==='green' ? 'border-l-4 border-l-green-500' : (color==='amber' ? 'border-l-4 border-l-amber-500' : (color==='red' ? 'border-l-4 border-l-red-500' : ''));
                const scoreTextCls = color==='green' ? 'text-green-600' : (color==='amber' ? 'text-amber-600' : (color==='red' ? 'text-red-600' : 'text-gray-600'));
                return (
                <div key={o.id} className={`bg-white rounded border p-2 shadow-sm ${borderCls}`}
                     draggable
                     onDragStart={onDragStart(o.id)}>
                  <div className="text-sm font-medium truncate" title={o.name}>{o.name}</div>
                  <div className="text-xs text-gray-500 truncate" title={o.originalUrl}>{o.originalUrl}</div>
                  {anState[o.id] && (
                    <div className="mt-1">
                      <div className="h-2 bg-gray-200 rounded overflow-hidden">
                        {(() => {
                          const elapsed = Date.now() - (anState[o.id]?.start || Date.now());
                          const pct = Math.min(95, Math.floor(elapsed / 100));
                          return <div className="h-2 bg-blue-500" style={{ width: pct + '%' }} />
                        })()}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1">
                        分析中…（约10秒）。{anState[o.id]?.degraded ? <span className="text-amber-600 ml-1">检测到降级，稍后可重试</span> : null}
                      </div>
                    </div>
                  )}
                  <div className="mt-1 text-xs">
                    <span className="text-gray-600">Siterank 分：</span>
                    <span className={`font-medium ${scoreTextCls}`}>{sc !== undefined ? String(sc) : '-'}</span>
                    <Button variant="outline" size="sm" className="ml-2 h-7" onClick={()=>refreshScore(o)}>刷新评分</Button>
                    <span className="ml-3 text-gray-600">ROSC：</span>
                    <span className={`font-medium ${(() => { const r = rosc[o.id]; if (r===undefined) return ''; return r>=1.3? 'text-green-600' : (r>=1.0? 'text-amber-600':'text-red-600') })()}`}>{rosc[o.id]?.toFixed(2) ?? '-'}</span>
                    {kpiSource[o.id] && (
                      <span className={`ml-2 text-[11px] px-1.5 py-0.5 rounded ${kpiSource[o.id]==='real' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {kpiSource[o.id]==='real' ? '真实' : '占位'}
                      </span>
                    )}
                    {kpiSyncing[o.id] && (
                      <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">同步中…</span>
                    )}
                    <Button variant="outline" size="sm" className="ml-2 h-7" onClick={()=>loadKPI(o)} disabled={!!kpiSyncing[o.id]}>刷新KPI</Button>
                  </div>
                  {trendMap[o.id] && trendMap[o.id]!.length > 0 && (
                    <div className="mt-1" style={{ width: '100%', height: 60 }}>
                      <ResponsiveContainer>
                        <LineChart data={trendMap[o.id]}
                          margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={1.8} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Select onValueChange={(v)=>moveTo(o, v)}>
                      <SelectTrigger className="w-40 h-8 text-xs">
                        <SelectValue placeholder="移动到…" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_COLUMNS.map(s => (
                          <SelectItem key={s.key} value={s.key} className="text-xs">{s.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={()=>runAnalyze(o)} disabled={busy===`analyze:${o.id}`}>评估</Button>
                    <Button variant="outline" size="sm" onClick={()=>runSimulate(o)} disabled={busy===`sim:${o.id}`}>仿真</Button>
                    <Button variant="outline" size="sm" onClick={()=>openAccounts(o)}>账号</Button>
                    <Button variant="outline" size="sm" onClick={()=>viewTasks(o)}>任务</Button>
                    <Button variant="outline" size="sm" onClick={()=>viewTrend(o)}>趋势</Button>
                    <Button variant="outline" size="sm" onClick={()=>moveTo(o, 'archived')} disabled={busy===o.id}>归档</Button>
                  </div>
                  {(() => {
                    const t = times[o.id] || {};
                    const nav = t.resolveNav || 0;
                    const stab = t.resolveStab || 0;
                    const swms = t.sw || 0;
                    const aims = t.ai || 0;
                    if (!nav && !stab && !swms && !aims) return null;
                    const pill = (label:string, ms:number, red:number, amber:number) => {
                      const cls = ms>=red? 'bg-red-100 text-red-700' : (ms>=amber? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700');
                      return <span className={`px-2 py-0.5 rounded text-[11px] ${cls}`}>{label} {ms}ms</span>;
                    };
                    return (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {nav ? pill('resolve', nav + (stab||0), 60000, 30000) : null}
                        {swms ? pill('sw', swms, 10000, 5000) : null}
                        {aims ? pill('ai', aims, 8000, 4000) : null}
                      </div>
                    );
                  })()}

                  {kpiDays[o.id] && kpiDays[o.id]!.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="w-full h-20">
                        <ResponsiveContainer>
                          <LineChart data={kpiDays[o.id]}
                            margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <Line type="monotone" dataKey="impressions" stroke="#0ea5e9" strokeWidth={1.8} dot={false} />
                            <Line type="monotone" dataKey="clicks" stroke="#22c55e" strokeWidth={1.8} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="w-full h-20">
                        <ResponsiveContainer>
                          <LineChart data={kpiDays[o.id]}
                            margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <Line type="monotone" dataKey="spend" stroke="#f97316" strokeWidth={1.8} dot={false} />
                            <Line type="monotone" dataKey="revenue" stroke="#a855f7" strokeWidth={1.8} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="w-full h-20 col-span-2">
                        <ResponsiveContainer>
                          <LineChart data={kpiRoscDays[o.id]}
                            margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <Tooltip formatter={(v:any)=>Number(v).toFixed(2)} labelFormatter={(l:any)=>`日期 ${l}`}/>
                            <Line type="monotone" dataKey="rosc" stroke="#0ea5e9" strokeWidth={1.8} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {kpiUpdatedAt[o.id] && (
                    <div className="mt-1 text-[11px] text-gray-500">KPI更新时间：{new Date(kpiUpdatedAt[o.id] as string).toLocaleString()}</div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Sheet open={taskOpen} onOpenChange={setTaskOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>仿真任务 — {taskOffer?.name || taskOffer?.id}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {tasks.length === 0 && <div className="text-sm text-gray-500">暂无任务</div>}
            {tasks.slice((taskPage-1)*taskPageSize, (taskPage)*taskPageSize).map((t:any)=> (
              <div key={t.id} className="border rounded p-2">
                <div className="text-sm"><span className="text-gray-500">ID:</span> {t.id}</div>
                <div className="text-sm"><span className="text-gray-500">状态:</span> {t.status}</div>
                <div className="text-xs text-gray-500">创建: {t.createdAt || ''} 更新: {t.updatedAt || ''}</div>
                {(() => {
                  try {
                    const r = (t.result && (typeof t.result === 'string' ? JSON.parse(t.result) : t.result)) || null;
                    if (!r) return null;
                    const q = r.quality || r.Quality;
                    const score = q && (q.score || q.Score);
                    const err = r.error || r.Error;
                    const st = typeof r.status === 'number' ? r.status : undefined;
                    return (
                      <div className="mt-1 text-xs">
                        {score !== undefined && <div>质量评分：<span className="font-medium">{String(score)}</span></div>}
                        {st !== undefined && <div>HTTP状态：{st}</div>}
                        {err && <div className="text-amber-600">错误：{String(err)}</div>}
                      </div>
                    );
                  } catch { return null }
                })()}
              </div>
            ))}
            {tasks.length > 0 && (
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-gray-600">共 {tasks.length} 条</div>
                <div className="flex items-center gap-2">
                  <select className="border rounded h-7 text-xs px-1" value={taskPageSize} onChange={e=>{ setTaskPageSize(parseInt(e.target.value)||10); setTaskPage(1); }}>
                    {[5,10,20,50].map(n => <option key={n} value={n}>{n}/页</option>)}
                  </select>
                  <Button variant="outline" size="sm" onClick={()=>setTaskPage(p=> Math.max(1, p-1))}>上一页</Button>
                  <div className="text-xs">第 {taskPage} 页</div>
                  <Button variant="outline" size="sm" onClick={()=>setTaskPage(p=> (p*taskPageSize < tasks.length ? p+1 : p))}>下一页</Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={trendOpen} onOpenChange={setTrendOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>近30天评分趋势 — {trendOffer?.name || trendOffer?.id}</DialogTitle>
          </DialogHeader>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} interval={Math.ceil((trend.length || 1)/6)} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="avg" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={acctOpen} onOpenChange={setAcctOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>已关联账号 — {acctOffer?.name || acctOffer?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input placeholder="输入 Google Ads Customer ID（不含短横）" value={acctNew} onChange={e=>setAcctNew(e.target.value)} />
              <Button onClick={addAccount} disabled={!acctNew}>添加</Button>
            </div>
            <div className="space-y-1">
              {acctList.length===0 && <div className="text-sm text-gray-500">暂无关联账号</div>}
              {acctList.map(cid => (
                <div key={cid} className="flex items-center justify-between border rounded px-2 py-1 text-sm">
                  <div>{cid}</div>
                  <Button variant="outline" size="sm" onClick={()=>removeAccount(cid)}>移除</Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
