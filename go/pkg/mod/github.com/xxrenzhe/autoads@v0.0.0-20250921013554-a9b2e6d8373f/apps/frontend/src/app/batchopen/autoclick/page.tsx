"use client";

import React, { useEffect, useState } from 'react';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';
import { http } from '@/shared/http/client';
import { ProtectedButton } from '@/components/auth/ProtectedButton';

type Schedule = {
  id: string
  name: string
  timezone: string
  timeWindow: string
  dailyTarget: number
  refererType?: string
  refererValue?: string
  proxyUrl?: string | null
  status: 'ENABLED' | 'DISABLED'
  createdAt: string
  updatedAt: string
}

export default function AutoClickSchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Schedule | null>(null)
  const [form, setForm] = useState({
    name: '',
    urls: '',
    timezone: 'US',
    timeWindow: '00:00-24:00',
    dailyTarget: 100,
    refererType: 'social',
    refererValue: '',
    proxyUrl: ''
  })

  async function load() {
    setLoading(true)
    try {
      const res = await http.get<{ success?: boolean, data?: any[] }>(`/batchopen/autoclick/schedules`)
      const list: any[] = Array.isArray(res) ? res : (res as any)?.data || []
      const mapped: Schedule[] = list.map((r: any) => ({
        id: r.id,
        name: r.name,
        timezone: r.timezone,
        timeWindow: r.timeWindow || r.time_window,
        dailyTarget: r.dailyTarget || r.daily_target,
        refererType: r.refererType || r.referer_type,
        refererValue: r.refererValue || r.referer_value,
        proxyUrl: r.proxyUrl ?? r.proxy_url ?? null,
        status: (r.status || 'DISABLED').toUpperCase(),
        createdAt: r.createdAt || r.created_at || new Date().toISOString(),
        updatedAt: r.updatedAt || r.updated_at || new Date().toISOString(),
      }))
      setSchedules(mapped)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', urls: '', timezone: 'US', timeWindow: '00:00-24:00', dailyTarget: 100, refererType: 'social', refererValue: '', proxyUrl: '' })
    setShowForm(true)
  }

  function openEdit(s: Schedule) {
    setEditing(s)
    setForm({ name: s.name, urls: '', timezone: s.timezone, timeWindow: s.timeWindow, dailyTarget: s.dailyTarget, refererType: s.refererType || 'social', refererValue: s.refererValue || '', proxyUrl: s.proxyUrl || '' })
    setShowForm(true)
  }

  async function save() {
    setSaving(true)
    try {
      const body: any = {
        name: form.name,
        urls: form.urls.split('\n').map(x => x.trim()).filter(Boolean),
        timezone: form.timezone,
        timeWindow: form.timeWindow,
        dailyTarget: form.dailyTarget,
        referer: { type: form.refererType, value: form.refererValue || undefined },
        proxyUrl: form.proxyUrl || undefined,
      }
      if (editing) {
        await http.put(`/batchopen/autoclick/schedules/${editing.id}`, body)
      } else {
        await http.post(`/batchopen/autoclick/schedules`, body)
      }
      setShowForm(false)
      await load()
    } catch (e) {
      alert('保存失败')
    }
    setSaving(false)
  }

  async function remove(id: string) {
    if (!confirm('确认删除该任务？')) return
    try { await http.delete(`/batchopen/autoclick/schedules/${id}`); await load() } catch { alert('删除失败') }
  }

  async function toggle(id: string, enable: boolean) {
    try {
      await http.post(`/batchopen/autoclick/schedules/${id}/${enable ? 'enable' : 'disable'}`)
      await load()
    } catch { alert('操作失败') }
  }

  async function viewProgress(id: string) {
    try {
      const r = await fetch(`/api/v2/autoclick/schedules/${id}/execution/current`)
      const j = await r.json().catch(()=>({}))
      if (!r.ok || !j?.id) { alert('当前无进行中任务'); return }
      window.location.href = `/adscenter/executions/v2/${j.id}`
    } catch { alert('获取进度失败') }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className={UI_CONSTANTS.typography.h2}>自动化点击任务</h1>
          <ProtectedButton featureName="autoclick" onClick={openCreate} className={UI_CONSTANTS.buttons.primary}>新增任务</ProtectedButton>
        </div>

        {showForm && (
          <div className={`${UI_CONSTANTS.cards.simple} p-6 mb-6`}>
            <h3 className={UI_CONSTANTS.typography.h3 + ' mb-4'}>{editing ? '编辑任务' : '新增任务'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600">任务名称</label>
                <input className="w-full border rounded-lg px-3 py-2" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-600">国家/时区</label>
                <select className="w-full border rounded-lg px-3 py-2" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}>
                  <option value="US">美国 US (UTC-8)</option>
                  <option value="CN">中国 CN (UTC+8)</option>
                  <option value="UK">英国 UK (UTC+0)</option>
                  <option value="JP">日本 JP (UTC+9)</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">执行时间段</label>
                <select className="w-full border rounded-lg px-3 py-2" value={form.timeWindow} onChange={e => setForm({ ...form, timeWindow: e.target.value })}>
                  <option value="00:00-24:00">00:00-24:00</option>
                  <option value="06:00-24:00">06:00-24:00</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">每日点击总数</label>
                <input type="number" min={1} className="w-full border rounded-lg px-3 py-2" value={form.dailyTarget} onChange={e => setForm({ ...form, dailyTarget: Number(e.target.value||0) })} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">URL 列表（每行一个）</label>
                <textarea className="w-full border rounded-lg px-3 py-2 min-h-[120px]" value={form.urls} onChange={e => setForm({ ...form, urls: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-600">Referer 类型</label>
                <select className="w-full border rounded-lg px-3 py-2" value={form.refererType} onChange={e => setForm({ ...form, refererType: e.target.value })}>
                  <option value="social">社媒</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">Referer 值（可选）</label>
                <input className="w-full border rounded-lg px-3 py-2" value={form.refererValue} onChange={e => setForm({ ...form, refererValue: e.target.value })} placeholder="https://www.facebook.com/" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">代理（可选）</label>
                <input className="w-full border rounded-lg px-3 py-2" value={form.proxyUrl} onChange={e => setForm({ ...form, proxyUrl: e.target.value })} placeholder="http://user:pass@ip:port" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className={UI_CONSTANTS.buttons.outline} onClick={() => setShowForm(false)}>取消</button>
              <ProtectedButton featureName="autoclick" onClick={save} disabled={saving} className={UI_CONSTANTS.buttons.primary}>{saving ? '保存中...' : '保存'}</ProtectedButton>
            </div>
          </div>
        )}

        <div className={`${UI_CONSTANTS.cards.simple} p-6`}>
          {loading ? (
            <div className="text-center text-gray-600">加载中...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center text-gray-600">暂无任务，点击“新增任务”创建</div>
          ) : (
            <div className="space-y-3">
              {schedules.map(s => (
                <div key={s.id} className="border rounded-xl p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{s.name}</div>
                    <div className="text-sm text-gray-600 mt-1">{s.timezone} · {s.timeWindow} · 每日 {s.dailyTarget} 次</div>
                    <div className="text-xs text-gray-500 mt-1">状态：{s.status === 'ENABLED' ? '已启动' : '未启动'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className={UI_CONSTANTS.buttons.outline} onClick={() => openEdit(s)}>编辑</button>
                    <button className={UI_CONSTANTS.buttons.outline} onClick={() => remove(s.id)}>删除</button>
                    {s.status === 'ENABLED' ? (
                      <ProtectedButton featureName="autoclick" className={UI_CONSTANTS.buttons.outline} onClick={() => toggle(s.id, false)}>停止</ProtectedButton>
                    ) : (
                      <ProtectedButton featureName="autoclick" className={UI_CONSTANTS.buttons.primary} onClick={() => toggle(s.id, true)}>启动</ProtectedButton>
                    )}
                    <ProtectedButton featureName="autoclick" className={UI_CONSTANTS.buttons.outline} onClick={() => viewProgress(s.id)}>查看进度</ProtectedButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
