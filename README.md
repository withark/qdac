# 행사 견적 시스템

AI 기반 행사 견적서 자동 생성 도구 (Next.js 14)

---

## 빠른 시작 (3단계)

### 1. 설치
```bash
npm install
```

### 2. 환경 변수 설정
```bash
cp .env.local.example .env.local
```
- **로그인 (소셜 + 임시 아이디/비번):**
  - 소셜: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - 선택 소셜: `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
  - 아이디/비번 임시 활성: `ENABLE_EMAIL_PASSWORD_AUTH=1` (+ `NEXT_PUBLIC_ENABLE_CREDENTIAL_AUTH=1`)
  - 소셜만 강제 전환: `AUTH_SOCIAL_ONLY=1` (+ `NEXT_PUBLIC_AUTH_SOCIAL_ONLY=1`)
  - 상세는 [docs/AUTH_ENV.md](docs/AUTH_ENV.md). 구글 동의 화면에 **플래닉** 이름이 나오게 하려면 [docs/GOOGLE_OAUTH_PLANIC.md](docs/GOOGLE_OAUTH_PLANIC.md) 참고.
- **AI:** `.env.local`에 Anthropic 또는 OpenAI API 키 입력:
```
ANTHROPIC_API_KEY=sk-ant-여기에_키_입력
```
> API 키: https://console.anthropic.com 에서 무료 발급

### 3. 실행
```bash
npm run dev
```
→ http://localhost:3000 접속

---

## 페이지 구성

### 사용자 영역 (고객용)

| 경로 | 기능 |
|------|------|
| `/` | 랜딩 · 소개 |
| `/auth` | 소셜 로그인(Google/Kakao/Naver) + 임시 아이디/비번 |
| `/plans` | 플랜 선택 (요금제 보기) |
| `/generate` | AI 견적서 생성 · Excel/PDF 다운로드 |
| `/prices`   | 단가표 관리 (내 단가 → AI 자동 반영) |
| `/references` | 참고 견적서·시나리오·큐시트 샘플 |
| `/history`  | 견적 이력 · 통계 |
| `/settings` | 회사 정보 · 기본값 |

### 관리자 영역 (`/admin` — 운영자 전용)

| 경로 | 기능 |
|------|------|
| `/admin` | 관리자 로그인 · 대시보드 |
| `/admin/users` | 사용자 관리 (준비 중) |
| `/admin/subscriptions` | 구독 관리 (준비 중) |
| `/admin/plans` | 플랜 관리 (준비 중) |
| `/admin/usage` | 사용량 관리 (준비 중) |
| `/admin/engines` | 엔진/모델 (준비 중) |
| `/admin/logs` | 로그 (준비 중) |
| `/admin/system` | 시스템 (준비 중) |

관리자 화면은 `/admin` 이하로만 제공되며, 관리자 쿠키가 없으면 접근 시 로그인 페이지로 이동합니다.  
상세 IA·권한 구조는 [docs/IA.md](docs/IA.md) 참고.

---

## 폴더 구조

```
event-quote/
├── app/
│   ├── admin/         ← 관리자 전용 (/admin, /admin/users, …)
│   ├── api/           ← API 라우트 (generate, prices, history, settings, auth)
│   ├── generate/      ← 메인 견적 생성 페이지
│   ├── prices/        ← 단가표 관리
│   ├── references/    ← 참고 견적서·시나리오·큐시트
│   ├── history/       ← 견적 이력
│   └── settings/      ← 설정
├── middleware.ts     ← /admin 하위 비관리자 접근 차단
├── components/
│   ├── quote/         ← InputForm, QuoteResult
│   └── ui/            ← 공통 UI 컴포넌트
├── lib/
│   ├── ai.ts          ← Claude API 호출
│   ├── storage.ts     ← JSON 파일 읽기/쓰기
│   ├── calc.ts        ← 견적 계산 유틸
│   ├── exportExcel.ts ← SheetJS Excel 생성
│   ├── exportPdf.ts   ← html2canvas+jsPDF 출력
│   └── types.ts       ← 타입 정의
└── data/              ← 데이터 저장 (자동 생성)
    ├── prices.json
    ├── history.json
    ├── settings.json
    └── references.json
```

---

## 데이터 저장

모든 데이터는 `data/` 폴더에 JSON으로 저장됩니다. DB 불필요.

> ⚠️ `data/` 폴더를 주기적으로 백업하세요.

---

## 기술 스택

- **Next.js 14** (App Router)
- **NextAuth** — 소셜 로그인(Google/Kakao/Naver)
- **Anthropic Claude** / **OpenAI** — AI 견적 생성
- **SheetJS** — Excel 다운로드
- **html2canvas + jsPDF** — PDF 출력
- **Tailwind CSS**
- **TypeScript**

---

## 운영·테스트 점검 순서

배포 전 또는 배포 후 확인 시 아래 순서로 점검하면 좋습니다.

1. **빌드·타입**
   - `npx tsc --noEmit` — 타입 오류 없음
   - `npm run build` — 프로덕션 빌드 성공

2. **환경 변수**
   - 로컬: `.env.local`에 `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `ADMIN_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 설정
   - 운영: Vercel 등에 동일 이름으로 설정. **운영 도메인**은 `https://www.planic.cloud` 이므로 `NEXTAUTH_URL=https://www.planic.cloud` 로 고정.

3. **소셜 로그인**
   - `/auth` 접속 → 설정된 소셜 버튼 클릭 → 인증 후 콜백까지 정상 이동
   - Google/Kakao/Naver 콘솔의 리디렉션 URI가 `{NEXTAUTH_URL}/api/auth/callback/{provider}` 와 일치하는지 확인

4. **기능**
   - `/generate` — 견적서 생성 (AI 키 필요)
   - `/prices`, `/settings`, `/history` — CRUD 및 저장
   - 참고 견적서·시나리오·과업지시서 업로드/삭제
   - 큐시트 샘플 업로드/다운로드

5. **에러 확인**
   - API 실패 시 서버 로그에 `[라우트명]` 컨텍스트로 로그 출력되는지 확인 (logError 사용)
   - 로그인 실패 시 `/auth?error=...` 에서 개발 모드일 때 error/errorDescription 노출 여부 확인
   - 운영 스모크체크: `PLANIC_ADMIN_PASSWORD=... npm run verify:production-runtime`

### Vercel 운영 배포 전 체크리스트

- **환경 변수 (Vercel Settings → Environment Variables)**  
  `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `ADMIN_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 필수.  
  Kakao/Naver 사용 시 `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 추가.  
  아이디/비번 임시 운영 시 `ENABLE_EMAIL_PASSWORD_AUTH=1`, `NEXT_PUBLIC_ENABLE_CREDENTIAL_AUTH=1`; 소셜-only 전환 시 `AUTH_SOCIAL_ONLY=1`, `NEXT_PUBLIC_AUTH_SOCIAL_ONLY=1`.  
  AI 사용 시 `ANTHROPIC_API_KEY` 또는 `OPENAI_API_KEY` 추가. 상세는 [docs/AUTH_ENV.md](docs/AUTH_ENV.md) 참고.
- **Google 리디렉션 URI**  
  Google Cloud Console → 사용자 인증 정보 → 승인된 리디렉션 URI에  
  운영: `https://www.planic.cloud/api/auth/callback/google` / 로컬: `http://localhost:3000/api/auth/callback/google` 등록.
- **빌드**  
  `npx tsc --noEmit` → `npm run build` 성공 확인 후 배포.  
  (`check-auth-env.mjs`가 production `planic.cloud` 배포에서 `NEXTAUTH_SECRET`, `ADMIN_PASSWORD` 누락/약한 값이면 빌드를 차단)
- **운영 API 런타임 점검(배포 후)**  
  `PLANIC_BASE_URL=https://www.planic.cloud PLANIC_ADMIN_PASSWORD=... npm run verify:production-runtime`  
  (`PLANIC_CHECK_DEFAULT_ADMIN=0` 설정 시 기본 `admin/admin` 차단 검사는 생략 가능)
- **시간당 자동 점검(GitHub Actions)**  
  `.github/workflows/production-runtime-smoke.yml` 이 매시간(`0 * * * *`) 운영 스모크체크를 실행합니다.  
  저장소 `Actions secrets`에 아래 값을 설정하세요:
  `PLANIC_ADMIN_PASSWORD`(필수), `PLANIC_BASE_URL`(권장), `PLANIC_ADMIN_USERNAME`(선택), `PLANIC_EXPECT_PROVIDER`(선택), `PLANIC_CHECK_DEFAULT_ADMIN`(선택), `PLANIC_CHECK_ADMIN_QUALITY_BUNDLE`(선택)
- **로그인 테스트 순서**  
  배포 URL → `/auth` → 설정된 소셜 로그인 버튼 → 인증 후 콜백(홈 또는 callbackUrl) 이동 확인.
- **배포 후 첫 점검**  
  `/auth` 로그인 성공 → `/settings` 또는 `/generate` 접근 가능 여부 확인. API 키 없으면 `/generate`는 에러 메시지로 안내됨.
