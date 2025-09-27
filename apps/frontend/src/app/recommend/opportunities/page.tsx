"use client";
import React from 'react';
import type { components } from '@/sdk/recommendations/types';

type OppItem = components['schemas']['OpportunityItem'] & {
  topKeywords?: Array<{ keyword?: string; score?: number; reason?: string }>;
  topDomains?: Array<{ domain?: string; score?: number }>;
};

export default function OpportunitiesPage() {
  const [items, setItems] = React.useState<OppItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [seed, setSeed] = React.useState('');
  const [country, setCountry] = React.useState('');
  const [next, setNext] = React.useState<string | null>(null);
  function downloadFile(name: string, mime: string, content: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  const load = React.useCallback(async (reset: boolean) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (seed.trim()) params.set('seedDomain', seed.trim());
      if (country.trim()) params.set('country', country.trim());
      params.set('limit', '20');
      if (!reset && next) params.set('cursor', next);
      const resp = await fetch(`/api/v1/recommend/opportunities?${params.toString()}`, { headers: { 'accept': 'application/json' } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const j = await resp.json();
      const arr = Array.isArray(j.items) ? j.items : [];
      setItems(reset ? arr : [...items, ...arr]);
      setNext(j.next || null);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally { setLoading(false); }
  }, [seed, country, next, items]);

  React.useEffect(() => { load(true); }, []);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">我的机会</h1>
      <div className="flex items-center gap-3 mb-3">
        <input className="px-2 py-1 border rounded" placeholder="种子域名" value={seed} onChange={e=>setSeed(e.target.value)} />
        <input className="px-2 py-1 border rounded w-28" placeholder="国家" value={country} onChange={e=>setCountry(e.target.value)} />
        <button className="px-3 py-1 border rounded" onClick={()=>{ setNext(null); setItems([]); load(true); }} disabled={loading}>{loading ? '加载中…' : '搜索'}</button>
        <button className="px-3 py-1 border rounded" onClick={()=>{ setSeed(''); setCountry(''); setNext(null); setItems([]); load(true); }} disabled={loading}>重置</button>
        <button className="px-3 py-1 border rounded" disabled={loading || items.length===0} onClick={()=>{
          const csvHeader = 'id,seedDomain,country,createdAt,summary,topKW,topDM\n';
          const rows = items.map(it=>{
            const topKW = Array.isArray((it as any).topKeywords)? (it as any).topKeywords.slice(0,3).map((k:any)=>k.keyword).filter(Boolean).join('|'):'';
            const topDM = Array.isArray((it as any).topDomains)? (it as any).topDomains.slice(0,3).map((d:any)=>d.domain).filter(Boolean).join('|'):'';
            const created = it.createdAt? new Date(it.createdAt as any).toISOString():'';
            const summary = (it as any).summary || '';
            const esc = (s:string)=> JSON.stringify(s??'');
            return `${it.id},${esc(it.seedDomain||'')},${esc(it.country||'')},${esc(created)},${esc(summary)},${esc(topKW)},${esc(topDM)}`;
          }).join('\n');
          downloadFile('opportunities.csv','text/csv', csvHeader+rows);
        }}>导出CSV</button>
        <button className="px-3 py-1 border rounded" disabled={loading || items.length===0} onClick={()=>{
          downloadFile('opportunities.json','application/json', JSON.stringify({ items }, null, 2));
        }}>导出JSON</button>
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>
      {items.length === 0 ? (
        <div className="text-gray-500">暂无数据</div>
      ) : (
        <>
        <table className="w-full border border-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2 border-b">ID</th>
              <th className="text-left p-2 border-b">Seed</th>
              <th className="text-left p-2 border-b">Country</th>
              <th className="text-left p-2 border-b">Created</th>
              <th className="text-left p-2 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b hover:bg-gray-50">
                <td className="p-2">{it.id}</td>
                <td className="p-2">{it.seedDomain}</td>
                <td className="p-2">{it.country || '-'}</td>
                <td className="p-2">{it.createdAt ? new Date(it.createdAt).toLocaleString() : ''}</td>
                <td className="p-2">
                  <div className="text-xs text-gray-600">
                    {it.summary && <div className="mb-1">{it.summary}</div>}
                    {Array.isArray(it.topKeywords) && it.topKeywords.length > 0 && (
                      <div className="mb-1">KW: {(it.topKeywords.slice(0,3)).map(k=>k.keyword).filter(Boolean).join(', ')}</div>
                    )}
                    {Array.isArray(it.topDomains) && it.topDomains.length > 0 && (
                      <div>DM: {(it.topDomains.slice(0,3)).map(d=>d.domain).filter(Boolean).join(', ')}</div>
                    )}
                  </div>
                  <div>
                    <a className="text-blue-600 hover:underline" href={`/recommend/opportunities/${it.id}`}>查看</a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3">
          <button className="px-3 py-1 border rounded" disabled={loading || !next} onClick={()=>load(false)}>{loading? '加载中…' : (next? '加载更多' : '没有更多了')}</button>
        </div>
        </>
      )}
    </div>
  );
}
