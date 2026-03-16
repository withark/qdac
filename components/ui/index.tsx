'use client'
import {
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
} from 'react'
import clsx from 'clsx'

/* ── Button / Btn ─────────────────────────── */
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}
export function Button({ variant = 'secondary', size = 'md', type = 'button', className, ...props }: BtnProps) {
  return (
    <button
      type={type}
      {...props}
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-lg transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        variant === 'primary'   && 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm',
        variant === 'secondary' && 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300',
        variant === 'danger'    && 'border border-red-200 text-red-600 hover:bg-red-50',
        variant === 'ghost'     && 'text-gray-500 hover:text-gray-800 hover:bg-gray-100',
        className
      )}
    />
  )
}
/** alias */
export const Btn = Button

/* ── Input ────────────────────────────────── */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className, ...props }, ref) => (
    <div className={label ? 'flex flex-col gap-1' : undefined}>
      {label && <label className="text-xs text-gray-500">{label}</label>}
      <input
        ref={ref}
        {...props}
        className={clsx(
          'w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white',
          'placeholder-gray-400 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-colors',
          className
        )}
      />
    </div>
  )
)
Input.displayName = 'Input'

/* ── Select ───────────────────────────────── */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}
export function Select({ label, className, children, ...props }: SelectProps) {
  return (
    <div className={label ? 'flex flex-col gap-1' : undefined}>
      {label && <label className="text-xs text-gray-500">{label}</label>}
      <select
        {...props}
        className={clsx(
          'w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white',
          'focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-colors',
          className
        )}
      >
        {children}
      </select>
    </div>
  )
}

/* ── Textarea ─────────────────────────────── */
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}
export function Textarea({ label, className, ...props }: TextareaProps) {
  return (
    <div className={label ? 'flex flex-col gap-1' : undefined}>
      {label && <label className="text-xs text-gray-500">{label}</label>}
      <textarea
        {...props}
        className={clsx(
          'w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white resize-none',
          'placeholder-gray-400 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-colors',
          className
        )}
      />
    </div>
  )
}

/* ── Label / SectionLabel ─────────────────── */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-1 border-b border-gray-100">
      <span className="text-xs font-semibold tracking-wide text-gray-700">{children}</span>
    </div>
  )
}
export const Label = SectionLabel

/* ── Card ─────────────────────────────────── */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-white border border-gray-100 rounded-xl shadow-card', className)}>
      {children}
    </div>
  )
}

/* ── Field ────────────────────────────────── */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500">{label}</label>
      {children}
    </div>
  )
}

/* ── Toast ────────────────────────────────── */
interface ToastProps {
  message?: string
  msg?: string
  type?: 'ok' | 'err'
  onClose?: () => void
}
export function Toast({ message, msg, type = 'ok', onClose }: ToastProps) {
  const text = message ?? msg ?? ''
  if (!text) return null
  const isErr = type === 'err'
  return (
    <div
      className={clsx(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 text-sm px-5 py-2.5 rounded-full shadow-lg animate-fade-in',
        isErr ? 'bg-red-600 text-white' : 'bg-primary-600 text-white'
      )}
    >
      {text}
      {onClose && (
        <button onClick={onClose} className="opacity-80 hover:opacity-100 text-xs ml-1" aria-label="닫기">✕</button>
      )}
    </div>
  )
}

/* ── Spinner ──────────────────────────────── */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 py-0.5">
      <span className="w-3.5 h-3.5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin flex-shrink-0" />
      {label && <span>{label}</span>}
    </div>
  )
}
