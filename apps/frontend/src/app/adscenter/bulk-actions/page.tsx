"use client";
import React from 'react';
import type { components as adsTypes } from '@/sdk/adscenter/types';

type Op = adsTypes['schemas']['BulkActionOperation'];

export default function BulkActionsListPage() {
  const [items, setItems] = React.useState<Op[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const resp = await fetch('/api/v1/adscenter/bulk-actions?limit=50', { headers: { 'accept': 'application/json' } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const j = await resp.json();
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch (e: any) { setError(e?.message || '加载失败'); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">批量计划</h1>
      <div className="flex items-center gap-3 mb-3">
        <button className="px-3 py-1 border rounded" onClick={load} disabled={loading}>{loading? '加载中…':'刷新'}</button>
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>
      {items.length === 0 ? <div className="text-gray-500">暂无数据</div> : (
        <table className="w-full border text-sm">
          <thead className="bg-gray-50">
            <tr><th className="p-2 text-left">ID</th><th className="p-2 text-left">状态</th><th className="p-2 text-left">创建时间</th><th className="p-2 text-left">操作</th></tr>
          </thead>
          <tbody>
            {items.map((op, i) => (
              <tr key={`${op.operationId}-${i}`} className="border-b">
                <td className="p-2">{op.operationId}</td>
                <td className="p-2">{op.status}</td>
                <td className="p-2">{op.createdAt ? new Date(op.createdAt as any).toLocaleString() : ''}</td>
                <td className="p-2"><a className="text-blue-600 hover:underline" href={`/adscenter/bulk-actions/${op.operationId}`}>查看</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

