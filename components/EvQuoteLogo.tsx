'use client'

/** 플래닉 Planic 로고: 문서+견적 아이콘 + 텍스트(선택) */
interface EvQuoteLogoProps {
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function EvQuoteLogo({
  showText = true,
  size = 'md',
  className = '',
}: EvQuoteLogoProps) {
  const iconSize = size === 'sm' ? 24 : size === 'lg' ? 48 : 32
  const textSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-2xl' : 'text-base'

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
        aria-hidden
      >
        {/* 문서 형태 + 체크/견적 느낌 */}
        <rect x="4" y="2" width="24" height="30" rx="2" stroke="currentColor" strokeWidth="2" fill="none" className="text-primary-600" />
        <path d="M10 10h12M10 16h8M10 22h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-primary-500" />
        <circle cx="28" cy="28" r="10" fill="currentColor" className="text-primary-600" />
        <path d="M24.5 28l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {showText && (
        <span className={`font-bold tracking-tight text-gray-800 ${textSize}`}>
          플래닉 <span className="font-normal text-primary-600">Planic</span>
        </span>
      )}
    </div>
  )
}
