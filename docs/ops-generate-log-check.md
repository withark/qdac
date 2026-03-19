# generate 로그 확인 — 운영자 실행 절차

## 1. 이미 끝난 것

| 항목 | 값 |
|------|-----|
| 커밋 SHA | `211380339a59a5ddba6f9f680f5191efbc2f03a0` |
| 푸시된 브랜치 | `feature/test-codex-review` |
| Production 배포 | **수동**: `main` 머지 후 Vercel이 Production 자동 배포. 현재 브랜치만 푸시된 상태면 Production 미반영. |
| 운영 반영까지 남은 단계 | **2단계**: (1) `feature/test-codex-review` → `main` PR 머지, (2) Vercel Production 배포 완료 대기 |

---

## 2. 운영자가 지금 바로 할 것 (1분 실행문)

1. **Vercel 대시보드** 접속: https://vercel.com → 로그인.
2. **프로젝트 선택**: 팀/개인 대시보드에서 **planic** 프로젝트 클릭.
3. **Deployments** 클릭: 상단 탭에서 **Deployments** 선택.
4. **최신 Production 배포** 클릭: 목록에서 상태가 **Production**인 가장 위 항목 한 번 클릭.
5. **Runtime Logs** 열기: 해당 배포 상세 화면에서 **"Logs"** 또는 **"Runtime Logs"** 탭/버튼 클릭.
6. **검색창**에 `generate.slowest` 입력 후 검색.
7. **가장 최근 로그 줄** 선택: `generate.slowest`가 포함된 로그 한 줄 클릭해 전체 페이로드 확인.
8. 같은 로그 화면에서 검색어를 `generate.total`로 바꿔 한 번 더 검색, 같은 요청의 `generate.total` 로그 확인.
9. **에러/타임아웃 확인**: 같은 시간대 로그에서 `generate` 또는 `timeout`/`504`/`abort` 검색해 에러/타임아웃 로그 유무 확인.
10. 아래 **최종 값 5개**를 복사해 요청자에게 전달.

---

## 3. Vercel에서 보는 경로 (한 줄씩)

- Vercel → 대시보드 → **planic** 프로젝트 클릭
- 상단 **Deployments** 탭 클릭
- 목록에서 **가장 위 Production** 배포 한 번 클릭
- 해당 배포 상세에서 **Logs** / **Runtime Logs** 클릭
- 검색어: `generate.slowest`
- 검색어: `generate.total`
- (타임아웃 확인) 검색어: `generate` 또는 `timeout` / `504`

---

## 4. 운영자가 요청자에게 보내야 할 최종 값 5개

| # | 항목 | 로그에서 가져올 곳 |
|---|------|-------------------|
| 1 | **가장 오래 걸린 구간** | `generate.slowest` 로그의 `slowestStage` |
| 2 | **해당 구간 ms** | `generate.slowest` 로그의 `slowestMs` |
| 3 | **전체 generate 총 소요시간** | `generate.slowest` 또는 `generate.total` 로그의 `totalGenerateMs` |
| 4 | **generate 성공 여부** | 해당 requestId/quoteId 구간에 `logError('generate', ...)` 로그 없으면 성공 |
| 5 | **timeout 재발 여부** | 같은 구간 Runtime Logs에 timeout/504/abort 관련 에러 로그 있으면 재발, 없으면 미재발 |

---

## 5. 마지막 출력

- **완료된 것**: 커밋 푸시 (`211380339`), 브랜치 `feature/test-codex-review`.
- **운영자가 지금 할 것**: Vercel → planic → Deployments → 최신 Production → Runtime Logs → `generate.slowest` / `generate.total` 검색 후 위 5개 값 확인·전달.
- **로그에서 찾을 값**: `slowestStage`, `slowestMs`, `totalGenerateMs`, 성공 여부(에러 로그 유무), timeout/504/abort 유무.
- **최종 판정 기준**: (1) `totalGenerateMs`가 목표 이내인지, (2) `slowestStage`/`slowestMs`로 병목 구간 확인, (3) 성공 여부 true, (4) timeout 재발 false.
