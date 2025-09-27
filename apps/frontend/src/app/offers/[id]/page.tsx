'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { listOffers, type Offer } from '@/sdk/offer/client'
import { createOffer as createOfferAPI } from '@/lib/api/offers'
import { analyze as siterankAnalyze, getLatestByOffer as siterankGetLatest, getTrend as siterankGetTrend, computeSimilarOffers, suggestKeywords, type SimilarityItem, type KeywordSuggestion, type TrendPoint } from '@/sdk/siterank/client'
import { Loader2, Sparkles, BarChart3 } from 'lucide-react'

export default function OfferDetailPage() {
  const params = useParams() as { id: string }
  const [offers, setOffers] = useState<Offer[]>([])
  const [offer, setOffer] = useState<Offer | null>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [starting, setStarting] = useState(false)
  // Similar opportunities
  const [country, setCountry] = useState('')
  const [candidatesText, setCandidatesText] = useState('')
  const [similar, setSimilar] = useState<SimilarityItem[] | null>(null)
  const [kw, setKw] = useState<KeywordSuggestion[] | null>(null)
  const [loadingSimilar, setLoadingSimilar] = useState(false)
  const [loadingKw, setLoadingKw] = useState(false)
  const [trend, setTrend] = useState<TrendPoint[] | null>(null)
  const [history, setHistory] = useState<any[] | null>(null)
  // 一键诊断/修复（简化链路）
  const [diagRunning, setDiagRunning] = useState(false)
  const [diagMsg, setDiagMsg] = useState<string>('')
  const [diagResult, setDiagResult] = useState<any | null>(null)
  const [selectedSuggest, setSelectedSuggest] = useState<Record<number, boolean>>({})
  const [ruleFilter, setRuleFilter] = useState<{ error: boolean; warn: boolean; info: boolean }>({ error: true, warn: true, info: true })
  const [autoValidating, setAutoValidating] = useState(false)
  const [autoMsg, setAutoMsg] = useState<string>('')
  const [autoOk, setAutoOk] = useState<boolean | null>(null)
  const [planIssues, setPlanIssues] = useState<string[]>([])
  const [planText, setPlanText] = useState<string>('')
  const [validateResult, setValidateResult] = useState<any | null>(null)
  const planRef = useRef<HTMLTextAreaElement|null>(null)

  useEffect(() => {
    (async () => {
      try {
        const os = await listOffers()
        setOffers(os)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    const found = offers.find(o => o.id === params.id) || null
    setOffer(found)
  }, [offers, params?.id])

  useEffect(() => {
    if (!offer) return
    ;(async () => {
      try {
        const res: any = await siterankGetLatest(offer.id)
        if (typeof res?.result === 'string') {
          try { res.result = JSON.parse(res.result) } catch {}
        }
        setAnalysis(res)
        // load trend & history best-effort
        const tp = await siterankGetTrend(offer.id, 30)
        setTrend(tp)
        const hs = await (await import('@/sdk/siterank/client')).getHistory(offer.id, 30)
        setHistory(hs)
      } catch {
        setTrend([])
        setHistory([])
      }
    })()
  }, [offer?.id])

  useEffect(() => {
    if (!polling || !offer) return
    const t = setInterval(async () => {
      try {
        const res: any = await siterankGetLatest(offer.id)
        if (typeof res?.result === 'string') {
          try { res.result = JSON.parse(res.result) } catch {}
        }
        setAnalysis(res)
        if (res?.status === 'completed') setPolling(false)
      } catch {}
    }, 4000)
    return () => clearInterval(t)
  }, [polling, offer?.id])

  const score = useMemo(() => {
    if (!analysis?.result) return undefined
    const r = analysis.result
    return r.opportunityScore ?? r.score ?? r.total ?? undefined
  }, [analysis])

  const startAnalyze = async () => {
    if (!offer) return
    try {
      setStarting(true)
      await siterankAnalyze(offer.id)
      setPolling(true)
    } finally {
      setStarting(false)
    }
  }

  const getDomain = (urlStr?: string): string | null => {
    if (!urlStr) return null
    try {
      const u = new URL(urlStr)
      return u.hostname.replace(/^www\./, '')
    } catch {
      return null
    }
  }

  const runSimilar = async () => {
    if (!offer) return
    const seed = getDomain(offer.originalUrl)
    if (!seed) return
    const candidates = candidatesText
      .split(/[\n,\s]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .filter(d => d.toLowerCase() !== seed.toLowerCase())
    if (candidates.length === 0) { setSimilar([]); return }
    try {
      setLoadingSimilar(true)
      const items = await computeSimilarOffers(seed, candidates, country || undefined)
      setSimilar(items)
    } catch (e) {
      setSimilar([])
    } finally {
      setLoadingSimilar(false)
    }
  }

  const runKeywordSuggest = async () => {
    if (!offer) return
    const seed = getDomain(offer.originalUrl)
    if (!seed) return
    try {
      setLoadingKw(true)
      const items = await suggestKeywords(seed, { country: country || undefined, topN: 20, minScore: 0.4 })
      setKw(items)
    } catch (e) {
      setKw([])
    } finally {
      setLoadingKw(false)
    }
  }

  const runDiagnoseSuggestions = async () => {
    setDiagRunning(true); setDiagMsg(''); setDiagResult(null)
    try {
      const r = await fetch('/api/v1/adscenter/diagnose', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({}) })
      if (!r.ok) throw new Error(String(r.status))
      const j = await r.json(); setDiagResult(j); setDiagMsg('诊断完成，已生成建议')
      // 默认全选建议
      const sel: Record<number, boolean> = {}
      const arr = Array.isArray(j?.suggestedActions) ? j.suggestedActions : []
      arr.forEach((_: any, idx: number) => sel[idx] = true)
      setSelectedSuggest(sel)
    } catch (e:any) { setDiagMsg(`诊断失败：${e?.message||'unknown'}`) } finally { setDiagRunning(false) }
  }
  const buildPlanFromSuggestions = async () => {
    if (!diagResult) { setDiagMsg('请先完成诊断'); return }
    setDiagRunning(true); setDiagMsg(''); setPlanText('')
    try {
      const all = Array.isArray(diagResult?.suggestedActions) ? diagResult.suggestedActions : []
      const picked = all.filter((_: any, idx: number) => !!selectedSuggest[idx])
      const body = { metrics: {}, suggestedActions: picked }
      const r = await fetch('/api/v1/adscenter/diagnose/plan', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) throw new Error(String(r.status))
      const j = await r.json(); setPlanText(JSON.stringify(j?.plan ?? {}, null, 2)); setDiagMsg('已根据建议生成计划')
    } catch (e:any) { setDiagMsg(`生成计划失败：${e?.message||'unknown'}`) } finally { setDiagRunning(false) }
  }
  const validateCurrentPlan = async () => {
    if (!planText.trim()) { setDiagMsg('请先生成或编辑计划'); return }
    setDiagRunning(true); setDiagMsg('');
    try {
      let plan:any = null; try { plan = JSON.parse(planText) } catch { setDiagMsg('计划 JSON 无法解析'); setDiagRunning(false); return }
      const r = await fetch('/api/v1/adscenter/bulk-actions/validate', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(plan) })
      const j = await r.json(); setValidateResult(j)
      setDiagMsg(j?.ok === false ? '计划校验存在问题' : '校验通过')
    } catch (e:any) { setDiagMsg(`校验失败：${e?.message||'unknown'}`) } finally { setDiagRunning(false) }
  }
  const submitCurrentPlan = async () => {
    if (!planText.trim()) { setDiagMsg('请先生成或编辑计划'); return }
    setDiagRunning(true); setDiagMsg('');
    try {
      let plan:any = null; try { plan = JSON.parse(planText) } catch { setDiagMsg('计划 JSON 无法解析'); setDiagRunning(false); return }
      if (!validateResult || validateResult?.ok === false) { await validateCurrentPlan(); if (validateResult?.ok === false) return }
      const r = await fetch('/api/v1/adscenter/bulk-actions', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(plan) })
      const j = await r.json(); setDiagMsg(`计划已入队：${j?.operationId || ''}`)
    } catch (e:any) { setDiagMsg(`入队失败：${e?.message||'unknown'}`) } finally { setDiagRunning(false) }
  }

  const jumpToViolation = (v: any) => {
    const fieldPath = String(v?.field || '') // e.g. params.percent / filter.campaignId / type
    const pathParts = fieldPath.split('.').filter(Boolean)
    const fieldName = pathParts[pathParts.length-1] || ''
    const idx = typeof v?.actionIndex === 'number' ? v.actionIndex : -1
    if (!planText || !fieldName || !planRef.current) return
    // Improved mapping: find actions[idx] object region by brace matching
    const findActionObjectRegion = (text: string, index: number): { start: number; end: number } | null => {
      if (index < 0) return null
      const actionsKey = '"actions"'
      let p = text.indexOf(actionsKey)
      if (p < 0) return null
      // find '[' after actionsKey
      let i = text.indexOf('[', p)
      if (i < 0) return null
      // scan for { ... } objects inside array, count braces while respecting strings
      let found = -1
      const n = text.length
      let inStr = false, esc = false
      let depth = 0
      for (let pos = i + 1; pos < n; pos++) {
        const ch = text.charAt(pos)
        if (inStr) {
          if (esc) { esc = false } else if (ch === '\\') { esc = true } else if (ch === '"') { inStr = false }
          continue
        }
        if (ch === '"') { inStr = true; continue }
        if (ch === '{') {
          if (depth === 0) {
            // start of an object
            const start = pos
            depth = 1
            // find end of this object
            let pos2 = pos + 1; let inStr2 = false; let esc2 = false; let d = 1
            for (; pos2 < n; pos2++) {
              const c = text.charAt(pos2)
              if (inStr2) { if (esc2) { esc2 = false } else if (c === '\\') { esc2 = true } else if (c === '"') { inStr2 = false } }
              else {
                if (c === '"') inStr2 = true
                else if (c === '{') d++
                else if (c === '}') { d--; if (d === 0) { const end = pos2; found++; if (found === index) return { start, end }; pos = pos2; break } }
              }
            }
          }
          continue
        }
        if (ch === ']') break
      }
      return null
    }
    let region = findActionObjectRegion(planText, idx)
    // fallback: global search
    const needle = '"' + fieldName + '"'
    let pos = planText.indexOf(needle)
    if (region && region.start >= 0) {
      let subStart = region.start, subEnd = region.end+1
      // if path includes 'params' or 'filter', narrow the search region
      if (pathParts.length > 1) {
        const container = pathParts[0] // params or filter
        const keyNeedle = '"' + container + '"'
        const kPos = planText.slice(subStart, subEnd).indexOf(keyNeedle)
        if (kPos >= 0) {
          const kAbs = subStart + kPos
          // find the brace after : to delimit the nested object
          let bracePos = planText.indexOf('{', kAbs)
          if (bracePos >= 0 && bracePos < subEnd) {
            // naive brace match to find end of this object
            let d=1, p2=bracePos+1, inS=false, esc2=false
            for (; p2 < subEnd; p2++) {
              const c = planText.charAt(p2)
              if (inS) { if (esc2) esc2=false; else if (c==='\\') esc2=true; else if (c==='"') inS=false }
              else { if (c==='"') inS=true; else if (c==='{') d++; else if (c==='}') { d--; if (d===0) break } }
            }
            if (d===0) { subStart = bracePos; subEnd = p2+1 }
          }
        }
      }
      const sub = planText.slice(subStart, subEnd)
      const pIn = sub.indexOf(needle)
      if (pIn >= 0) pos = subStart + pIn
      else pos = subStart
    }
    if (pos < 0) pos = 0
    try {
      planRef.current.focus()
      planRef.current.setSelectionRange(Math.max(0,pos-2), Math.min(planText.length, pos+needle.length+2))
      // attempt scroll into view
      const el = planRef.current
      const lineHeight = 18
      const linesBefore = (planText.slice(0, pos).match(/\n/g) || []).length
      el.scrollTop = Math.max(0, linesBefore*lineHeight - 60)
    } catch {}
  }

  // 自动校验：计划编辑时 600ms 去抖
  useEffect(() => {
    if (!planText || !planText.trim()) { setAutoMsg(''); setAutoOk(null); return }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        let plan: any = null; try { plan = JSON.parse(planText) } catch { setAutoMsg('计划 JSON 无法解析'); setAutoOk(null); return }
        setAutoValidating(true)
        // quick param validation (client-side hints)
        const issues: string[] = []
        try {
          const acts = Array.isArray(plan?.actions) ? plan.actions : []
          if (acts.length === 0) issues.push('计划中未发现 actions 数组')
          acts.forEach((a: any, idx: number) => {
            const t = String(a?.type||'')
            if (!t) { issues.push(`第${idx+1}项缺少 type`); return }
            const p = a?.params || {}
            if (t === 'ADJUST_CPC') {
              if (typeof p.percent !== 'number' && typeof p.cpcValue !== 'number') {
                issues.push(`第${idx+1}项 ADJUST_CPC 需要 percent 或 cpcValue`)
              }
              if (typeof p.percent === 'number' && (p.percent < -90 || p.percent > 500)) {
                issues.push(`第${idx+1}项 ADJUST_CPC percent 建议范围 [-90, 500]`)
              }
            } else if (t === 'ADJUST_BUDGET') {
              if (typeof p.percent !== 'number' && typeof p.dailyBudget !== 'number') {
                issues.push(`第${idx+1}项 ADJUST_BUDGET 需要 percent 或 dailyBudget`)
              }
              if (typeof p.dailyBudget === 'number' && p.dailyBudget <= 0) {
                issues.push(`第${idx+1}项 ADJUST_BUDGET dailyBudget 需要 > 0`)
              }
              if (typeof p.percent === 'number' && (p.percent < -90 || p.percent > 500)) {
                issues.push(`第${idx+1}项 ADJUST_BUDGET percent 建议范围 [-90, 500]`)
              }
            } else if (t === 'ROTATE_LINK') {
              if (!(Array.isArray(p?.links) && p.links.length > 0) && !p?.targetDomain) {
                issues.push(`第${idx+1}项 ROTATE_LINK 需要 links[] 或 targetDomain`)
              }
            }
          })
        } catch { /* ignore */ }
        setPlanIssues(issues)
        const r = await fetch('/api/v1/adscenter/bulk-actions/validate', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(plan) })
        const j = await r.json().catch(()=>({}))
        if (cancelled) return
        setValidateResult(j)
        if (j?.ok === false) { setAutoMsg('自动校验：存在问题'); setAutoOk(false) }
        else { setAutoMsg('自动校验：通过'); setAutoOk(true) }
      } catch { if (!cancelled) { setAutoMsg('自动校验失败'); setAutoOk(null) } }
      finally { if (!cancelled) setAutoValidating(false) }
    }, 600)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [planText])

  // 一键诊断并入队执行（KISS：选择第一个关联账号，自动拉取 metrics -> plan -> validate -> submit）
  const oneClickDiagnoseExecute = async () => {
    if (!offer) return
    setDiagRunning(true)
    setDiagMsg('')
    try {
      // 1) 读取关联账号
      const accRes = await fetch(`/api/v1/offers/${encodeURIComponent(offer.id)}/accounts`, { headers: { 'accept': 'application/json' } })
      const accData = await accRes.json()
      const firstAcc = Array.isArray(accData?.items) && accData.items.length > 0 ? accData.items[0].accountId : ''
      if (!firstAcc) { setDiagMsg('未找到关联的 Ads 账号'); return }
      setDiagMsg(`已选择账号 ${firstAcc}，获取诊断指标...`)
      // 2) 获取诊断指标（后端可返回 stub/实时）
      const metrics = await (await fetch(`/api/v1/adscenter/diagnose/metrics?accountId=${encodeURIComponent(firstAcc)}`, { headers: { 'accept': 'application/json' } })).json()
      setDiagMsg('生成计划（校验模式）...')
      // 3) 生成计划
      const planOut = await (await fetch('/api/v1/adscenter/diagnose/plan', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ metrics }) })).json()
      const plan = planOut?.plan
      if (!plan) { setDiagMsg('生成计划失败'); return }
      setDiagMsg('校验计划...')
      // 4) 校验
      const val = await (await fetch('/api/v1/adscenter/bulk-actions/validate', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(plan) })).json()
      if (val?.ok === false) { setDiagMsg('计划校验存在问题，请至 Adscenter 调整'); return }
      setDiagMsg('入队执行...')
      // 5) 入队
      const submit = await (await fetch('/api/v1/adscenter/bulk-actions', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(plan) })).json()
      const opId = submit?.operationId || ''
      setDiagMsg(opId ? `计划已入队：${opId}` : '计划已入队')
    } catch (e: any) {
      setDiagMsg(`执行失败：${e?.message || 'unknown'}`)
    } finally { setDiagRunning(false) }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-12 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> 正在加载...
      </div>
    )
  }

  if (!offer) {
    return (
      <div className="container mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle>未找到 Offer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">请返回列表或选择有效的 Offer。</p>
            <div className="mt-4">
              <Link href="/offers"><Button variant="outline">返回 Offer 列表</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{offer.name}</h1>
        <Link href="/offers"><Button variant="outline">返回列表</Button></Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>URL：<a className="text-blue-600 underline break-all" href={offer.originalUrl} target="_blank" rel="noreferrer">{offer.originalUrl}</a></div>
          <div>状态：{offer.status}</div>
          <div>创建时间：{new Date(offer.createdAt as any).toLocaleString()}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> 评估（Siterank）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Button onClick={startAnalyze} disabled={starting || polling}>
              {polling ? '评估进行中...' : (starting ? '启动中...' : (<><Sparkles className="h-4 w-4 mr-2"/>一键评估</>))}
            </Button>
            <Link href="/insights"><Button variant="ghost">查看 Insights</Button></Link>
            <Button variant="outline" onClick={oneClickDiagnoseExecute} disabled={diagRunning}>{diagRunning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>处理中...</> : '一键诊断并执行'}</Button>
          </div>
          {diagMsg && <div className="text-xs text-muted-foreground">{diagMsg}</div>}
          {analysis && (
            <div className="rounded border p-4 bg-white">
              <div className="text-sm text-muted-foreground">最新评估状态：<span className="font-medium text-black">{analysis.status}</span></div>
              {typeof score === 'number' && (
                <div className="mt-2">机会评分：<span className="text-2xl font-bold text-green-600">{Number(score).toFixed(2)}</span> / 100</div>
              )}
              {Array.isArray(trend) && trend.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium mb-2">近30天趋势（均值）</div>
                  <div className="text-xs grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {trend.slice(-12).map((p, i) => (
                      <div key={p.date+String(i)} className="px-2 py-1 border rounded">
                        <div className="text-muted-foreground">{p.date}</div>
                        <div className="font-semibold">{Number(p.avgScore).toFixed(1)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(history) && history.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium mb-2">历史记录（最近10条）</div>
                  <div className="text-xs border rounded divide-y">
                    {history.slice(-10).reverse().map((h, i) => (
                      <div key={(h.analysisId||i)+''} className="flex items-center justify-between px-2 py-1">
                        <div className="text-muted-foreground">{new Date(h.createdAt || Date.now()).toLocaleString()}</div>
                        <div className="font-semibold">{typeof h.score === 'number' ? Number(h.score).toFixed(2) : '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>相似机会与关键词扩展</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>国家（可选，ISO）</Label>
              <Input value={country} onChange={e => setCountry(e.target.value.toUpperCase())} placeholder="如 US" />
            </div>
            <div className="md:col-span-2">
              <Label>候选域名（用逗号/空格/换行分隔）</Label>
              <textarea
                className="w-full border rounded-md p-2 h-24"
                placeholder="example1.com, example2.com"
                value={candidatesText}
                onChange={e => setCandidatesText(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={runSimilar} disabled={loadingSimilar}>{loadingSimilar ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>计算中...</> : '计算相似度'}</Button>
            <Button onClick={runKeywordSuggest} variant="outline" disabled={loadingKw}>{loadingKw ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>生成中...</> : '关键词扩展'}</Button>
          </div>

          {Array.isArray(similar) && (
            <div>
              <div className="text-sm font-medium mb-2">相似网站（按得分降序）</div>
              {similar.length === 0 ? (
                <div className="text-sm text-muted-foreground">暂无候选结果</div>
              ) : (
                <ul className="text-sm list-disc pl-5 space-y-3">
                  {similar.map((it, idx) => (
                    <li key={it.domain+idx} className="space-y-1">
                      <div>
                        <span className="font-medium">{it.domain}</span> — 分数 <span className="font-semibold">{Number(it.score).toFixed(2)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-2"
                          onClick={async ()=>{
                            try {
                              await createOfferAPI({ name: it.domain, originalUrl: `https://${it.domain}` })
                              alert('已添加到机会池（将进入评估流程）')
                            } catch (e:any) {
                              alert(`添加失败：${e?.message||'unknown'}`)
                            }
                          }}
                        >添加到机会池</Button>
                      </div>
                      {it.factors && (typeof it.factors === 'object') && (
                        <div className="text-muted-foreground">
                          {(() => { const f:any = it.factors as any; return (
                            <>
                              {f.reason && <div>理由：{String(f.reason)}</div>}
                              <div className="text-xs">构成：关键词 {Number(f.keyword||0).toFixed(1)}、流量 {Number(f.traffic||0).toFixed(1)}、国家 {Number(f.country||0).toFixed(1)}、行业 {Number(f.category||0).toFixed(1)}</div>
                            </>
                          )})()}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {Array.isArray(kw) && (
            <div>
              <div className="text-sm font-medium mb-2">关键词扩展（按分数降序）</div>
              {kw.length === 0 ? (
                <div className="text-sm text-muted-foreground">暂无建议</div>
              ) : (
                <ul className="text-sm list-disc pl-5 space-y-1">
                  {kw.map((k, idx) => (
                    <li key={k.keyword+idx}>
                      <span className="font-medium">{k.keyword}</span> — 分数 <span className="font-semibold">{Number(k.score).toFixed(2)}</span>
                      {k.reason ? <span className="text-muted-foreground">（{k.reason}）</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>诊断与计划（可编辑）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button onClick={runDiagnoseSuggestions} disabled={diagRunning}>{diagRunning? '诊断中...' : '一键诊断（获取建议）'}</Button>
            <Button onClick={buildPlanFromSuggestions} variant="outline" disabled={diagRunning || !diagResult}>根据建议生成计划</Button>
            <Button onClick={validateCurrentPlan} variant="outline" disabled={diagRunning || !planText.trim()}>校验计划</Button>
            <Button onClick={submitCurrentPlan} disabled={diagRunning || !planText.trim()}>入队执行</Button>
          </div>
          {diagMsg && <div className="text-xs text-muted-foreground">{diagMsg}</div>}
          {diagResult?.rules && Array.isArray(diagResult.rules) && (
            <div>
              <div className="text-sm font-medium mb-2">诊断结果</div>
              <div className="flex items-center gap-3 mb-2 text-xs">
                <label className="flex items-center gap-1"><input type="checkbox" checked={ruleFilter.error} onChange={e=>setRuleFilter(f=>({ ...f, error: e.target.checked }))}/> error</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={ruleFilter.warn} onChange={e=>setRuleFilter(f=>({ ...f, warn: e.target.checked }))}/> warn</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={ruleFilter.info} onChange={e=>setRuleFilter(f=>({ ...f, info: e.target.checked }))}/> info</label>
              </div>
              <table className="w-full border text-xs">
                <thead className="bg-gray-50"><tr><th className="p-2 text-left">级别</th><th className="p-2 text-left">规则</th><th className="p-2 text-left">原因</th></tr></thead>
                <tbody>
                  {diagResult.rules.filter((r:any)=>{
                    const s = String(r.severity||'info').toLowerCase();
                    return (s==='error' && ruleFilter.error) || (s==='warn' && ruleFilter.warn) || ((s!=='error' && s!=='warn') && ruleFilter.info)
                  }).slice(0,20).map((r:any, i:number)=>(
                    <tr key={i} className="border-b">
                      <td className="p-2">{r.severity}</td>
                      <td className="p-2">{r.code || r.name || '-'}</td>
                      <td className="p-2">{r.reason || r.message || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {Array.isArray(diagResult?.suggestedActions) && diagResult.suggestedActions.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-1">建议动作（勾选后生成计划）</div>
              <ul className="text-xs space-y-1">
                {diagResult.suggestedActions.map((a:any, idx:number)=>(
                  <li key={idx} className="flex items-start gap-2">
                    <input type="checkbox" className="mt-0.5" checked={!!selectedSuggest[idx]} onChange={e=>setSelectedSuggest(s=>({ ...s, [idx]: e.target.checked }))} />
                    <div>
                      <div><span className="font-mono font-semibold">{a.action}</span>{a.params ? <> — <span className="text-muted-foreground">{JSON.stringify(a.params)}</span></> : null}</div>
                      {a.reason && <div className="text-muted-foreground">原因：{a.reason}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <div className="text-sm font-medium mb-1">计划（可编辑 JSON）</div>
            <textarea ref={planRef} className={`w-full border rounded p-2 text-xs font-mono ${autoOk===false?'border-red-500':autoOk===true?'border-green-500':''}`} style={{ minHeight: 220 }} value={planText} onChange={e=>setPlanText(e.target.value)} placeholder="{\n  \"validateOnly\": false,\n  \"actions\": [\n    { \"type\": \"ADJUST_CPC\", \"params\": { \"adjustPercent\": 10 } }\n  ]\n}" />
            {autoValidating ? <div className="text-xs text-muted-foreground mt-1">自动校验中...</div> : (autoMsg && <div className="text-xs text-muted-foreground mt-1">{autoMsg}</div>)}
            {Array.isArray(planIssues) && planIssues.length > 0 && (
              <div className="mt-2 text-xs text-red-600">
                <div className="font-medium">参数提示：</div>
                <ul className="list-disc pl-5">
                  {planIssues.slice(0,8).map((s,i)=>(<li key={i}>{s}</li>))}
                </ul>
              </div>
            )}
            {validateResult?.violations && Array.isArray(validateResult.violations) && validateResult.violations.length > 0 && (
              <div className="mt-2 text-xs">
                <div className="font-medium">校验问题：</div>
                <ul className="list-disc pl-5">
                  {validateResult.violations.slice(0,20).map((v:any, i:number)=>(
                    <li key={i}>
                      <button className={`underline ${String(v.severity||'info').toLowerCase()==='error'?'text-red-600':String(v.severity||'info').toLowerCase()==='warn'?'text-yellow-600':'text-gray-600'}`} onClick={()=>jumpToViolation(v)}>
                        [{v.severity||'info'}] actions[{typeof v.actionIndex==='number'?v.actionIndex:'-'}].{v.field||''}: {v.message||''}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
