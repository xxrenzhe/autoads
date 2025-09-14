import React from 'react';

// 临时简化版本，避免依赖问题
export function AdminApp() {
  // SiteRank 设置
  const [srMapping, setSrMapping] = useState<string>('{}');
  const [srWeights, setSrWeights] = useState<{ globalRank: number; monthlyVisits: number }>({ globalRank: 0.6, monthlyVisits: 0.4 });
  const [srMsg, setSrMsg] = useState<string>('');

  // 限流覆盖
  const [rlOverrides, setRlOverrides] = useState<string>('{}');
  const [rlEnv, setRlEnv] = useState<any>({});
  const [rlMsg, setRlMsg] = useState<string>('');

  // Token 规则试算
  const [tkFeature, setTkFeature] = useState<string>('siterank');
  const [tkAction, setTkAction] = useState<string>('default');
  const [tkCount, setTkCount] = useState<number>(1);
  const [tkResult, setTkResult] = useState<{ per?: number; total?: number } | null>(null);
  const [tkMsg, setTkMsg] = useState<string>('');

  // 任务中心（最小版）
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskMsg, setTaskMsg] = useState<string>('');

  useEffect(() => {
    // 加载 SiteRank 设置
    fetch('/api/admin/siterank/settings').then(r => r.json()).then(data => {
      if (data?.data) {
        setSrWeights(data.data.weights || { globalRank: 0.6, monthlyVisits: 0.4 });
        try { setSrMapping(JSON.stringify(data.data.mapping || {}, null, 2)); } catch { setSrMapping('{}'); }
      }
    }).catch(() => {});
    // 加载限流覆盖与当前 ENV
    fetch('/api/admin/rate-limit/overrides').then(r => r.json()).then(data => {
      try { setRlOverrides(JSON.stringify(data.data || {}, null, 2)); } catch { setRlOverrides('{}'); }
"use client";
import React, { useEffect, useState } from 'react';
      setRlEnv(data.env || {});
    }).catch(() => {});
    // 加载任务列表
    fetch('/api/tasks').then(r => r.json()).then(data => {
      setTasks(data?.data || []);
    }).catch(() => {});
  }, []);

  async function saveSiteRankSettings() {
    setSrMsg('');
    try {
      const mapping = JSON.parse(srMapping || '{}');
      const res = await fetch('/api/admin/siterank/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mapping, weights: srWeights })
      });
      if (!res.ok) throw new Error('保存失败');
      setSrMsg('保存成功');
    } catch (e: any) {
      setSrMsg(`保存失败: ${e.message || String(e)}`);
    }
  }

  async function saveRateLimitOverrides() {
    setRlMsg('');
    try {
      const overrides = JSON.parse(rlOverrides || '{}');
      const res = await fetch('/api/admin/rate-limit/overrides', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(overrides)
      });
      if (!res.ok) throw new Error('保存失败');
      setRlMsg('保存成功（实际生效需更新运行时 ENV 或后端配置）');
    } catch (e: any) {
      setRlMsg(`保存失败: ${e.message || String(e)}`);
    }
  }

  async function tryCalcTokens() {
    setTkMsg(''); setTkResult(null);
    try {
      const res = await fetch('/api/admin/tokens/try-calc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feature: tkFeature, action: tkAction, count: tkCount })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || '计算失败');
      setTkResult(data.data || {});
    } catch (e: any) {
      setTkMsg(`计算失败: ${e.message || String(e)}`);
    }
  }

  async function retryTask(id: string) {
    setTaskMsg('');
    try {
      const res = await fetch(`/api/tasks/${id}/retry`, { method: 'POST' });
      if (!res.ok) throw new Error('重试请求失败');
      setTaskMsg('重试请求已发送');
    } catch (e: any) {
      setTaskMsg(`重试失败: ${e.message || String(e)}`);
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: 1000, margin: '0 auto' }}>
      <h1>Admin Dashboard</h1>
      <p style={{ color: '#666' }}>最小版 Admin 界面：支持 SiteRank 设置、限流策略、Token 试算、审计导出与任务中心</p>

      {/* SiteRank 设置 */}
      <section style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>SiteRank 设置（字段映射 + 权重）</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <label>GlobalRank 权重: <input type="number" step="0.1" min={0} max={1} value={srWeights.globalRank} onChange={e => setSrWeights({ ...srWeights, globalRank: parseFloat(e.target.value) || 0 })} /></label>
          <label>MonthlyVisits 权重: <input type="number" step="0.1" min={0} max={1} value={srWeights.monthlyVisits} onChange={e => setSrWeights({ ...srWeights, monthlyVisits: parseFloat(e.target.value) || 0 })} /></label>
        </div>
        <textarea value={srMapping} onChange={e => setSrMapping(e.target.value)} rows={6} style={{ width: '100%', fontFamily: 'monospace' }} placeholder='{"sourceField":"targetField"}' />
        <div style={{ marginTop: 8 }}>
          <button onClick={saveSiteRankSettings} style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: 6 }}>保存</button>
          {srMsg && <span style={{ marginLeft: 8, color: srMsg.includes('失败') ? 'red' : 'green' }}>{srMsg}</span>}
        </div>
      </section>

      {/* 限流策略（覆盖保存到 SystemConfig） */}
      <section style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>限流策略（覆盖）</h2>
        <p style={{ color: '#666', marginBottom: 8 }}>当前运行 ENV：{Object.entries(rlEnv || {}).map(([k, v]) => `${k}=${v}`).join(' | ') || 'N/A'}</p>
        <textarea value={rlOverrides} onChange={e => setRlOverrides(e.target.value)} rows={6} style={{ width: '100%', fontFamily: 'monospace' }} placeholder='{"RATE_LIMIT_SITERANK_PER_MINUTE":40}' />
        <div style={{ marginTop: 8 }}>
          <button onClick={saveRateLimitOverrides} style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: 6 }}>保存</button>
          {rlMsg && <span style={{ marginLeft: 8, color: rlMsg.includes('失败') ? 'red' : 'green' }}>{rlMsg}</span>}
        </div>
      </section>

      {/* Token 规则试算 */}
      <section style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Token 规则试算</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <label>Feature:
            <select value={tkFeature} onChange={e => setTkFeature(e.target.value)}>
              <option value="siterank">siterank</option>
              <option value="batchopen">batchopen</option>
              <option value="adscenter">adscenter</option>
            </select>
          </label>
          <label>Action: <input value={tkAction} onChange={e => setTkAction(e.target.value)} placeholder='default/update_ad' /></label>
          <label>Count: <input type="number" min={1} value={tkCount} onChange={e => setTkCount(parseInt(e.target.value || '1', 10))} /></label>
          <button onClick={tryCalcTokens} style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: 6 }}>试算</button>
        </div>
        {tkResult && <p style={{ color: '#333' }}>每次消耗: {tkResult.per} | 总消耗: {tkResult.total}</p>}
        {tkMsg && <p style={{ color: 'red' }}>{tkMsg}</p>}
      </section>

      {/* 审计导出 */}
      <section style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>审计日志导出</h2>
        <p style={{ color: '#666', marginBottom: 8 }}>支持导出 JSON 或 CSV；可选时间范围参数 start/end（ISO 字符串）。</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="/api/admin/audits/export?format=json" target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: 6, textDecoration: 'none' }}>导出 JSON（全部）</a>
          <a href="/api/admin/audits/export?format=csv" target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: 6, textDecoration: 'none' }}>导出 CSV（全部）</a>
        </div>
      </section>

      {/* 任务中心（最小版） */}
      <section style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>任务中心（最小版）</h2>
        {taskMsg && <p style={{ color: taskMsg.includes('失败') ? 'red' : 'green' }}>{taskMsg}</p>}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #eee', textAlign: 'left', padding: 6 }}>ID</th>
              <th style={{ borderBottom: '1px solid #eee', textAlign: 'left', padding: 6 }}>类型</th>
              <th style={{ borderBottom: '1px solid #eee', textAlign: 'left', padding: 6 }}>状态</th>
              <th style={{ borderBottom: '1px solid #eee', textAlign: 'left', padding: 6 }}>进度</th>
              <th style={{ borderBottom: '1px solid #eee', textAlign: 'left', padding: 6 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td style={{ borderBottom: '1px solid #f3f3f3', padding: 6 }}>{t.id}</td>
                <td style={{ borderBottom: '1px solid #f3f3f3', padding: 6 }}>{t.type}</td>
                <td style={{ borderBottom: '1px solid #f3f3f3', padding: 6 }}>{t.status}</td>
                <td style={{ borderBottom: '1px solid #f3f3f3', padding: 6 }}>{t.progress ?? 0}%</td>
                <td style={{ borderBottom: '1px solid #f3f3f3', padding: 6 }}>
                  {t.type === 'adscenter' && (
                    <button onClick={() => retryTask(t.id)} style={{ padding: '4px 10px', border: '1px solid #ccc', borderRadius: 6 }}>重试</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
