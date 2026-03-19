# 운영 체크리스트 (짧은 버전)

배포 직전/직후 운영자가 그대로 따라 하는 체크리스트.

---

## 실행 전 준비물

- [ ] 관리자 비밀번호
- [ ] Google 검증용 계정 이메일
- [ ] Toss 테스트 카드 / 실결제 여부
- [ ] 검증 플랜명

## 배포 전 체크

- [ ] `npm run build` 성공
- [ ] (운영) `NEXTAUTH_URL`이 **운영 도메인**으로 고정되어 있는지
- [ ] (운영) `NEXTAUTH_SECRET` 존재(누락 시 인증/미들웨어가 깨질 수 있음)
- [ ] (운영) `DATABASE_URL` 존재(관리자/구독/결제 집계가 비정상일 수 있음)
- [ ] (결제 live 운영 시) 토스 결제 env 검증(`validateTossLiveEnv()`가 실패하지 않는 구성)

---

## ENV 체크

- [ ] `NEXTAUTH_URL`
- [ ] `NEXTAUTH_SECRET`
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`
- [ ] `DATABASE_URL`
- [ ] `BILLING_MODE` (운영 정책에 따라 `live` 또는 `mock`)
- [ ] (선택) `TOSS_PAYMENTS_WEBHOOK_VERIFY` (웹훅 검증 강제 여부)

---

## DB 변경 체크

- [ ] 운영에서 DDL 자동 실행 정책 확인:
  - 기본은 운영 `NODE_ENV=production`에서 DDL 부트스트랩이 꺼짐
  - 필요 시 `DB_BOOTSTRAP_SCHEMA=true`를 **일시적으로** 켜고 1회 호출 후 끄기

---

## 실행 순서 (실제 사용자 흐름)

전제: 관리자 페이지 점검은 `/admin`에서 관리자 로그인(준비물의 관리자 비밀번호 사용) 후 수행.

- [ ] 1) Google 로그인: `/auth` → (Google 검증 계정) 로그인 성공 → `/dashboard` 진입
- [ ] 2) generate 1회: `/generate`에서 견적 생성 1회 성공
- [ ] 3) generation-logs 확인: `/admin/generation-logs`에서 방금 생성한 요청이 표시되는지 확인
- [ ] 4) users 확인: `/admin/users`에서 해당 사용자가 노출되고(최근 로그인/플랜/구독상태/최근 결제일 컬럼 확인), 필요 시 `/api/admin/users`가 200인지 확인
- [ ] 5) subscriptions 확인: `/admin/subscriptions`에서 검증 플랜 기준 구독 상태가 반영되었는지 확인(필요 시 `/api/admin/subscriptions`가 200인지 확인)
- [ ] 6) payments 확인: `/admin/payments`에서 주문/웹훅 반영이 정상적으로 표시되는지 확인(필요 시 `/api/admin/payments`가 200으로 응답하는지 확인). 결제 전이면 “주문 없음/대기” 공백은 정상 허용
- [ ] 7) Toss 결제: 검증 플랜에 대해 Toss 결제 실행(테스트 카드/실결제 여부는 준비물에 따름)

- [ ] 7.1 Toss 결제 성공 후: `billing_orders.status=approved`, `subscriptions`에서 active가 1개만 유지, `/admin` KPI가 반영됨
- [ ] 7.2 Toss 결제 실패 후: `billing_orders.status=failed`, `subscriptions`에서 active로 전환되지 않음
- [ ] 7.3 환불/취소 후: `billing_orders.status=canceled`, `subscriptions`이 `canceled`로 정리됨

---
## 최종 판정 규칙

- P0 (운영 불가): 아래 중 하나라도 실패하면 **즉시 운영 중지/롤백(Go-No-Go)**
  - Google 로그인 실패로 사용자 `/dashboard` 진입이 불가
  - `/generate`에서 생성 1회가 실패하거나, `generation-logs`에 해당 생성이 기록되지 않음
  - 관리자 관련 페이지/API가 차단되거나(401) 5xx로 응답: `/api/admin/users`, `/api/admin/subscriptions`, `/api/admin/payments` 중 하나라도 실패
  - Toss 결제 성공 후 `billing_orders.status=approved` 또는 `subscriptions.active` 반영 실패(웹훅/동기화 실패)
- P1 (운영 가능, 제한 대응): 재시도/대체 대응이 필요하되 운영 의사결정에 “즉시 치명적”이지 않은 항목
  - `/admin` KPI 숫자/카드가 일시적으로 0이거나 지연되어 보이지만, `/api/admin/*` 원천 데이터는 정상(200)이며 최종 반영 확인 가능
  - 화면 컬럼 포맷/정렬만 어긋나고 원천 데이터 조회/API는 정상(200)

정리: **P0가 하나라도 실패하면 운영 불가**입니다. P1은 운영 가능하되, 같은 P1이 반복(동일 배포에서 재현)되면 P0로 재분류 후 중지/조치합니다.
