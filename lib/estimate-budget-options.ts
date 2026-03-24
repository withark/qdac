/** 견적 생성 API `budget` 필드 — `parseBudgetCeilingKRW`가 상한을 읽을 수 있게 전체 문구 사용 */
export const ESTIMATE_BUDGET_OPTIONS: { value: string; label: string }[] = [
  { value: '소규모 (300만원 이하)', label: '소규모 (300만원 이하)' },
  { value: '중규모 (300~1,000만원)', label: '중규모 (300~1,000만원)' },
  { value: '대규모 (1,000만원 이상)', label: '대규모 (1,000만원 이상)' },
  { value: '미정', label: '미정 · AI가 범위 제안' },
]
