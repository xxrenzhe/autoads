'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/admin/components/ui/input'
import { Label } from '@/admin/components/ui/label'
import { Textarea } from '@/admin/components/ui/textarea'
import { Coins, CheckCircle, AlertCircle, Users } from 'lucide-react'

interface Candidate {
  raw: string
  userId?: string
  email?: string
  status: 'pending' | 'resolved' | 'not_found' | 'recharged' | 'failed'
  message?: string
}

export default function BatchRechargePage() {
  const router = useRouter()
  const [identifiers, setIdentifiers] = useState('')
  const [amount, setAmount] = useState<number>(100)
  const [description, setDescription] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [resolving, setResolving] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const parseInput = (): string[] => {
    return identifiers
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
  }

  const resolveUsers = async () => {
    setMessage(null)
    setResolving(true)
    try {
      const raws = Array.from(new Set(parseInput()))
      const list: Candidate[] = raws.map(r => ({ raw: r, status: 'pending' }))
      const out: Candidate[] = []
      for (const item of list) {
        // Heuristic: if contains '@', treat as email; else assume id
        if (item.raw.includes('@')) {
          const q = encodeURIComponent(item.raw)
          const res = await fetch(`/api/admin/users?q=${q}&limit=1`)
          if (res.ok) {
            const data = await res.json()
            const user = (data.items || []).find((u: any) => u.email?.toLowerCase() === item.raw.toLowerCase()) || (data.items || [])[0]
            if (user?.id) {
              out.push({ raw: item.raw, email: item.raw, userId: user.id, status: 'resolved' })
            } else {
              out.push({ raw: item.raw, email: item.raw, status: 'not_found', message: '用户不存在' })
            }
          } else {
            out.push({ raw: item.raw, email: item.raw, status: 'failed', message: '查询失败' })
          }
        } else {
          // assume raw is userId
          out.push({ raw: item.raw, userId: item.raw, status: 'resolved' })
        }
      }
      setCandidates(out)
      setMessage({ type: 'success', text: `已解析 ${out.filter(c => c.status === 'resolved').length}/${out.length} 个用户` })
    } catch (e) {
      setMessage({ type: 'error', text: '解析用户失败，请稍后重试' })
    } finally {
      setResolving(false)
    }
  }

  const performRecharge = async () => {
    if (!amount || amount <= 0) {
      setMessage({ type: 'error', text: '请输入有效的充值数量' })
      return
    }
    setProcessing(true)
    setMessage(null)
    try {
      const resolved = candidates.filter(c => c.status === 'resolved' && c.userId)
      const results: Candidate[] = []
      for (const c of resolved) {
        try {
          const res = await fetch(`/api/admin/users/${c.userId}/tokens/recharge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, description })
          })
          if (res.ok) {
            results.push({ ...c, status: 'recharged', message: '成功' })
          } else {
            const body = await res.json().catch(() => ({}))
            results.push({ ...c, status: 'failed', message: body?.error || '失败' })
          }
        } catch (e) {
          results.push({ ...c, status: 'failed', message: '网络错误' })
        }
      }
      // merge back
      const merged = candidates.map(c => results.find(r => r.raw === c.raw) || c)
      setCandidates(merged)
      const ok = results.filter(r => r.status === 'recharged').length
      setMessage({ type: 'success', text: `充值完成：成功 ${ok}，失败 ${results.length - ok}` })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center"><Users className="h-6 w-6 mr-2" />批量充值 Tokens</h1>
        <Button variant="outline" onClick={() => router.push('/admin-dashboard')}>返回后台</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>批量充值表单</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <div className={`p-3 rounded-lg text-sm flex items-center ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {message.type === 'success' ? <CheckCircle className="h-4 w-4 mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />}
              {message.text}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ids">用户标识（每行一个，支持ID或Email）</Label>
              <Textarea id="ids" rows={8} value={identifiers} onChange={(e) => setIdentifiers(e.target.value)} placeholder={'例如：\nuser_abc123\nuser@example.com'} />
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="amount">充值数量</Label>
                <Input id="amount" type="number" min={1} value={amount} onChange={(e) => setAmount(parseInt(e.target.value || '0', 10))} />
              </div>
              <div>
                <Label htmlFor="desc">备注（可选）</Label>
                <Textarea id="desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="活动奖励、补偿、人工充值等" />
              </div>
              <div className="flex gap-2">
                <Button onClick={resolveUsers} disabled={resolving}>{resolving ? '解析中...' : '解析用户'}</Button>
                <Button onClick={performRecharge} disabled={processing || candidates.filter(c => c.status === 'resolved').length === 0}>{processing ? '处理中...' : '执行充值'}</Button>
              </div>
            </div>
          </div>

          {candidates.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">解析结果</h3>
              <div className="overflow-auto border rounded">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left">输入</th>
                      <th className="px-3 py-2 text-left">User ID</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left">状态</th>
                      <th className="px-3 py-2 text-left">消息</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2">{c.raw}</td>
                        <td className="px-3 py-2">{c.userId || '-'}</td>
                        <td className="px-3 py-2">{c.email || '-'}</td>
                        <td className="px-3 py-2">{c.status}</td>
                        <td className="px-3 py-2">{c.message || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

