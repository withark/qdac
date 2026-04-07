import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPageShell } from '@/components/legal/LegalPageShell'
import {
  COMPANY_LANDLINE_TEL,
  SITE_COMPANY_ADDRESS,
  SUPPORT_EMAIL,
  companyLandlineTelHref,
} from '@/lib/support-contact'

const title = '개인정보처리방침 · 플래닉 Planic'
const description = '플래닉(Planic)의 개인정보 수집·이용·보관 및 이용자 권리에 관한 안내입니다.'

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

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="개인정보처리방침"
      intro="플래닉(Planic)은 회원가입, 문서 생성, 결제 등 서비스 제공 과정에서 필요한 개인정보를 관련 법령에 따라 처리합니다."
    >
      <article className="pb-4">
        <div className="sticky top-[58px] z-[15] mb-6 space-y-3 border-b border-slate-100 bg-white/95 pb-3 pt-1 backdrop-blur">
          <p id="privacy-effective" className="text-xs text-slate-500 sm:text-sm">
            시행일: 2026년 3월 24일
          </p>
          <nav aria-label="개인정보처리방침 목차" className="flex flex-wrap gap-x-2 gap-y-1.5 text-[11px] sm:text-xs">
            {[
              ['수집 항목', '#privacy-items'],
              ['수집 방법', '#privacy-method'],
              ['이용 목적', '#privacy-purpose'],
              ['보관 기간', '#privacy-retention'],
              ['제3자 제공', '#privacy-third'],
              ['처리 위탁', '#privacy-consign'],
              ['이용자 권리', '#privacy-rights'],
              ['쿠키·로그', '#privacy-cookies'],
              ['안전성 조치', '#privacy-security'],
              ['문의처', '#privacy-contact'],
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

        <section id="privacy-items" className={section}>
          <h2 className={h2}>수집하는 개인정보 항목</h2>
          <ol className={ol}>
            <li>회원가입/로그인 정보: 식별자, 이메일, 이름(표시명), 프로필 정보(로그인 제공 범위 내)</li>
            <li>결제 관련 정보: 결제 식별값, 승인/구독 상태, 거래 내역(민감 결제정보는 결제대행사 정책에 따름)</li>
            <li>업로드 자료: 참고 문서 파일, 입력 텍스트, 연결 문서 정보</li>
            <li>생성 데이터: 생성된 문서 본문, 제목, 문서 유형, 저장/수정 이력</li>
            <li>서비스 로그: 접속기록, 기기/브라우저 정보, IP, 오류 로그, 쿠키 정보</li>
          </ol>
        </section>

        <section id="privacy-method" className={section}>
          <h2 className={h2}>수집 방법</h2>
          <ul className={ul}>
            <li>회원이 직접 입력하는 가입/프로필/문서 작성 정보</li>
            <li>로그인 연동(OAuth) 절차를 통한 제공 정보</li>
            <li>문서 생성·저장·업로드 이용 과정에서 자동 생성되는 정보</li>
            <li>결제, 고객문의, 운영 지원 과정에서 제공되는 정보</li>
          </ul>
        </section>

        <section id="privacy-purpose" className={section}>
          <h2 className={h2}>이용 목적</h2>
          <ol className={ol}>
            <li>회원 식별, 로그인 유지, 계정 보안</li>
            <li>행사 문서 생성·저장·재열기·수정 기능 제공</li>
            <li>결제 처리, 요금제 관리, 환불/정산 대응</li>
            <li>고객 문의 응답 및 공지 전달</li>
            <li>서비스 품질 개선, 장애 대응, 보안 및 부정 이용 방지</li>
          </ol>
        </section>

        <section id="privacy-retention" className={section}>
          <h2 className={h2}>보관 기간</h2>
          <ol className={ol}>
            <li>회원 정보: 탈퇴 시까지 보관(관계 법령에 따른 보관 의무가 있는 경우 예외)</li>
            <li>생성 문서·업로드 자료: 회원이 삭제하거나 탈퇴할 때까지 또는 정책상 보관 기간까지</li>
            <li>결제/거래 기록: 전자상거래 등 관련 법령에서 정한 보존 기간</li>
            <li>접속 기록/로그: 통신비밀보호법 등 관련 법령에서 정한 기간</li>
          </ol>
        </section>

        <section id="privacy-third" className={section}>
          <h2 className={h2}>제3자 제공 여부</h2>
          <p className={p}>
            회사는 원칙적으로 이용자 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 따른 요청이 있거나,
            이용자가 사전에 동의한 경우에는 예외로 합니다.
          </p>
        </section>

        <section id="privacy-consign" className={section}>
          <h2 className={h2}>처리 위탁</h2>
          <ul className={ul}>
            <li>클라우드/데이터베이스 운영</li>
            <li>로그인 인증 제공자 연동</li>
            <li>결제대행사(PG) 결제 처리</li>
            <li>고객 안내 메시지 발송(필요 시)</li>
          </ul>
          <p className={p}>위탁 시 관련 법령에 따라 계약 및 안전성 조치를 적용하며, 변경 시 본 방침에 반영합니다.</p>
        </section>

        <section id="privacy-rights" className={section}>
          <h2 className={h2}>이용자 권리</h2>
          <p className={p}>
            이용자는 언제든지 개인정보 열람·정정·삭제·처리정지를 요청할 수 있으며, 법령이 허용하는 범위에서 지체 없이
            처리합니다.
          </p>
        </section>

        <section id="privacy-cookies" className={section}>
          <h2 className={h2}>쿠키 / 로그 / 접속기록</h2>
          <ul className={ul}>
            <li>로그인 유지, 보안, 성능 개선을 위해 쿠키를 사용할 수 있습니다.</li>
            <li>접속기록 및 시스템 로그는 장애 분석, 보안 대응, 부정 이용 방지 목적으로 처리됩니다.</li>
            <li>이용자는 브라우저 설정으로 쿠키 저장을 거부할 수 있으나 일부 기능이 제한될 수 있습니다.</li>
          </ul>
        </section>

        <section id="privacy-security" className={section}>
          <h2 className={h2}>안전성 확보 조치</h2>
          <ol className={ol}>
            <li>개인정보에 대한 접근 권한의 차등 부여 및 최소화</li>
            <li>전송 구간 암호화(HTTPS 등), 저장 시 암호화(해당 시)</li>
            <li>침해 사고 대응을 위한 접속 기록 보관 및 모니터링</li>
            <li>내부 관리계획 수립, 담당자 교육</li>
          </ol>
        </section>

        <section id="privacy-contact" className={`${section} border-t border-slate-100 pt-8 mt-10`}>
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
