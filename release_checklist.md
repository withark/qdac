# Planic Release Stabilization Checklist (Draft)

## 0) Freeze 범위
- 새 기능 추가 금지
- 구조 변경 최소화
- 변경은 “한 번에 하나의 이슈” 원칙

## 1) 프로젝트 구조 요약 (빠른 파악)
- App Router(Next.js `app/`)
  - 사용자/마케팅: `app/page.tsx`, `app/features/page.tsx`, `app/guide/page.tsx`, `app/help/page.tsx`, `app/plans/page.tsx`, `app/terms/page.tsx`, `app/privacy/page.tsx`
  - 인증: `app/auth/page.tsx`
  - 핵심 사용자 영역(로그인 필요): `app/dashboard/page.tsx`, 문서 생성 계열(예: `app/generate/page.tsx`, `app/estimate-generator/page.tsx` 등), `app/settings/page.tsx`, `app/history/page.tsx`, `app/prices/page.tsx`
  - 결제: `app/billing/*` (checkout/success/fail)
  - 관리자 UI: `app/admin/*`
- API Route (`app/api/`)
  - 사용자: `app/api/me/route.ts`, 문서/가격/히스토리 관련 라우트들
  - 결제:
    - 주문 조회: `app/api/billing/order/route.ts`
    - 구독 반영(mock): `app/api/billing/subscribe/route.ts`
    - 웹훅 수신(Toss): `app/api/billing/webhook/route.ts`
    - 결제 승인 처리: `app/api/billing/confirm/route.ts` (success 페이지에서 호출)
  - 관리자 API: `app/api/admin/**/route.ts` (전반적으로 `requireAdmin()` 적용)
- 미들웨어:
  - `middleware.ts`에서 `/admin` 쿠키 보호 + 로그인 필요 경로 보호

## 2) 사용자 핵심 흐름(추정)
1. 마케팅 진입: `/` → 주요 랜딩(`/features`, `/plans`, `/help`, `/guide`)
2. 인증 유도: 로그인 필요 경로로 이동 시 `middleware.ts`가 `/auth`로 리다이렉트
3. 핵심 작업:
   - 대략 `estimate-generator`/`generate`류 페이지에서 견적/문서 생성
   - 생성 결과는 스트리밍/비동기 흐름(`lib/api/client.ts`의 `apiGenerateStream`)을 거칠 가능성
4. 결제 전환:
   - `/plans`에서 업그레이드 → `app/billing/checkout/page.tsx`
   - checkout이 `/api/billing/order`로 주문을 조회 후 Toss 결제 모듈 실행
   - 성공 후:
     - `/billing/success`가 `/api/billing/confirm` 호출
     - 웹훅이 구독 활성화(DB 반영)까지 처리
5. 대시보드 복귀:
   - `app/dashboard/page.tsx`가 `/api/me`를 통해 사용량/플랜 표시 및 UI 구성

## 3) 배포 전 필수 체크 (Build/CI 성격)
1. `npm run build` 성공
2. 타입/린트 통과
3. E2E 스모크:
   - `npm run test:e2e`
   - 포함 케이스(현재 repo 기준): `/`, `/features`, `/help#faq-document-types`, `/plans`, `/terms`

## 4) 치명적 오류 탐지(런타임) 체크
1. Vercel Preview 런타임 로그에서 `500`, `Unhandled Rejection`, `Edge runtime error` 여부 확인
2. 브라우저 콘솔에서 아래 항목 존재 여부 확인
   - 네트워크 `4xx/5xx` (특히 `/api/*`)
   - React hydration warning, hook 에러
   - 스트림 파싱/NDJSON 처리 관련 에러

## 5) 핵심 전환 흐름 검증 (브라우저 기준, 필수)
1. 로그인/리다이렉트
   - 미로그인 상태에서 로그인 필요 경로 진입 시 `/auth`로 이동하는지
   - `reason=signup_required`가 올바르게 설정되는지(estimate-generator 관련)
2. 대시보드 로딩
   - `/dashboard` 진입 시 `/api/me` 호출 실패 시 사용자용 에러 표시가 되는지
3. 문서 생성/진행(최소 1회)
   - “생성 시작 → 완료/에러 표시”까지 콘솔/화면 에러 없는지
4. 결제 업그레이드(가능하면 테스트 결제 1회)
   - `/billing/checkout`에서 `NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY` 누락 시 오류 메시지 표시되는지
   - 결제 성공 시 `/billing/success`에서 `/api/billing/confirm` 호출 후 `/dashboard?checkout=success`로 가는지
   - 결제 실패 시 `/billing/fail`에서 메시지/CTA가 깨지지 않는지
5. 웹훅 처리(Toss live)
   - `BILLING_MODE=live`에서 웹훅 엔드포인트가 정상 응답하는지
   - 웹훅 검증 옵션(`TOSS_PAYMENTS_WEBHOOK_VERIFY`)에 따라 401/200 분기 동작이 의도대로인지

## 6) 모바일/반응형 레이아웃 점검
1. 작은 화면(예: iPhone SE~14 Pro)에서 스크롤/오버플로우 확인
2. `h-screen overflow-hidden` 계열 레이아웃(예: `app/dashboard/page.tsx`)에서
   - 헤더 고정/콘텐츠 스크롤이 정상인지
   - 하단 토스트/팝업이 잘리지 않는지
3. 테이블/카드 레이아웃(`app/plans/page.tsx` 등)에서
   - 가로 스크롤 발생 여부
   - 버튼/링크 클릭 영역이 충분한지

## 7) SEO/메타/운영 설정 점검
1. `app/layout.tsx`
   - `metadataBase` 및 기본 `title/description/openGraph/twitter`가 깨지지 않는지
2. OpenGraph 이미지
   - `/opengraph-image` 렌더링이 오류 없이 생성되는지(콘솔에 Edge 관련 에러 없는지)
3. `app/sitemap.ts`, `app/robots.ts`
   - 중요한 공개 페이지가 sitemap에 포함되는지
   - robots에서 과도하게 차단하지 않는지(예: `'/dashboard'`, `'/admin'` 등만 disallow되는지)

## 8) 체크 후 제출물(관측 결과 기록)
- 확인자/시간
- 브라우저(기기/OS/버전)
- 발견된 에러(콘솔/네트워크/로그) 요약 + 재현 URL

