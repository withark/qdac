'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import clsx from 'clsx'

type Placement = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
type Variant = 'default' | 'compact' | 'sidebar'

function initials(email?: string | null) {
  const e = (email ?? '').trim()
  if (!e) return '계정'
  const head = e.split('@')[0] ?? e
  const cleaned = head.replace(/[^a-zA-Z0-9가-힣]/g, '')
  return (cleaned.slice(0, 2) || '계정').toUpperCase()
}

export function AccountPanel({
  className,
  placement = 'bottom-right',
  variant = 'default',
}: {
  className?: string
  placement?: Placement
  variant?: Variant
}) {
  const session = useSession()
  const data = session?.data
  const email = data?.user?.email ?? null
  const openId = useId()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const firstItemRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null)

  const canShow = useMemo(() => !!data?.user, [data?.user])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => firstItemRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open])

  if (!canShow) return null

  const panelPos =
    placement === 'top-left'
      ? 'left-0 bottom-full mb-2'
      : placement === 'top-right'
        ? 'right-0 bottom-full mb-2'
        : placement === 'bottom-left'
          ? 'left-0 mt-2'
          : 'right-0 mt-2'

  return (
    <div className={clsx('relative', className)}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={openId}
        onClick={() => setOpen(v => !v)}
        className={clsx(
          variant === 'compact'
            ? 'w-10 h-10 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm'
            : variant === 'sidebar'
              ? 'w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-gray-700 shadow-sm'
              : 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-semibold text-gray-700 shadow-sm',
          'hover:bg-slate-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-200',
          'active:scale-[0.99] transition'
        )}
      >
        <span
          className={clsx(
            'inline-flex flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold',
            variant === 'compact' ? 'h-7 w-7' : variant === 'sidebar' ? 'h-8 w-8' : 'h-8 w-8'
          )}
          aria-hidden
        >
          {initials(email)}
        </span>
        {(variant === 'default' || variant === 'sidebar') && (
          <>
            <span className={clsx('truncate', variant === 'sidebar' ? 'flex-1 min-w-0 text-gray-600' : 'hidden sm:inline max-w-[10rem]')}>
              {email ?? '내 계정'}
            </span>
            <span className="text-gray-300 flex-shrink-0" aria-hidden>▾</span>
          </>
        )}
      </button>

      {open && (
        <>
          {/* outside click area */}
          <button
            type="button"
            aria-label="계정 패널 닫기"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => {
              setOpen(false)
              btnRef.current?.focus()
            }}
          />

          <div
            id={openId}
            role="dialog"
            aria-label="계정 패널"
            className={clsx(
              'absolute z-50 w-[320px] max-w-[calc(100vw-24px)]',
              panelPos,
              'rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40 overflow-hidden'
            )}
          >
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
              <p className="text-[11px] font-semibold text-slate-500 tracking-wide">로그인 계정</p>
              <p className="mt-1 text-sm font-semibold text-gray-900 break-all">{email ?? '—'}</p>
            </div>

            <div className="p-2">
              <Link
                ref={firstItemRef as any}
                href="/settings"
                className={clsx(
                  'w-full flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800',
                  'hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-200'
                )}
                onClick={() => setOpen(false)}
              >
                <span>설정</span>
                <span className="text-gray-300" aria-hidden>→</span>
              </Link>

              <Link
                href="/billing"
                className={clsx(
                  'w-full flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800',
                  'hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-200'
                )}
                onClick={() => setOpen(false)}
              >
                <span>요금제 / 구독 관리</span>
                <span className="text-gray-300" aria-hidden>→</span>
              </Link>

              <div className="my-2 h-px bg-slate-100" />

              <button
                ref={((el: HTMLButtonElement | null) => {
                  if (!firstItemRef.current) firstItemRef.current = el
                }) as any}
                type="button"
                onClick={async () => {
                  setOpen(false)
                  await signOut({ callbackUrl: '/' })
                }}
                className={clsx(
                  'w-full flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm font-semibold',
                  'text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200'
                )}
              >
                <span>로그아웃</span>
                <span className="text-red-300" aria-hidden>↩</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

