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
- **로그인 (Google):** `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — 상세는 [docs/AUTH_ENV.md](docs/AUTH_ENV.md) 참고.
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

| 경로 | 기능 |
|------|------|
| `/auth` | Google 로그인 |
| `/generate` | AI 견적서 생성 · Excel/PDF 다운로드 |
| `/prices`   | 단가표 관리 (내 단가 → AI 자동 반영) |
| `/history`  | 견적 이력 · 통계 |
| `/settings` | 회사 정보 · 기본값 · 참고 견적서 업로드 |

---

## 폴더 구조

```
event-quote/
├── app/
│   ├── api/           ← API 라우트 (generate, prices, history, settings)
│   ├── generate/      ← 메인 견적 생성 페이지
│   ├── prices/        ← 단가표 관리
│   ├── history/       ← 견적 이력
│   └── settings/      ← 설정
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
- **NextAuth** — Google 로그인
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
   - 로컬: `.env.local`에 `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 설정
   - 운영: Vercel 등에 동일 이름으로 설정, `NEXTAUTH_URL`은 실제 배포 URL(또는 커스텀 도메인)로 고정

3. **Google 로그인**
   - `/auth` 접속 → "Google로 로그인" 클릭 → Google 인증 후 콜백까지 정상 이동
   - Google Cloud Console에서 리디렉션 URI가 `{NEXTAUTH_URL}/api/auth/callback/google` 와 일치하는지 확인

4. **기능**
   - `/generate` — 견적서 생성 (AI 키 필요)
   - `/prices`, `/settings`, `/history` — CRUD 및 저장
   - 참고 견적서·시나리오·과업지시서 업로드/삭제
   - 큐시트 샘플 업로드/다운로드

5. **에러 확인**
   - API 실패 시 서버 로그에 `[라우트명]` 컨텍스트로 로그 출력되는지 확인 (logError 사용)
   - 로그인 실패 시 `/auth?error=...` 에서 개발 모드일 때 error/errorDescription 노출 여부 확인
