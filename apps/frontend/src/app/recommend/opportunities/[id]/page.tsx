"use client";
import React from 'react';
import type { components } from '@/sdk/recommendations/types';
import type { components as adsTypes } from '@/sdk/adscenter/types';

type Opportunity = components['schemas']['Opportunity'];

export default function OpportunityDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const [data, setData] = React.useState<Opportunity | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [posting, setPosting] = React.useState(false);
  function downloadFile(name: string, mime: string, content: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const resp = await fetch(`/api/v1/recommend/opportunities/${encodeURIComponent(id)}`, { headers: { 'accept': 'application/json' } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const j = await resp.json();
      setData(j);
    } catch (e: any) { setError(e?.message || '加载失败'); }
    finally { setLoading(false); }
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  async function createBulkPlan(validateOnly = true) {
    if (!data) return;
    setPosting(true);
    try {
      const body: adsTypes['schemas']['OpportunityComboPlan'] = {
        validateOnly,
        seedDomain: data.seedDomain,
        country: data.country,
        plan: {
          keywords: (data.topKeywords || []).slice(0, 50),
          domains: (data.topDomains || []).slice(0, 50),
        },
      };
      const resp = await fetch('/api/v1/adscenter/bulk-actions', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const j = await resp.json().catch(()=>({}));
      if (!validateOnly && j && j.operationId) {
        window.location.href = `/adscenter/bulk-actions/${encodeURIComponent(j.operationId)}`;
        return;
      }
      alert(validateOnly ? '已提交校验计划（validate-only）' : '已提交批量计划');
    } catch (e: any) {
      alert(e?.message || '提交失败');
    } finally { setPosting(false); }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">机会详情 #{id}</h1>
      <div className="flex items-center gap-3 mb-3">
        <a className="text-blue-600 hover:underline" href="/recommend/opportunities">返回列表</a>
        <button className="px-3 py-1 border rounded" onClick={load} disabled={loading}>{loading ? '加载中…' : '刷新'}</button>
        {error && <span className="text-red-600 text-sm">{error}</span>}
        <button className="px-3 py-1 border rounded" disabled={!data || posting} onClick={()=>createBulkPlan(true)}>校验计划（validate-only）</button>
        <button className="px-3 py-1 border rounded" disabled={!data || posting} onClick={()=>createBulkPlan(false)}>一键发起批量计划</button>
        <button className="px-3 py-1 border rounded" disabled={!data} onClick={()=> downloadFile(`opportunity-${id}.json`,'application/json', JSON.stringify(data, null, 2))}>导出JSON</button>
        <button className="px-3 py-1 border rounded" disabled={!data} onClick={()=> {
          if (!data) return;
          const topKW = (data.topKeywords||[]).map((k:any)=>k.keyword).filter(Boolean).join('|');
          const topDM = (data.topDomains||[]).map((d:any)=>d.domain).filter(Boolean).join('|');
          const headers = 'id,seedDomain,country,summary,topKW,topDM\n';
          const row = `${id},${JSON.stringify(data.seedDomain||'')},${JSON.stringify(data.country||'')},${JSON.stringify((data as any).summary||'')},${JSON.stringify(topKW)},${JSON.stringify(topDM)}\n`;
          downloadFile(`opportunity-${id}.csv`,'text/csv', headers+row);
        }}>导出CSV</button>
      </div>
      {!data ? (
        <div className="text-gray-500">{loading ? '加载中…' : (error || '暂无数据')}</div>
      ) : (
        <div className="space-y-3">
          <div><span className="font-medium">Seed:</span> {data.seedDomain} <span className="ml-3 font-medium">Country:</span> {data.country || '-'}
            {data.summary && <span className="ml-3 text-gray-700">摘要：{data.summary}</span>}
          </div>
          <div>
            <div className="font-medium">Top Keywords</div>
            <ul className="list-disc ml-5">
              {(data.topKeywords || []).slice(0, 20).map((it: any, i: number) => (
                <li key={i}>{it.keyword || JSON.stringify(it)} {it.score != null && <span className="text-gray-500">({Number(it.score).toFixed(1)})</span>}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-medium">Top Domains</div>
            <table className="w-full border text-sm">
              <thead><tr className="bg-gray-50"><th className="text-left p-2 border-b">Domain</th><th className="text-left p-2 border-b">Score</th></tr></thead>
              <tbody>
                {(data.topDomains || []).slice(0, 50).map((it: any, i: number) => (
                  <tr key={i} className="border-b"><td className="p-2">{it.domain || JSON.stringify(it)}</td><td className="p-2">{it.score != null ? Number(it.score).toFixed(1) : ''}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="font-medium">Raw JSON</div>
            <pre className="text-xs bg-gray-50 p-3 rounded border overflow-auto" style={{ maxHeight: 480 }}>{JSON.stringify(data, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
