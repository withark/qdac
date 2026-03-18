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
  const span = endM - startM
  const n = rows.length
  return rows.map((row, i) => {
    const t =
      n === 1
        ? startM
        : Math.round(startM + (span * i) / Math.max(n - 1, 1))
    return { ...row, time: minutesToHHMM(t % (24 * 60)) }
  })
}
