/**
 * 마이크로티칭 발표 신청 — 일정과 순수 함수 (강의자 지시 2026-10-03).
 *
 * 화면(src) · 서버 함수(functions) · 검증기(scripts)가 같은 일정을 읽는다. 다른 곳에 날짜를 적지 않는다.
 *
 *   과학교육론    19명 — 11/2 · 11/9 (2명씩), 11/16 · 11/23 · 11/30 · 12/7 · 12/14 (3명씩). 1인 10분 안팎(±1~2분).
 *   과학교과교수법 14명 — 11/3 · 11/10 (3명씩), 11/17 (2명), 11/24 · 12/1 (3명씩). 1인 15~20분.
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
    // wording-ok: 발표 시간 — 강의자가 정한 마이크로티칭 길이이지 앱의 진행 시간이 아니다
    minutes: '한 사람 10분 안팎 (1~2분 넘거나 모자라도 됩니다)',
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
    // wording-ok: 발표 시간 — 강의자가 정한 마이크로티칭 길이이지 앱의 진행 시간이 아니다
    minutes: '한 사람 최소 15분, 최장 20분',
    days: [
      { date: '2026-11-03', count: 3 },
      { date: '2026-11-10', count: 3 },
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

/* ─────────────── 발표 소재 · 수업 방식 · 수업계획안 (강의자 지시 2026-10-16) ─────────────── */

/** 수업 방식 — 여러 개 고를 수 있다. 목록에 없으면 「기타」에 적는다 */
export const MT_METHODS = ['강의', '시범실험', '학생 실험', '모둠활동', '토의·토론'] as const

/**
 * 발표 소재와 방식 — 신청한 학생이 자기 자리에 적는다. 같은 반 모두가 일정표에서 본다.
 * 학년 · 단원은 교과서 보기와 같은 목록(shared/textbook.ts — 1·2학년 2022 개정, 3학년 2015 개정)에서 고른다.
 */
export interface MtDetail {
  grade: number | null
  unitId: string | null
  /** 단원 이름 — 목록이 바뀌어도 적힌 대로 보이게 함께 적는다 */
  unitTitle: string
  topic: string
  methods: string[]
  /** 기타 방식 */
  methodOther: string
  detailAt: number | null
}

export const MT_TOPIC_MAX = 60
export const MT_METHOD_OTHER_MAX = 30

/** 수업계획안 · 양식 파일 — 한글 · 워드 · PDF */
export const MT_FILE_EXTS = ['pdf', 'hwp', 'hwpx', 'docx', 'doc'] as const
export const MT_FILE_MAX_MB = 20
export const MT_FILE_ACCEPT = '.pdf,.hwp,.hwpx,.docx,.doc'

/** 파일 머리로 형식을 본다 — 이름만 믿지 않는다. pdf %PDF- · docx/hwpx 는 zip(PK\x03\x04) · hwp/doc 는 OLE(D0 CF 11 E0) */
export function mtFileKind(name: string, head: Uint8Array): (typeof MT_FILE_EXTS)[number] | null {
  const ext = (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? '').toLowerCase()
  if (!(MT_FILE_EXTS as readonly string[]).includes(ext)) return null
  const starts = (bytes: number[]) => bytes.every((b, i) => head[i] === b)
  if (ext === 'pdf') return starts([0x25, 0x50, 0x44, 0x46, 0x2d]) ? 'pdf' : null
  if (ext === 'docx' || ext === 'hwpx') return starts([0x50, 0x4b, 0x03, 0x04]) ? ext : null
  return starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) ? (ext as 'hwp' | 'doc') : null
}

export const MT_CONTENT_TYPE: Record<(typeof MT_FILE_EXTS)[number], string> = {
  pdf: 'application/pdf',
  hwp: 'application/x-hwp',
  hwpx: 'application/hwp+zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
}

/**
 * 강의용 PT(발표 슬라이드) — 파워포인트 · PDF (강의자 지시 2026-11-02).
 * 그림이 많아 지도안보다 크다. 요청 하나가 100 MB 를 넘지 못하므로 90 MB 까지.
 * Google 슬라이드 · Keynote 는 pptx 나 PDF 로 내보내 올린다.
 */
export const MT_SLIDES_EXTS = ['pptx', 'ppt', 'pdf'] as const
export const MT_SLIDES_MAX_MB = 90
export const MT_SLIDES_ACCEPT = '.pptx,.ppt,.pdf'

/** 파일 머리로 형식을 본다 — pptx 는 zip(PK\x03\x04) · ppt 는 OLE(D0 CF 11 E0) · pdf 는 %PDF- */
export function mtSlidesKind(name: string, head: Uint8Array): (typeof MT_SLIDES_EXTS)[number] | null {
  const ext = (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? '').toLowerCase()
  if (!(MT_SLIDES_EXTS as readonly string[]).includes(ext)) return null
  const starts = (bytes: number[]) => bytes.every((b, i) => head[i] === b)
  if (ext === 'pdf') return starts([0x25, 0x50, 0x44, 0x46, 0x2d]) ? 'pdf' : null
  if (ext === 'pptx') return starts([0x50, 0x4b, 0x03, 0x04]) ? 'pptx' : null
  return starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) ? 'ppt' : null
}

export const MT_SLIDES_CONTENT_TYPE: Record<(typeof MT_SLIDES_EXTS)[number], string> = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  pdf: 'application/pdf',
}

/* ─────────────── 수업 영상 · 성찰 · 교수 피드백 · 동료 의견 (강의자 지시 2026-10-17 · 2026-11-02 고침) ─────────────── */

/** 글 하나 — 성찰 · 피드백. 누가 언제 썼는지 함께 */
export interface MtNote {
  text: string
  at: number
}
export const MT_NOTE_MAX = 3000

/**
 * 신청 기록(mtApplications/{uid})에 적는 글 칸 — 화면 · 서버 · 검사가 같은 표를 읽는다 (2026-11-02).
 *   reflectionGood · reflectionBad    발표한 본인이 수업 뒤에 적는 성찰 둘
 *   feedbackGood · feedbackImprove    강사가 적는 피드백 둘
 * 영상이 없어도 쓴다 — 수업은 영상보다 먼저 끝난다.
 */
export const MT_NOTE_FIELDS = {
  reflectionGood: { by: 'student', label: '잘된 점', hint: '수업에서 계획대로 되었거나 학생의 반응이 좋았던 장면을 적으세요.' },
  reflectionBad: { by: 'student', label: '잘못된 점', hint: '계획과 달랐던 장면과 그 까닭, 다음에 바꿀 것을 적으세요.' },
  feedbackGood: { by: 'instructor', label: '잘된 점', hint: '학생이 자기 성찰과 나란히 읽습니다.' },
  feedbackImprove: { by: 'instructor', label: '개선할 점', hint: '다음 수업에서 바꿀 것 한두 가지와 그 이유를 적으세요.' },
} as const
export type MtNoteField = keyof typeof MT_NOTE_FIELDS
export const MT_REFLECTION_FIELDS = ['reflectionGood', 'reflectionBad'] as const
export const MT_FEEDBACK_FIELDS = ['feedbackGood', 'feedbackImprove'] as const
export function isMtNoteField(v: unknown): v is MtNoteField {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(MT_NOTE_FIELDS, v)
}

/** 수업 영상 — 강사가 마이크로티칭 뒤에 올린다. 본인과 강사만 본다 */
export const MT_VIDEO_EXTS = ['mp4', 'm4v', 'mov', 'webm'] as const
export const MT_VIDEO_ACCEPT = '.mp4,.m4v,.mov,.webm,video/mp4,video/quicktime,video/webm'
/** 영상 상한(MB) — 한 시간 수업 1080p 가 보통 1~2 GB 다 */
export const MT_VIDEO_MAX_MB = 4096
/** 조각 크기(MB) — Pages Functions 요청 상한(100 MB) 아래, R2 조각 최소(5 MiB) 위 */
export const MT_VIDEO_PART_MB = 48
export const MT_VIDEO_CONTENT_TYPE: Record<(typeof MT_VIDEO_EXTS)[number], string> = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' }

/** 영상 파일 머리 — mp4·m4v·mov 는 4번째 바이트부터 "ftyp", webm 은 EBML 1A 45 DF A3 */
export function mtVideoKind(name: string, head: Uint8Array): (typeof MT_VIDEO_EXTS)[number] | null {
  const ext = (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? '').toLowerCase()
  if (!(MT_VIDEO_EXTS as readonly string[]).includes(ext)) return null
  if (ext === 'webm') return head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3 ? 'webm' : null
  return head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70 ? (ext as 'mp4' | 'm4v' | 'mov') : null
}

/**
 * 동료 의견 — 다른 수강생이 수업을 보며 적는 세 칸 (2026-11-02). 발표자에게는 익명으로 보인다.
 *   good     이 수업에서 좋았던 점
 *   improve  이 수업에서 아쉬웠던 점
 *   ifMine   내가 이 수업을 한다면 — 같은 주제를 자기가 가르친다면 어떻게 풀어 가겠는가
 */
export const MT_PEER_FIELDS = {
  good: { label: '이 수업에서 좋았던 점', hint: '배울 만했던 교사의 행동과 그때 학생의 반응을 적으세요.' },
  improve: { label: '이 수업에서 아쉬웠던 점', hint: '다음에 바꾸면 좋을 장면과 그 이유를 적으세요.' },
  ifMine: { label: '내가 이 수업을 한다면', hint: '같은 주제를 내가 가르친다면 어디를 어떻게 다르게 풀어 갈지 적으세요.' },
} as const
export type MtPeerField = keyof typeof MT_PEER_FIELDS
export const MT_PEER_FIELD_KEYS = ['good', 'improve', 'ifMine'] as const
export interface MtPeerComment {
  presenterUid: string
  authorUid: string
  good: string
  improve: string
  ifMine: string
  at: number
}
export const MT_PEER_MAX = 800
