/** NDJSON `stage` 코드 → 사용자 표시용 한국어 (진행 UX 공통) */
export function mapGenerationStageToKorean(stage: string): string {
  const m: Record<string, string> = {
    context: '자료 불러오는 중',
    prompt: '프롬프트 구성 중',
    llm: 'AI 작성 중',
    generate: 'AI 작성 중',
    parse: '결과 정리 중',
    post: '결과 정리 중',
    save: '저장 중',
  }
  return m[stage] ?? stage
}
