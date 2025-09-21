"use client";

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

import { useSession } from 'next-auth/react'
import { useEffect } from 'react'

export default function AdminAdscenterMetricsPage() {
  const { data: session } = useSession()
  useEffect(()=>{
    const role = (session as any)?.user?.role
    if (!role || String(role).toUpperCase() !== 'ADMIN') {
      if (typeof window !== 'undefined') window.location.href = '/ops/console/login'
    }
  }, [session])
  const [userId, setUserId] = useState('')
  const [account, setAccount] = useState('mock')
  const [days, setDays] = useState(7)

  const backfill = async () => {
    const qs = new URLSearchParams()
    if (userId.trim()) qs.set('userId', userId.trim())
    if (account.trim()) qs.set('account', account.trim())
    if (days>0) qs.set('days', String(days))
    const res = await fetch(`/api/v2/admin/adscenter/metrics/backfill?${qs.toString()}`, { method: 'POST' })
    const j = await res.json().catch(()=>({}))
    if (!res.ok || j?.ok !== true) { toast.error(j?.message || '回填失败'); return }
    toast.success(`回填完成，插入 ${j?.inserted ?? 0}`)
  }

  const exportCreds = async () => {
    const t = Date.now()
    const a = document.createElement('a')
    a.href = '/api/v2/admin/adscenter/google-ads/credentials/export'
    a.download = `google_ads_credentials_${t}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Card className="p-6 space-y-3">
        <div className="text-lg font-semibold">指标回填</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>User ID（可选）</Label>
            <Input value={userId} onChange={e=>setUserId(e.target.value)} placeholder="不填则对全部活跃账号"/>
          </div>
          <div>
            <Label>Account（可选）</Label>
            <Input value={account} onChange={e=>setAccount(e.target.value)} placeholder="customerId 或 mock"/>
          </div>
          <div>
            <Label>Days</Label>
            <Input type="number" value={days} onChange={e=>setDays(parseInt(e.target.value||'7'))}/>
          </div>
        </div>
        <Button onClick={backfill}>触发回填</Button>
      </Card>

      <Card className="p-6 space-y-3">
        <div className="text-lg font-semibold">导出凭据</div>
        <div className="text-sm text-gray-600">导出脱敏后的 google_ads_configs（userId/customerId/name/is_active/updated_at）。</div>
        <Button onClick={exportCreds}>导出 CSV</Button>
      </Card>
    </div>
  )
}
