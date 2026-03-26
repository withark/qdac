'use client'

import { useEffect } from 'react'
import { applyThemeToDom, THEME_STORAGE_KEY, type ThemeMode } from '@/components/theme/theme-mode'

function readStoredMode(): ThemeMode {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    // ignore
  }
  return 'system'
}

export function ThemeInitializer() {
  useEffect(() => {
    const mode = readStoredMode()
    applyThemeToDom(mode)

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const current = readStoredMode()
      if (current === 'system') applyThemeToDom('system')
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return null
}
