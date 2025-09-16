"use client";

import React, { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { http } from '@/shared/http/client'
import { toast } from 'sonner'
import { useLiveExecution } from '@/hooks/useLiveExecution'
import { useFeatureGuard } from '@/lib/utils/feature-guard'

type Template = { id?: string; name?: string; key?: string; [k:string]: any }

export default function QuickUpdateCard() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [templateId, setTemplateId] = useState<string>('')
  const [accountId, setAccountId] = useState<string>('mock')
  const [offerUrl, setOfferUrl] = useState<string>('')
  const [resolved, setResolved] = useState<{ finalUrl?: string; finalUrlSuffix?: string } | null>(null)
  const [dryResult, setDryResult] = useState<{ affected?: number; sample?: any[] } | null>(null)
  const [executing, setExecuting] = useState(false)
  const [execId, setExecId] = useState<string | undefined>(undefined)
  const { event, connected } = useLiveExecution(execId)
  const { guardAdsCenter } = useFeatureGuard()

  useEffect(() => {
    ;(async () => {
      try {
        const [tpl, acc] = await Promise.all([
          http.get<any>('/api/v2/adscenter/templates'),
          http.get<any>('/api/v2/adscenter/accounts')
        ])
        const list = Array.isArray(tpl?.items) ? tpl.items : []
        setTemplates(list)
        const accs = Array.isArray(acc?.items) ? acc.items : []
        // 追加 mock 账户用于验收
        setAccounts([{ customer_id: 'mock', name: 'Mock Account (本地验收)' }, ...accs])
      } catch (e) { /* no-op */ }
    })()
  }, [])

  const canExecute = useMemo(() => !!templateId && !!accountId, [templateId, accountId])

  const resolveOffer = async () => {
    if (!guardAdsCenter().ok) return
    if (!offerUrl.trim()) { toast.error('请输入 Offer URL'); return }
    const res = await http.post<any>('/api/v2/adscenter/offers/resolve', { offerUrl })
    if (res?.ok) { setResolved({ finalUrl: res.finalUrl, finalUrlSuffix: res.finalUrlSuffix }); toast.success('解析成功') }
    else { toast.error(res?.message || '解析失败'); setResolved(null) }
  }

  const dryRun = async () => {
    if (!guardAdsCenter().ok) return
    if (!canExecute) { toast.error('请选择模板和账户'); return }
    const res = await http.post<any>(`/api/v2/adscenter/templates/${encodeURIComponent(templateId)}/dry-run?account=${encodeURIComponent(accountId)}`, {})
    setDryResult({ affected: res?.affected || 0, sample: res?.sample || [] })
  }

  const execute = async () => {
    if (!guardAdsCenter().ok) return
    if (!canExecute) { toast.error('请选择模板和账户'); return }
    setExecuting(true)
    try {
      const res = await http.post<any>(`/api/v2/adscenter/templates/${encodeURIComponent(templateId)}/execute?account=${encodeURIComponent(accountId)}`, {})
      toast.success(`已提交：成功 ${res?.updated ?? 0}，失败 ${res?.failed ?? 0}`)
      if (res?.executionId) setExecId(res.executionId)
    } catch (e:any) {
      toast.error(e?.message || '执行失败')
    } finally { setExecuting(false) }
  }

  return (
    <Card className="p-6">
      <div className="text-lg font-semibold mb-4">快速更新（账号 + 模板 + 干跑 + 执行）</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <Label>模板</Label>
          <Select onValueChange={setTemplateId} value={templateId}>
            <SelectTrigger><SelectValue placeholder="选择模板"/></SelectTrigger>
            <SelectContent>
              {templates.map((t, i) => <SelectItem key={t.id || t.key || i} value={(t.id || t.key || String(i)) as string}>{t.name || t.id || t.key}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>账户</Label>
          <Select onValueChange={setAccountId} value={accountId}>
            <SelectTrigger><SelectValue placeholder="选择账户"/></SelectTrigger>
            <SelectContent>
              {accounts.map((a, i) => <SelectItem key={a.customer_id || a.id || i} value={(a.customer_id || a.id || 'mock') as string}>{a.name || a.customer_id || a.id}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button disabled={!canExecute} onClick={dryRun} variant="outline" className="w-full">干跑预估</Button>
        </div>
      </div>

      {dryResult && (
        <div className="mb-4 text-sm text-gray-700">预估影响条数：<b>{dryResult.affected}</b>，样例：{(dryResult.sample||[]).length}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
        <div className="col-span-2">
          <Label>Offer URL（可选：解析 Final URL/Suffix）</Label>
          <div className="flex gap-2">
            <Input placeholder="https://..." value={offerUrl} onChange={e=>setOfferUrl(e.target.value)} />
            <Button variant="secondary" onClick={resolveOffer}>解析</Button>
          </div>
        </div>
        <div className="flex items-end">
          <Button disabled={!canExecute || executing} onClick={execute} className="w-full">执行</Button>
        </div>
      </div>
      {resolved && (
        <div className="text-xs text-gray-600 mb-2">Final URL: {resolved.finalUrl} | Suffix: {resolved.finalUrlSuffix}</div>
      )}

      {execId && (
        <div className="mt-4 p-3 border rounded text-sm">
          <div className="mb-2">执行ID：{execId}（{connected ? 'SSE已连接' : '等待更新'}）</div>
          <div>状态：{event?.status || 'unknown'}，进度：{event?.progress ?? 0}%（{event?.processedItems ?? 0}/{event?.totalItems ?? 0}）</div>
        </div>
      )}
    </Card>
  )
}
