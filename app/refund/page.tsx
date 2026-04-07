import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPageShell } from '@/components/legal/LegalPageShell'
import {
  COMPANY_LANDLINE_TEL,
  SITE_COMPANY_ADDRESS,
  SUPPORT_EMAIL,
  companyLandlineTelHref,
} from '@/lib/support-contact'

const title = '환불정책 · 플래닉 Planic'
const description = '플래닉(Planic) 유료 구독 상품의 환불 및 청약철회 기준을 안내합니다.'

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description },
  twitter: { title, description },
}

const section = 'mt-8 first:mt-0'
const h2 = 'text-[17px] font-semibold text-slate-900'
const p = 'mt-2 text-sm text-slate-700 leading-relaxed'
const ol = 'mt-2 list-decimal pl-5 space-y-1.5 text-sm text-slate-700 leading-relaxed'
const ul = 'mt-2 list-disc pl-5 space-y-1.5 text-sm text-slate-700 leading-relaxed'

export default function RefundPage() {
  return (
    <LegalPageShell
      title="환불정책"
      intro="플래닉(Planic) 유료 구독의 환불 및 해지 관련 기준을 안내합니다. 결제대행사 처리 규정과 관련 법령에 따라 달라질 수 있습니다."
    >
      <article className="pb-4">
        <div className="sticky top-[58px] z-[15] mb-6 space-y-3 border-b border-slate-100 bg-white/95 pb-3 pt-1 backdrop-blur">
          <p id="refund-effective" className="text-xs text-slate-500 sm:text-sm">
            시행일: 2026년 3월 24일
          </p>
          <nav aria-label="환불정책 목차" className="flex flex-wrap gap-x-2 gap-y-1.5 text-[11px] sm:text-xs">
            {[
              ['적용범위', '#refund-scope'],
              ['환불 대상', '#refund-target'],
              ['환불 조건', '#refund-conditions'],
              ['신청 방법', '#refund-apply'],
              ['처리 절차', '#refund-process'],
              ['해지와의 관계', '#refund-cancel'],
              ['예외 및 유의사항', '#refund-exceptions'],
              ['결제대행사/법령 우선', '#refund-priority'],
              ['문의처', '#refund-contact'],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-md px-1.5 py-0.5 text-primary-700 hover:bg-primary-50 hover:underline"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <section id="refund-scope" className={section}>
          <h2 className={h2}>1. 적용범위</h2>
          <p className={p}>
            본 환불정책은 플래닉(Planic)에서 제공하는 유료 구독(월간/연간 등) 상품 및 관련 서비스의 환불과
            청약철회에 관한 기준을 설명합니다. 결제 시 선택하신 상품/요금제와 결제대행사 처리 규정 및 관련 법령에
            따라 적용 내용이 달라질 수 있습니다.
          </p>
        </section>

        <section id="refund-target" className={section}>
          <h2 className={h2}>2. 환불 대상</h2>
          <ul className={ul}>
            <li>유료 구독(월간/연간 등)의 결제 금액(해당 주기 기준)</li>
            <li>요금제 변경/업그레이드 등으로 인해 발생한 차액 결제(해당 시)</li>
          </ul>
          <p className={p}>
            이미 환불이 완료된 결제 건은 추가 환불이 제한될 수 있으며, 구체적인 환불 가능 여부는 결제 내역 확인 후
            안내드립니다.
          </p>
        </section>

        <section id="refund-conditions" className={section}>
          <h2 className={h2}>3. 환불 조건</h2>
          <p className={p}>
            환불 가능 여부는 “서비스 제공 개시 여부”와 “관련 법령이 허용하는 범위”를 기준으로 판단합니다. 일반적으로
            다음과 같은 원칙을 따릅니다.
          </p>
          <ol className={ol}>
            <li>
              <b>서비스 제공 개시 전</b>: 관계 법령 및 회사의 절차가 허용하는 범위에서 전액 환불이 가능할 수 있습니다.
            </li>
            <li>
              <b>서비스 제공 개시 후</b>: 이미 이용(기능 제공)이 진행된 경우, 회사는 법령이 허용하는 범위 내에서
              전액 또는 부분 환불을 제공할 수 있으며, 환불 금액은 제공된 기간/가치 등을 고려하여 조정될 수 있습니다.
            </li>
            <li>프로모션/쿠폰 등 할인 혜택이 적용된 경우 환불 금액이 달라질 수 있습니다.</li>
          </ol>
        </section>

        <section id="refund-apply" className={section}>
          <h2 className={h2}>4. 환불 신청 방법</h2>
          <p className={p}>
            환불을 원하시는 경우 아래 문의 이메일로 신청해 주세요. 원활한 처리를 위해 아래 정보를 함께 제공해 주시면
            좋습니다.
          </p>
          <ul className={ul}>
            <li>환불 요청하는 결제(주문) 정보: 결제일, 결제수단(신용카드/계좌 등), 결제 금액</li>
            <li>플래닉 계정 정보: 가입 시 사용한 이메일 주소</li>
            <li>필요 시 증빙 자료(결제 내역 캡처 등)</li>
          </ul>
        </section>

        <section id="refund-process" className={section}>
          <h2 className={h2}>5. 처리 절차</h2>
          <ol className={ol}>
            <li>접수: 문의 이메일로 접수된 환불 신청 정보를 확인합니다.</li>
            <li>검토: 서비스 제공 개시 및 이용 사실, 관련 법령, 결제대행사 처리 가능 여부 등을 확인합니다.</li>
            <li>처리: 환불 승인 시 결제대행사를 통해 환불이 진행됩니다.</li>
          </ol>
          <p className={p}>
            환불이 완료되기까지의 소요 시간은 결제수단 및 은행/결제대행사 처리 일정에 따라 달라질 수 있습니다.
          </p>
        </section>

        <section id="refund-cancel" className={section}>
          <h2 className={h2}>6. 해지와의 관계</h2>
          <ul className={ul}>
            <li>구독 해지와 환불은 별개로 진행될 수 있습니다.</li>
            <li>
              구독 해지는 즉시 취소되지 않습니다. 해당 월에 이미 결제된 1건은 취소되지 않으며, 다음 달부터
              구독이 중단됩니다.
            </li>
          </ul>
          <p className={p}>
            해지/환불에 대한 정확한 처리 가능 여부는 결제 내역을 확인한 후 이메일로 안내드립니다.
          </p>
        </section>

        <section id="refund-exceptions" className={section}>
          <h2 className={h2}>7. 예외 및 유의사항</h2>
          <ul className={ul}>
            <li>이용 약관 위반 또는 부정 이용이 확인되는 경우 환불이 제한될 수 있습니다.</li>
            <li>환불 요청 철회/변경이 필요한 경우, 결제대행사 처리 진행 여부에 따라 제한될 수 있습니다.</li>
            <li>이미 환불이 진행(승인)된 건은 추가 조정이 어려울 수 있습니다.</li>
          </ul>
        </section>

        <section id="refund-priority" className={section}>
          <h2 className={h2}>8. 결제대행사/법령 우선</h2>
          <p className={p}>
            본 환불정책의 내용은 관련 법령 및 결제대행사(예: 토스페이먼츠 등)의 환불 처리 규정이 우선 적용됩니다.
            또한, 회사 사정 및 운영 정책 변경에 따라 세부 기준이 달라질 수 있습니다.
          </p>
        </section>

        <section id="refund-contact" className={`${section} border-t border-slate-100 pt-8 mt-10`}>
          <h2 className={h2}>문의처</h2>
          <p className={p}>
            주소: {SITE_COMPANY_ADDRESS}
            <br />
            문의 유선:{' '}
            <a
              href={companyLandlineTelHref()}
              className="rounded-sm text-slate-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2"
            >
              {COMPANY_LANDLINE_TEL}
            </a>
            <br />
            문의 이메일: {SUPPORT_EMAIL}
            <br />
            통신판매업 신고번호: 제2017-경기포천-0319호
            <br />
            답변 가능 시간: 영업일 오전 10:00 ~ 16:00 (순차 회신)
          </p>
        </section>
      </article>
    </LegalPageShell>
  )
}

