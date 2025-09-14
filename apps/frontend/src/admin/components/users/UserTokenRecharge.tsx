'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Coins, CheckCircle, AlertCircle } from 'lucide-react'

interface Props {
  userId: string
  onRecharged?: (newBalance?: number) => void
  id?: string
}

export default function UserTokenRecharge({ userId, onRecharged, id }: Props) {
  const [amount, setAmount] = useState<number>(100)
  const [description, setDescription] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleRecharge = async () => {
    if (!amount || amount <= 0) {
      setMessage({ type: 'error', text: '请输入有效的充值数量' })
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/tokens/recharge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: 'error', text: data?.error || '充值失败，请稍后重试' })
        return
      }
      setMessage({ type: 'success', text: `已成功为用户充值 ${amount} Tokens` })
      setDescription('')
      onRecharged?.(data?.user?.tokenBalance)
    } catch (e) {
      setMessage({ type: 'error', text: '网络错误，请稍后再试' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card id={id || 'user-token-recharge'}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Coins className="h-5 w-5 mr-2" />
          手动充值 Tokens
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div className={`p-3 rounded-lg text-sm flex items-center ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {message.type === 'success' ? <CheckCircle className="h-4 w-4 mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />}
            {message.text}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label htmlFor="recharge-amount">充值数量</Label>
            <Input
              id="recharge-amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value || '0', 10))}
              placeholder="例如：100"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="recharge-desc">备注（可选）</Label>
            <Textarea
              id="recharge-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：活动奖励、补偿、人工充值等"
              rows={2}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleRecharge} disabled={loading}>
            {loading ? '处理中...' : '确认充值'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
