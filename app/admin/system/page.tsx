'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type SystemData = {
  status: string
  db: string
  envSummary: { hasDatabase: boolean; nodeEnv: string }
  notice: string | null
}

type FeatureFlags = {
  cuesheetEnabled: boolean
  scenarioEnabled: boolean
}

export default function AdminSystemPage() {
  const [data, setData] = useState<SystemData | null>(null)
  const [flags, setFlags] = useState<FeatureFlags | null>(null)
  const [flagsSaving, setFlagsSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/system')
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok && res?.data) setData(res.data)
        else setError(res?.error?.message || '조회 실패')
      })
      .catch(() => setError('요청 실패'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/admin/feature-flags')
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok && res?.data) setFlags(res.data)
      })
      .catch(() => {})
  }, [])

  async function saveFlags(next: FeatureFlags) {
    setFlags(next)
    setFlagsSaving(true)
    try {
      const r = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      const res = await r.json()
      if (res?.ok && res?.data) setFlags(res.data)
      else alert(res?.error?.message || '저장 실패')
    } catch {
      alert('저장 실패')
    } finally {
      setFlagsSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">로딩 중…</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">시스템</h1>
        <Link href="/admin" className="text-sm text-primary-600 hover:text-primary-700">← 대시보드</Link>
      </div>
      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <p className="text-xs text-gray-500">상태</p>
          <p className="font-medium">{data.status === 'ok' ? '정상' : '제한적'}</p>
        </div>
        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <p className="text-xs text-gray-500">DB</p>
          <p className="font-medium">{data.db === 'ok' ? '연결됨' : data.db === 'unconfigured' ? '미설정' : '오류'}</p>
        </div>
        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <p className="text-xs text-gray-500">NODE_ENV</p>
          <p className="font-medium">{data.envSummary?.nodeEnv ?? '—'}</p>
        </div>
      </div>
      <section>
        <h2 className="text-sm font-medium text-gray-700 mb-2">점검 링크</h2>
        <ul className="space-y-1 text-sm">
          <li><a href="/api/health" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">/api/health</a> — 헬스 체크</li>
        </ul>
      </section>

      <section className="max-w-xl">
        <h2 className="text-sm font-medium text-gray-700 mb-2">기능 플래그</h2>
        <p className="text-xs text-gray-500 mb-3">
          사용자 화면에서 기능을 재오픈할 때 사용합니다. 안정성 검증 전에는 기본 OFF 권장.
        </p>
        {!flags ? (
          <p className="text-sm text-gray-500">로딩 중…</p>
        ) : (
          <div className="space-y-2">
            <label className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 bg-white">
              <div>
                <p className="text-sm font-medium text-gray-900">큐시트 탭 노출</p>
                <p className="text-xs text-gray-500">사용자 화면에서 cueRows/cueSummary 노출</p>
              </div>
              <input
                type="checkbox"
                checked={flags.cuesheetEnabled}
                disabled={flagsSaving || data.db !== 'ok'}
                onChange={(e) => saveFlags({ ...flags, cuesheetEnabled: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 bg-white">
              <div>
                <p className="text-sm font-medium text-gray-900">시나리오 탭 노출</p>
                <p className="text-xs text-gray-500">사용자 화면에서 scenario 노출</p>
              </div>
              <input
                type="checkbox"
                checked={flags.scenarioEnabled}
                disabled={flagsSaving || data.db !== 'ok'}
                onChange={(e) => saveFlags({ ...flags, scenarioEnabled: e.target.checked })}
              />
            </label>
            {data.db !== 'ok' && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                DB가 연결되어야 플래그를 저장할 수 있습니다.
              </p>
            )}
          </div>
        )}
      </section>
      {data.notice && <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">{data.notice}</p>}
      <p className="text-xs text-gray-400">공지/운영 메모·시스템 설정 확장은 추후 반영 예정입니다.</p>
    </div>
  )
}
