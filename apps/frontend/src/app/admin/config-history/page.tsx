'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { http } from '@/shared/http/client'

type ChangeRow = {
  id: string
  configKey: string
  oldValue: string | null
  newValue: string
  changedBy: string
  reason?: string | null
  createdAt: string
}

export default function ConfigHistoryPage() {
  const [prefix, setPrefix] = useState('token.')
  const [rows, setRows] = useState<ChangeRow[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const res = await http.get<any>(`/ops/api/v1/console/system/config/changes?prefix=${encodeURIComponent(prefix)}`)
      const data = (res as any)?.data || res
      setRows(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-sm text-gray-600 mb-1">前缀过滤（如 token. / siterank / adscenter）</label>
          <Input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="token." />
        </div>
        <Button onClick={load} disabled={loading}>{loading ? '加载中...' : '刷新'}</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>配置变更历史</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">时间</th>
                  <th className="p-2">Key</th>
                  <th className="p-2">旧值</th>
                  <th className="p-2">新值</th>
                  <th className="p-2">变更人</th>
                  <th className="p-2">原因</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="p-2">{r.configKey}</td>
                    <td className="p-2 max-w-[360px] truncate" title={r.oldValue || ''}>{r.oldValue || '-'}</td>
                    <td className="p-2 max-w-[360px] truncate" title={r.newValue}>{r.newValue}</td>
                    <td className="p-2">{r.changedBy}</td>
                    <td className="p-2">{r.reason || '-'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-gray-500">暂无记录</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
