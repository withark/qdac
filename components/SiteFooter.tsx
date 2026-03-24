import Link from 'next/link'

type SiteFooterProps = {
  /** 랜딩 등에서 여백·부가 카피 축소 */
  compact?: boolean
}

/**
 * 공통 사업자·약관 푸터 (랜딩, 약관 페이지 등)
 */
export function SiteFooter({ compact = false }: SiteFooterProps) {
  const pad = compact ? 'py-6 sm:py-7' : 'py-9 sm:py-10'
  const textSize = compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'

  return (
    <footer className="flex-shrink-0 border-t border-slate-100 bg-white">
      <div className={`mx-auto max-w-5xl px-4 sm:px-6 ${pad} ${textSize}`}>
        <div className="grid gap-8 sm:grid-cols-[1.5fr_1fr_1.4fr]">
          <section className="space-y-2">
            <p className="text-sm font-semibold tracking-tight text-slate-900">플래닉 Planic</p>
            <p className="text-slate-600">행사 준비에 필요한 문서를 하나씩 빠르게 만드는 AI 도구</p>
          </section>

          <nav className="space-y-2" aria-label="서비스 링크">
            <p className="font-semibold text-slate-900">서비스</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-slate-600">
              <Link href="/features" className="transition-colors hover:text-primary-600">기능 소개</Link>
              <Link href="/guide" className="transition-colors hover:text-primary-600">사용 방법</Link>
              <Link href="/help" className="transition-colors hover:text-primary-600">도움말</Link>
              <Link href="/plans" className="transition-colors hover:text-primary-600">요금제</Link>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-slate-600">
              <Link href="/terms" className="transition-colors hover:text-primary-600">이용약관</Link>
              <Link href="/privacy" className="transition-colors hover:text-primary-600">개인정보처리방침</Link>
            </div>
          </nav>

          <section className="space-y-2">
            <p className="font-semibold text-slate-900">사업자 정보</p>
            <address className="not-italic space-y-1 text-slate-600">
              <p>주소: 광릉수목원로 600 A동</p>
              <p>
                대표 연락처:{' '}
                <a href="tel:07086661112" className="font-medium text-primary-700 hover:underline">
                  070-8666-1112
                </a>
              </p>
              <p>통신판매업 신고번호: 제2017-경기포천-0319호</p>
              <p>고객센터 운영시간: 오전 10:00 ~ 16:00</p>
            </address>
          </section>
        </div>
      </div>
    </footer>
  )
}
