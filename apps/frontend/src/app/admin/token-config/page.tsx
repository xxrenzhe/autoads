'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { http } from '@/shared/http/client'
import { toast } from 'sonner'

type TokenConfig = {
  siterank: { costPerDomain: number; batchMultiplier: number }
  batchopen: { costPerUrl: number; batchMultiplier: number }
  adscenter: { costPerLinkChange: number; batchMultiplier: number }
}

export default function TokenConfigAdminPage() {
  const [config, setConfig] = useState<TokenConfig | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const res = await http.get<any>('/ops/api/v1/console/token-config')
      const data = (res as any)?.data || res
      setConfig(data)
    } catch (e) {
      toast.error('加载配置失败')
    }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!config) return
    try {
      setSaving(true)
      const payload = {
        siterank: {
          costPerDomain: Number(config.siterank.costPerDomain),
          batchMultiplier: Number(config.siterank.batchMultiplier)
        },
        batchopen: {
          costPerUrl: Number(config.batchopen.costPerUrl),
          batchMultiplier: Number(config.batchopen.batchMultiplier)
        },
        adscenter: {
          costPerLinkChange: Number(config.adscenter.costPerLinkChange),
          batchMultiplier: Number(config.adscenter.batchMultiplier)
        }
      }
      await http.post('/ops/api/v1/console/token-config', payload)
      toast.success('配置已保存')
    } catch {
      toast.error('保存失败')
    } finally { setSaving(false) }
  }

  if (!config) return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Token 规则配置</h1>
      <p>加载中...</p>
    </div>
  )

  const Field = ({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" value={value} onChange={e => onChange(Number(e.target.value))} />
    </div>
  )

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Token 规则配置</h1>
      <Card>
        <CardHeader>
          <CardTitle>SiteRank</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="costPerDomain" value={config.siterank.costPerDomain} onChange={v => setConfig({ ...config, siterank: { ...config.siterank, costPerDomain: v } })} />
          <Field label="batchMultiplier" value={config.siterank.batchMultiplier} onChange={v => setConfig({ ...config, siterank: { ...config.siterank, batchMultiplier: v } })} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>BatchOpen</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="costPerUrl" value={config.batchopen.costPerUrl} onChange={v => setConfig({ ...config, batchopen: { ...config.batchopen, costPerUrl: v } })} />
          <Field label="batchMultiplier" value={config.batchopen.batchMultiplier} onChange={v => setConfig({ ...config, batchopen: { ...config.batchopen, batchMultiplier: v } })} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>AdsCenter</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="costPerLinkChange" value={config.adscenter.costPerLinkChange} onChange={v => setConfig({ ...config, adscenter: { ...config.adscenter, costPerLinkChange: v } })} />
          <Field label="batchMultiplier" value={config.adscenter.batchMultiplier} onChange={v => setConfig({ ...config, adscenter: { ...config.adscenter, batchMultiplier: v } })} />
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
      </div>
    </div>
  )
}
