# Planic Release Risk Register (Draft)

## 우선순위 표기
- P0: 배포 시 사용자/결제/인증이 즉시 막힐 가능성(가장 먼저)
- P1: 부분 장애 또는 보안/운영 리스크(중요)
- P2: 회귀/사소한 장애 가능성(그래도 점검 권장)
- P3: 성능/UX 저하 또는 간헐적 경미 이슈

## 10대 위험 이슈(코드 근거 기반)

### 1) (P0) Toss 웹훅에서 “검증 이후” 로깅/아이템업데이트 실패가 500을 유발할 수 있음
- 영역: `app/api/billing/webhook/route.ts`
- 왜 위험한가
  - 웹훅은 공급자가 재시도할 수 있으므로, DB/로깅 단계에서 500이 나면 동일 이벤트가 반복 처리/재시도될 위험이 커집니다.
  - 현재는 `verifyTossWebhookPayment()` 호출부는 방어하지만, 이후 `logBillingWebhook()` 및 `recordBillingWebhookEventIfNew()` 호출이 try/catch로 감싸져 있지 않습니다.
- 근거(핵심 흐름)
  - `verifyTossWebhookPayment` 이후:
    - `await logBillingWebhook(...)` 호출
    - `await recordBillingWebhookEventIfNew(eventId, 'toss')`
    - `handleTossPaymentStatusChanged(data)`는 별도 try/catch로 감싸져 있으나,
    - 로깅/아이템업데이트 실패는 아직 500으로 전파될 수 있습니다.
- 제안(구조 변경 최소화)
  - `logBillingWebhook` / `recordBillingWebhookEventIfNew`를 try/catch로 감싸고,
    - 로깅 실패는 “구독 처리 성공/실패”와 분리하여 웹훅 전체 500을 줄이는 방향으로 조정
    - 예: 로깅 실패 시에도 구독 상태 갱신은 계속 수행(또는 로깅 단계 실패는 200으로 종료)
- 검증
  - `BILLING_MODE=live`에서 웹훅 요청을 1회(가능하면 Toss 테스트 모드 payload) 실행 후 200/DB 반영 확인

### 2) (P0) Preview/배포 환경에서 NextAuth secret 미설정 시 인증 토큰 검증이 실패할 수 있음
- 영역: `middleware.ts`, `lib/nextauth-secret.ts`, `scripts/check-auth-env.mjs`
- 왜 위험한가
  - 인증/권한 게이트가 미들웨어에서 돌아가며, 토큰 검증 실패는 대량 리다이렉트 루프/접근 불가로 이어질 수 있습니다.
  - `scripts/check-auth-env.mjs`는 `VERCEL_ENV === 'production'`에서만 `NEXTAUTH_SECRET` 누락을 강제 종료합니다.
  - `resolveNextAuthSecret()`는 `NODE_ENV === 'production'`이면 `NEXTAUTH_SECRET`이 없을 때 undefined를 유지합니다.
- 근거
  - `check-auth-env.mjs`: production일 때만 필수 체크
  - `lib/nextauth-secret.ts`: production이면 fallback secret을 쓰지 않음
  - `middleware.ts`: `getToken({ secret })` 호출에 영향을 줌
- 제안
  - Preview에서도(또는 해당 도메인/host 조건일 때) `NEXTAUTH_SECRET`이 없으면 명확한 오류/기본값 정책을 두는 것이 안전
- 검증
  - Vercel Preview에서 로그인 시 토큰 검증이 정상인지(콘솔/네트워크 redirect 패턴 확인)

### 3) (P1) Admin 보안 기본값/시크릿 fallback이 공격 표면을 넓힐 수 있음
- 영역: `lib/admin-auth.ts`, `app/api/auth/admin-login/route.ts`, `scripts/hash-admin-password.js`
- 왜 위험한가
  - DB에 `admin_password_hash`가 없을 때 기본 비밀번호(`admin`)로 검증할 수 있습니다.
  - 또한 admin 세션 HMAC 시크릿이 `NEXTAUTH_SECRET || ADMIN_SECRET || 'dev-admin-secret-min-32-chars'`로 fallback될 수 있어,
    환경변수 미설정 시 쿠키 위변조 가능성이 커집니다.
- 근거
  - `DEFAULT_PASSWORD = 'admin'`
  - `getSecret()`이 env 없을 때 dev 고정 문자열 사용
- 제안
  - 운영/preview에서 최소한 “dev fallback 차단” 또는 “DB 해시 미존재 시 로그인 차단” 같은 방어 정책 점검
- 검증
  - Vercel Preview에서 admin-login이 어떤 경로로 성공 가능한지(로컬/스테이징과 비교)

### 4) (P1) 미들웨어 보호 경로에 `/billing` 포함 → 결제 성공/실패 페이지 접근이 세션에 강하게 의존
- 영역: `middleware.ts`
- 왜 위험한가
  - 결제 완료 시점에 사용자가 로그아웃/세션 만료 상태면 `/billing/success`에서도 `/auth`로 리다이렉트되어 사용자 흐름이 끊길 수 있습니다.
- 근거
  - `PROTECTED_PREFIXES`에 `'/billing'` 포함
  - `/billing/success`는 `/api/billing/confirm` 호출(서버에서 세션 기반)
- 제안
  - 결제 성공/실패 페이지의 요구 세션 정책이 의도와 일치하는지 확인(운영 UX 관점)
- 검증
  - 결제 직전/직후 세션 만료 시나리오(가능하면)에서 UX가 어떻게 망가지는지 확인

### 5) (P1) 웹훅 이벤트 idempotency 키 생성에 payload 필드가 비어도 문자열이 만들어짐
- 영역: `app/api/billing/webhook/route.ts`
- 왜 위험한가
  - `eventId = toss_${paymentKey ?? ''}_${orderId ?? ''}_${status ?? ''}_${createdAt ?? ''}` 형태라
    일부 필드가 없으면 eventId가 동일/충돌하거나, 반대로 중복 억제가 약해질 가능성이 있습니다.
- 근거
  - payload에서 `paymentKey/orderId`가 검증 단계에서 존재를 확인하지만,
    `status`, `createdAt`는 빈 값이 될 수 있음(현재 eventType이 PAYMENT_STATUS_CHANGED인 경우에만 검증 진입)
- 제안
  - createdAt/status 등 추가 필드 의존도를 낮추고, orderId 중심으로 안정 키를 구성하는지 점검
- 검증
  - Toss 테스트 모드에서 동일 orderId 이벤트를 반복 전송해 idempotency가 제대로 동작하는지 확인

### 6) (P2) SEO metadataBase가 build 시점 env에 의존(placeholder risk)
- 영역: `next.config.js`, `app/layout.tsx`, `lib/site-url.ts`
- 왜 위험한가
  - NEXTAUTH_URL이 build 시점에 비면 `next.config.js`에서 placeholder로 설정되며,
    메타데이터의 절대 URL이 placeholder로 굳을 수 있습니다.
  - Vercel 런타임 env가 build 이후에만 주입되는 특수 케이스에서는 OG/canonical이 어긋날 수 있습니다.
- 근거
  - `next.config.js`: NEXTAUTH_URL이 빈 값/유효하지 않으면 placeholder.build로 대체
  - `app/layout.tsx`: `metadataBase`/openGraph.url에 baseUrl 존재 시만 반영
- 제안
  - Vercel build 단계에서 올바른 NEXTAUTH_URL이 주입되는지 확인
- 검증
  - Preview에서 `/_next` 관련이 아닌 실제 HTML head의 og:url/canonical 확인

### 7) (P2) OpenGraph 이미지가 Edge runtime으로 동작 → 특정 런타임/폴리필 이슈 시 500 가능
- 영역: `app/opengraph-image.tsx`
- 근거
  - `export const runtime = 'edge'`
  - ImageResponse 렌더 실패 시 OG 생성이 실패할 수 있음
- 제안
  - Preview에서 `/opengraph-image` 직접 호출 시 정상 응답/콘솔 에러 여부 확인
- 검증
  - 브라우저에서 OG 이미지 URL로 접속 후 다운로드/렌더 확인

### 8) (P2) 스트림(NDJSON) 파서가 newline 기반 split에 의존
- 영역: `lib/api/client.ts`의 `apiGenerateStream`
- 왜 위험한가
  - 서버가 chunk 경계에서 `\n`을 보장하지 않으면 파서가 완성 이벤트를 놓칠 수 있습니다(현재는 buffer 누적/trim으로 일부 완화).
  - generation 실패가 “화면에서는 단순 실패”로 보이거나, 콘솔에서만 상세 원인 확인될 수 있습니다.
- 근거
  - `buffer.split('\n')` 후 라인 단위 JSON parse
- 제안
  - 스트리밍 응답 포맷이 실제로 NDJSON “줄 구분”을 준수하는지 서버 출력 코드와 함께 확인
- 검증
  - Preview에서 생성 플로우를 최소 1회 실행해 단계 이벤트/complete 수신 확인

### 9) (P3) Dashboard 레이아웃이 `h-screen overflow-hidden` 기반 → 모바일에서 스크롤/토스트 가림 가능
- 영역: `app/dashboard/page.tsx`
- 근거
  - 최상단 컨테이너 `h-screen overflow-hidden`
  - 내부 `overflow-y-auto`는 존재하나, 모바일 환경에서 토스트/헤더가 잘릴 수 있음
- 제안
  - 모바일에서 실제 스크롤/하단 컴포넌트 가림 여부 점검
- 검증
  - iPhone SE / 390px 폭에서 화면 스크롤 + 토스트 노출 시 가림 여부 확인

### 10) (P3) Public 페이지 로딩의 클라이언트 컴포넌트 비중 증가 시 hydration warning 가능
- 영역
  - `SessionProvider`(root layout), 각 페이지의 `use client` 컴포넌트 구성
- 제안
  - Preview에서 React 콘솔 warning이 없는지 확인
- 검증
  - 마케팅 주요 페이지 3~5개 + 로그인/대시보드 1개에서 콘솔 확인

## 지금 당장 수정해야 할 “1개만” (권장)
### 선택: (P0) `app/api/billing/webhook/route.ts`의 “검증 이후 로깅/아이템업데이트” 500 전파 완화
- 이유
  - 근거가 매우 직접적입니다: 현재 웹훅 라우트는 검증 단계만 방어적이고,
    `logBillingWebhook()` / `recordBillingWebhookEventIfNew()`는 try/catch가 없어 해당 단계에서 DB/네트워크 문제가 생기면 500으로 끝날 가능성이 있습니다.
  - 웹훅은 재시도/중복 이벤트 이슈가 연결되기 쉬워 “한 번의 500”이 운영 리스크로 확대될 가능성이 큽니다.
- 기대 효과
  - 웹훅 이벤트의 구독 반영(핵심 기능)과 로깅/아이템업데이트(부가 기능)를 분리하여,
    사소한 장애가 결제 전체 장애로 번지는 것을 줄입니다.
- 브라우저 기준 재검증(코드 수정 후)
  - 결제 성공/실패 페이지 동선
  - `/dashboard?checkout=success`로 이동 시 `/api/me`가 정상인지
  - 콘솔/네트워크에서 5xx가 줄었는지 확인

