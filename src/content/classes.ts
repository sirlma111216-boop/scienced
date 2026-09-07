/**
 * 수강 클래스 — 학기별 독립 공간.
 *
 * 이 강의는 여러 학기 동안 같은 내용으로 반복된다.
 * 18강 교재 내용은 한 벌만 두고(`lessons/*`), 학기마다 달라지는 것 —
 * 수강생·응답·공개 여부·모둠 — 만 클래스 안에서 움직인다.
 *
 * 콘텐츠를 학기마다 복사하지 않는 것이 이 설계의 핵심이다.
 * 복사하면 1강 문구를 고칠 때 모든 학기를 찾아다녀야 한다.
 */

export type Affiliation = 'undergrad' | 'gradschool'

export const AFFILIATIONS = [
  { key: 'undergrad' as const, label: '경희대학교 학부' },
  { key: 'gradschool' as const, label: '경희대학교 교육대학원' },
]

/**
 * 학기 선택지.
 * 계절학기를 나중에 늘릴 수 있도록 여기 한 곳에만 둔다.
 */
export const TERMS = [
  { key: '1' as const, label: '1학기' },
  { key: '2' as const, label: '2학기' },
]

export type Term = (typeof TERMS)[number]['key']

export const DAYS = [
  { key: 'mon' as const, label: '월' },
  { key: 'tue' as const, label: '화' },
  { key: 'wed' as const, label: '수' },
  { key: 'thu' as const, label: '목' },
  { key: 'fri' as const, label: '금' },
  { key: 'sat' as const, label: '토' },
  { key: 'sun' as const, label: '일' },
]

export type DayKey = (typeof DAYS)[number]['key']

export const affiliationLabel = (a: Affiliation) =>
  AFFILIATIONS.find((x) => x.key === a)?.label ?? a

export const termLabel = (t: string) => TERMS.find((x) => x.key === t)?.label ?? `${t}학기`

export const dayLabel = (d: string) => DAYS.find((x) => x.key === d)?.label ?? d

/** 요일은 월→일 순서로 정렬해 표시한다. 저장 순서와 무관하게 읽기가 일정하도록. */
export function sortDays(days: string[]): string[] {
  const order = DAYS.map((d) => d.key) as string[]
  return [...days].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

/**
 * 표시 이름 자동 생성.
 *   2026학년도 2학기 · 경희대학교 학부 · 화 13:00–15:45 · 3학점
 * 강사가 고칠 수 있으므로 어디까지나 초기값이다.
 */
export function buildDisplayName(input: {
  year: number
  term: string
  affiliation: Affiliation
  days: string[]
  startTime: string
  endTime: string
  credits: number
}): string {
  const days = sortDays(input.days).map(dayLabel).join('·')
  const time = input.startTime && input.endTime ? `${input.startTime}–${input.endTime}` : ''
  const when = [days, time].filter(Boolean).join(' ')
  return [
    `${input.year}학년도 ${termLabel(input.term)}`,
    affiliationLabel(input.affiliation),
    when,
    `${input.credits}학점`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** 상단바처럼 좁은 자리에 쓰는 짧은 이름. */
export function buildShortName(input: {
  year: number
  term: string
  affiliation: Affiliation
  days: string[]
}): string {
  const days = sortDays(input.days).map(dayLabel).join('·')
  const place = input.affiliation === 'gradschool' ? '교육대학원' : '학부'
  return `${String(input.year).slice(2)}-${input.term} ${place} ${days}`
}

/**
 * 참여 코드 6자리.
 * 눈으로 옮겨 적을 때 헷갈리는 0/O/1/I/l 을 뺀다.
 * 칠판에 적어 주는 코드라서 이 배제가 실제로 필요하다.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateJoinCode(): string {
  const bytes = new Uint32Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

/** 종료가 시작보다 빠르면 저장을 막는다. */
export function isTimeRangeValid(start: string, end: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return false
  return start < end
}

export interface ClassFormValues {
  affiliation: Affiliation
  year: number
  term: string
  days: string[]
  startTime: string
  endTime: string
  credits: number
  displayName: string
}

export function emptyClassForm(): ClassFormValues {
  const year = new Date().getFullYear()
  const base = {
    affiliation: 'undergrad' as Affiliation,
    year,
    term: '1',
    days: [] as string[],
    startTime: '13:00',
    endTime: '15:45',
    credits: 3,
  }
  return { ...base, displayName: buildDisplayName(base) }
}

/** 저장 전 검사. 문제가 있으면 필드별 메시지를 돌려준다. */
export function validateClassForm(v: ClassFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!Number.isInteger(v.year) || v.year < 2000 || v.year > 2100) {
    errors.year = '학년도를 확인해 주세요.'
  }
  if (!TERMS.some((t) => t.key === v.term)) errors.term = '학기를 골라 주세요.'
  if (v.days.length === 0) errors.days = '수업 요일을 하나 이상 고르세요.'
  if (!isTimeRangeValid(v.startTime, v.endTime)) {
    errors.endTime = '종료 시각이 시작 시각보다 뒤여야 합니다.'
  }
  if (!(v.credits > 0)) errors.credits = '학점을 확인해 주세요.'
  if (!v.displayName.trim()) errors.displayName = '표시 이름을 적어 주세요.'
  return errors
}
