/** 견적·문서 생성에서 쓰는 행사 유형 옵션 (InputForm·견적 생성기 공통) */
export const EVENT_TYPE_GROUPS = [
  { group: '기념·의식', options: ['기념식 / 개교기념', '시상식 / 수료식', '창립기념'] },
  { group: '교육·강연', options: ['강연 / 강의', '세미나 / 컨퍼런스', '워크숍'] },
  { group: '야외·체험', options: ['체육대회 / 운동회', '레크레이션', '팀빌딩', '야유회 / MT'] },
  { group: '공연·축제', options: ['축제 / 페스티벌', '콘서트 / 공연', '기업 행사'] },
] as const
