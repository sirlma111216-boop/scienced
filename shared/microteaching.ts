/**
 * 마이크로티칭 발표 신청 — 일정과 순수 함수 (강의자 지시 2026-10-03).
 *
 * 화면(src) · 서버 함수(functions) · 검증기(scripts)가 같은 일정을 읽는다. 다른 곳에 날짜를 적지 않는다.
 *
 *   과학교육론    19명 — 11/2 · 11/9 (2명씩), 11/16 · 11/23 · 11/30 · 12/7 · 12/14 (3명씩). 1인 10분 안팎(±1~2분).
 *   과학교과교수법 14명 — 10/27 · 11/3 · 11/10 · 11/17 (2명씩), 11/24 · 12/1 (3명씩). 1인 15~20분.
 *
 * 한 사람이 한 자리만 신청한다. 자기 자리는 취소하고 다른 날짜·순서로 옮길 수 있다.
 * 자리 id 는 `${날짜}_${순서}` — 2026-11-02_1 처럼. 날짜 꼴이 고정이라 갈라 읽을 수 있다.
 */
export type MtCourseId = 'method' | 'edu'

export interface MtDay {
  /** YYYY-MM-DD (한국 시각) */
  date: string
  /** 그날 발표 인원 */
  count: number
}

export interface MtCourseSchedule {
  courseId: MtCourseId
  title: string
  /** 수강 인원 — 자리 수의 합과 같아야 한다 */
  total: number
  /** 한 사람의 발표 시간 — 화면에 그대로 적는다 */
  minutes: string
  days: MtDay[]
}

export const MT_SCHEDULE: Record<MtCourseId, MtCourseSchedule> = {
  edu: {
    courseId: 'edu',
    title: '과학교육론',
    total: 19,
    minutes: '한 사람 10분 안팎 (1~2분 넘거나 모자라도 된다)',
    days: [
      { date: '2026-11-02', count: 2 },
      { date: '2026-11-09', count: 2 },
      { date: '2026-11-16', count: 3 },
      { date: '2026-11-23', count: 3 },
      { date: '2026-11-30', count: 3 },
      { date: '2026-12-07', count: 3 },
      { date: '2026-12-14', count: 3 },
    ],
  },
  method: {
    courseId: 'method',
    title: '과학교과교수법',
    total: 14,
    minutes: '한 사람 최소 15분, 최장 20분',
    days: [
      { date: '2026-10-27', count: 2 },
      { date: '2026-11-03', count: 2 },
      { date: '2026-11-10', count: 2 },
      { date: '2026-11-17', count: 2 },
      { date: '2026-11-24', count: 3 },
      { date: '2026-12-01', count: 3 },
    ],
  },
}

export const MT_ORDER_LABEL = ['첫 번째 발표', '두 번째 발표', '세 번째 발표', '네 번째 발표']

export interface MtSlotRef {
  slotId: string
  date: string
  /** 1부터 */
  order: number
}

export function mtSlotId(date: string, order: number): string {
  return `${date}_${order}`
}

/** 과목의 자리 전부 — 날짜 순, 순서 순 */
export function mtSlots(courseId: MtCourseId): MtSlotRef[] {
  return MT_SCHEDULE[courseId].days.flatMap((d) => Array.from({ length: d.count }, (_, i) => ({ slotId: mtSlotId(d.date, i + 1), date: d.date, order: i + 1 })))
}

export function isMtSlot(courseId: MtCourseId, slotId: string): boolean {
  return mtSlots(courseId).some((s) => s.slotId === slotId)
}

/**
 * 학생에게 열렸는가. 강사가 정한 때(`microteachingOpenAt`, ms)가 없으면 닫혀 있다.
 *   closed     때를 정하지 않았다 — 학생에게는 아예 없는 화면이다
 *   scheduled  때는 정했지만 아직이다 — 학생에게 「언제 열린다」만 보인다
 *   open       열렸다
 */
export function mtOpenState(openAt: number | null | undefined, now: number): 'closed' | 'scheduled' | 'open' {
  if (typeof openAt !== 'number' || !Number.isFinite(openAt)) return 'closed'
  return now >= openAt ? 'open' : 'scheduled'
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** 「11월 2일 (월)」 — 날짜는 한국 시각으로 읽는다 */
export function mtDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${m}월 ${d}일 (${WEEKDAY[day]})`
}

/** 자리 수의 합이 수강 인원과 같은가 — 검증기가 본다 */
export function mtScheduleProblems(): string[] {
  const out: string[] = []
  for (const s of Object.values(MT_SCHEDULE)) {
    const sum = s.days.reduce((a, d) => a + d.count, 0)
    if (sum !== s.total) out.push(`${s.title}: 자리 ${sum} ≠ 인원 ${s.total}`)
    const dates = s.days.map((d) => d.date)
    if (new Set(dates).size !== dates.length) out.push(`${s.title}: 같은 날짜가 두 번`)
    if ([...dates].sort().join() !== dates.join()) out.push(`${s.title}: 날짜가 순서대로가 아니다`)
    for (const d of s.days) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) out.push(`${s.title}: 날짜 꼴 ${d.date}`)
      if (d.count < 1 || d.count > MT_ORDER_LABEL.length) out.push(`${s.title}: ${d.date} 인원 ${d.count}`)
    }
  }
  return out
}
