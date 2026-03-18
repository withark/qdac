'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type EnginesData = {
  effective: { provider: string; model: string; maxTokens: number }
  env: { hasAnthropic: boolean; hasOpenAI: boolean; aiProvider: string | null; openaiModel: string | null; anthropicModel: string | null }
  overlay: { provider?: string; model?: string; maxTokens?: number } | null
}

export default function AdminEnginesPage() {
  const [data, setData] = useState<EnginesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [overlay, setOverlay] = useState({ provider: '', model: '', maxTokens: 4000 })

  function load() {
    fetch('/api/admin/engines')
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok && res?.data) {
          setData(res.data)
          setOverlay({
            provider: res.data.effective?.provider ?? '',
            model: res.data.effective?.model ?? '',
            maxTokens: res.data.effective?.maxTokens ?? 4000,
          })
        } else setError(res?.error?.message || '조회 실패')
      })
      .catch(() => setError('요청 실패'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/engines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: overlay.provider === 'anthropic' || overlay.provider === 'openai' ? overlay.provider : undefined,
          model: overlay.model || undefined,
          maxTokens: overlay.maxTokens,
        }),
      })
      const result = await res.json().catch(() => ({}))
      if (res.ok && result?.ok) load()
      else setError(result?.error?.message || '저장 실패')
    } catch {
      setError('저장 요청 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">로딩 중…</p>
  if (error && !data) return <p className="text-sm text-red-600">{error}</p>
  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">엔진/모델</h1>
        <Link href="/admin" className="text-sm text-primary-600 hover:text-primary-700">← 대시보드</Link>
      </div>

      <section className="border border-slate-200 rounded-lg bg-white p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">현재 적용 값 (env + DB 오버레이)</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">provider</dt><dd className="font-mono">{data.effective?.provider ?? '—'}</dd>
          <dt className="text-gray-500">model</dt><dd className="font-mono">{data.effective?.model ?? '—'}</dd>
          <dt className="text-gray-500">maxTokens</dt><dd className="font-mono">{data.effective?.maxTokens ?? '—'}</dd>
        </dl>
      </section>

      <section className="border border-slate-200 rounded-lg bg-white p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">환경 변수 요약</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">ANTHROPIC_API_KEY</dt><dd>{data.env?.hasAnthropic ? '설정됨' : '미설정'}</dd>
          <dt className="text-gray-500">OPENAI_API_KEY</dt><dd>{data.env?.hasOpenAI ? '설정됨' : '미설정'}</dd>
          <dt className="text-gray-500">AI_PROVIDER</dt><dd className="font-mono">{data.env?.aiProvider ?? '—'}</dd>
          <dt className="text-gray-500">OPENAI_MODEL</dt><dd className="font-mono">{data.env?.openaiModel ?? '—'}</dd>
          <dt className="text-gray-500">ANTHROPIC_MODEL</dt><dd className="font-mono">{data.env?.anthropicModel ?? '—'}</dd>
        </dl>
      </section>

      <section className="border border-slate-200 rounded-lg bg-white p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">DB 오버레이 저장 (env보다 우선)</h2>
        <p className="text-xs text-gray-500 mb-3">DB가 있을 때 저장됩니다. 견적·AI 호출 시 <code className="bg-slate-100 px-1 rounded">callLLM</code>가 이 값(provider/model/maxTokens)을 그대로 사용합니다.</p>
        <div className="space-y-2 max-w-sm">
          <div>
            <label className="block text-xs text-gray-600 mb-1">provider</label>
            <select
              value={overlay.provider}
              onChange={(e) => setOverlay((o) => ({ ...o, provider: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">env 따름</option>
              <option value="anthropic">anthropic</option>
              <option value="openai">openai</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">model</label>
            <input
              type="text"
              value={overlay.model}
              onChange={(e) => setOverlay((o) => ({ ...o, model: e.target.value }))}
              placeholder="gpt-4o / claude-sonnet-4-6"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">maxTokens</label>
            <input
              type="number"
              value={overlay.maxTokens}
              onChange={(e) => setOverlay((o) => ({ ...o, maxTokens: Number(e.target.value) || 4000 }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button type="button" onClick={save} disabled={saving} className="btn-primary text-sm py-2 px-4 disabled:opacity-50">
            {saving ? '저장 중…' : '오버레이 저장'}
          </button>
        </div>
      </section>

      <p className="text-xs text-gray-400">generate API에서 engine_config 오버레이를 읽어 적용하는 연동은 추후 반영 예정입니다.</p>
    </div>
  )
}
