import Link from 'next/link'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'

type SiteFooterProps = {
  /** 랜딩 등에서 여백·부가 카피 축소 */
  compact?: boolean
}

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
          <Link href="/" className="text-slate-900 transition-colors hover:text-primary-600">
            <EvQuoteLogo showText size="sm" className="justify-center" />
          </Link>

          <p className="mt-2.5 text-slate-600">행사 준비에 필요한 문서를 하나씩 빠르게 만드는 AI 도구</p>

          <nav className="mt-4" aria-label="서비스 및 정책 링크">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-slate-600">
              <Link href="/guide" className="transition-colors hover:text-primary-600">사용 방법</Link>
              <Link href="/features" className="transition-colors hover:text-primary-600">기능 소개</Link>
              <Link href="/help" className="transition-colors hover:text-primary-600">도움말</Link>
              <Link href="/plans" className="transition-colors hover:text-primary-600">요금제</Link>
              <Link href="/terms" className="transition-colors hover:text-primary-600">이용약관</Link>
              <Link href="/privacy" className="transition-colors hover:text-primary-600">개인정보처리방침</Link>
            </div>
          </nav>

          <address className="mt-4 max-w-[920px] space-y-0.5 text-[11px] leading-[1.45] not-italic text-slate-600 sm:text-xs">
            <p>
              <span className="font-medium text-slate-700">(주)시냇가에심은나무</span> · 사업자번호: 438-81-01028 · 대표자: 이다윗 · 주소:
              광릉수목원로 600 A동
            </p>
            <p>
              대표 연락처:{' '}
              <a href="tel:07086661112" className="font-medium text-primary-700 hover:underline">
                070-8666-1112
              </a>{' '}
              · 통신판매업 신고번호: 제2017-경기포천-0319호 · 고객센터 운영: 오전 10:00 ~ 16:00
            </p>
          </address>
        </div>
      </div>
    </footer>
  )
}
