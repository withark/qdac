# 행사 견적 시스템

AI 기반 행사 견적서 자동 생성 도구 (Next.js 14)

---

## 빠른 시작 (3단계)

### 1. 설치
```bash
npm install
```

### 2. API 키 설정
```bash
cp .env.local.example .env.local
```
`.env.local` 파일을 열고 Anthropic API 키 입력:
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
- **Anthropic Claude** (claude-sonnet-4-20250514)
- **SheetJS** — Excel 다운로드
- **html2canvas + jsPDF** — PDF 출력
- **Tailwind CSS**
- **TypeScript**
