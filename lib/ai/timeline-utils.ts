/** "19:00" → 분 (0~24h 당일) */
export function hhmmToMinutes(hhmm: string): number | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm.trim())) return null
  const [h, m] = hhmm.trim().split(':').map(Number)
  if (h === undefined || m === undefined || m < 0 || m > 59) return null
  return (h % 24) * 60 + m
}

export function minutesToHHMM(total: number): string {
  const m = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** 시작~종료 사이로 타임라인 time을 균등 배치 (종료 포함) */
export function redistributeTimelineTimes(
  rows: { time: string; content: string; detail: string; manager: string }[],
  startHHmm: string,
  endHHmm: string,
): { time: string; content: string; detail: string; manager: string }[] {
  const start = hhmmToMinutes(startHHmm)
  const end = hhmmToMinutes(endHHmm)
  if (start === null || end === null || rows.length === 0) return rows
  let endM = end
  let startM = start
  if (endM <= startM) endM += 24 * 60
  const n = rows.length
  if (n === 1) return [{ ...rows[0], time: minutesToHHMM(startM) }]

  const span = endM - startM

  // 1) 이상적 배치(연속값) -> 2) 분 단위 정수화 -> 3) 중복 방지(가능한 경우 엄격 증가)
  const ideal = rows.map((_, i) => startM + (span * i) / (n - 1))
  let times = ideal.map(t => Math.round(t))
  times[0] = startM
  times[n - 1] = endM

  // Forward: 중복/역전 방지
  for (let i = 1; i <= n - 2; i++) {
    if (times[i] <= times[i - 1]) times[i] = times[i - 1] + 1
  }
  // Backward: 마지막 고정(end) 유지
  for (let i = n - 2; i >= 1; i--) {
    if (times[i] >= times[i + 1]) times[i] = times[i + 1] - 1
  }

  // span이 너무 짧아 엄격 증가가 불가능한 경우(범위 밖으로 튐) 원복
  const outOfRange = times.some(t => t < startM || t > endM || !Number.isFinite(t))
  if (outOfRange) {
    times = ideal.map(t => Math.round(t))
    times[0] = startM
    times[n - 1] = endM
    // 최소한 단조 증가(또는 중복 허용)만 확보
    for (let i = 1; i <= n - 2; i++) {
      if (times[i] < times[i - 1]) times[i] = times[i - 1]
    }
  }

  return rows.map((row, i) => ({ ...row, time: minutesToHHMM(times[i]) }))
}
