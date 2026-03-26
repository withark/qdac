'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'

type Tab = 'login' | 'signup'

type Props = {
  tab: Tab
  callbackUrl: string
}

export function EmailPasswordAuthForm({ tab, callbackUrl }: Props) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      if (tab === 'signup') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login, password, name: name.trim() || undefined }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          if (data.error === 'duplicate') setError('이미 사용 중인 아이디·이메일이에요.')
          else setError('가입에 실패했어요. 잠시 후 다시 시도해 주세요.')
          return
        }
        setMessage('가입되었어요. 로그인 중…')
        const sign = await signIn('email-password', {
          email: login,
          password,
          callbackUrl,
          redirect: false,
        })
        if (sign?.error) {
          setError('가입은 되었지만 로그인에 실패했어요. 로그인 탭에서 다시 시도해 주세요.')
          return
        }
        window.location.href = callbackUrl
        return
      }

      const sign = await signIn('email-password', {
        email: login,
        password,
        callbackUrl,
        redirect: false,
      })
      if (sign?.error) {
        setError('아이디·비밀번호를 확인해 주세요.')
        return
      }
      window.location.href = callbackUrl
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor="ep-login" className="block text-xs font-medium text-slate-600 mb-1">
          아이디 또는 이메일
        </label>
        <input
          id="ep-login"
          name="login"
          type="text"
          autoComplete="username"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
          placeholder="billingtest 또는 you@example.com"
          required
        />
      </div>
      {tab === 'signup' ? (
        <div>
          <label htmlFor="ep-name" className="block text-xs font-medium text-slate-600 mb-1">
            이름 (선택)
          </label>
          <input
            id="ep-name"
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
            placeholder="표시 이름"
          />
        </div>
      ) : null}
      <div>
        <label htmlFor="ep-password" className="block text-xs font-medium text-slate-600 mb-1">
          비밀번호
        </label>
        <input
          id="ep-password"
          name="password"
          type="password"
          autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
          placeholder="6자 이상"
          minLength={tab === 'signup' ? 6 : undefined}
          required
        />
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {message ? <p className="text-xs text-primary-700">{message}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[48px] rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 transition-colors"
      >
        {loading ? '처리 중…' : tab === 'signup' ? '이메일로 가입' : '이메일로 로그인'}
      </button>
      <p className="text-[11px] text-slate-400 text-center leading-relaxed">
        결제 테스트용: 아이디 <span className="text-slate-600">billingtest</span> / 비밀번호{' '}
        <span className="text-slate-600">test1234</span>
      </p>
    </form>
  )
}
