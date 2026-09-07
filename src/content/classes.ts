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

/**
 * 강의 길이 (3차 E).
 *
 * 같은 진도를 50분 두 교시로 나가는 반이 있다. 전환 시간을 빼면 한 차시에
 * 실제로 쓸 수 있는 것은 40분 남짓이라, 심화 블록을 흐름에서 빼고
 * 「수업 후 이어서」로 내린다. 뺀 것은 사라지지 않는다.
 */
export const SESSION_LENGTHS = [
  { key: 'full' as const, label: '1시간 강의', short: '1시간' },
  // wording-ok: 클래스가 어느 판으로 도는지를 가리키는 설정값이다. 단계 소요 시간이 아니다.
  { key: 'short' as const, label: '50분 강의', short: '50분' },
]

export const sessionLengthLabel = (s: string) =>
  SESSION_LENGTHS.find((x) => x.key === s)?.label ?? s

/** 목록·배지처럼 좁은 자리에 쓰는 표기. */
export const sessionLengthShort = (s: string) =>
  SESSION_LENGTHS.find((x) => x.key === s)?.short ?? s

/** 같은 학기에 여러 강의를 열 수 있으므로 기본값을 비워 둔다. 강사가 반드시 적는다. */
export const COURSE_TITLE_SUGGESTIONS = ['과학교육론', '과학교과교수법']

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
 *   과학교육론 · 2026학년도 2학기 · 경희대학교 학부 · 화 13:00–15:45 · 3학점
 *
 * 강의 제목이 맨 앞에 온다 (3차 E). 같은 학기·같은 요일에 두 강의가 열리면
 * 학년도부터 시작하는 이름으로는 목록에서 구분이 안 된다.
 * 강사가 고칠 수 있으므로 어디까지나 초기값이다.
 */
export function buildDisplayName(input: {
  courseTitle?: string
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
    input.courseTitle?.trim(),
    `${input.year}학년도 ${termLabel(input.term)}`,
    affiliationLabel(input.affiliation),
    when,
    `${input.credits}학점`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * 상단바처럼 좁은 자리에 쓰는 짧은 이름.
 * 여기서도 강의 제목이 먼저다 — 두 강의를 함께 열면 상단바만 보고 구분해야 한다.
 */
export function buildShortName(input: {
  courseTitle?: string
  year: number
  term: string
  affiliation: Affiliation
  days: string[]
}): string {
  const days = sortDays(input.days).map(dayLabel).join('·')
  const place = input.affiliation === 'gradschool' ? '교육대학원' : '학부'
  const when = `${String(input.year).slice(2)}-${input.term} ${place} ${days}`
  return input.courseTitle?.trim() ? `${input.courseTitle.trim()} · ${when}` : when
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
  courseTitle: string
  affiliation: Affiliation
  year: number
  term: string
  days: string[]
  startTime: string
  endTime: string
  credits: number
  sessionLength: 'full' | 'short'
  displayName: string
}

export function emptyClassForm(): ClassFormValues {
  const year = new Date().getFullYear()
  const base = {
    courseTitle: '',
    affiliation: 'undergrad' as Affiliation,
    year,
    term: '1',
    days: [] as string[],
    startTime: '13:00',
    endTime: '15:45',
    credits: 3,
    // 기본값은 1시간 강의. 짧은 판은 고르는 것이지 흘러드는 것이 아니다.
    sessionLength: 'full' as const,
  }
  return { ...base, displayName: buildDisplayName(base) }
}

/** 저장 전 검사. 문제가 있으면 필드별 메시지를 돌려준다. */
export function validateClassForm(v: ClassFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!v.courseTitle.trim()) errors.courseTitle = '강의 제목을 적어 주세요.'
  if (!Number.isInteger(v.year) || v.year < 2000 || v.year > 2100) {
    errors.year = '학년도를 확인해 주세요.'
  }
  if (!TERMS.some((t) => t.key === v.term)) errors.term = '학기를 골라 주세요.'
  if (v.days.length === 0) errors.days = '수업 요일을 하나 이상 고르세요.'
  if (!isTimeRangeValid(v.startTime, v.endTime)) {
    errors.endTime = '종료 시각이 시작 시각보다 뒤여야 합니다.'
  }
  if (!(v.credits > 0)) errors.credits = '학점을 확인해 주세요.'
  if (!SESSION_LENGTHS.some((s) => s.key === v.sessionLength)) {
    errors.sessionLength = '강의 길이를 골라 주세요.'
  }
  if (!v.displayName.trim()) errors.displayName = '표시 이름을 적어 주세요.'
  return errors
}
