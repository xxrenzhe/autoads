"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { AdminDashboardLayout } from '@/components/layout/DashboardLayout';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';

export default function AutoClickSystemConfigPage() {
  const [variance, setVariance] = useState('0.3');
  const [proxies, setProxies] = useState<{ code: string; value: string }[]>([
    { code: 'US', value: '' },
    { code: 'UK', value: '' },
    { code: 'CN', value: '' },
    { code: 'JP', value: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [httpConc, setHttpConc] = useState('10');
  const [brConc, setBrConc] = useState('3');
  const [maxStep, setMaxStep] = useState('3');
  const [userRPM, setUserRPM] = useState('');
  const [executorURL, setExecutorURL] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/ops/api/v1/console/system/config');
        const data = await res.json();
        const list: any[] = data?.data || [];
        const getVal = (k: string) => list.find((it: any) => it.config_key === k)?.config_value || '';
        const currentVariance = getVal('AutoClick_Count_Variance_Hour') || '0.3';
        setVariance(currentVariance);
        const prefix = 'Proxy_URL_';
        const existing = list
          .filter((it: any) => String(it.config_key || '').startsWith(prefix))
          .map((it: any) => ({ code: String(it.config_key).slice(prefix.length), value: it.config_value || '' }));
        const merged = [...proxies];
        existing.forEach((e: any) => {
          const idx = merged.findIndex(m => m.code.toUpperCase() === String(e.code).toUpperCase());
          if (idx >= 0) merged[idx].value = e.value; else merged.push({ code: e.code.toUpperCase(), value: e.value });
        });
        setProxies(merged);
        // load concurrency & throttling
        // 复用上面的 getVal，避免重复声明导致运行时错误
        setHttpConc(getVal('AutoClick_HTTP_Concurrency') || '10');
        setBrConc(getVal('AutoClick_Browser_Concurrency') || '3');
        setMaxStep(getVal('AutoClick_MaxStepPerTick') || '3');
        setUserRPM(getVal('AutoClick_User_RPM') || '');
        setExecutorURL(getVal('AutoClick_Browser_Executor_URL') || '');
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true); setMessage('');
    try {
      const ops: any[] = [];
      ops.push({ op: 'set', key: 'AutoClick_Count_Variance_Hour', value: variance || '0.3', category: 'autoclick', description: 'variance' });
      const seenKeys: string[] = [];
      proxies.forEach(p => {
        const code = (p.code || '').toUpperCase().replace(/[^A-Z]/g, '');
        if (!code) return;
        const key = `Proxy_URL_${code}`;
        seenKeys.push(key);
        if (p.value && p.value.trim()) {
          ops.push({ op: 'set', key, value: p.value.trim(), category: 'autoclick', description: 'proxy url' });
        } else {
          ops.push({ op: 'unset', key });
        }
      });
      // add concurrency & throttling ops
      ops.push({ op: 'set', key: 'AutoClick_HTTP_Concurrency', value: httpConc || '10', category: 'autoclick', description: 'http concurrency' });
      ops.push({ op: 'set', key: 'AutoClick_Browser_Concurrency', value: brConc || '3', category: 'autoclick', description: 'browser concurrency' });
      ops.push({ op: 'set', key: 'AutoClick_MaxStepPerTick', value: maxStep || '3', category: 'autoclick', description: 'max step per tick' });
      if (userRPM) ops.push({ op: 'set', key: 'AutoClick_User_RPM', value: userRPM, category: 'autoclick', description: 'per-user rpm' }); else ops.push({ op: 'unset', key: 'AutoClick_User_RPM' });
      if (executorURL) ops.push({ op: 'set', key: 'AutoClick_Browser_Executor_URL', value: executorURL, category: 'autoclick', description: 'browser executor url' }); else ops.push({ op: 'unset', key: 'AutoClick_Browser_Executor_URL' });
      const r = await fetch('/ops/api/v1/console/system/config/batch', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ops) });
      if (!r.ok) throw new Error('batch save failed');
      setMessage('保存成功（正在热更新）');
    } catch (e) {
      setMessage('保存失败');
    }
    setSaving(false);
  };

  const validateProxy = async (value: string) => {
    if (!value || !value.trim()) { alert('请输入代理地址'); return; }
    try {
      const res = await fetch('/api/batchopen/proxy-url-validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proxyUrl: value.trim() }) });
      const data = await res.json();
      if (res.ok && (data?.valid ?? false)) alert('代理可用'); else alert(`无效代理：${data?.message || 'unknown'}`);
    } catch {
      alert('验证失败');
    }
  }

  return (
    <AdminDashboardLayout title="AutoClick 配置" description="通过系统配置热更新 Proxy 与方差">
      <div className="space-y-4">
        {loading ? (
          <div className="text-gray-500">加载中...</div>
        ) : (
          <div className={`${UI_CONSTANTS.cards.simple} p-6 space-y-4`}>
            <div>
              <label className="block text-sm text-gray-600 mb-2">国家代理（Proxy_URL_{'{COUNTRY}'})</label>
              <div className="space-y-2">
                {proxies.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input className="col-span-2 border rounded px-3 py-2" value={p.code} onChange={e => {
                      const v = e.target.value.toUpperCase();
                      setProxies(prev => prev.map((it, i) => i===idx ? { ...it, code: v } : it))
                    }} placeholder="US" />
                    <textarea className="col-span-9 border rounded px-3 py-2 min-h-[60px]" value={p.value} onChange={e => setProxies(prev => prev.map((it, i) => i===idx ? { ...it, value: e.target.value } : it))} placeholder="http://user:pass@ip:port 或代理拉取接口"></textarea>
                    <div className="col-span-1 flex flex-col gap-2">
                      <button className={UI_CONSTANTS.buttons.outline} onClick={() => validateProxy(p.value)}>验证</button>
                      <button className={UI_CONSTANTS.buttons.outline} onClick={() => setProxies(prev => prev.filter((_, i) => i!==idx))}>移除</button>
                    </div>
                  </div>
                ))}
                <div>
                  <button className={UI_CONSTANTS.buttons.outline} onClick={() => setProxies(prev => [...prev, { code: '', value: '' }])}>添加国家</button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">留空即为禁用该国家默认代理</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">HTTP 并发（AutoClick_HTTP_Concurrency）</label>
                <input type="number" min={1} className="w-48 border rounded px-3 py-2" value={httpConc} onChange={e => setHttpConc(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">浏览器并发（AutoClick_Browser_Concurrency）</label>
                <input type="number" min={1} className="w-48 border rounded px-3 py-2" value={brConc} onChange={e => setBrConc(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">每 Tick 最大推进（AutoClick_MaxStepPerTick）</label>
                <input type="number" min={1} className="w-48 border rounded px-3 py-2" value={maxStep} onChange={e => setMaxStep(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">用户 RPM（AutoClick_User_RPM，可选）</label>
                <input type="number" min={0} className="w-48 border rounded px-3 py-2" value={userRPM} onChange={e => setUserRPM(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">浏览器执行器 URL（AutoClick_Browser_Executor_URL）</label>
              <input type="text" className="w-full border rounded px-3 py-2" value={executorURL} onChange={e => setExecutorURL(e.target.value)} placeholder="http://next-host/api/executor/puppeteer 或独立执行器地址" />
              <p className="text-xs text-gray-500 mt-1">配置后将通过该地址执行真实浏览器访问</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">AutoClick_Count_Variance_Hour</label>
              <input type="number" min={0} max={0.9} step={0.05} className="w-48 border rounded px-3 py-2" value={variance} onChange={e => setVariance(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">每小时目标值的随机方差（建议 0.2~0.4）</p>
            </div>
            <div className="flex items-center gap-3">
              <button className={UI_CONSTANTS.buttons.primary} onClick={save} disabled={saving}>保存配置</button>
              {message && <span className="text-sm text-gray-600">{message}</span>}
            </div>
          </div>
        )}
      </div>
    </AdminDashboardLayout>
  );
}
