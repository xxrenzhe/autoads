'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type Item = { id: string; type: string; title: string; message: any; createdAt: string }

export default function NotificationsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [cursor, setCursor] = useState<string>('')
  const [unread, setUnread] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)

  const load = async (cur?: string) => {
    setLoading(true)
    const url = '/api/notifications/recent' + (cur ? `?cursor=${encodeURIComponent(cur)}` : '')
    const r = await fetch(url, { cache: 'no-store' })
    const data = await r.json().catch(()=>({ items: [] }))
    const list: Item[] = Array.isArray(data?.items) ? data.items : []
    if (cur) setItems(prev => [...prev, ...list])
    else setItems(list)
    setLoading(false)
  }
  const refreshUnread = async () => {
    try {
      const r = await fetch('/api/notifications/unread-count', { cache: 'no-store' })
      const d = await r.json().catch(()=>({ count: 0 }))
      setUnread(d?.count || 0)
    } catch { setUnread(0) }
  }
  useEffect(() => { load(); refreshUnread() }, [])

  const markAllRead = async () => {
    if (!items.length) return
    const lastId = items[0]?.id
    try {
      const r = await fetch('/api/notifications/read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lastId }) })
      if (r.ok) { toast.success('已全部标记为已读'); refreshUnread() }
      else toast.error('标记失败')
    } catch { toast.error('标记失败') }
  }

  const severityColor = (t: string) => t === 'error' ? 'bg-red-600' : t==='warn' ? 'bg-yellow-600' : t==='success' ? 'bg-green-600' : 'bg-gray-600'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">通知</h1>
        <div className="flex gap-2 items-center">
          <Badge variant="secondary">未读 {unread}</Badge>
          <Button size="sm" variant="outline" onClick={()=>load()}>刷新</Button>
          <Button size="sm" onClick={markAllRead}>全部标记已读</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((n) => (
          <Card key={n.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge className={severityColor((n.message?.severity || '').toLowerCase())}>{n.message?.severity || 'info'}</Badge>
                <span>{n.title}</span>
              </CardTitle>
              <CardDescription className="text-xs">{new Date(n.createdAt || Date.now()).toLocaleString()}</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(n.message || n, null, 2)}</pre>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button variant="outline" onClick={()=>{ if (items.length) load(items[items.length-1].id) }} disabled={loading}>
          {loading ? '加载中...' : '加载更多'}
        </Button>
      </div>
    </div>
  )
}

