import Link from 'next/link'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'

type SiteFooterProps = {
  /** 랜딩 등에서 여백·부가 카피 축소 */
  compact?: boolean
}

const footerLinkClass =
  'rounded-sm text-slate-600 underline-offset-4 transition-colors hover:text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2'

/**
 * 공통 사업자·약관 푸터 (랜딩, 약관 페이지 등)
 */
export function SiteFooter({ compact = false }: SiteFooterProps) {
  const pad = compact ? 'py-8 sm:py-9' : 'py-10 sm:py-12'
  const textSize = compact ? 'text-xs' : 'text-sm'

  return (
    <footer className="flex-shrink-0 border-t border-slate-100 bg-white">
      <div className={`mx-auto max-w-5xl px-4 sm:px-6 ${pad}`}>
        <div className={`mx-auto flex max-w-3xl flex-col items-center text-center ${textSize}`}>
          <Link
            href="/"
            className="rounded-sm text-slate-900 transition-colors hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2"
          >
            <EvQuoteLogo showText size="sm" className="justify-center" />
          </Link>

          <p className="mt-3 max-w-md text-pretty text-slate-600">
            행사 준비 문서를 완성본 수준으로 빠르게 만들어 주는 AI 도구
          </p>

          <nav className="mt-6 w-full max-w-xl" aria-label="푸터 링크">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-1 sm:gap-y-2">
              <div
                className="flex flex-wrap justify-center gap-x-3 gap-y-2 sm:gap-x-4"
                role="group"
                aria-label="서비스 안내"
              >
                <Link href="/guide" className={footerLinkClass}>
                  사용 방법
                </Link>
                <Link href="/features" className={footerLinkClass}>
                  기능 소개
                </Link>
                <Link href="/help" className={footerLinkClass}>
                  도움말
                </Link>
                <Link href="/plans" className={footerLinkClass}>
                  요금제
                </Link>
              </div>
              <span className="hidden h-4 w-px shrink-0 bg-slate-200 sm:block" aria-hidden />
              <div
                className="flex flex-wrap justify-center gap-x-3 gap-y-2 sm:gap-x-4"
                role="group"
                aria-label="약관 및 정책"
              >
                <Link href="/terms" className={footerLinkClass}>
                  이용약관
                </Link>
                <Link href="/refund" className={footerLinkClass}>
                  환불정책
                </Link>
                <Link href="/privacy" className={footerLinkClass}>
                  개인정보처리방침
                </Link>
              </div>
            </div>
          </nav>

          <div className="mt-6 w-full max-w-2xl border-t border-slate-100 pt-6">
            <h2 className="sr-only">사업자 정보</h2>
            <address className="space-y-1.5 text-xs leading-relaxed not-italic text-slate-600 sm:text-[13px] sm:leading-snug">
              <p className="text-pretty">
                <span className="font-medium text-slate-700">(주)시냇가에심은나무</span>
                <span className="text-slate-400" aria-hidden>
                  {' '}
                  ·{' '}
                </span>
                사업자번호: 438-81-01028
                <span className="text-slate-400" aria-hidden>
                  {' '}
                  ·{' '}
                </span>
                대표자: 이다윗
                <span className="text-slate-400" aria-hidden>
                  {' '}
                  ·{' '}
                </span>
                주소: 광릉수목원로 600 A동
              </p>
              <p className="text-pretty">
                대표 연락처:{' '}
                <a
                  href="tel:07086661112"
                  className="font-medium text-primary-700 underline-offset-2 transition-colors hover:text-primary-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 rounded-sm"
                >
                  070-8666-1112
                </a>
                <span className="text-slate-400" aria-hidden>
                  {' '}
                  ·{' '}
                </span>
                통신판매업 신고번호: 제2017-경기포천-0319호
                <span className="text-slate-400" aria-hidden>
                  {' '}
                  ·{' '}
                </span>
                고객센터 운영: 오전 10:00–16:00
              </p>
            </address>
          </div>
        </div>
      </div>
    </footer>
  )
}
