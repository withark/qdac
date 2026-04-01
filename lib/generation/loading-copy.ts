const DEFAULT_PROGRESS_PHRASES = [
  '핵심 내용을 빠르게 정리하고 있어요',
  '읽기 편한 문장으로 다듬는 중이에요',
  '현장에서 바로 쓸 수 있게 구성하고 있어요',
  '완성도를 높이는 마지막 점검 중이에요',
]

function stageAwarePhrases(stageLabel: string): string[] {
  if (stageLabel.includes('입력 확인')) {
    return ['입력값을 검토하고 누락 항목을 확인하는 중이에요', '생성 방향을 잡고 있어요']
  }
  if (stageLabel.includes('자료')) {
    return ['필요한 맥락을 모아 구조를 준비하고 있어요', '문서 흐름에 맞는 근거를 정리하고 있어요']
  }
  if (stageLabel.includes('프롬프트')) {
    return ['요청 의도에 맞게 생성 지시를 구성하는 중이에요', '결과 품질을 높이기 위한 조건을 정리하고 있어요']
  }
  if (stageLabel.includes('작성')) {
    return ['핵심 메시지를 중심으로 초안을 쓰고 있어요', '문장 톤과 흐름을 맞추는 중이에요']
  }
  if (stageLabel.includes('정리')) {
    return ['중복 표현을 줄이고 가독성을 높이는 중이에요', '한 번 더 읽기 좋게 정돈하고 있어요']
  }
  if (stageLabel.includes('저장')) {
    return ['결과를 안전하게 저장하는 중이에요', '곧 결과 화면으로 연결해 드릴게요']
  }
  return DEFAULT_PROGRESS_PHRASES
}

export function getGenerationLoadingCopy(stageLabel: string, elapsedSec: number): string {
  const phrases = stageAwarePhrases(stageLabel)
  const index = Math.floor(Math.max(0, elapsedSec) / 4) % phrases.length
  return phrases[index] || DEFAULT_PROGRESS_PHRASES[0]
}
