export type ThemeMode = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'planic_theme_mode'

export function nextThemeMode(current: ThemeMode): ThemeMode {
  if (current === 'light') return 'dark'
  if (current === 'dark') return 'system'
  return 'light'
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyThemeToDom(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  const resolved = resolveTheme(mode)
  html.dataset.themeMode = mode
  html.dataset.themeResolved = resolved
  if (resolved === 'dark') html.classList.add('theme-dark')
  else html.classList.remove('theme-dark')
}
