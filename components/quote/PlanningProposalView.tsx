'use client'

import type { PlanningDoc, PlanningActionBlock } from '@/lib/types'
import clsx from 'clsx'

const ACCENT_BAR: Record<NonNullable<PlanningActionBlock['accent']>, string> = {
  blue: 'border-l-[8px] border-l-blue-700 bg-gradient-to-r from-blue-50/80 to-white',
  orange: 'border-l-[8px] border-l-amber-500 bg-gradient-to-r from-amber-50/80 to-white',
  green: 'border-l-[8px] border-l-emerald-600 bg-gradient-to-r from-emerald-50/80 to-white',
  yellow: 'border-l-[8px] border-l-yellow-500 bg-gradient-to-r from-yellow-50/70 to-white',
  slate: 'border-l-[8px] border-l-slate-600 bg-gradient-to-r from-slate-50/80 to-white',
}

function hasStructuredPlanning(p: PlanningDoc): boolean {
  return Boolean(
    p.subtitle?.trim() ||
      (p.backgroundStats && p.backgroundStats.length > 0) ||
      (p.programOverviewRows && p.programOverviewRows.length > 0) ||
      (p.actionProgramBlocks && p.actionProgramBlocks.length > 0) ||
      (p.actionPlanTable && p.actionPlanTable.length > 0) ||
      (p.expectedEffectsShortTerm && p.expectedEffectsShortTerm.length > 0) ||
      (p.expectedEffectsLongTerm && p.expectedEffectsLongTerm.length > 0),
  )
}

type Props = {
  eventName: string
  planning: PlanningDoc
  onPatch: (patch: Partial<PlanningDoc>) => void
}

export default function PlanningProposalView({ eventName, planning: p, onPatch }: Props) {
  if (!hasStructuredPlanning(p)) return null

  return (
    <div className="planning-proposal-print mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b-4 border-blue-800 bg-white px-6 py-5 text-center">
        <h2 className="text-xl font-bold tracking-tight text-blue-900 sm:text-2xl">{eventName || '행사 기획안'}</h2>
        {p.subtitle ? (
          <p className="mt-2 text-sm font-semibold text-amber-600 sm:text-base">{p.subtitle}</p>
        ) : null}
        <p className="mt-1 text-xs text-slate-500">기획 제안서 미리보기 · PDF 저장 시 이 영역이 함께 캡처됩니다</p>
      </div>

      <div className="space-y-8 px-4 py-6 sm:px-6">
        {p.backgroundStats && p.backgroundStats.length > 0 ? (
          <section>
            <h3 className="mb-3 border-b border-blue-200 pb-1 text-sm font-bold text-blue-800">1. 배경 및 필요성</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {p.backgroundStats.map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-center shadow-sm"
                >
                  <div className="text-3xl font-extrabold text-amber-600">{s.value || '—'}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-800">{s.label}</div>
                  {s.detail ? <p className="mt-2 text-xs leading-relaxed text-slate-600">{s.detail}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {p.programOverviewRows && p.programOverviewRows.length > 0 ? (
          <section>
            <h3 className="mb-3 border-b border-blue-200 pb-1 text-sm font-bold text-blue-800">2. 프로그램 개요</h3>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs sm:text-sm">
                <tbody>
                  {p.programOverviewRows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-slate-50/90' : 'bg-white'}>
                      <th className="w-[28%] border-b border-slate-200 px-3 py-2.5 font-semibold text-blue-900">
                        {row.label}
                      </th>
                      <td className="border-b border-slate-200 px-3 py-2.5 text-slate-800">
                        <div className="font-medium">{row.value}</div>
                        {row.detail ? <div className="mt-0.5 text-xs text-slate-600">{row.detail}</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {p.actionProgramBlocks && p.actionProgramBlocks.length > 0 ? (
          <section>
            <h3 className="mb-3 border-b border-blue-200 pb-1 text-sm font-bold text-blue-800">3. 세부 액션 프로그램</h3>
            <div className="space-y-4">
              {p.actionProgramBlocks.map((block, i) => {
                const accent = block.accent && ACCENT_BAR[block.accent] ? block.accent : 'blue'
                return (
                  <div
                    key={i}
                    className={clsx(
                      'flex overflow-hidden rounded-xl border border-slate-200 shadow-sm',
                      ACCENT_BAR[accent],
                    )}
                  >
                    <div className="flex w-14 shrink-0 flex-col items-center justify-center bg-slate-800/90 py-3 text-white sm:w-16">
                      <span className="text-lg font-bold leading-none">
                        {String(block.order).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 p-3 sm:p-4">
                      <div className="text-xs font-bold text-amber-700">{block.dayLabel}</div>
                      <div className="mt-1 text-sm font-bold text-slate-900">{block.title}</div>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-700 sm:text-sm">
                        {block.description}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200/80 pt-2 text-[11px] text-slate-600">
                        <span>
                          <span className="font-medium text-slate-500">시간</span> {block.timeRange}
                        </span>
                        <span>
                          <span className="font-medium text-slate-500">대상</span> {block.participants}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        {p.actionPlanTable && p.actionPlanTable.length > 0 ? (
          <section>
            <h3 className="mb-3 border-b border-blue-200 pb-1 text-sm font-bold text-blue-800">4. 액션 플랜</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[520px] text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-blue-900 text-white">
                    <th className="px-3 py-2 font-semibold">단계</th>
                    <th className="px-3 py-2 font-semibold">시기</th>
                    <th className="px-3 py-2 font-semibold">주요 내용</th>
                    <th className="px-3 py-2 font-semibold">담당</th>
                  </tr>
                </thead>
                <tbody>
                  {p.actionPlanTable.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="border-b border-slate-200 px-3 py-2 font-semibold text-amber-700">{row.step}</td>
                      <td className="border-b border-slate-200 px-3 py-2 text-slate-800">{row.timing}</td>
                      <td className="border-b border-slate-200 px-3 py-2 text-slate-700">{row.content}</td>
                      <td className="border-b border-slate-200 px-3 py-2 text-slate-600">{row.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {(p.expectedEffectsShortTerm && p.expectedEffectsShortTerm.length > 0) ||
        (p.expectedEffectsLongTerm && p.expectedEffectsLongTerm.length > 0) ? (
          <section>
            <h3 className="mb-3 border-b border-blue-200 pb-1 text-sm font-bold text-blue-800">5. 기대 효과</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <div className="text-xs font-bold text-amber-800">단기 효과</div>
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-slate-800 sm:text-sm">
                  {(p.expectedEffectsShortTerm || []).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="text-xs font-bold text-emerald-800">장기 효과</div>
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-slate-800 sm:text-sm">
                  {(p.expectedEffectsLongTerm || []).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        <p className="text-center text-[10px] text-slate-400">© {new Date().getFullYear()} Planic · 기획안 미리보기</p>

        <details className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-slate-600">구조화 필드 한 줄 수정 (부제)</summary>
          <label className="mt-2 block text-[10px] text-slate-500">subtitle</label>
          <input
            type="text"
            value={p.subtitle || ''}
            onChange={(e) => onPatch({ subtitle: e.target.value })}
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            placeholder="슬로건"
          />
        </details>
      </div>
    </div>
  )
}
