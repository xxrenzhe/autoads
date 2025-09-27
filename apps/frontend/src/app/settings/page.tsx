'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { getNotificationSettings, updateNotificationSettings, type NotificationSettings } from '@/sdk/console/client'
import { getLinkRotationSettings, updateLinkRotationSettings, type LinkRotationSettings } from '@/sdk/adscenter/client'
import { listOffers, getOfferPreferences, updateOfferPreferences, type OfferPreferences } from '@/sdk/offer/client'

export default function SettingsPage() {
  // Notifications (user scope)
  const [notif, setNotif] = useState<NotificationSettings | null>(null)
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifSaved, setNotifSaved] = useState<string|undefined>()

  // Link rotation
  const [linkset, setLinkset] = useState<LinkRotationSettings | null>(null)
  const [linkSaving, setLinkSaving] = useState(false)
  const [linkSaved, setLinkSaved] = useState<string|undefined>()

  // Offer auto status (per-offer)
  const [offers, setOffers] = useState<{ id: string; name: string }[]>([])
  const [selectedOfferId, setSelectedOfferId] = useState<string>('')
  const [offerPrefs, setOfferPrefs] = useState<OfferPreferences | null>(null)
  const [offerSaving, setOfferSaving] = useState(false)
  const [offerSaved, setOfferSaved] = useState<string|undefined>()

  useEffect(() => {
    // load settings in parallel
    ;(async () => {
      try {
        const [n, l, os] = await Promise.all([
          getNotificationSettings('user'),
          getLinkRotationSettings(),
          listOffers().catch(() => []) as any,
        ])
        setNotif(n)
        setLinkset(l)
        if (Array.isArray(os)) setOffers(os.map((o: any) => ({ id: o.id, name: o.name || o.id })))
      } catch (e) {
        console.error('settings init failed', e)
      }
    })()
  }, [])

  // When selecting an offer, load prefs
  useEffect(() => {
    if (!selectedOfferId) { setOfferPrefs(null); return }
    ;(async () => {
      try {
        const p = await getOfferPreferences(selectedOfferId)
        setOfferPrefs(p)
      } catch (e) {
        console.error('load offer prefs failed', e)
        setOfferPrefs({ autoStatusEnabled: false, statusRules: { zeroPerfDays: 5, roscDeclineDays: 7 } })
      }
    })()
  }, [selectedOfferId])

  const offerOptions = useMemo(() => offers.map(o => (
    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
  )), [offers])

  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">设置</h1>

      {/* 订阅/计费聚合入口（替代 Billing 顶级导航） */}
      <Card>
        <CardHeader>
          <CardTitle>订阅与计费</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">在此管理订阅计划、余额与扣费明细。原“计费中心”已迁移至设置页。</p>
          <div className="flex items-center gap-3">
            <a href="/billing" className="inline-block">
              <Button variant="outline">进入计费中心</Button>
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>通知与预警（节流/置信度/通道）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {notif ? (
            <>
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-enabled">启用通知</Label>
                <Switch id="notif-enabled" checked={notif.enabled} onCheckedChange={(v) => setNotif({ ...notif, enabled: !!v })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>最小置信度 [0-1]</Label>
                  <Input type="number" step="0.05" min={0} max={1} value={notif.minConfidence}
                         onChange={(e) => setNotif({ ...notif, minConfidence: Math.max(0, Math.min(1, Number(e.target.value)||0)) })} />
                </div>
                <div>
                  <Label>每分钟阈值</Label>
                  <Input type="number" min={0} value={notif.throttlePerMinute}
                         onChange={(e) => setNotif({ ...notif, throttlePerMinute: Math.max(0, Number(e.target.value)||0) })} />
                </div>
                <div>
                  <Label>聚类窗口(秒)</Label>
                  <Input type="number" min={0} value={notif.groupWindowSec}
                         onChange={(e) => setNotif({ ...notif, groupWindowSec: Math.max(0, Number(e.target.value)||0) })} />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2"><Switch checked={notif.channels.inApp} onCheckedChange={(v)=>setNotif({ ...notif, channels: { ...notif.channels, inApp: !!v } })} /> <span>应用内</span></div>
                <div className="flex items-center gap-2"><Switch checked={notif.channels.email} onCheckedChange={(v)=>setNotif({ ...notif, channels: { ...notif.channels, email: !!v } })} /> <span>邮件</span></div>
                <div className="flex items-center gap-2"><Switch checked={notif.channels.webhook} onCheckedChange={(v)=>setNotif({ ...notif, channels: { ...notif.channels, webhook: !!v } })} /> <span>Webhook</span></div>
              </div>
              <div className="flex items-center gap-3">
                <Button disabled={notifSaving} onClick={async ()=>{
                  try { setNotifSaving(true); await updateNotificationSettings(notif); setNotifSaved('已保存'); setTimeout(()=>setNotifSaved(undefined), 2000) } finally { setNotifSaving(false) }
                }}>保存</Button>
                {notifSaved && <span className="text-green-600 text-sm">{notifSaved}</span>}
              </div>
            </>
          ) : (<div className="text-sm text-muted-foreground">加载中...</div>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>换链接频控（Adscenter）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {linkset ? (
            <>
              <div className="flex items-center justify-between">
                <Label htmlFor="link-enabled">启用换链接定时</Label>
                <Switch id="link-enabled" checked={linkset.enabled} onCheckedChange={(v)=>setLinkset({ ...linkset, enabled: !!v })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>最小间隔(分钟)</Label>
                  <Input type="number" min={1} value={linkset.minIntervalMinutes}
                         onChange={(e)=>setLinkset({ ...linkset, minIntervalMinutes: Math.max(1, Number(e.target.value)||1) })} />
                </div>
                <div>
                  <Label>单Offer每日上限</Label>
                  <Input type="number" min={0} value={linkset.maxPerDayPerOffer}
                         onChange={(e)=>setLinkset({ ...linkset, maxPerDayPerOffer: Math.max(0, Number(e.target.value)||0) })} />
                </div>
                <div>
                  <Label>单账号每小时上限</Label>
                  <Input type="number" min={0} value={linkset.maxPerHourPerAccount}
                         onChange={(e)=>setLinkset({ ...linkset, maxPerHourPerAccount: Math.max(0, Number(e.target.value)||0) })} />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <Switch checked={linkset.rollbackOnError} onCheckedChange={(v)=>setLinkset({ ...linkset, rollbackOnError: !!v })} />
                  <span>异常自动回退</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button disabled={linkSaving} onClick={async ()=>{ try { setLinkSaving(true); await updateLinkRotationSettings(linkset); setLinkSaved('已保存'); setTimeout(()=>setLinkSaved(undefined), 2000) } finally { setLinkSaving(false) } }}>保存</Button>
                {linkSaved && <span className="text-green-600 text-sm">{linkSaved}</span>}
              </div>
            </>
          ) : (<div className="text-sm text-muted-foreground">加载中...</div>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Offer 自动状态转换（按Offer）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>选择Offer</Label>
              <Select value={selectedOfferId} onValueChange={setSelectedOfferId}>
                <SelectTrigger><SelectValue placeholder="选择一个Offer" /></SelectTrigger>
                <SelectContent>{offerOptions}</SelectContent>
              </Select>
            </div>
            {offerPrefs && (
              <>
                <div className="flex items-center gap-2 mt-8">
                  <Switch checked={!!offerPrefs.autoStatusEnabled} onCheckedChange={(v)=>setOfferPrefs({ ...offerPrefs!, autoStatusEnabled: !!v })} />
                  <span>启用自动状态转换</span>
                </div>
                <div>
                  <Label>连续0曝0点天数</Label>
                  <Input type="number" min={1} max={30} value={offerPrefs.statusRules?.zeroPerfDays ?? 5}
                         onChange={(e)=>setOfferPrefs({ ...offerPrefs!, statusRules: { ...(offerPrefs!.statusRules||{}), zeroPerfDays: Math.max(1, Math.min(30, Number(e.target.value)||5)) } })} />
                </div>
                <div>
                  <Label>ROSC连续下滑天数</Label>
                  <Input type="number" min={1} max={30} value={offerPrefs.statusRules?.roscDeclineDays ?? 7}
                         onChange={(e)=>setOfferPrefs({ ...offerPrefs!, statusRules: { ...(offerPrefs!.statusRules||{}), roscDeclineDays: Math.max(1, Math.min(30, Number(e.target.value)||7)) } })} />
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button disabled={offerSaving || !selectedOfferId || !offerPrefs} onClick={async ()=>{
              if (!selectedOfferId || !offerPrefs) return
              try { setOfferSaving(true); await updateOfferPreferences(selectedOfferId, offerPrefs); setOfferSaved('已保存'); setTimeout(()=>setOfferSaved(undefined), 2000) } finally { setOfferSaving(false) }
            }}>保存</Button>
            {offerSaved && <span className="text-green-600 text-sm">{offerSaved}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
