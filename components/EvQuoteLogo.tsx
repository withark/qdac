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
        {/* Rounded app-mark: indigo gradient + simple P monogram */}
        <defs>
          <linearGradient id="planic_g" x1="6" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366F1" />
            <stop offset="1" stopColor="#4338CA" />
          </linearGradient>
          <linearGradient id="planic_sheen" x1="10" y1="8" x2="26" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" stopOpacity="0.35" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect x="4.5" y="4.5" width="31" height="31" rx="9" fill="url(#planic_g)" />
        <rect x="6.5" y="6.5" width="27" height="27" rx="8" fill="url(#planic_sheen)" />

        {/* P stem */}
        <path
          d="M15 28V12.5C15 11.7 15.7 11 16.5 11H21.7C25.6 11 28 13.1 28 16.4C28 19.7 25.6 21.9 21.7 21.9H18.5V28C18.5 28.8 17.8 29.5 17 29.5C16.2 29.5 15 28.8 15 28Z"
          fill="white"
          fillOpacity="0.98"
        />
        {/* inner cut for bowl */}
        <path
          d="M18.5 14.2V19.1H21.4C23.6 19.1 24.8 17.9 24.8 16.6C24.8 15.3 23.6 14.2 21.4 14.2H18.5Z"
          fill="#4338CA"
          fillOpacity="0.55"
        />
      </svg>
      {showText && (
        <span className={`font-bold tracking-tight text-gray-800 ${textSize}`}>
          플래닉 <span className="font-normal text-primary-600">Planic</span>
        </span>
      )}
    </div>
  )
}
