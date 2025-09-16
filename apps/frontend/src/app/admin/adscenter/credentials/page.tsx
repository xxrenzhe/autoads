"use client";

import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Cred = { userId: string; customerId: string; name: string; isActive: boolean; updatedAt: string }

import { useSession } from 'next-auth/react'
import { useEffect } from 'react'

export default function AdminCredentialsPage() {
  const { data: session } = useSession()
  useEffect(()=>{
    const role = (session as any)?.user?.role
    if (!role || String(role).toUpperCase() !== 'ADMIN') {
      if (typeof window !== 'undefined') window.location.href = '/ops/console/login'
    }
  }, [session])
  const [userId, setUserId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [active, setActive] = useState('')
  const [updatedFrom, setUpdatedFrom] = useState('')
  const [updatedTo, setUpdatedTo] = useState('')
  const [rows, setRows] = useState<Cred[]>([])
  const [loading, setLoading] = useState(false)

  const query = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (userId.trim()) qs.set('userId', userId.trim())
      if (customerId.trim()) qs.set('customerId', customerId.trim())
      if (active) qs.set('active', active)
      if (updatedFrom.trim()) qs.set('updatedFrom', updatedFrom.trim())
      if (updatedTo.trim()) qs.set('updatedTo', updatedTo.trim())
      const r = await fetch(`/api/v2/admin/adscenter/google-ads/credentials?${qs.toString()}`)
      const j = await r.json().catch(()=>({}))
      const list = Array.isArray(j?.items) ? j.items : []
      setRows(list.map((x:any)=>({ userId: x.userId||x.user_id, customerId: x.customerId||x.customer_id, name: x.name, isActive: !!x.isActive, updatedAt: x.updatedAt || x.updated_at })))
    } finally { setLoading(false) }
  }
  useEffect(()=>{ query().catch(()=>{}) },[])

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div><Label>User ID</Label><Input value={userId} onChange={e=>setUserId(e.target.value)} placeholder="可选"/></div>
          <div><Label>Customer ID</Label><Input value={customerId} onChange={e=>setCustomerId(e.target.value)} placeholder="可选"/></div>
          <div>
            <Label>Active</Label>
            <Select value={active} onValueChange={setActive}>
              <SelectTrigger><SelectValue placeholder="全部"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="true">启用</SelectItem>
                <SelectItem value="false">禁用</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Updated From（RFC3339）</Label><Input value={updatedFrom} onChange={e=>setUpdatedFrom(e.target.value)} placeholder="2025-09-16T00:00:00Z"/></div>
          <div><Label>Updated To（RFC3339）</Label><Input value={updatedTo} onChange={e=>setUpdatedTo(e.target.value)} placeholder="2025-09-17T00:00:00Z"/></div>
        </div>
        <div className="mt-3"><Button onClick={query} disabled={loading}>{loading?'查询中...':'查询'}</Button></div>
      </Card>
      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">User ID</th>
                <th className="px-3 py-2 text-left">Customer ID</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Active</th>
                <th className="px-3 py-2 text-left">Updated At</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i)=> (
                <tr key={i} className={i%2? 'bg-white':'bg-gray-50'}>
                  <td className="px-3 py-2">{r.userId}</td>
                  <td className="px-3 py-2">{r.customerId}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.isActive? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">{typeof r.updatedAt==='string' ? r.updatedAt : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
