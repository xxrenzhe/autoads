"use client";

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

import { useSession } from 'next-auth/react'
import { useEffect } from 'react'

export default function AdminAdscenterOAuthPage() {
  const { data: session } = useSession()
  useEffect(()=>{
    const role = (session as any)?.user?.role
    if (!role || String(role).toUpperCase() !== 'ADMIN') {
      if (typeof window !== 'undefined') window.location.href = '/ops/console/login'
    }
  }, [session])
  const [redirectUri, setRedirectUri] = useState('')
  const [scopes, setScopes] = useState('https://www.googleapis.com/auth/adwords openid email')
  const [clientId, setClientId] = useState('')
  const [authUrl, setAuthUrl] = useState('')
  const [code, setCode] = useState('')
  const [userId, setUserId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [clientSecret, setClientSecret] = useState('')

  const genLink = async () => {
    if (!redirectUri.trim()) { toast.error('请输入 redirectUri'); return }
    const res = await fetch('/api/v2/admin/adscenter/google-ads/oauth/link', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redirectUri, scopes: scopes.split(/\s+/).filter(Boolean), clientId: clientId.trim() || undefined })
    })
    const j = await res.json().catch(()=>({}))
    if (!res.ok || !j?.authUrl) { toast.error(j?.message || '生成失败'); return }
    setAuthUrl(j.authUrl)
    toast.success('已生成授权链接')
  }

  const submitCallback = async () => {
    if (!code.trim() || !redirectUri.trim() || !userId.trim() || !customerId.trim()) { toast.error('请填写 code/redirectUri/userId/customerId'); return }
    const body: any = { code: code.trim(), redirectUri: redirectUri.trim(), userId: userId.trim(), customerId: customerId.trim() }
    if (clientId.trim()) body.clientId = clientId.trim()
    if (clientSecret.trim()) body.clientSecret = clientSecret.trim()
    const res = await fetch('/api/v2/admin/adscenter/google-ads/oauth/callback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const j = await res.json().catch(()=>({}))
    if (!res.ok || j?.ok !== true) { toast.error(j?.message || '回调处理失败'); return }
    toast.success('OAuth 凭据已保存')
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Card className="p-6 space-y-3">
        <div className="text-lg font-semibold">生成授权链接</div>
        <div>
          <Label>Redirect URI</Label>
          <Input value={redirectUri} onChange={e=>setRedirectUri(e.target.value)} placeholder="https://yourapp.com/oauth/callback"/>
        </div>
        <div>
          <Label>Client ID（可选，未填则读取 system_configs）</Label>
          <Input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="Google OAuth Client ID"/>
        </div>
        <div>
          <Label>Scopes（空格分隔）</Label>
          <Textarea rows={2} value={scopes} onChange={e=>setScopes(e.target.value)} />
        </div>
        <Button onClick={genLink}>生成授权链接</Button>
        {authUrl && <div className="text-sm break-all"><a className="text-blue-600 underline" href={authUrl} target="_blank" rel="noreferrer">{authUrl}</a></div>}
      </Card>

      <Card className="p-6 space-y-3">
        <div className="text-lg font-semibold">回调处理（粘贴 code）</div>
        <div>
          <Label>Authorization Code</Label>
          <Input value={code} onChange={e=>setCode(e.target.value)} placeholder="从 redirectUri 中拿到的 code 参数"/>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>User ID</Label>
            <Input value={userId} onChange={e=>setUserId(e.target.value)} placeholder="绑定到哪个用户"/>
          </div>
          <div>
            <Label>Customer ID</Label>
            <Input value={customerId} onChange={e=>setCustomerId(e.target.value)} placeholder="Google Ads Customer ID 或 mock"/>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Client ID（可选）</Label>
            <Input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="如与系统配置不一致可覆盖"/>
          </div>
          <div>
            <Label>Client Secret（可选）</Label>
            <Input value={clientSecret} onChange={e=>setClientSecret(e.target.value)} placeholder="可覆盖系统配置"/>
          </div>
        </div>
        <Button onClick={submitCallback}>提交回调</Button>
      </Card>
    </div>
  )
}
