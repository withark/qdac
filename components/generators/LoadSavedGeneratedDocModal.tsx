'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import type { QuoteDoc } from '@/lib/types'
import { Button } from '@/components/ui'
import { DOCUMENT_LABEL_KO } from '@/lib/plan-access'

/** GET /api/generated-docs 가 지원하는 docType */
export type GeneratedDocListDocType =
  | 'estimate'
  | 'program'
  | 'timetable'
  | 'planning'
  | 'scenario'
  | 'cuesheet'
  | 'emceeScript'

export type SavedGeneratedDocRow = {
  id: string
  docType: string
  createdAt: string
  total: number
  eventName: string
  clientName: string
  quoteDate: string
  eventDate: string
}

function formatListLabel(row: SavedGeneratedDocRow): string {
  const name = row.eventName?.trim() || '행사명 없음'
  const d = row.createdAt ? new Date(row.createdAt) : null
  const dateStr = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('ko-KR') : ''
  return dateStr ? `${name} · ${dateStr}` : name
}

export function LoadSavedGeneratedDocModal(props: {
  open: boolean
  onClose: () => void
  docType: GeneratedDocListDocType
  onLoaded: (payload: { doc: QuoteDoc; id: string }) => void
}) {
  const { open, onClose, docType, onLoaded } = props
  const [list, setList] = useState<SavedGeneratedDocRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    if (!open) return
    setFetching(true)
    apiFetch<SavedGeneratedDocRow[]>(`/api/generated-docs?docType=${docType}&limit=40`)
      .then((d) => {
        const rows = Array.isArray(d) ? d : []
        setList(rows)
        setSelectedId(rows[0]?.id ?? '')
      })
      .catch(() => {
        setList([])
        setSelectedId('')
      })
      .finally(() => setFetching(false))
  }, [open, docType])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function handleConfirm() {
    if (!selectedId) return
    setLoading(true)
    try {
      const res = await apiFetch<{ id: string; doc: QuoteDoc }>(`/api/generated-docs/${selectedId}`)
      onLoaded({ doc: res.doc, id: res.id })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const label = DOCUMENT_LABEL_KO[docType] ?? docType

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="load-saved-doc-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="load-saved-doc-title" className="text-base font-semibold text-slate-900">
          저장된 {label} 불러오기
        </h2>
        <p className="mt-1 text-xs text-slate-500">이전에 생성해 저장한 문서를 불러와 편집합니다.</p>

        {fetching ? (
          <p className="mt-4 text-sm text-slate-600">목록을 불러오는 중…</p>
        ) : list.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">저장된 문서가 없습니다.</p>
        ) : (
          <select
            className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {list.map((r) => (
              <option key={r.id} value={r.id}>
                {formatListLabel(r)}
              </option>
            ))}
          </select>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="secondary" type="button" onClick={onClose}>
            취소
          </Button>
          <Button
            size="sm"
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!selectedId || loading || fetching}
          >
            {loading ? '불러오는 중…' : '불러오기'}
          </Button>
        </div>
      </div>
    </div>
  )
}
