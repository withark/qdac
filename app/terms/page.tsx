import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPageShell } from '@/components/legal/LegalPageShell'
import {
  COMPANY_LANDLINE_TEL,
  SITE_COMPANY_ADDRESS,
  SUPPORT_EMAIL,
  companyLandlineTelHref,
} from '@/lib/support-contact'

const title = '이용약관 · 플래닉 Planic'
const description = '플래닉(Planic) 서비스 이용에 관한 약관입니다.'

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

export default function TermsPage() {
  return (
    <LegalPageShell
      title="이용약관"
      intro="플래닉(Planic) 서비스 이용과 관련한 기준을 안내합니다. 본 약관은 행사 문서 생성 서비스의 이용 조건, 권리·의무, 책임 범위를 규정합니다."
    >
      <article className="pb-4">
        <div className="sticky top-[58px] z-[15] mb-6 space-y-3 border-b border-slate-100 bg-white/95 pb-3 pt-1 backdrop-blur">
          <p id="terms-effective" className="text-xs text-slate-500 sm:text-sm">
            시행일: 2026년 3월 24일
          </p>
          <nav aria-label="약관 목차" className="flex flex-wrap gap-x-2 gap-y-1.5 text-[11px] sm:text-xs">
            {[
              ['제1조', '#terms-1'],
              ['제2조', '#terms-2'],
              ['제3조', '#terms-3'],
              ['제4조', '#terms-4'],
              ['제5조', '#terms-5'],
              ['제6조', '#terms-6'],
              ['제7조', '#terms-7'],
              ['제8조', '#terms-8'],
              ['제9조', '#terms-9'],
              ['제10조', '#terms-10'],
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

        <section id="terms-1" className={section}>
          <h2 className={h2}>제1조 목적</h2>
          <p className={p}>
            본 약관은 주식회사 시냇가에심은나무(이하 "회사")가 제공하는 플래닉(Planic) 서비스의 이용과 관련하여,
            회사와 이용자 간 권리·의무 및 책임사항을 정함을 목적으로 합니다.
          </p>
        </section>

        <section id="terms-2" className={section}>
          <h2 className={h2}>제2조 서비스 내용</h2>
          <ol className={ol}>
            <li>서비스는 행사 준비 문서(견적서, 기획안, 프로그램 제안서, 시나리오, 큐시트 등) 생성 기능을 제공합니다.</li>
            <li>이용자는 문서를 생성·저장·재열기·수정하고, 문서 흐름을 이어서 작업할 수 있습니다.</li>
            <li>서비스에는 요금제, 결제, 계정 관리, 이용 이력 확인 등 부가 기능이 포함될 수 있습니다.</li>
            <li>회사는 운영·기술상 필요에 따라 서비스의 일부 기능을 변경하거나 추가할 수 있습니다.</li>
          </ol>
        </section>

        <section id="terms-3" className={section}>
          <h2 className={h2}>제3조 회원가입 및 계정</h2>
          <ol className={ol}>
            <li>서비스의 주요 기능은 로그인 기반으로 제공됩니다.</li>
            <li>이용자는 정확한 정보를 제공해야 하며, 타인의 정보를 도용하거나 허위 정보를 등록해서는 안 됩니다.</li>
            <li>계정 보안 책임은 이용자에게 있으며, 계정 공유·양도·대여는 금지됩니다.</li>
            <li>약관 위반, 부정 이용, 운영 방해가 확인되는 경우 회사는 이용 제한 또는 계정 해지를 할 수 있습니다.</li>
          </ol>
        </section>

        <section id="terms-4" className={section}>
          <h2 className={h2}>제4조 문서 생성 및 저장</h2>
          <ol className={ol}>
            <li>이용자는 주제 입력 또는 기존 문서 연결을 통해 문서를 생성할 수 있습니다.</li>
            <li>생성 문서는 저장 후 재열기 및 수정이 가능하며, 후속 문서 작성 시 참고할 수 있습니다.</li>
            <li>AI 생성 결과는 초안 성격이며, 최종 사용 전 이용자의 검토·수정이 필요합니다.</li>
            <li>서비스 정책에 따라 문서 보관 기간, 생성 한도, 기능 제공 범위가 달라질 수 있습니다.</li>
          </ol>
        </section>

        <section id="terms-5" className={section}>
          <h2 className={h2}>제5조 단가표/과업 문서 업로드 및 이용</h2>
          <ol className={ol}>
            <li>이용자는 단가표, 과업지시서 등 문서 파일·텍스트를 업로드해 문서 생성에 활용할 수 있습니다.</li>
            <li>업로드 자료에 대한 권리와 적법성은 이용자가 보장해야 합니다.</li>
            <li>회사는 서비스 제공, 품질 개선, 보안 점검을 위해 필요한 범위에서 업로드 자료를 처리할 수 있습니다.</li>
            <li>불법·유해·권리침해 자료가 확인되면 회사는 삭제 또는 이용 제한 조치를 취할 수 있습니다.</li>
          </ol>
        </section>

        <section id="terms-6" className={section}>
          <h2 className={h2}>제6조 유료 서비스 및 결제</h2>
          <ol className={ol}>
            <li>서비스 일부는 유료 요금제로 제공될 수 있으며, 요금·주기·제공 범위는 페이지 내 안내에 따릅니다.</li>
            <li>결제는 회사가 지정한 결제대행사를 통해 처리될 수 있습니다.</li>
            <li>구독 해지, 환불, 결제 취소 등은 관련 법령과 결제 정책 및 고지 내용에 따릅니다.</li>
            <li>요금제/가격 변경 시 회사는 사전에 공지합니다.</li>
          </ol>
        </section>

        <section id="terms-7" className={section}>
          <h2 className={h2}>제7조 이용 제한</h2>
          <ol className={ol}>
            <li>법령 위반, 타인 권리 침해, 불법·유해 콘텐츠 입력 또는 업로드</li>
            <li>서비스 정상 운영을 방해하는 비정상 접근, 자동화 남용, 보안 위협 행위</li>
            <li>타인 사칭, 허위 정보 유포, 회사 및 제3자에 대한 명예 훼손</li>
            <li>회사는 위 행위 발생 시 사전 고지 후 또는 긴급 시 즉시 이용 제한 조치를 할 수 있습니다.</li>
          </ol>
        </section>

        <section id="terms-8" className={section}>
          <h2 className={h2}>제8조 책임 제한</h2>
          <ol className={ol}>
            <li>회사는 천재지변, 통신 장애, 외부 서비스 장애 등 불가항력으로 인한 손해에 대해 책임을 지지 않습니다.</li>
            <li>AI 생성 결과의 정확성·완전성은 보증되지 않으며, 최종 문서 사용 책임은 이용자에게 있습니다.</li>
            <li>회사의 고의 또는 중대한 과실이 없는 한, 간접·특별 손해에 대한 책임은 제한됩니다.</li>
          </ol>
        </section>

        <section id="terms-9" className={section}>
          <h2 className={h2}>제9조 개인정보 보호</h2>
          <p className={p}>
            회사는 관련 법령에 따라 이용자의 개인정보를 보호하며, 개인정보의 수집·이용·보관·파기에 관한 상세 내용은
            별도의 개인정보처리방침을 따릅니다.
          </p>
        </section>

        <section id="terms-10" className={`${section} border-t border-slate-100 pt-8 mt-10`}>
          <h2 className={h2}>제10조 문의처 및 운영자 정보</h2>
          <p className={p}>
            상호: (주)시냇가에심은나무
            <br />
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
