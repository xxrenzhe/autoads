"use client";
import React from 'react';
import type { components as adsTypes } from '@/sdk/adscenter/types';

type Op = adsTypes['schemas']['BulkActionOperation'];
type AuditItem = adsTypes['schemas']['BulkActionAuditItem'];

export default function BulkActionDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [op, setOp] = React.useState<Op | null>(null);
  const [audits, setAudits] = React.useState<AuditItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rbPlan, setRbPlan] = React.useState<any | null>(null);
  const [rbMsg, setRbMsg] = React.useState<string>('');
  const [rbLoading, setRbLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(id)}`, { headers: { 'accept':'application/json' } }),
        fetch(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(id)}/audits`, { headers: { 'accept':'application/json' } }),
      ]);
      if (!r1.ok) throw new Error(`op ${r1.status}`);
      if (!r2.ok) throw new Error(`audits ${r2.status}`);
      const j1 = await r1.json();
      const j2 = await r2.json();
      setOp(j1 as any);
      setAudits(Array.isArray(j2.items) ? (j2.items as any) : []);
    } catch (e: any) { setError(e?.message || '加载失败'); }
    finally { setLoading(false); }
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  const planAudit = audits.find(a => (a.kind as any) === 'before');
  const actionAudits = audits.filter(a => (a.kind as any) === 'other');
  const afterAudits = audits.filter(a => (a.kind as any) === 'after');

  const loadRollbackPlan = async () => {
    setRbLoading(true); setRbMsg('');
    try {
      const r = await fetch(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(id)}/rollback-plan`, { headers: { 'accept': 'application/json' } })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      setRbPlan(j?.plan || null)
      setRbMsg('已加载回滚计划')
    } catch (e: any) {
      setRbMsg(`加载失败：${e?.message || 'unknown'}`)
    } finally { setRbLoading(false) }
  }
  const executeRollback = async () => {
    setRbLoading(true); setRbMsg('');
    try {
      const r = await fetch(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(id)}/rollback-execute`, { method: 'POST', headers: { 'accept': 'application/json' } })
      if (r.status !== 202) throw new Error(`HTTP ${r.status}`)
      const j = await r.json().catch(()=>({}))
      setRbMsg(`已触发回滚：executed=${j?.executed ?? '?'} errors=${j?.errors ?? 0}`)
    } catch (e: any) {
      setRbMsg(`回滚失败：${e?.message || 'unknown'}`)
    } finally { setRbLoading(false) }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">批量计划详情 #{id}</h1>
      <div className="flex items-center gap-3 mb-3">
        <a className="text-blue-600 hover:underline" href="/adscenter/bulk-actions">返回列表</a>
        <button className="px-3 py-1 border rounded" onClick={load} disabled={loading}>{loading? '加载中…':'刷新'}</button>
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>
      {!op ? <div className="text-gray-500">{loading? '加载中…':'暂无数据'}</div> : (
        <div className="space-y-4">
          <div>
            <div className="font-medium">概况</div>
            <div className="text-sm text-gray-700">状态：{op.status} {op.createdAt && <>｜创建：{new Date(op.createdAt as any).toLocaleString()}</>} {op.updatedAt && <>｜更新：{new Date(op.updatedAt as any).toLocaleString()}</>}</div>
          </div>
          <div>
            <div className="font-medium mb-1">计划（提交时）</div>
            <pre className="text-xs bg-gray-50 p-3 rounded border overflow-auto" style={{ maxHeight: 320 }}>{planAudit ? JSON.stringify(planAudit.snapshot, null, 2) : '无'}</pre>
          </div>
          <div>
            <div className="font-medium mb-1">动作（细粒度审计）</div>
            {actionAudits.length === 0 ? <div className="text-gray-500">无</div> : (
              <table className="w-full border text-sm">
                <thead className="bg-gray-50"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">类型</th><th className="p-2 text-left">参数</th></tr></thead>
                <tbody>
                  {actionAudits.map((a, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{(a.snapshot as any)?.actionIndex ?? i}</td>
                      <td className="p-2">{(a.snapshot as any)?.type ?? ''}</td>
                      <td className="p-2"><pre className="text-xs whitespace-pre-wrap">{JSON.stringify((a.snapshot as any)?.params ?? {}, null, 2)}</pre></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div>
            <div className="font-medium mb-1">执行结果（after 快照）</div>
            {afterAudits.length === 0 ? <div className="text-gray-500">无</div> : (
              <pre className="text-xs bg-gray-50 p-3 rounded border overflow-auto" style={{ maxHeight: 320 }}>{JSON.stringify(afterAudits.map(a=>a.snapshot), null, 2)}</pre>
            )}
          </div>

          <div>
            <div className="font-medium mb-1">回滚</div>
            <div className="flex items-center gap-2 mb-2">
              <button className="px-3 py-1 border rounded" onClick={loadRollbackPlan} disabled={rbLoading}>加载回滚计划</button>
              <button className="px-3 py-1 border rounded" onClick={executeRollback} disabled={rbLoading}>执行回滚</button>
              {rbMsg && <span className="text-sm text-gray-600">{rbMsg}</span>}
            </div>
            <pre className="text-xs bg-gray-50 p-3 rounded border overflow-auto" style={{ maxHeight: 240 }}>{rbPlan ? JSON.stringify(rbPlan, null, 2) : '未加载'}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
