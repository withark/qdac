import type { PriceCategory, PriceItem } from '@/lib/types'

/** 사용자가 고른 행사 종류 문자열 → 단가표 카테고리 분류과 비교용 버킷 */
export type EventPriceBucket =
  | 'sports'
  | 'teambuilding'
  | 'corporate'
  | 'festival'
  | 'wedding'
  | 'conference'
  | 'launch'
  | 'school'
  | 'general'

function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
}

/** 단가표 카테고리 이름만 보고 어떤 행사 성격인지 추정 (없으면 neutral) */
export function classifyPriceCategoryName(name: string): EventPriceBucket | 'neutral' {
  const n = norm(name)
  if (!n) return 'neutral'
  if (/(체육|운동회|운동장|종목|경기|이어달리기|줄다리기|양궁|다트|투호|계주)/.test(n)) return 'sports'
  if (/(팀빌딩|teambuilding)/.test(n)) return 'teambuilding'
  if (/(워크숍|워크샵|세미나|세션|회의|기업|임직원|강연|포럼|컨퍼런스|교육|워크)/.test(n)) return 'corporate'
  if (/(축제|페스티벌|공연|콘서트|무대|festival)/.test(n)) return 'festival'
  if (/(웨딩|결혼|혼례)/.test(n)) return 'wedding'
  if (/(컨퍼런스|컨벤션|conference)/.test(n)) return 'conference'
  if (/(런칭|쇼케이스|launch)/.test(n)) return 'launch'
  if (/(학교|입학|졸업|학예회)/.test(n)) return 'school'
  if (/(레크|야유회|mt|피크닉)/.test(n)) return 'sports'
  return 'neutral'
}

/** 사용자 선택 행사 종류 → 버킷 */
export function eventTypeToBucket(eventType: string): EventPriceBucket {
  const t = norm(eventType)
  if (!t) return 'general'
  if (/(체육대회|운동회)/.test(t)) return 'sports'
  if (/(팀빌딩|teambuilding)/.test(t)) return 'teambuilding'
  if (/(워크숍|워크샵|세미나|컨퍼런스|강연|포럼)/.test(t)) return 'corporate'
  if (/(레크레이션|야유회|mt)/.test(t)) return 'sports'
  if (/(축제|페스티벌|콘서트|공연)/.test(t)) return 'festival'
  if (/(웨딩|결혼)/.test(t)) return 'wedding'
  if (/(기업행사|기업)/.test(t)) return 'corporate'
  if (/(기념|시상|창립)/.test(t)) return 'general'
  return 'general'
}

function itemMatchesBucket(item: PriceItem, userBucket: EventPriceBucket, eventTypeRaw: string): boolean {
  const types = item.types
  if (!Array.isArray(types) || types.length === 0) return true
  const et = norm(eventTypeRaw)
  for (const ty of types) {
    const t = norm(ty)
    if (!t) continue
    if (et && (t.includes(et) || et.includes(t))) return true
    const tb = eventTypeToBucket(ty)
    if (tb === userBucket || tb === 'general') return true
  }
  return false
}

function categoryMatchesBucket(
  catClass: EventPriceBucket | 'neutral',
  userBucket: EventPriceBucket,
): boolean {
  if (catClass === 'neutral') return true
  if (userBucket === 'general') return true
  if (catClass === userBucket) return true
  /** 팀빌딩·레크는 기업 워크숍 계열과 겹칠 수 있어 corporate와 완전 배제하지 않음 */
  if (userBucket === 'teambuilding' && (catClass === 'corporate' || catClass === 'sports')) return true
  if (userBucket === 'corporate' && catClass === 'teambuilding') return true
  if (userBucket === 'sports' && catClass === 'teambuilding') return true
  if (userBucket === 'teambuilding' && catClass === 'sports') return false
  if (userBucket === 'corporate' && catClass === 'sports') return false
  if (userBucket === 'sports' && catClass === 'corporate') return false
  return true
}

/**
 * 선택한 행사 종류에 맞지 않는 단가표 카테고리·행을 제외합니다.
 * 카테고리명이 애매하면(neutral) 그대로 둡니다. 모두 걸러지면 원본을 반환합니다.
 */
export function filterPriceCategoriesForEvent(
  prices: PriceCategory[],
  eventType: string,
): PriceCategory[] {
  if (!prices.length) return prices
  const userBucket = eventTypeToBucket(eventType)
  if (userBucket === 'general') return prices

  const out: PriceCategory[] = []
  for (const cat of prices) {
    const catClass = classifyPriceCategoryName(cat.name || '')
    if (!categoryMatchesBucket(catClass, userBucket)) continue
    const items = (cat.items || []).filter((it) => itemMatchesBucket(it, userBucket, eventType))
    if (items.length === 0) continue
    out.push({ ...cat, items })
  }

  if (out.length === 0) return prices
  return out
}
