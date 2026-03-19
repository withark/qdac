# 운영 반영 체크리스트 (DB / ENV / 배포 후 점검)

이 문서는 **운영 반영(Production)** 시 필수로 확인해야 하는 항목을 체크리스트로 정리합니다.

---

## 실행 전 준비물

- 관리자 비밀번호
- Google 검증용 계정 이메일
- Toss 테스트 카드 / 실결제 여부
- 검증 플랜명

---

## 1) DB 스키마 반영 절차

이 프로젝트는 `lib/db/client.ts`의 `initDb()`에서 테이블/인덱스를 **자동 부트스트랩**할 수 있습니다.

- **개발 기본값**: 요청 중 `initDb()`가 호출되면 `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`를 수행하며 스키마를 맞춥니다.
- **운영 기본값**: `NODE_ENV=production`이면 부트스트랩이 기본 비활성화됩니다(첫 요청 DDL로 인한 timeout 위험).
- **운영에서 스키마를 자동으로 맞춰야 하는 경우(예: 긴급 hotfix)**:
  - `DB_BOOTSTRAP_SCHEMA=true`를 일시적으로 켠 뒤, 관리자가 `/admin` 등 DB를 쓰는 페이지/API를 1회 호출해 스키마 부트스트랩을 수행합니다.
  - 완료 후 즉시 `DB_BOOTSTRAP_SCHEMA`를 끄는 것을 권장합니다.

### 운영 스키마 변경 시 “반드시 확인할 것”

- **새 테이블/인덱스 추가**: `initDb()`에 `CREATE TABLE/INDEX IF NOT EXISTS`가 들어갔는지
- **컬럼 추가**: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 형태로 되어 있는지
- **partial unique index**(예: active 중복 방지): 인덱스 생성이 `IF NOT EXISTS`인지
- **운영에서 DDL을 자동 실행하지 않는 정책을 유지할지**: 유지한다면 별도 마이그레이션/DDL 실행 절차가 필요합니다.

---

## 2) ENV 체크리스트 (Production)

### 인증(필수)

- `NEXTAUTH_URL` (운영 canonical URL 고정: 보통 `https://www.planic.cloud`)
- `NEXTAUTH_SECRET` (필수. 누락 시 middleware `getToken`이 영구 실패할 수 있음)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### DB (관리자/구독/결제/로그 집계에 영향)

- `DATABASE_URL` (Neon Postgres connection string)

### 결제 (live 모드일 때 필수)

- `BILLING_MODE=live` 로 운영할 경우, 토스 결제 관련 env가 필수입니다.
- (구체 변수는 `lib/billing/toss-config`가 검증합니다. 운영 반영 전 `validateTossLiveEnv()`가 통과하는지 확인하세요.)

### 옵션/운영용

- `DB_BOOTSTRAP_SCHEMA` (운영에서 스키마 자동 부트스트랩이 필요할 때만 일시적으로 `true`)
- `TOSS_PAYMENTS_WEBHOOK_VERIFY` (웹훅 검증을 강제할지)

---

## 3) 실행 순서 (실제 사용자 흐름)

전제: 관리자 페이지 점검은 `/admin`에서 관리자 로그인(준비물의 관리자 비밀번호 사용) 후 수행.

- 1) Google 로그인
  - `/auth`에서 Google 검증 계정으로 로그인 → `/dashboard` 진입 확인
- 2) generate 1회
  - `/generate`에서 견적 생성 1회 성공 확인
- 3) generation-logs 확인
  - `/admin/generation-logs`에서 방금 생성된 요청이 표시되는지 확인
- 4) users 확인
  - `/admin/users`에서 해당 사용자 노출(최근 로그인/플랜/구독상태/최근 결제일 컬럼 업데이트) 확인
  - 필요 시 `/api/admin/users`가 200으로 응답하는지 확인
- 5) subscriptions 확인
  - `/admin/subscriptions`에서 검증 플랜 구독 상태가 반영되었는지 확인
  - 필요 시 `/api/admin/subscriptions`가 200으로 응답하는지 확인
- 6) payments 확인
  - `/admin/payments`에서 주문/웹훅 반영이 정상적으로 표시되는지 확인
  - 필요 시 `/api/admin/payments`가 200으로 응답하는지 확인
- 7) Toss 결제
  - 검증 플랜에 대해 Toss 결제 실행(테스트 카드/실결제 여부는 준비물에 따름)
  - 성공 시:
    - `billing_orders.status=approved` 반영
    - `subscriptions`에 active 1개만 유지
    - `/admin` KPI(오늘 승인/이번 달 매출/활성 유료) 반영
  - 실패 시:
    - `billing_orders.status=failed` 반영, 구독이 active로 바뀌지 않음(실패 로그 확인)
  - 환불/취소 시:
    - `billing_orders.status=canceled` 반영, 구독이 `canceled`로 정리됨

---

## 4) 장애/리스크 시그널(운영자 관점)

- 관리자 대시보드에서 `paymentSuccessRateMonth`, `recentPaymentFailures`가 비정상 증가
- 사용자 목록에서 `quotaExceeded` 또는 비활성 사용자 증가
- 구독 목록에서 동일 userId에 active가 2개 이상(구조상 발생하면 안 됨)

---
## 최종 판정 규칙

- P0 (운영 불가): 아래 중 하나라도 실패하면 **즉시 운영 중지/롤백(Go-No-Go)**
  - Google 로그인 실패로 사용자 `/dashboard` 진입이 불가
  - `/generate`에서 생성 1회가 실패하거나, `generation-logs`에 해당 생성이 기록되지 않음
  - 관리자 관련 페이지/API가 차단되거나(401) 5xx로 응답: `/api/admin/users`, `/api/admin/subscriptions`, `/api/admin/payments` 중 하나라도 실패
  - Toss 결제 성공 후 `billing_orders.status=approved` 또는 `subscriptions.active` 반영 실패(웹훅/동기화 실패)
- P1 (운영 가능, 제한 대응): 재시도/대체 대응이 필요하되 운영 의사결정에 즉시 치명적이지 않은 항목
  - `/admin` KPI 숫자/카드가 일시적으로 0이거나 지연되어 보이지만, `/api/admin/*` 원천 데이터는 정상(200)이며 최종 반영 확인 가능
  - 화면 컬럼 포맷/정렬만 어긋나고 원천 데이터 조회/API는 정상(200)

정리: **P0가 하나라도 실패하면 운영 불가**입니다. P1은 운영 가능하되, 같은 P1이 반복(동일 배포에서 재현)되면 P0로 재분류 후 중지/조치합니다.

