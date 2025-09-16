"use client";

import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useFeatureGuard } from '@/lib/utils/feature-guard'

type BindingRow = {
  offer_id: string
  offer_url: string
  offer_status: string
  binding_id?: string
  account_id?: string
  rotation_frequency?: string
  rotation_at?: string
  unique_window_days?: number
  active?: boolean
  last_rotation_at?: string
  next_rotation_at?: string
}

export default function OffersPage() {
  const [rows, setRows] = useState<BindingRow[]>([])
  const [offerUrl, setOfferUrl] = useState('')
  const [accountId, setAccountId] = useState('mock')
  const [frequency, setFrequency] = useState('daily')
  const [rotations, setRotations] = useState<any[]>([])
  const [viewId, setViewId] = useState<string | null>(null)
  const { guardAdsCenter } = useFeatureGuard()

  const fetchList = async () => {
    const r = await fetch('/api/v2/adscenter/offers')
    const j = await r.json()
    setRows(j?.items || [])
  }
  useEffect(()=>{ fetchList().catch(()=>{}) },[])

  const bind = async () => {
    if (!guardAdsCenter().ok) return
    try {
      const res = await fetch('/api/v2/adscenter/offers', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ offerUrl, accountId, rotationFrequency: frequency }) })
      if (!res.ok) throw new Error('绑定失败')
      toast.success('绑定成功'); setOfferUrl(''); fetchList()
    } catch(e:any) { toast.error(e?.message || '绑定失败') }
  }

  const rotate = async (bindingId?: string) => {
    if (!guardAdsCenter().ok) return
    if (!bindingId) return
    const res = await fetch(`/api/v2/adscenter/offers/${bindingId}/rotate`, { method:'POST' })
    const j = await res.json().catch(()=>({}))
    if (res.ok && j?.ok) { toast.success('已轮换'); fetchList() } else { toast.error(j?.message || '轮换失败') }
  }

  const viewHistory = async (bindingId?: string) => {
    if (!bindingId) return
    const r = await fetch(`/api/v2/adscenter/offers/${bindingId}/rotations`)
    const j = await r.json().catch(()=>({}))
    setViewId(bindingId)
    setRotations(j?.items || [])
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Card className="p-6">
        <div className="text-lg font-semibold mb-3">新建绑定</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label>Offer URL</Label><Input value={offerUrl} onChange={e=>setOfferUrl(e.target.value)} placeholder="https://..."/></div>
          <div>
            <Label>账户</Label>
            <Input value={accountId} onChange={e=>setAccountId(e.target.value)} placeholder="mock 或 customerId"/>
          </div>
          <div>
            <Label>频率</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">hourly</SelectItem>
                <SelectItem value="daily">daily</SelectItem>
                <SelectItem value="weekly">weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4"><Button onClick={bind}>绑定</Button></div>
      </Card>

      <Card className="p-6">
        <div className="text-lg font-semibold mb-3">绑定列表</div>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={`${r.offer_id}-${r.binding_id}-${i}`} className="border rounded p-3">
              <div className="text-sm text-gray-600">Offer: {r.offer_url}</div>
              <div className="text-xs text-gray-500">绑定ID: {r.binding_id || '-'}</div>
              <div className="text-xs text-gray-500">账户: {r.account_id || '-'}, 频率: {r.rotation_frequency || '-'}</div>
              <div className="text-xs text-gray-500">上次: {r.last_rotation_at || '-'}，下次: {r.next_rotation_at || '-'}</div>
              <div className="mt-2 space-x-2">
                {r.binding_id && <Button variant="outline" onClick={()=>rotate(r.binding_id)}>手动轮换</Button>}
                {r.binding_id && <Button variant="outline" onClick={()=>viewHistory(r.binding_id)}>查看历史</Button>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {viewId && (
        <Card className="p-6">
          <div className="text-lg font-semibold mb-3">轮换历史（绑定 {viewId}）</div>
          <div className="space-y-2 text-sm">
            {rotations.length === 0 ? <div className="text-gray-500">暂无历史</div> : rotations.map((x:any, idx:number) => (
              <div key={idx} className="border rounded p-2">
                <div>时间：{x.rotatedAt || x.rotated_at}</div>
                <div>状态：{x.status}</div>
                <div className="text-gray-600 break-all">{x.finalUrl}{x.finalUrlSuffix ? ('?'+x.finalUrlSuffix) : ''}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
