'use client'
import {
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
  useId,
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
        'inline-flex items-center justify-center rounded-xl font-semibold transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'px-3 py-2 text-sm' : 'px-4 py-2.5 text-[15px]',
        variant === 'primary'   && 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm shadow-primary-500/10',
        variant === 'secondary' && 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300',
        variant === 'danger'    && 'border border-red-200 text-red-600 hover:bg-red-50',
        variant === 'ghost'     && 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
        className
      )}
    />
  )
}
/** alias */
export const Btn = Button

/* ── Input ────────────────────────────────── */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  /** 라벨 옆에 필수 표시(별표) */
  showRequiredMark?: boolean
  /** 검증 실패 시 테두리 강조 */
  invalid?: boolean
}
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, showRequiredMark, invalid, className, id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId

    return (
      <div className={label ? 'flex flex-col gap-1.5' : undefined}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-slate-700">
            {label}
            {showRequiredMark ? (
              <abbr title="필수" className="ml-0.5 font-bold text-red-600 no-underline">
                *
              </abbr>
            ) : null}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={invalid || undefined}
          {...props}
          className={clsx(
            'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] text-slate-900 shadow-sm',
            'placeholder:text-slate-500 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100/70 transition-colors',
            invalid && 'border-red-300 focus:border-red-400 focus:ring-red-100/70',
            className
          )}
        />
      </div>
    )
  }
)
Input.displayName = 'Input'

/* ── Select ───────────────────────────────── */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}
export function Select({ label, className, children, ...props }: SelectProps) {
  const generatedId = useId()
  const selectId = props.id ?? generatedId

  return (
    <div className={label ? 'flex flex-col gap-1.5' : undefined}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-semibold text-slate-700">
          {label}
        </label>
      )}
      <select
        {...props}
        id={selectId}
        className={clsx(
          'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] text-slate-900 shadow-sm',
          'focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100/70 transition-colors',
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
  showRequiredMark?: boolean
  invalid?: boolean
}
export function Textarea({ label, showRequiredMark, invalid, className, ...props }: TextareaProps) {
  const generatedId = useId()
  const textareaId = props.id ?? generatedId

  return (
    <div className={label ? 'flex flex-col gap-1.5' : undefined}>
      {label && (
        <label htmlFor={textareaId} className="text-sm font-semibold text-slate-700">
          {label}
          {showRequiredMark ? (
            <abbr title="필수" className="ml-0.5 font-bold text-red-600 no-underline">
              *
            </abbr>
          ) : null}
        </label>
      )}
      <textarea
        {...props}
        id={textareaId}
        aria-invalid={invalid || undefined}
        className={clsx(
          'w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] text-slate-900 shadow-sm',
          'placeholder:text-slate-500 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100/70 transition-colors',
          invalid && 'border-red-300 focus:border-red-400 focus:ring-red-100/70',
          className
        )}
      />
    </div>
  )
}

/* ── Label / SectionLabel ─────────────────── */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 pb-2 pt-2">
      <span className="text-sm font-semibold tracking-wide text-slate-800">{children}</span>
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
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
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

export { CalendarPicker } from './CalendarPicker'
