"use client";

import React, { useState } from 'react';
import { AdminDashboardLayout } from '@/components/layout/DashboardLayout';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';
import { useAdminAutoClickProblemUrls, useAdminAutoClickProblemUrlsActions, useAdminAutoClickProblemUrlsBatchActions } from '@/lib/hooks/admin/useAdminAutoClickProblemUrls';

export default function ProblemUrlsPage() {
  const [q, setQ] = useState('');
  const [userId, setUserId] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminAutoClickProblemUrls({ q, userId, page, limit: 20 });
  const { preferBrowser, resetCounters, remove } = useAdminAutoClickProblemUrlsActions();
  const batch = useAdminAutoClickProblemUrlsBatchActions();
  const [selected, setSelected] = useState<string[]>([]);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState('');
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<any>(null);
  const [diagUrl, setDiagUrl] = useState<string>('');
  const runDiagnosis = async (url: string) => {
    setDiagOpen(true); setDiagLoading(true); setDiagResult(null); setDiagUrl(url);
    try {
      const res = await fetch('/api/executor/puppeteer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, waitUntil: 'domcontentloaded', timeoutMs: 20000, screenshot: true, fullPage: false }) });
      const data = await res.json();
      setDiagResult(data);
    } catch (e) {
      setDiagResult({ ok: false, error: 'diagnosis failed' })
    }
    setDiagLoading(false);
  }

  const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => {
    const ids = (data?.rows || []).map((r: any) => r.id);
    const all = ids.every((id: string) => selected.includes(id));
    setSelected(all ? [] : ids);
  };

  return (
    <AdminDashboardLayout title="AutoClick 问题 URL" description="查看并处理连续失败的URL记录">
      <div className="space-y-4">
        <div className={`${UI_CONSTANTS.cards.simple} p-4 grid grid-cols-1 md:grid-cols-3 gap-3`}>
          <input className="border rounded px-3 py-2" placeholder="搜索URL关键词" value={q} onChange={e => setQ(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="按用户ID筛选（可选）" value={userId} onChange={e => setUserId(e.target.value)} />
          <div className="flex gap-2">
            <button className={UI_CONSTANTS.buttons.primary} onClick={() => setPage(1)}>搜索</button>
            <button className={UI_CONSTANTS.buttons.outline} onClick={() => { setQ(''); setUserId(''); setPage(1); }}>重置</button>
          </div>
        </div>

          <div className={`${UI_CONSTANTS.cards.simple} p-0 overflow-hidden`}>
            {/* 批量操作工具栏 */}
            <div className="flex items-center justify-between p-3 border-b bg-gray-50">
              <div className="text-sm text-gray-600">已选中 {selected.length} 条</div>
              <div className="flex gap-2">
                <button className={UI_CONSTANTS.buttons.outline} disabled={!selected.length || batch.isPending} onClick={() => batch.mutate({ ids: selected, op: 'prefer' })}>批量优先浏览器</button>
                <button className={UI_CONSTANTS.buttons.outline} disabled={!selected.length || batch.isPending} onClick={() => batch.mutate({ ids: selected, op: 'reset' })}>批量重置计数</button>
                <button className={UI_CONSTANTS.buttons.outline} disabled={!selected.length || batch.isPending} onClick={() => batch.mutate({ ids: selected, op: 'clear_prefer' as any })}>批量清除优先</button>
                <button className={UI_CONSTANTS.buttons.danger} disabled={!selected.length || batch.isPending} onClick={() => { if (confirm('确认删除选中记录？')) batch.mutate({ ids: selected, op: 'delete' }) }}>批量删除</button>
              </div>
            </div>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2"><input type="checkbox" onChange={toggleAll} checked={(data?.rows || []).length>0 && (data?.rows || []).every((r:any)=>selected.includes(r.id))} /></th>
                <th className="px-3 py-2 text-left">URL</th>
                <th className="px-3 py-2 text-left">用户</th>
                <th className="px-3 py-2">HTTP失败</th>
                <th className="px-3 py-2">浏览器失败</th>
                <th className="px-3 py-2">最近失败</th>
                <th className="px-3 py-2">优先浏览器至</th>
                <th className="px-3 py-2">备注</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">加载中...</td></tr>
              ) : (data?.rows || []).length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">暂无数据</td></tr>
              ) : (
                (data?.rows || []).map((r: any) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 text-center"><input type="checkbox" checked={selected.includes(r.id)} onChange={()=>toggle(r.id)} /></td>
                    <td className="px-3 py-2 break-all max-w-[420px]">{r.url}</td>
                    <td className="px-3 py-2 text-gray-600">{r.userId}</td>
                    <td className="px-3 py-2 text-center">{r.httpFailConsecutive}</td>
                    <td className="px-3 py-2 text-center">{r.browserFailConsecutive}</td>
                    <td className="px-3 py-2 text-gray-600">{r.lastFailAt ? new Date(r.lastFailAt).toLocaleString('zh-CN') : '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.preferBrowserUntil ? new Date(r.preferBrowserUntil).toLocaleString('zh-CN') : '-'}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[260px] truncate" title={r.notes || ''}>{r.notes || '-'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2 justify-end">
                        <button className={UI_CONSTANTS.buttons.outline} onClick={() => preferBrowser.mutate(r.id)} disabled={preferBrowser.isPending}>优先浏览器</button>
                        <button className={UI_CONSTANTS.buttons.outline} onClick={() => resetCounters.mutate(r.id)} disabled={resetCounters.isPending}>重置计数</button>
                        {r.preferBrowserUntil && (
                          <button className={UI_CONSTANTS.buttons.outline} onClick={async () => { try { await fetch(`/ops/api/v1/console/autoclick/url-failures/${r.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ clearPrefer: true }) }); location.reload() } catch {} }}>清除优先</button>
                        )}
                        <button className={UI_CONSTANTS.buttons.outline} onClick={() => runDiagnosis(r.url)}>诊断</button>
                        <button className={UI_CONSTANTS.buttons.outline} onClick={() => { setEditingNotesId(r.id); setEditingNotesValue(r.notes || '') }}>备注</button>
                        <button className={UI_CONSTANTS.buttons.danger} onClick={() => { if (confirm('确认删除记录？')) remove.mutate(r.id) }} disabled={remove.isPending}>删除</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {editingNotesId && (
          <div className={`${UI_CONSTANTS.cards.simple} p-4 flex items-center gap-3`}>
            <textarea className="flex-1 border rounded px-3 py-2 min-h-[80px]" value={editingNotesValue} onChange={e => setEditingNotesValue(e.target.value)} placeholder="填写备注..." />
            <button className={UI_CONSTANTS.buttons.primary} onClick={async () => {
              try {
                await fetch(`/ops/api/v1/console/autoclick/url-failures/${editingNotesId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: editingNotesValue }) })
                setEditingNotesId(null)
                setSelected([])
                location.reload()
              } catch {}
            }}>保存</button>
            <button className={UI_CONSTANTS.buttons.outline} onClick={() => setEditingNotesId(null)}>取消</button>
          </div>
        )}

        {diagOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-[720px] max-w-[95vw] p-4 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">诊断：{diagUrl}</h3>
                <button className={UI_CONSTANTS.buttons.outline} onClick={() => setDiagOpen(false)}>关闭</button>
              </div>
              {diagLoading ? (
                <div className="text-gray-500 p-6">诊断中...</div>
              ) : diagResult ? (
                <div className="space-y-3">
                  <div className="text-sm text-gray-700">
                    <div>结果：{diagResult.ok ? '成功' : '失败'}</div>
                    <div>分类：{diagResult.classification || '-'}</div>
                    <div>HTTP：{diagResult.httpStatus ?? '-'}</div>
                    <div>最终URL：{diagResult.finalUrl || '-'}</div>
                    <div>耗时：{diagResult.durationMs} ms</div>
                  </div>
                  {diagResult.screenshotBase64 && (
                    <div className="border rounded overflow-hidden">
                      <img src={`data:image/jpeg;base64,${diagResult.screenshotBase64}`} alt="screenshot" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 p-6">无结果</div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button className={UI_CONSTANTS.buttons.outline} onClick={() => setPage(p => Math.max(1, p - 1))}>上一页</button>
          <span className="text-sm text-gray-600">第 {page} 页</span>
          <button className={UI_CONSTANTS.buttons.outline} onClick={() => setPage(p => p + 1)} disabled={(data?.rows?.length || 0) < 20}>下一页</button>
        </div>
      </div>
    </AdminDashboardLayout>
  );
}
