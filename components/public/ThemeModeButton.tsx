'use client'

import { useEffect, useState } from 'react'
import { applyThemeToDom, nextThemeMode, THEME_STORAGE_KEY, type ThemeMode } from '@/components/theme/theme-mode'

function readStoredMode(): ThemeMode {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    // ignore
  }
  return 'system'
}

const LABELS: Record<ThemeMode, string> = {
  light: '라이트',
  dark: '다크',
  system: '시스템',
}

export function ThemeModeButton() {
  const [mode, setMode] = useState<ThemeMode>('system')

  useEffect(() => {
    setMode(readStoredMode())
  }, [])

  function onClick() {
    const next = nextThemeMode(mode)
    setMode(next)
    applyThemeToDom(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:text-sm"
      title="클릭 시 라이트 → 다크 → 시스템 순으로 전환"
      aria-label="테마 전환"
    >
      현재 시스템 설정 · {LABELS[mode]}
    </button>
  )
}
