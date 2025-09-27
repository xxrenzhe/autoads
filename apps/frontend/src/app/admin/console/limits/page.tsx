"use client"

import { useEffect, useState } from 'react'

export default function AdminConsoleLimitsPolicy() {
  const [loading, setLoading] = useState(false)
  const [policyText, setPolicyText] = useState('')
  const [jsonMode, setJsonMode] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setLoading(true); setMessage(null)
    try {
      const r = await fetch('/api/v1/console/limits/policy', { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      if (data.policy) {
        setJsonMode(true)
        setPolicyText(JSON.stringify(data.policy, null, 2))
      } else if (data.policyText) {
        setJsonMode(false)
        setPolicyText(String(data.policyText))
      } else {
        setPolicyText('')
      }
    } catch (e: any) {
      setMessage(`读取失败: ${e?.message || e}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function save() {
    setLoading(true); setMessage(null)
    try {
      let body: any = {}
      if (jsonMode) {
        try {
          body.policy = JSON.parse(policyText || '{}')
        } catch (e: any) {
          setMessage(`JSON 解析错误: ${e?.message || e}`)
          setLoading(false)
          return
        }
      } else {
        body.policyText = policyText
      }
      const r = await fetch('/api/v1/console/limits/policy', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setMessage(`已创建版本: ${data.version || 'latest'}`)
    } catch (e: any) {
      setMessage(`保存失败: ${e?.message || e}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Adscenter 限流/配额策略</h1>
      <div className="flex items-center gap-4">
        <button disabled={loading} onClick={load} className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200">刷新</button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={jsonMode} onChange={(e)=>setJsonMode(e.target.checked)} /> JSON 模式
        </label>
        <button disabled={loading} onClick={save} className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">保存为新版本</button>
        {loading && <span className="text-gray-500 text-sm">加载中...</span>}
      </div>
      {message && <div className="text-sm text-gray-700">{message}</div>}
      <textarea className="w-full h-[520px] p-3 font-mono text-sm border rounded" value={policyText} onChange={(e)=>setPolicyText(e.target.value)} placeholder={jsonMode?'{\n  "plan": { ... }\n}':'策略文本内容'} />
      <p className="text-xs text-gray-500">说明：本编辑器会直接创建 Secret 新版本，生产环境请谨慎修改。</p>
    </div>
  )
}

