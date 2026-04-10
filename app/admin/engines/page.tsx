'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type EnginesData = {
  effective: { provider: string; model: string; maxTokens: number }
  policy: {
    mode: 'openai_only' | 'hybrid' | 'premium_hybrid'
    defaultOpenAIModel: string
    defaultClaudeModel: string
    premiumClaudeEscalationModel: string
    premiumClaudeEnabled: boolean
    claudeFallbackEnabled: boolean
    opusEscalationEnabled: boolean
    premiumEscalationPolicy: 'explicit_only' | 'high_stakes_or_explicit'
  }
  env: {
    hasAnthropic: boolean
    hasOpenAI: boolean
    aiProvider: string | null
    openaiModel: string | null
    anthropicModel: string | null
    anthropicPremiumModel?: string | null
  }
  overlay: Record<string, unknown> | null
}

/** 샘플 반영 강도 → 프롬프트에 들어갈 문구 */
const SAMPLE_STRENGTH_OPTIONS = [
  { value: '', label: '사용자 지정 (아래 입력)', note: '' },
  { value: 'low', label: '약하게', note: '참고만 하고 기본 형식 우선' },
  { value: 'medium', label: '보통', note: '샘플과 기본 형식을 균형 있게 반영' },
  { value: 'strong', label: '강하게', note: '샘플 구조·문체를 최대한 따를 것' },
] as const

/** 출력 형식 프리셋 */
const OUTPUT_FORMAT_OPTIONS: { value: string; label: string; hint?: string }[] = [
  { value: '', label: '직접 입력 (아래)' },
  { value: 'paragraph', label: '문단형', hint: '문단 위주, 표는 보조' },
  { value: 'table', label: '표형', hint: '표 위주, 멘트는 짧게' },
  { value: 'mixed', label: '혼합형', hint: '문단과 표를 상황에 맞게' },
  { value: 'operational', label: '운영문서형', hint: '시간/담당/준비물 등 운영용 열 구성' },
]

export default function AdminEnginesPage() {
  const [data, setData] = useState<EnginesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [overlay, setOverlay] = useState({
    provider: '',
    model: '',
    maxTokens: 8192,
    structureFirst: false,
    toneFirst: false,
    outputFormatTemplate: '',
    sampleWeightNote: '',
    qualityBoost: '',
    defaultEngineMode: 'hybrid' as 'openai_only' | 'hybrid' | 'premium_hybrid',
    defaultOpenAIModel: '',
    defaultClaudeModel: '',
    premiumClaudeEscalationModel: '',
    premiumClaudeEnabled: true,
    claudeFallbackEnabled: true,
    opusEscalationEnabled: true,
    premiumEscalationPolicy: 'high_stakes_or_explicit' as 'explicit_only' | 'high_stakes_or_explicit',
  })
  const [sampleStrengthPreset, setSampleStrengthPreset] = useState<'low' | 'medium' | 'strong' | ''>('')
  const [outputFormatPreset, setOutputFormatPreset] = useState<string>('')

  function load() {
    fetch('/api/admin/engines')
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok && res?.data) {
          setData(res.data)
          const ov = res.data.overlay || {}
          setOverlay({
            provider: res.data.effective?.provider ?? '',
            model: res.data.effective?.model ?? '',
            maxTokens: res.data.effective?.maxTokens ?? 8192,
            structureFirst: !!ov.structureFirst,
            toneFirst: !!ov.toneFirst,
            outputFormatTemplate: String(ov.outputFormatTemplate ?? ''),
            sampleWeightNote: String(ov.sampleWeightNote ?? ''),
            qualityBoost: String(ov.qualityBoost ?? ''),
            defaultEngineMode: (res.data.policy?.mode ?? 'hybrid') as 'openai_only' | 'hybrid' | 'premium_hybrid',
            defaultOpenAIModel: String(res.data.policy?.defaultOpenAIModel ?? ''),
            defaultClaudeModel: String(res.data.policy?.defaultClaudeModel ?? ''),
            premiumClaudeEscalationModel: String(res.data.policy?.premiumClaudeEscalationModel ?? ''),
            premiumClaudeEnabled: Boolean(res.data.policy?.premiumClaudeEnabled ?? true),
            claudeFallbackEnabled: Boolean(res.data.policy?.claudeFallbackEnabled ?? true),
            opusEscalationEnabled: Boolean(res.data.policy?.opusEscalationEnabled ?? true),
            premiumEscalationPolicy: (res.data.policy?.premiumEscalationPolicy ?? 'high_stakes_or_explicit') as
              | 'explicit_only'
              | 'high_stakes_or_explicit',
          })
          const sn = String(ov.sampleWeightNote ?? '')
          if (/약하게|참고만/.test(sn)) setSampleStrengthPreset('low')
          else if (/강하게|최대한/.test(sn)) setSampleStrengthPreset('strong')
          else if (sn.trim()) setSampleStrengthPreset('medium')
          else setSampleStrengthPreset('')
          const of = String(ov.outputFormatTemplate ?? '')
          if (/문단/.test(of)) setOutputFormatPreset('paragraph')
          else if (/표 위주|표형/.test(of)) setOutputFormatPreset('table')
          else if (/혼합/.test(of)) setOutputFormatPreset('mixed')
          else if (/운영/.test(of)) setOutputFormatPreset('operational')
          else setOutputFormatPreset('')
        } else setError(res?.error?.message || '조회 실패')
      })
      .catch(() => setError('요청 실패'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    try {
      let sampleWeightNote = overlay.sampleWeightNote
      if (sampleStrengthPreset === 'low') sampleWeightNote = '참고만 하고 기본 형식 우선.'
      else if (sampleStrengthPreset === 'medium') sampleWeightNote = '샘플과 기본 형식을 균형 있게 반영.'
      else if (sampleStrengthPreset === 'strong') sampleWeightNote = '샘플 구조·문체를 최대한 따를 것.'

      let outputFormatTemplate = overlay.outputFormatTemplate
      if (outputFormatPreset === 'paragraph') outputFormatTemplate = '문단 위주, 표는 보조.'
      else if (outputFormatPreset === 'table') outputFormatTemplate = '표 위주, 멘트는 짧게.'
      else if (outputFormatPreset === 'mixed') outputFormatTemplate = '문단과 표를 상황에 맞게 혼합.'
      else if (outputFormatPreset === 'operational') outputFormatTemplate = '시간/담당/준비물 등 운영문서형 열 구성.'

      const res = await fetch('/api/admin/engines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: overlay.provider === 'anthropic' || overlay.provider === 'openai' ? overlay.provider : undefined,
          model: overlay.model || undefined,
          maxTokens: overlay.maxTokens,
          structureFirst: overlay.structureFirst,
          toneFirst: overlay.toneFirst,
          outputFormatTemplate: outputFormatPreset ? outputFormatTemplate : overlay.outputFormatTemplate,
          sampleWeightNote: sampleStrengthPreset ? sampleWeightNote : overlay.sampleWeightNote,
          qualityBoost: overlay.qualityBoost,
          defaultEngineMode: overlay.defaultEngineMode,
          defaultOpenAIModel: overlay.defaultOpenAIModel,
          defaultClaudeModel: overlay.defaultClaudeModel,
          premiumClaudeEscalationModel: overlay.premiumClaudeEscalationModel,
          premiumClaudeEnabled: overlay.premiumClaudeEnabled,
          claudeFallbackEnabled: overlay.claudeFallbackEnabled,
          opusEscalationEnabled: overlay.opusEscalationEnabled,
          premiumEscalationPolicy: overlay.premiumEscalationPolicy,
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
      <div>
        <h1 className="text-lg font-semibold text-gray-900">생성 규칙 설정</h1>
        <p className="text-sm text-gray-600 mt-1 max-w-2xl">
          문서를 <strong>어떤 기준으로 생성할지</strong> 조정합니다. AI 모델 선택과 함께, 샘플 반영 강도·우선 기준·출력 형식을 설정하면
          실제 생성 요청 시 <code className="bg-slate-100 px-1 rounded text-xs">buildGeneratePrompt</code>에 반영됩니다.
        </p>
      </div>

      {/* 현재 적용 값 요약 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-2">엔진 정책</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">기본 엔진 모드</label>
            <select
              value={overlay.defaultEngineMode}
              onChange={(e) =>
                setOverlay((o) => ({ ...o, defaultEngineMode: e.target.value as 'openai_only' | 'hybrid' | 'premium_hybrid' }))
              }
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="openai_only">openai_only (기본/단일)</option>
              <option value="hybrid">hybrid (OpenAI + Claude)</option>
              <option value="premium_hybrid">premium_hybrid (프로 플랜 Claude 허용)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">기본 OpenAI 모델</label>
            <input
              type="text"
              value={overlay.defaultOpenAIModel}
              onChange={(e) => setOverlay((o) => ({ ...o, defaultOpenAIModel: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">기본 Claude 모델 (Sonnet)</label>
            <input
              type="text"
              value={overlay.defaultClaudeModel}
              onChange={(e) => setOverlay((o) => ({ ...o, defaultClaudeModel: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">프리미엄 상향 모델 (Opus)</label>
            <input
              type="text"
              value={overlay.premiumClaudeEscalationModel}
              onChange={(e) => setOverlay((o) => ({ ...o, premiumClaudeEscalationModel: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={overlay.premiumClaudeEnabled}
              onChange={(e) => setOverlay((o) => ({ ...o, premiumClaudeEnabled: e.target.checked }))}
            />
            프로 사용자 Claude 프리미엄 경로 허용
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={overlay.claudeFallbackEnabled}
              onChange={(e) => setOverlay((o) => ({ ...o, claudeFallbackEnabled: e.target.checked }))}
            />
            OpenAI 실패 시 Claude 폴백 허용
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={overlay.opusEscalationEnabled}
              onChange={(e) => setOverlay((o) => ({ ...o, opusEscalationEnabled: e.target.checked }))}
            />
            Opus 4.1 2차 상향 허용
          </label>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Opus 상향 조건</label>
            <select
              value={overlay.premiumEscalationPolicy}
              onChange={(e) =>
                setOverlay((o) => ({
                  ...o,
                  premiumEscalationPolicy: e.target.value as 'explicit_only' | 'high_stakes_or_explicit',
                }))
              }
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="high_stakes_or_explicit">고난도 또는 명시 요청</option>
              <option value="explicit_only">명시 요청일 때만</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-2">현재 적용 값 (env + DB 오버레이)</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">provider</dt>
          <dd className="font-mono">{data.effective?.provider ?? '—'}</dd>
          <dt className="text-gray-500">model</dt>
          <dd className="font-mono">{data.effective?.model ?? '—'}</dd>
          <dt className="text-gray-500">maxTokens</dt>
          <dd className="font-mono">{data.effective?.maxTokens ?? '—'}</dd>
          <dt className="text-gray-500">enginePolicy</dt>
          <dd className="font-mono">{data.policy?.mode ?? '—'}</dd>
          <dt className="text-gray-500">premiumClaude</dt>
          <dd>{data.policy?.premiumClaudeEnabled ? '활성' : '비활성'}</dd>
          <dt className="text-gray-500">opusEscalation</dt>
          <dd>{data.policy?.opusEscalationEnabled ? '활성' : '비활성'}</dd>
        </dl>
      </section>

      {/* 환경 변수 요약 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-2">환경 변수 요약</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">ANTHROPIC_API_KEY</dt>
          <dd>{data.env?.hasAnthropic ? '설정됨' : '미설정'}</dd>
          <dt className="text-gray-500">OPENAI_API_KEY</dt>
          <dd>{data.env?.hasOpenAI ? '설정됨' : '미설정'}</dd>
          <dt className="text-gray-500">AI_PROVIDER</dt>
          <dd className="font-mono">{data.env?.aiProvider ?? '—'}</dd>
          <dt className="text-gray-500">OPENAI_MODEL</dt>
          <dd className="font-mono">{data.env?.openaiModel ?? '—'}</dd>
          <dt className="text-gray-500">ANTHROPIC_MODEL</dt>
          <dd className="font-mono">{data.env?.anthropicModel ?? '—'}</dd>
        </dl>
      </section>

      {/* 생성 규칙: 탭별 / 샘플 강도 / 우선 기준 / 출력 형식 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">생성 규칙 (DB 오버레이 · env보다 우선)</h2>
        <p className="text-xs text-gray-500 mb-4">
          아래 설정은 견적서·제안 프로그램·타임테이블·큐시트·시나리오 등 <strong>공통</strong>으로 적용됩니다.
          저장 시 실제 생성 파이프라인에 반영됩니다.
        </p>

        <div className="space-y-4">
          {/* LLM 인프라 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">provider</label>
              <select
                value={overlay.provider}
                onChange={(e) => setOverlay((o) => ({ ...o, provider: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
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
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">maxTokens</label>
              <input
                type="number"
                min={6000}
                max={32000}
                value={overlay.maxTokens}
                onChange={(e) => setOverlay((o) => ({ ...o, maxTokens: Number(e.target.value) || 8192 }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* 샘플 반영 강도 */}
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">샘플 반영 강도</h3>
            <select
              value={sampleStrengthPreset}
              onChange={(e) => setSampleStrengthPreset(e.target.value as typeof sampleStrengthPreset)}
              className="w-full max-w-xs border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              {SAMPLE_STRENGTH_OPTIONS.map((opt) => (
                <option key={opt.value || 'custom'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {sampleStrengthPreset && (
              <p className="text-[11px] text-gray-500 mt-1">
                {SAMPLE_STRENGTH_OPTIONS.find((o) => o.value === sampleStrengthPreset)?.note}
              </p>
            )}
            {!sampleStrengthPreset && (
              <textarea
                className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                rows={2}
                value={overlay.sampleWeightNote}
                onChange={(e) => setOverlay((o) => ({ ...o, sampleWeightNote: e.target.value }))}
                placeholder="예: 큐시트 샘플 열 구성을 우선 따를 것"
              />
            )}
          </div>

          {/* 우선 기준 */}
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">우선 기준 (문서 생성 시 무엇을 우선할지)</h3>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="priority"
                  checked={overlay.structureFirst && !overlay.toneFirst}
                  onChange={() => setOverlay((o) => ({ ...o, structureFirst: true, toneFirst: false }))}
                />
                구조 우선 (표·행)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="priority"
                  checked={overlay.toneFirst && !overlay.structureFirst}
                  onChange={() => setOverlay((o) => ({ ...o, toneFirst: true, structureFirst: false }))}
                />
                문체 우선
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="priority"
                  checked={!overlay.structureFirst && !overlay.toneFirst}
                  onChange={() => setOverlay((o) => ({ ...o, structureFirst: false, toneFirst: false }))}
                />
                지정 안 함
              </label>
            </div>
          </div>

          {/* 출력 형식 */}
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">출력 형식</h3>
            <select
              value={outputFormatPreset}
              onChange={(e) => setOutputFormatPreset(e.target.value)}
              className="w-full max-w-xs border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              {OUTPUT_FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value || 'custom'} value={opt.value}>
                  {opt.label} {opt.hint ? `— ${opt.hint}` : ''}
                </option>
              ))}
            </select>
            {!outputFormatPreset && (
              <textarea
                className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                rows={2}
                value={overlay.outputFormatTemplate}
                onChange={(e) => setOverlay((o) => ({ ...o, outputFormatTemplate: e.target.value }))}
                placeholder="예: 표 위주, 멘트는 짧게"
              />
            )}
          </div>

          {/* 품질 보강 */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">품질 보강 (프롬프트 말미에 주입)</label>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
              rows={2}
              value={overlay.qualityBoost}
              onChange={(e) => setOverlay((o) => ({ ...o, qualityBoost: e.target.value }))}
              placeholder="추가 지시 문장"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn-primary text-sm py-2 px-4 disabled:opacity-50 mt-4"
        >
          {saving ? '저장 중…' : '규칙 저장'}
        </button>
      </section>

      {/* 실제 반영 확인 */}
      <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-2">실제 반영 확인</h2>
        <p className="text-xs text-gray-500">
          위 설정은 견적 생성 API 호출 시 <code className="bg-slate-200 px-1 rounded">buildGeneratePrompt</code>를 통해
          Claude/OpenAI 요청 프롬프트에 주입됩니다. 샘플 반영·우선 기준·출력 형식 문구가 그대로 포함되며,{' '}
          <Link href="/admin/generation-logs" className="text-primary-600 underline">생성 로그</Link>에서 요청별 스냅샷을 확인할 수 있습니다.
        </p>
      </section>

      <p className="text-xs text-gray-400">
        견적 생성 시 출력 토큰은 설정값과 무관하게 최소 10,240까지 사용해 JSON 잘림을 줄입니다.
      </p>
    </div>
  )
}
