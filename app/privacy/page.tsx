import type { Metadata } from 'next'
import { LegalPageShell } from '@/components/legal/LegalPageShell'

export const metadata: Metadata = {
  title: '개인정보처리방침 · 플래닉 Planic',
  description: '플래닉(Planic)의 개인정보 수집·이용·보관 및 이용자 권리에 관한 안내입니다.',
}

const section = 'mt-8 first:mt-0'
const h2 = 'text-base font-bold text-slate-900'
const p = 'mt-2 text-sm text-slate-700 leading-relaxed'
const ol = 'mt-2 list-decimal pl-5 space-y-1.5 text-sm text-slate-700 leading-relaxed'
const ul = 'mt-2 list-disc pl-5 space-y-1.5 text-sm text-slate-700 leading-relaxed'

export default function PrivacyPage() {
  return (
    <LegalPageShell title="개인정보처리방침">
      <article className="pb-4">
        <p className="text-xs text-slate-500">시행일: 2025년 3월 24일</p>
        <p className={`${p} mt-4`}>
          주식회사 시냇가에심은나무(이하 &quot;회사&quot;)는 「개인정보 보호법」 등 관련 법령을 준수하며, 행사 문서
          생성·관리 서비스 플래닉(Planic)(이하 &quot;서비스&quot;) 이용자의 개인정보를 보호하고 권익을 보호하기 위하여
          다음과 같이 개인정보처리방침을 수립·공개합니다.
        </p>

        <section className={section}>
          <h2 className={h2}>제1조 (처리 목적)</h2>
          <p className={p}>회사는 수집한 개인정보를 다음의 목적 범위 내에서만 처리합니다.</p>
          <ol className={ol}>
            <li>회원 식별, 가입 의사 확인, 본인 확인, 부정 이용 방지</li>
            <li>서비스 제공, 문서 생성·저장·이력 관리, 고객 지원 및 공지 전달</li>
            <li>유료 요금제·구독·결제·환불·청구서 발행 등 결제 관련 처리</li>
            <li>서비스 품질 개선, 통계·분석(식별 불가 형태의 가공 포함 가능), 보안·부정 이용 모니터링</li>
            <li>법령상 의무 이행, 분쟁 대응 및 권리 행사</li>
          </ol>
        </section>

        <section className={section}>
          <h2 className={h2}>제2조 (수집 항목 및 수집 방법)</h2>
          <ol className={ol}>
            <li>
              <strong className="text-slate-800">회원 가입·로그인 시</strong>
              <ul className={ul}>
                <li>
                  Google 계정을 통한 로그인: Google OAuth 절차를 통해 제공되는 식별자, 이메일 주소, 이름(표시명),
                  프로필 이미지 URL 등 해당 인증 제공자가 공개하는 범위의 정보
                </li>
                <li>개발·테스트 환경에서 별도 인증 방식이 제공되는 경우, 그에 따른 최소한의 계정 정보</li>
              </ul>
            </li>
            <li>
              <strong className="text-slate-800">서비스 이용 과정에서 자동·수동으로 생성·저장되는 정보</strong>
              <ul className={ul}>
                <li>생성·편집한 문서 본문, 제목, 유형, 저장 시각 등 작업 이력</li>
                <li>참고를 위해 업로드하거나 연결한 파일·텍스트 등 이용자가 입력한 콘텐츠</li>
                <li>접속 일시, IP 주소, 쿠키, 기기·브라우저 정보, 오류 로그 등 서비스 이용 기록 일부</li>
              </ul>
            </li>
            <li>
              <strong className="text-slate-800">결제 시</strong>
              <ul className={ul}>
                <li>
                  결제대행사 처리에 필요한 결제 식별 정보, 승인 내역, 구독 상태 등(카드 번호 전체 등 민감 정보는 회사가
                  직접 저장하지 않는 것을 원칙으로 하며, 결제대행사 정책에 따름)
                </li>
              </ul>
            </li>
            <li>
              수집 방법: 웹·앱 화면 입력, OAuth 연동, 서비스 이용 과정에서의 자동 생성, 고객 문의 시 이용자가 제공하는
              정보 등
            </li>
          </ol>
        </section>

        <section className={section}>
          <h2 className={h2}>제3조 (처리 및 보유 기간)</h2>
          <ol className={ol}>
            <li>
              회원 정보: 원칙적으로 회원 탈퇴 시까지. 다만 관계 법령에 따라 보관이 필요한 경우 해당 기간 동안
              보관합니다.
            </li>
            <li>
              문서·이력·업로드 자료: 이용자가 삭제하거나 탈퇴할 때까지 또는 서비스 정책에 따른 보관 기간까지. 내부
              백업·복구 정책에 따라 일정 기간 사본이 남을 수 있으며, 탈퇴 후에는 복구가 불가능한 방식으로 조속히 파기하는
              것을 원칙으로 합니다.
            </li>
            <li>
              결제·세금계산서·거래 기록: 전자상거래 등에서의 소비자보호에 관한 법률 등 관련 법령이 정한 기간
            </li>
            <li>
              접속 기록 등: 통신비밀보호법 등 관련 법령이 정한 기간
            </li>
          </ol>
        </section>

        <section className={section}>
          <h2 className={h2}>제4조 (개인정보의 제3자 제공)</h2>
          <p className={p}>
            회사는 이용자의 개인정보를 제1조의 처리 목적 범위 내에서만 이용하며, 원칙적으로 이용자의 동의 없이 외부에
            제공하지 않습니다. 다만 다음의 경우는 예외로 합니다.
          </p>
          <ol className={ol}>
            <li>이용자가 사전에 동의한 경우</li>
            <li>법령에 특별한 규정이 있거나 수사·재판 등을 위해 법령에 따라 요청이 있는 경우</li>
          </ol>
        </section>

        <section className={section}>
          <h2 className={h2}>제5조 (처리 위탁)</h2>
          <p className={p}>
            회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁할 수 있으며, 위탁 시 관련 법령에 따라
            위탁 업무 내용·수탁자를 공개하고 필요한 경우 계약을 통해 안전성 확보 조치를 요구합니다.
          </p>
          <ol className={ol}>
            <li>
              <strong className="text-slate-800">클라우드 인프라·데이터베이스</strong>: 서비스 데이터 저장·백업(예:
              PostgreSQL 호환 클라우드 DB 등)
            </li>
            <li>
              <strong className="text-slate-800">인증</strong>: Google 등 소셜 로그인 제공자(이용 시 해당 사업자의
              개인정보처리방침이 일부 적용될 수 있음)
            </li>
            <li>
              <strong className="text-slate-800">결제</strong>: 신용카드·간편결제 등 결제대행사(국내외 결제 서비스를
              사용하는 경우 해당 사업자)
            </li>
            <li>
              <strong className="text-slate-800">이메일·알림 발송</strong>: 거래·공지 메시지 전송을 위한 발송 대행(해당
              시)
            </li>
          </ol>
          <p className={p}>
            위탁 업무의 내용이나 수탁자가 변경되는 경우 본 방침을 개정하거나 별도로 공지합니다.
          </p>
        </section>

        <section className={section}>
          <h2 className={h2}>제6조 (개인정보의 국외 이전)</h2>
          <p className={p}>
            회사는 이용자의 개인정보를 대한민국 이외의 국가로 이전할 필요가 있는 경우, 관련 법령이 정하는 바에 따라
            이전 국가·이전 일시 및 방법, 제공 항목, 수령자, 연락처, 관리 조치 등을 고지하고 필요한 동의 또는 조치를
            취합니다. 클라우드·결제·인증 등 일부 수탁사의 서버가 해외 리전에 위치할 수 있으며, 이 경우 해당 사업자의
            표준계약조항·개인정보 보호 정책 등을 통해 보호 조치를 이행합니다.
          </p>
        </section>

        <section className={section}>
          <h2 className={h2}>제7조 (파기 절차 및 방법)</h2>
          <ol className={ol}>
            <li>
              보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다.
            </li>
            <li>
              전자적 파일 형태는 복구 불가능한 방법으로 삭제하고, 종이 문서는 분쇄 또는 소각합니다.
            </li>
          </ol>
        </section>

        <section className={section}>
          <h2 className={h2}>제8조 (이용자 및 법정대리인의 권리·의무)</h2>
          <ol className={ol}>
            <li>
              이용자는 언제든지 자신의 개인정보 열람·정정·삭제·처리정지를 요구할 수 있으며, 회사는 지체 없이 필요한
              조치를 합니다. 다만 다른 법령에서 특정 항목의 보관을 요구하는 경우 삭제가 제한될 수 있습니다.
            </li>
            <li>
              권리 행사는 서비스 내 설정, 고객센터(070-8666-1112, 운영시간 오전 10:00 ~ 16:00), 회사가 지정한 이메일 등을
              통해 하실 수 있습니다.
            </li>
            <li>
              만 14세 미만 아동의 개인정보 처리에 관하여는 법정대리인의 동의를 받아야 하며, 관련 요청이 있는 경우 회사는
              적법한 절차에 따라 처리합니다.
            </li>
          </ol>
        </section>

        <section className={section}>
          <h2 className={h2}>제9조 (쿠키의 운용)</h2>
          <p className={p}>
            회사는 로그인 유지·보안·서비스 개선을 위해 쿠키를 사용할 수 있습니다. 이용자는 브라우저 설정을 통해 쿠키
            저장을 거부할 수 있으나, 일부 기능 이용이 제한될 수 있습니다. 세션 관련 쿠키는 HttpOnly 등 안전한 옵션을
            적용하는 것을 원칙으로 합니다.
          </p>
        </section>

        <section className={section}>
          <h2 className={h2}>제10조 (안전성 확보 조치)</h2>
          <p className={p}>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취합니다.</p>
          <ol className={ol}>
            <li>개인정보에 대한 접근 권한의 차등 부여 및 최소화</li>
            <li>전송 구간 암호화(HTTPS 등), 저장 시 암호화(해당 시)</li>
            <li>침해 사고 대응을 위한 접속 기록 보관 및 모니터링</li>
            <li>내부 관리계획 수립, 담당자 교육</li>
          </ol>
        </section>

        <section className={section}>
          <h2 className={h2}>제11조 (개인정보 자동 수집 장치의 설치·운영 및 거부)</h2>
          <p className={p}>
            회사는 이용자에게 개별화된 서비스를 제공하기 위해 정보를 저장하고 수시로 불러오는 쿠키 등을 사용할 수
            있습니다. 이용자는 쿠키 설치에 대한 선택권을 가지며, 웹브라우저 옵션 설정을 통해 쿠키 허용·차단을 설정할 수
            있습니다.
          </p>
        </section>

        <section className={section}>
          <h2 className={h2}>제12조 (개인정보 보호책임자)</h2>
          <p className={p}>
            회사는 개인정보 처리에 관한 업무를 총괄하여 책임지는 개인정보 보호책임자를 지정하고 있습니다.
          </p>
          <ul className={ul}>
            <li>성명 및 직책: 개인정보 보호책임자(회사 지정)</li>
            <li>연락처: 070-8666-1112</li>
            <li>이메일 등 기타 연락처는 서비스 내 고객센터 안내에 따릅니다.</li>
          </ul>
          <p className={p}>
            정보주체는 개인정보침해에 대한 신고·상담을 아래 기관에 요청할 수 있습니다. 개인정보 분쟁조정위원회
            (www.kopico.go.kr), 개인정보침해신고센터 (privacy.kisa.or.kr), 대검찰청 사이버수사과 (www.spo.go.kr),
            경찰청 사이버안전국 (cyberbureau.police.go.kr) 등.
          </p>
        </section>

        <section className={section}>
          <h2 className={h2}>제13조 (고지의 의무)</h2>
          <p className={p}>
            본 개인정보처리방침의 내용 추가·삭제 및 수정이 있는 경우 시행일 7일 전부터 서비스 내 공지사항 또는 연결
            화면을 통해 공지합니다. 다만 이용자 권리에 중대한 영향을 미치는 변경의 경우 최소 30일 전에 공지하거나
            필요한 경우 동의를 받습니다.
          </p>
        </section>

        <section className={`${section} border-t border-slate-100 pt-8 mt-10`}>
          <h2 className={h2}>부칙</h2>
          <p className={p}>본 방침은 2025년 3월 24일부터 시행합니다.</p>
        </section>
      </article>
    </LegalPageShell>
  )
}
