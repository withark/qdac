export type AuthRedirectReason = 'signup_required' | 'login_required'

export function buildAuthHref(params: { callbackUrl: string; reason?: AuthRedirectReason }): string {
  const callbackUrl = (params.callbackUrl || '/').trim() || '/'
  const reason = params.reason

  const sp = new URLSearchParams()
  sp.set('callbackUrl', callbackUrl.startsWith('/') ? callbackUrl : '/')
  if (reason) sp.set('reason', reason)
  return `/auth?${sp.toString()}`
}

export function buildStartHref(params: { isAuthenticated: boolean; targetPath?: string }): string {
  const targetPath = params.targetPath ?? '/generate'
  if (params.isAuthenticated) return targetPath
  return buildAuthHref({ callbackUrl: targetPath, reason: 'signup_required' })
}

